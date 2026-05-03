import { assertSupabaseReady } from "../supabase-config.js";

const TEST_COLUMNS = "*";
const QUESTION_COLUMNS = "*";
const QUESTION_STATE_COLUMNS = "question_id,test_id,selected_answer,confidence,note,highlight_text,saved_folders,review_tags,question_type_tags,review_difficulty,is_incorrect_last_attempt,marked_tough,marked_must_revise,attempts_history,spaced_revision,updated_at";
const TEST_ATTEMPT_COLUMNS = "attempt_payload,submitted_at";
const USER_SETTINGS_COLUMNS = "user_id,full_name,display_name,deck_intervals,permissions,custom_tags,folders,updated_at";
const USER_NOTES_COLUMNS = "id,user_id,subject,title,content,items,highlights,created_at,updated_at";

function isMissingRelationError(error) {
    const text = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
    return text.includes("could not find the table")
        || text.includes("relation")
        || text.includes("schema cache")
        || text.includes("does not exist");
}

function normalizeTableRow(row) {
    if (Array.isArray(row)) {
        return row.reduce((acc, cell, index) => {
            acc[`c${index + 1}`] = cell;
            return acc;
        }, {});
    }

    if (!row || typeof row !== "object") {
        return { c1: row };
    }

    if (Array.isArray(row.cells)) {
        return row.cells.reduce((acc, cell, index) => {
            acc[`c${index + 1}`] = cell;
            return acc;
        }, {});
    }

    return row;
}

function normalizeQuestionBlock(block) {
    if (!block || typeof block !== "object") return block;

    if (block.type === "text") {
        const text = Array.isArray(block.lines)
            ? block.lines.join("\n")
            : String(block.text ?? "");
        return {
            type: "text",
            text
        };
    }

    if (block.type === "table") {
        return {
            type: "table",
            caption: block.caption ?? "",
            headers: Array.isArray(block.headers) ? block.headers.map((header) => String(header)) : [],
            rows: Array.isArray(block.rows) ? block.rows.map(normalizeTableRow) : []
        };
    }

    return block;
}

function normalizeQuestion(question) {
    if (!question || typeof question !== "object") return question;

    const nextQuestion = { ...question };
    const nextSource = nextQuestion.source && typeof nextQuestion.source === "object"
        ? { ...nextQuestion.source }
        : {};

    if (!nextSource.sourceText && typeof nextSource.source_text === "string") {
        nextSource.sourceText = nextSource.source_text;
    }
    if (!nextSource.examName && typeof nextSource.exam_name === "string") {
        nextSource.examName = nextSource.exam_name;
    }

    const persistedMeta = nextSource.__vaultMeta && typeof nextSource.__vaultMeta === "object"
        ? nextSource.__vaultMeta
        : {};

    nextQuestion.source = nextSource;
    if (persistedMeta.canonicalId && !nextQuestion.canonicalId) nextQuestion.canonicalId = persistedMeta.canonicalId;
    if (persistedMeta.isCanonical != null && nextQuestion.isCanonical == null) nextQuestion.isCanonical = Boolean(persistedMeta.isCanonical);
    if (persistedMeta.isVirtual != null && nextQuestion.isVirtual == null) nextQuestion.isVirtual = Boolean(persistedMeta.isVirtual);
    if (persistedMeta._canonicalQuestionId && !nextQuestion._canonicalQuestionId) nextQuestion._canonicalQuestionId = persistedMeta._canonicalQuestionId;
    if (persistedMeta._provider && !nextQuestion._provider) nextQuestion._provider = persistedMeta._provider;
    if (Array.isArray(persistedMeta.appearsInProviders) && !Array.isArray(nextQuestion.appearsInProviders)) nextQuestion.appearsInProviders = persistedMeta.appearsInProviders;
    if (Array.isArray(persistedMeta.providerReferences) && !Array.isArray(nextQuestion.providerReferences)) nextQuestion.providerReferences = persistedMeta.providerReferences;
    if (Array.isArray(persistedMeta.mergedFrom) && !Array.isArray(nextQuestion.mergedFrom)) nextQuestion.mergedFrom = persistedMeta.mergedFrom;
    if (Array.isArray(persistedMeta.mergedFromTests) && !Array.isArray(nextQuestion.mergedFromTests)) nextQuestion.mergedFromTests = persistedMeta.mergedFromTests;
    if (persistedMeta.mergedAt && !nextQuestion.mergedAt) nextQuestion.mergedAt = persistedMeta.mergedAt;
    if (persistedMeta.mergeMode && !nextQuestion.mergeMode) nextQuestion.mergeMode = persistedMeta.mergeMode;
    if (persistedMeta.selectedSource && !nextQuestion.selectedSource) nextQuestion.selectedSource = persistedMeta.selectedSource;
    if (Array.isArray(persistedMeta.explanations) && !Array.isArray(nextQuestion.explanations)) nextQuestion.explanations = persistedMeta.explanations;
    if (persistedMeta.pyqMeta && !nextQuestion.pyqMeta) nextQuestion.pyqMeta = persistedMeta.pyqMeta;
    if (persistedMeta.is_allied != null && nextQuestion.is_allied == null) nextQuestion.is_allied = Boolean(persistedMeta.is_allied);
    if (persistedMeta.is_others != null && nextQuestion.is_others == null) nextQuestion.is_others = Boolean(persistedMeta.is_others);
    if (persistedMeta.exam_info && !nextQuestion.exam_info) nextQuestion.exam_info = persistedMeta.exam_info;
    if (Array.isArray(persistedMeta.mergedExplanations) && persistedMeta.mergedExplanations.length && !Array.isArray(nextQuestion.mergedExplanations)) {
        nextQuestion.mergedExplanations = persistedMeta.mergedExplanations;
    }

    // Rebuild multi-source explanations when only mergedExplanations survived round-trip (common for canonical merges).
    const merged = Array.isArray(nextQuestion.mergedExplanations) ? nextQuestion.mergedExplanations : [];
    if (merged.length > 1 && (!Array.isArray(nextQuestion.explanations) || nextQuestion.explanations.length <= 1)) {
        nextQuestion.explanations = merged
            .map((entry) => ({
                source: entry?.provider || entry?.source || "",
                markdown: entry?.markdown || "",
                isPreferred: String(entry?.provider || entry?.source || "") === String(nextQuestion.selectedSource || "")
            }))
            .filter((item) => item.source || item.markdown);
        if (nextQuestion.explanations.length && !nextQuestion.explanations.some((e) => e.isPreferred)) {
            const pref = nextQuestion.explanations.find((e) => e.source === nextQuestion.selectedSource) || nextQuestion.explanations[0];
            if (pref) pref.isPreferred = true;
        }
    }

    if (Array.isArray(nextQuestion.explanations) && nextQuestion.explanations.length) {
        nextQuestion.availableSources = nextQuestion.explanations.map((item) => item.source).filter(Boolean);
        nextQuestion.selectedSource = nextQuestion.selectedSource || nextQuestion.explanations.find((item) => item.isPreferred)?.source || nextQuestion.explanations[0]?.source || "";
        const selectedExplanation = nextQuestion.explanations.find((item) => item.source === nextQuestion.selectedSource) || nextQuestion.explanations[0];
        nextQuestion.explanationMarkdown = selectedExplanation?.markdown || nextQuestion.explanationMarkdown || "";
    }

    const sourceText = String(nextQuestion.source?.sourceText || "").trim();
    nextQuestion.isPyq = Boolean(nextQuestion.isCanonical || nextQuestion.isVirtual || nextQuestion.isPyq);

    if (Array.isArray(nextQuestion.questionBlocks)) {
        nextQuestion.questionBlocks = nextQuestion.questionBlocks.map(normalizeQuestionBlock);
    }

    if (nextQuestion.questionTable && typeof nextQuestion.questionTable === "object") {
        nextQuestion.questionTable = normalizeQuestionBlock({
            type: "table",
            ...nextQuestion.questionTable
        });
    }

    return nextQuestion;
}

function normalizeTest(test) {
    if (!test || typeof test !== "object") return test;

    return {
        ...test,
        provider: test.provider ?? null,
        institute: test.institute ?? test.provider ?? null,
        program_id: test.program_id ?? test.programId ?? test.program ?? null,
        program_name: test.program_name ?? test.programName ?? null,
        launch_year: Number.isFinite(Number(test.launch_year)) ? Number(test.launch_year) : null,
        subject_test: test.subject_test ?? null,
        sectionGroup: test.sectionGroup ?? null,
        questionCount: Array.isArray(test.questions) ? test.questions.length : Number(test.questionCount || 0),
        questions: Array.isArray(test.questions) ? test.questions.map(normalizeQuestion) : []
    };
}

/** `test_attempts.score` is numeric in Postgres; `computeScore()` stores a rich object on the attempt. */
function toDbNumericScore(score) {
    if (score == null) return null;
    if (typeof score === "number" && Number.isFinite(score)) return score;
    if (typeof score === "object" && score !== null && Number.isFinite(Number(score.totalMarks))) {
        return Number(score.totalMarks);
    }
    return null;
}

function normalizeAttempt(attempt) {
    if (!attempt || typeof attempt !== "object") return attempt;

    return {
        ...attempt,
        questions: Array.isArray(attempt.questions) ? attempt.questions.map(normalizeQuestion) : []
    };
}

function buildAttemptId(testId, submittedAt) {
    return `${testId}__${submittedAt}`;
}

function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
}

function chunk(array, size = 200) {
    const result = [];
    for (let index = 0; index < array.length; index += size) {
        result.push(array.slice(index, index + size));
    }
    return result;
}

function readGlobalQuestionCache() {
    try {
        const cacheKey = "upscVault_allQuestions";
        const cached = localStorage.getItem(cacheKey);
        if (!cached) return [];
        const parsed = JSON.parse(cached);
        return Array.isArray(parsed?.questions) ? parsed.questions : [];
    } catch {
        return [];
    }
}

function writeGlobalQuestionCache(questions) {
    try {
        const cacheKey = "upscVault_allQuestions";
        const payload = JSON.stringify({
            questions,
            timestamp: Date.now()
        });
        // Check approximate size before writing to avoid QuotaExceededError
        const sizeMB = payload.length / (1024 * 1024);
        if (sizeMB > 4) {
            console.warn(`[Cache] Payload too large (${sizeMB.toFixed(1)}MB), skipping localStorage cache.`);
            try { localStorage.removeItem(cacheKey); } catch {}
            return;
        }
        localStorage.setItem(cacheKey, payload);
    } catch (error) {
        const errStr = String(error).toLowerCase();
        if (error?.name === "QuotaExceededError" || errStr.includes("quota") || errStr.includes("exceed")) {
            console.warn("[Cache] localStorage quota exceeded — clearing question cache to prevent stale reads.");
            try { localStorage.removeItem("upscVault_allQuestions"); } catch {}
        } else {
            console.warn("Failed to write global question cache:", error);
            // Default safe-fail mode: just drop the cache rather than risking stale data
            try { localStorage.removeItem("upscVault_allQuestions"); } catch {}
        }
    }
}

function replaceGlobalQuestionCacheRowsForTest(testId, rows) {
    if (!testId) return;
    const incoming = Array.isArray(rows) ? rows : [];
    const incomingIds = new Set(incoming.map((row) => row?.id).filter(Boolean));

    const existing = readGlobalQuestionCache();
    const kept = existing.filter((row) => {
        if (!row) return false;
        if (row.test_id === testId) return false;
        if (incomingIds.size && incomingIds.has(row.id)) return false;
        return true;
    });

    const merged = [...kept, ...incoming];
    // If the merged payload would be too large, just clear the cache entirely.
    // The app will fetch fresh data from Supabase on next load.
    try {
        const estimatedSize = JSON.stringify(merged).length;
        if (estimatedSize > 4 * 1024 * 1024) {
            console.warn(`[Cache] Merged cache too large (~${(estimatedSize / 1024 / 1024).toFixed(1)}MB), clearing instead.`);
            try { localStorage.removeItem("upscVault_allQuestions"); } catch {}
            return;
        }
    } catch {
        // JSON.stringify failed — too large
        try { localStorage.removeItem("upscVault_allQuestions"); } catch {}
        return;
    }
    writeGlobalQuestionCache(merged);
}

function mapQuestionRowToQuestion(row) {
    const source = row.source && typeof row.source === "object"
        ? { ...row.source }
        : {};
    if (!source.sourceText && typeof source.source_text === "string") {
        source.sourceText = source.source_text;
    }
    if (!source.examName && typeof source.exam_name === "string") {
        source.examName = source.exam_name;
    }
    const meta = source.__vaultMeta && typeof source.__vaultMeta === "object" ? source.__vaultMeta : {};
    const explanations = Array.isArray(meta.explanations) ? meta.explanations : [];
    const availableSources = explanations.map((item) => item.source).filter(Boolean);
    const selectedSource = meta.selectedSource || explanations.find((item) => item.isPreferred)?.source || availableSources[0] || "";
    const selectedExplanation = explanations.find((item) => item.source === selectedSource) || explanations[0];
    const examInfo = (meta.exam_info && typeof meta.exam_info === "object")
        ? meta.exam_info
        : ((source.exam_info && typeof source.exam_info === "object") ? source.exam_info : {});
    const isAllied = meta.is_allied != null
        ? Boolean(meta.is_allied)
        : (source.is_allied != null ? Boolean(source.is_allied) : false);
    const isOthers = meta.is_others != null
        ? Boolean(meta.is_others)
        : (source.is_others != null ? Boolean(source.is_others) : false);

    return {
        id: row.id,
        questionNumber: row.question_number,
        questionText: row.question_text,
        statementLines: Array.isArray(row.statement_lines) ? row.statement_lines : [],
        questionBlocks: Array.isArray(row.question_blocks) ? row.question_blocks : [],
        options: row.options || {},
        correctAnswer: row.correct_answer,
        explanationMarkdown: selectedExplanation?.markdown || row.explanation_markdown || "",
        source,
        subject: row.subject,
        sectionGroup: row.section_group,
        microTopic: row.micro_topic,
        source_attribution_label: row.source_attribution_label || source.source_attribution_label || "",
        isPyq: Boolean(meta.isCanonical || meta.isVirtual || meta.isPyq || source.sourceText),
        is_allied: isAllied,
        is_others: isOthers,
        exam_info: examInfo,
        pyqMeta: meta.pyqMeta || null,
        canonicalId: meta.canonicalId || null,
        isCanonical: Boolean(meta.isCanonical),
        isVirtual: Boolean(meta.isVirtual),
        _canonicalQuestionId: meta._canonicalQuestionId || null,
        _provider: meta._provider || "",
        explanations,
        availableSources,
        selectedSource,
        appearsInProviders: Array.isArray(meta.appearsInProviders) ? meta.appearsInProviders : [],
        providerReferences: Array.isArray(meta.providerReferences) ? meta.providerReferences : [],
        mergedFrom: Array.isArray(meta.mergedFrom) ? meta.mergedFrom : [],
        mergedFromTests: Array.isArray(meta.mergedFromTests) ? meta.mergedFromTests : [],
        mergedAt: meta.mergedAt || null,
        mergeMode: meta.mergeMode || "",
        ...(row.is_ncert !== undefined && row.is_ncert !== null
            ? { is_ncert: row.is_ncert === true, isNcert: row.is_ncert === true }
            : {}),
        ...(row.is_pyq !== undefined ? { is_pyq: row.is_pyq === true } : {}),
        ...(row.is_allied !== undefined ? { is_allied: row.is_allied === true } : {}),
        ...(row.is_others !== undefined ? { is_others: row.is_others === true } : {})
    };
}

function mapSettingsRow(row) {
    if (!row) return null;
    return {
        userId: row.user_id,
        profile: {
            fullName: row.full_name || "",
            displayName: row.display_name || ""
        },
        deckIntervals: row.deck_intervals || { again: 0, hard: 1, good: 3, easy: 7 },
        permissions: row.permissions || {
            accessPdf: true,
            accessNotes: true,
            accessFlashcards: true,
            accessTags: true,
            isAdmin: false
        },
        customTags: Array.isArray(row.custom_tags) ? row.custom_tags : [],
        customFolders: Array.isArray(row.folders) ? row.folders : []
    };
}

async function runSelect(queryBuilder) {
    const { data, error } = await queryBuilder;
    if (error) throw error;
    return data;
}

async function fetchAllRows(buildQuery, pageSize = 1000) {
    const rows = [];
    let from = 0;

    while (true) {
        const batch = await runSelect(buildQuery(from, from + pageSize - 1));
        rows.push(...batch);
        if (batch.length < pageSize) break;
        from += pageSize;
    }

    return rows;
}

export async function savePublicTest(test) {
    return saveFullTest(test);
}

export async function saveFullTest(test) {
    const client = assertSupabaseReady();
    const nextTest = normalizeTest(test);
    const timestamp = new Date().toISOString();
    const metadataRow = {
        id: nextTest.id,
        title: nextTest.title,
        provider: nextTest.provider ?? null,
        institute: nextTest.institute ?? null,
        program_id: nextTest.program_id ?? null,
        program_name: nextTest.program_name ?? null,
        launch_year: nextTest.launch_year ?? null,
        series: nextTest.series ?? null,
        level: nextTest.level ?? null,
        year: Number.isFinite(Number(nextTest.year)) ? Number(nextTest.year) : null,
        subject: nextTest.subject ?? null,
        subject_test: nextTest.subject_test ?? null,
        section_group: nextTest.sectionGroup ?? null,
        paper_type: nextTest.paperType ?? null,
        question_count: nextTest.questionCount ?? 0,
        default_minutes: nextTest.defaultMinutes ?? null,
        source_mode: nextTest.sourceMode ?? null,
        is_demo_available: Boolean(nextTest.isDemoAvailable),
        updated_at: timestamp
    };

    const { error: testError } = await client
        .from("tests")
        .upsert(metadataRow, { onConflict: "id" });
    if (testError) throw testError;

    const { error: deleteError } = await client
        .from("questions")
        .delete()
        .eq("test_id", nextTest.id);
    if (deleteError) throw deleteError;

    const questionRows = nextTest.questions.map((question) => {
        const nextQuestion = normalizeQuestion(question);
        const source = nextQuestion.source && typeof nextQuestion.source === "object"
            ? { ...nextQuestion.source }
            : {};
        const examInfo = (nextQuestion.exam_info && typeof nextQuestion.exam_info === "object")
            ? nextQuestion.exam_info
            : ((source.exam_info && typeof source.exam_info === "object") ? source.exam_info : {});
        const explanations = Array.isArray(nextQuestion.explanations)
            ? nextQuestion.explanations
                .map((item) => ({
                    source: item?.source || "",
                    markdown: item?.markdown || "",
                    isPreferred: Boolean(item?.isPreferred)
                }))
                .filter((item) => item.source || item.markdown)
            : [];
        const mergedExplanationsForVault = (() => {
            if (Array.isArray(nextQuestion.mergedExplanations) && nextQuestion.mergedExplanations.length) {
                return nextQuestion.mergedExplanations
                    .map((entry) => ({
                        provider: entry?.provider || entry?.source || "Unknown",
                        markdown: entry?.markdown || "",
                        length: typeof entry?.length === "number"
                            ? entry.length
                            : String(entry?.markdown || "").length
                    }))
                    .filter((e) => e.provider || e.markdown);
            }
            if (explanations.length > 1) {
                return explanations.map((entry) => ({
                    provider: entry.source || "Unknown",
                    markdown: entry.markdown || "",
                    length: String(entry.markdown || "").length
                }));
            }
            return [];
        })();
        const vaultMeta = {
            isPyq: Boolean(nextQuestion.isCanonical || nextQuestion.isVirtual || nextQuestion.isPyq || source.sourceText),
            is_allied: nextQuestion.is_allied != null
                ? Boolean(nextQuestion.is_allied)
                : (source.is_allied != null ? Boolean(source.is_allied) : false),
            is_others: nextQuestion.is_others != null
                ? Boolean(nextQuestion.is_others)
                : (source.is_others != null ? Boolean(source.is_others) : false),
            exam_info: (nextQuestion.exam_info && typeof nextQuestion.exam_info === "object")
                ? nextQuestion.exam_info
                : ((source.exam_info && typeof source.exam_info === "object") ? source.exam_info : null),
            pyqMeta: nextQuestion.pyqMeta || null,
            canonicalId: nextQuestion.canonicalId || null,
            isCanonical: Boolean(nextQuestion.isCanonical),
            isVirtual: Boolean(nextQuestion.isVirtual),
            _canonicalQuestionId: nextQuestion._canonicalQuestionId || null,
            _provider: nextQuestion._provider || "",
            appearsInProviders: Array.isArray(nextQuestion.appearsInProviders) ? nextQuestion.appearsInProviders : [],
            providerReferences: Array.isArray(nextQuestion.providerReferences) ? nextQuestion.providerReferences : [],
            explanations,
            selectedSource: nextQuestion.selectedSource || explanations.find((item) => item.isPreferred)?.source || explanations[0]?.source || "",
            mergedFrom: Array.isArray(nextQuestion.mergedFrom) ? nextQuestion.mergedFrom : [],
            mergedFromTests: Array.isArray(nextQuestion.mergedFromTests) ? nextQuestion.mergedFromTests : [],
            mergedAt: nextQuestion.mergedAt || null,
            mergeMode: nextQuestion.mergeMode || "",
            mergedExplanations: mergedExplanationsForVault
        };
        source.__vaultMeta = vaultMeta;
        const selectedExplanation = explanations.find((item) => item.source === vaultMeta.selectedSource) || explanations[0];
        return {
            id: nextQuestion.id,
            test_id: nextTest.id,
            question_number: nextQuestion.questionNumber ?? null,
            question_text: nextQuestion.questionText ?? "",
            statement_lines: Array.isArray(nextQuestion.statementLines) ? nextQuestion.statementLines : [],
            question_blocks: Array.isArray(nextQuestion.questionBlocks) ? nextQuestion.questionBlocks : [],
            options: nextQuestion.options || {},
            correct_answer: nextQuestion.correctAnswer ?? null,
            explanation_markdown: selectedExplanation?.markdown || (nextQuestion.explanationMarkdown ?? ""),
            source_attribution_label: nextQuestion.source_attribution_label ?? source.source_attribution_label ?? null,
            source,
            subject: nextQuestion.subject ?? null,
            section_group: nextQuestion.sectionGroup ?? nextTest.sectionGroup ?? null,
            micro_topic: nextQuestion.microTopic ?? null,
            is_pyq: examInfo.isPyq != null ? Boolean(examInfo.isPyq) : Boolean(nextQuestion.isPyq),
            is_ncert: examInfo.is_ncert != null ? Boolean(examInfo.is_ncert) : Boolean(nextQuestion.is_ncert),
            is_upsc_cse: examInfo.is_upsc_cse != null ? Boolean(examInfo.is_upsc_cse) : Boolean(nextQuestion.is_upsc_cse),
            is_allied: examInfo.is_allied != null ? Boolean(examInfo.is_allied) : Boolean(nextQuestion.is_allied),
            is_others: examInfo.is_others != null ? Boolean(examInfo.is_others) : Boolean(nextQuestion.is_others),
            exam: examInfo.exam ?? null,
            exam_group: examInfo.group ?? null,
            exam_year: Number.isFinite(Number(examInfo.year)) ? Number(examInfo.year) : null,
            exam_category: examInfo.exam_category ?? null,
            specific_exam: examInfo.specific_exam ?? null,
            exam_stage: examInfo.stage ?? null,
            exam_paper: examInfo.paper ?? null,
            updated_at: timestamp
        };
    });

    for (const batch of chunk(questionRows)) {
        if (!batch.length) continue;
        const { error: questionError } = await client
            .from("questions")
            .upsert(batch, { onConflict: "id" });
        if (questionError) throw questionError;
    }
    
    // Keep the global question cache consistent with what we just wrote for this test.
    // Blindly deleting the entire cache causes other tests to "stick" to stale rows
    // while still satisfying the per-test-id presence check in getCachedQuestionsAndMissingTests().
    try {
        replaceGlobalQuestionCacheRowsForTest(nextTest.id, questionRows);
        console.log(`Cache reconciled after successful save of test: ${nextTest.id}`);
    } catch (e) {
        console.warn("Failed to reconcile local question cache:", e);
    }
}

export async function loadPublicTests(includeQuestions = false) {
    const client = assertSupabaseReady();
    const tests = await fetchAllRows((from, to) =>
        client
            .from("tests")
            .select(TEST_COLUMNS)
            .order("institute", { ascending: true })
            .order("subject", { ascending: true })
            .order("title", { ascending: true })
            .range(from, to)
    );
    pruneQuestionCacheByValidTestIds(tests.map((row) => row.id).filter(Boolean));
    if (!includeQuestions) {
        return tests.map((row) => ({
            id: row.id,
            title: row.title,
            provider: row.provider ?? row.institute ?? null,
            institute: row.institute ?? row.provider ?? null,
            program_id: row.program_id ?? null,
            program_name: row.program_name ?? null,
            launch_year: row.launch_year ?? null,
            series: row.series,
            level: row.level,
            year: row.year,
            subject: row.subject,
            subject_test: row.subject_test ?? null,
            sectionGroup: row.section_group,
            paperType: row.paper_type,
            questionCount: row.question_count,
            defaultMinutes: row.default_minutes,
            sourceMode: row.source_mode,
            isDemoAvailable: row.is_demo_available,
            questions: []
        })).filter((item) => item?.id);
    }

    const questions = await loadQuestionsForTests(tests.map((row) => row.id));

    const questionsByTestId = questions.reduce((acc, row) => {
        const current = acc.get(row.test_id) || [];
        current.push(mapQuestionRowToQuestion(row));
        acc.set(row.test_id, current);
        return acc;
    }, new Map());

    return tests.map((row) => ({
        id: row.id,
        title: row.title,
        provider: row.provider ?? row.institute ?? null,
        institute: row.institute ?? row.provider ?? null,
        program_id: row.program_id ?? null,
        program_name: row.program_name ?? null,
        launch_year: row.launch_year ?? null,
        series: row.series,
        level: row.level,
        year: row.year,
        subject: row.subject,
        subject_test: row.subject_test ?? null,
        sectionGroup: row.section_group,
        paperType: row.paper_type,
        questionCount: row.question_count,
        defaultMinutes: row.default_minutes,
        sourceMode: row.source_mode,
        isDemoAvailable: row.is_demo_available,
        questions: questionsByTestId.get(row.id) || []
    })).filter((item) => item?.id);
}

export async function loadQuestionsForTests(testIds = [], onProgress = null) {
    const client = assertSupabaseReady();
    const uniqueIds = [...new Set((testIds || []).filter(Boolean))];
    if (!uniqueIds.length) return [];

    console.log(`loadQuestionsForTests called for ${uniqueIds.length} test IDs:`, uniqueIds);
    
    // Check cache first, then fetch only missing tests from server
    const { cachedQuestions, missingTestIds } = getCachedQuestionsAndMissingTests(uniqueIds);
    if (!missingTestIds.length) {
        console.log(`✅ SUCCESS: Loaded ${cachedQuestions.length} questions from cache for all requested tests`);
        return cachedQuestions;
    }
    
    console.log(`[Cache+Server] ${cachedQuestions.length} cached rows, fetching ${missingTestIds.length}/${uniqueIds.length} tests from server...`);

    if (missingTestIds.length > 25) {
        const questions = await fetchAllRows((from, to) =>
            client
                .from("questions")
                .select(QUESTION_COLUMNS)
                .in("test_id", missingTestIds)
                .order("test_id", { ascending: true })
                .order("question_number", { ascending: true })
                .range(from, to)
        );
        const mergedRows = [...cachedQuestions, ...questions];
        cacheQuestions(mergedRows);
        return mergedRows;
    }

    const rows = [...cachedQuestions];
    let processedCount = 0;
    const totalCount = missingTestIds.length;
    
    for (const batchIds of chunk(missingTestIds, 8)) {
        const batchRows = await fetchAllRows((from, to) =>
            client
                .from("questions")
                .select(QUESTION_COLUMNS)
                .in("test_id", batchIds)
                .order("test_id", { ascending: true })
                .order("question_number", { ascending: true })
                .range(from, to)
        );
        rows.push(...batchRows);
        processedCount += batchIds.length;
        
        // Report progress
        if (onProgress) {
            onProgress(processedCount, totalCount);
        }
    }

    // Cache the results
    cacheQuestions(rows);
    return rows;
}

// Helper functions for question caching
function getCachedQuestionsAndMissingTests(testIds) {
    const uniqueIds = [...new Set((testIds || []).filter(Boolean))];
    try {
        // Use a global cache key for all questions to avoid key mismatches
        const cacheKey = 'upscVault_allQuestions';
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const { questions, timestamp } = JSON.parse(cached);
            const cacheAge = Date.now() - timestamp;
            // Use cache if it's less than 24 hours old
            if (cacheAge < 24 * 60 * 60 * 1000) {
                // Filter cached questions to only return requested test IDs
                const filteredQuestions = questions.filter(q => uniqueIds.includes(q.test_id));
                const cachedTestIds = new Set(filteredQuestions.map((q) => q.test_id).filter(Boolean));
                const missingTestIds = uniqueIds.filter((id) => !cachedTestIds.has(id));
                console.log(`Loaded ${filteredQuestions.length} questions from cache for ${cachedTestIds.size}/${uniqueIds.length} tests`);
                return { cachedQuestions: filteredQuestions, missingTestIds };
            }
        }
    } catch (error) {
        console.error('Error reading question cache:', error);
    }
    return { cachedQuestions: [], missingTestIds: uniqueIds };
}

function cacheQuestions(questions) {
    try {
        // Use a global cache key for all questions
        const cacheKey = 'upscVault_allQuestions';
        const payload = JSON.stringify({
            questions,
            timestamp: Date.now()
        });
        const sizeMB = payload.length / (1024 * 1024);
        if (sizeMB > 4) {
            console.warn(`[Cache] Question cache too large (${sizeMB.toFixed(1)}MB), skipping localStorage. Will use IndexedDB / Supabase on next load.`);
            try { localStorage.removeItem(cacheKey); } catch {}
            return;
        }
        localStorage.setItem(cacheKey, payload);
        console.log(`Cached ${questions.length} questions globally (${sizeMB.toFixed(1)}MB)`);
    } catch (error) {
        const errStr = String(error).toLowerCase();
        if (error?.name === "QuotaExceededError" || errStr.includes("quota") || errStr.includes("exceed")) {
            console.warn("[Cache] localStorage quota exceeded — clearing stale cache.");
            try { localStorage.removeItem('upscVault_allQuestions'); } catch {}
        } else {
            console.error('Error caching questions:', error);
            try { localStorage.removeItem('upscVault_allQuestions'); } catch {}
        }
    }
}

function pruneQuestionCacheByValidTestIds(validTestIds = []) {
    try {
        const validSet = new Set((validTestIds || []).filter(Boolean));
        const cacheKey = 'upscVault_allQuestions';
        const cached = localStorage.getItem(cacheKey);
        if (!cached) return;
        const parsed = JSON.parse(cached);
        const allQuestions = Array.isArray(parsed?.questions) ? parsed.questions : [];
        const filteredQuestions = allQuestions.filter((row) => validSet.has(row?.test_id));
        if (filteredQuestions.length === allQuestions.length) return;
        localStorage.setItem(cacheKey, JSON.stringify({
            questions: filteredQuestions,
            timestamp: Date.now()
        }));
        console.log(`[Cache Cleanup] Removed ${allQuestions.length - filteredQuestions.length} stale cached question rows`);
    } catch (error) {
        console.error('Error pruning question cache:', error);
    }
}

export async function deletePublicTest(testId) {
    const client = assertSupabaseReady();
    const { error } = await client
        .from("tests")
        .delete()
        .eq("id", testId);
    if (error) throw error;
}

export async function loadAllUserAttempts(uid) {
    const client = assertSupabaseReady();
    const { data, error } = await client
        .from("test_attempts")
        .select(TEST_ATTEMPT_COLUMNS)
        .eq("user_id", uid)
        .order("submitted_at", { ascending: false });
    if (error) throw error;
    return (data || []).map((row) => normalizeAttempt(row.attempt_payload));
}

export async function saveAttemptAndStates(uid, attempt) {
    const client = assertSupabaseReady();
    const nextAttempt = normalizeAttempt(attempt);
    const submittedAt = nextAttempt.submittedAt || new Date().toISOString();
    const attemptId = buildAttemptId(nextAttempt.testId, submittedAt);

    // First, ensure the test exists in the tests table to satisfy foreign key constraint
    // This is needed when syncing local attempts that might reference tests not yet in Supabase
    const { error: testError } = await client
        .from("tests")
        .upsert({
            id: nextAttempt.testId,
            title: nextAttempt.title ?? "Untitled Test",
            provider: nextAttempt.provider ?? null,
            subject: nextAttempt.subject ?? null,
            updated_at: submittedAt
        }, { onConflict: "id" });
    if (testError) {
        console.warn("Failed to upsert test metadata:", testError);
        // Continue anyway - the test might already exist or error will be caught later
    }

    const { error: attemptError } = await client
        .from("test_attempts")
        .upsert({
            id: attemptId,
            user_id: uid,
            test_id: nextAttempt.testId,
            title: nextAttempt.title ?? null,
            provider: nextAttempt.provider ?? null,
            subject: nextAttempt.subject ?? null,
            explanation_mode: nextAttempt.explanationMode ?? null,
            timer_mode: nextAttempt.timerMode ?? null,
            timer_minutes: nextAttempt.timerMinutes ?? null,
            started_at: nextAttempt.startedAt ?? null,
            submitted_at: submittedAt,
            score: toDbNumericScore(nextAttempt.score),
            attempt_payload: nextAttempt
        }, { onConflict: "id" });
    if (attemptError) throw attemptError;

    const stateRows = nextAttempt.questions.map((question) => {
        const prevHistory = Array.isArray(question.attemptsHistory) ? question.attemptsHistory : [];
        const reviewTags = Array.isArray(question.reviewTags) ? question.reviewTags : [];
        const nextHistory = [
            {
                submittedAt,
                selectedAnswer: question.selectedAnswer,
                confidence: question.confidence,
                wasCorrect: question.selectedAnswer ? question.selectedAnswer === question.correctAnswer : false
            },
            ...prevHistory
        ].slice(0, 2);

        return {
            user_id: uid,
            question_id: question.id,
            test_id: nextAttempt.testId,
            selected_answer: question.selectedAnswer ?? null,
            confidence: question.confidence ?? null,
            note: question.note || "",
            highlight_text: question.highlightText || "",
            saved_folders: question.savedFolders || [],
            review_tags: reviewTags,
            question_type_tags: question.questionTypeTags || [],
            review_difficulty: question.reviewDifficulty ?? null,
            is_incorrect_last_attempt: !!question.selectedAnswer && question.selectedAnswer !== question.correctAnswer,
            marked_tough: reviewTags.includes("Tough"),
            marked_must_revise: reviewTags.includes("Must Revise"),
            attempts_history: nextHistory,
            spaced_revision: question.spacedRevision || null,
            updated_at: submittedAt
        };
    });

    for (const batch of chunk(stateRows)) {
        if (!batch.length) continue;
        const { error: stateError } = await client
            .from("question_states")
            .upsert(batch, { onConflict: "user_id,question_id" });
        if (stateError) throw stateError;
    }
}

export async function loadLatestAttempt(uid, testId) {
    const client = assertSupabaseReady();
    const rows = await runSelect(
        client
            .from("test_attempts")
            .select("attempt_payload")
            .eq("user_id", uid)
            .eq("test_id", testId)
            .order("submitted_at", { ascending: false })
            .limit(1)
    );
    return rows[0]?.attempt_payload || null;
}

export async function loadQuestionStates(uid, testId) {
    const client = assertSupabaseReady();
    const rows = await fetchAllRows((from, to) =>
        client
            .from("question_states")
            .select(QUESTION_STATE_COLUMNS)
            .eq("user_id", uid)
            .eq("test_id", testId)
            .order("updated_at", { ascending: false })
            .range(from, to)
    );
    return rows.map((row) => ({
        id: row.question_id,
        testId: row.test_id,
        questionId: row.question_id,
        selectedAnswer: row.selected_answer,
        confidence: row.confidence,
        note: row.note || "",
        highlightText: row.highlight_text || "",
        savedFolders: row.saved_folders || [],
        reviewTags: row.review_tags || [],
        questionTypeTags: row.question_type_tags || [],
        reviewDifficulty: row.review_difficulty,
        isIncorrectLastAttempt: row.is_incorrect_last_attempt,
        markedTough: row.marked_tough,
        markedMustRevise: row.marked_must_revise,
        attemptsHistory: row.attempts_history || [],
        spacedRevision: row.spaced_revision || null,
        updatedAt: row.updated_at
    }));
}

export async function loadAllQuestionStates(uid) {
    const client = assertSupabaseReady();
    const rows = await fetchAllRows((from, to) =>
        client
            .from("question_states")
            .select(QUESTION_STATE_COLUMNS)
            .eq("user_id", uid)
            .order("updated_at", { ascending: false })
            .range(from, to)
    );
    return rows.map((row) => ({
        id: row.question_id,
        testId: row.test_id,
        questionId: row.question_id,
        selectedAnswer: row.selected_answer,
        confidence: row.confidence,
        note: row.note || "",
        highlightText: row.highlight_text || "",
        savedFolders: row.saved_folders || [],
        reviewTags: row.review_tags || [],
        questionTypeTags: row.question_type_tags || [],
        reviewDifficulty: row.review_difficulty,
        isIncorrectLastAttempt: row.is_incorrect_last_attempt,
        markedTough: row.marked_tough,
        markedMustRevise: row.marked_must_revise,
        attemptsHistory: row.attempts_history || [],
        spacedRevision: row.spaced_revision || null,
        updatedAt: row.updated_at
    }));
}

export async function saveSingleQuestionState(uid, testId, questionId, patch, testMetadata = null) {
    const client = assertSupabaseReady();
    const reviewTags = Array.isArray(patch.reviewTags) ? patch.reviewTags : null;

    // Ensure the test exists in the tests table to satisfy foreign key constraint
    const { error: testError } = await client
        .from("tests")
        .upsert({
            id: testId,
            title: testMetadata?.title ?? "Untitled Test",
            provider: testMetadata?.provider ?? null,
            subject: testMetadata?.subject ?? null,
            updated_at: new Date().toISOString()
        }, { onConflict: "id" });
    if (testError) {
        console.warn("Failed to upsert test metadata in saveSingleQuestionState:", testError);
    }

    // Note: We always try to save to the database. The question_states table has a foreign key
    // constraint to the questions table. If the question doesn't exist, the upsert will fail
    // and throw an error that should be handled by the caller.

    const row = {
        user_id: uid,
        question_id: questionId,
        test_id: testId,
        updated_at: new Date().toISOString()
    };

    if (hasOwn(patch, "selectedAnswer")) row.selected_answer = patch.selectedAnswer ?? null;
    if (hasOwn(patch, "confidence")) row.confidence = patch.confidence ?? null;
    if (hasOwn(patch, "note")) row.note = patch.note || "";
    if (hasOwn(patch, "highlightText")) row.highlight_text = patch.highlightText || "";
    if (hasOwn(patch, "savedFolders")) row.saved_folders = patch.savedFolders || [];
    if (hasOwn(patch, "reviewTags")) row.review_tags = reviewTags || [];
    if (hasOwn(patch, "questionTypeTags")) row.question_type_tags = patch.questionTypeTags || [];
    if (hasOwn(patch, "reviewDifficulty")) row.review_difficulty = patch.reviewDifficulty ?? null;
    if (hasOwn(patch, "spacedRevision")) row.spaced_revision = patch.spacedRevision || null;
    if (reviewTags) {
        row.marked_tough = reviewTags.includes("Tough");
        row.marked_must_revise = reviewTags.includes("Must Revise");
    }

    const { error } = await client
        .from("question_states")
        .upsert(row, { onConflict: "user_id,question_id" });
    if (error) throw error;
}

export async function saveAttemptDraft(uid, attempt) {
    const client = assertSupabaseReady();
    const nextAttempt = normalizeAttempt(attempt);
    const { error } = await client
        .from("draft_attempts")
        .upsert({
            user_id: uid,
            test_id: nextAttempt.testId,
            attempt_payload: nextAttempt,
            updated_at: new Date().toISOString()
        }, { onConflict: "user_id,test_id" });
    if (error) throw error;
}

export async function loadAttemptDraft(uid, testId) {
    const client = assertSupabaseReady();
    const rows = await runSelect(
        client
            .from("draft_attempts")
            .select("attempt_payload")
            .eq("user_id", uid)
            .eq("test_id", testId)
            .limit(1)
    );
    return rows[0]?.attempt_payload || null;
}

export async function deleteAttemptDraft(uid, testId) {
    const client = assertSupabaseReady();
    const { error } = await client
        .from("draft_attempts")
        .delete()
        .eq("user_id", uid)
        .eq("test_id", testId);
    if (error) throw error;
}

export async function loadUserSettings(uid) {
    const client = assertSupabaseReady();
    const rows = await runSelect(
        client
            .from("user_settings")
            .select(USER_SETTINGS_COLUMNS)
            .eq("user_id", uid)
            .limit(1)
    );
    return mapSettingsRow(rows[0] || null);
}

export async function loadAllUserSettings() {
    const client = assertSupabaseReady();
    const { data, error } = await client
        .from("user_settings")
        .select(USER_SETTINGS_COLUMNS)
        .order("full_name", { ascending: true });
    if (error) throw error;
    return (data || []).map(mapSettingsRow);
}

export async function saveUserSettings(uid, patch) {
    const client = assertSupabaseReady();
    const row = {
        user_id: uid,
        updated_at: new Date().toISOString()
    };

    if (hasOwn(patch, "profile") || hasOwn(patch, "fullName")) {
        row.full_name = patch.profile?.fullName ?? patch.fullName ?? "";
    }
    if (hasOwn(patch, "profile") || hasOwn(patch, "displayName")) {
        row.display_name = patch.profile?.displayName ?? patch.displayName ?? "";
    }
    if (hasOwn(patch, "deckIntervals")) {
        row.deck_intervals = patch.deckIntervals || { again: 0, hard: 1, good: 3, easy: 7 };
    }
    if (hasOwn(patch, "customTags")) {
        row.custom_tags = patch.customTags || [];
    }
    if (hasOwn(patch, "customFolders")) {
        row.folders = patch.customFolders || [];
    }
    if (hasOwn(patch, "folders")) {
        row.folders = patch.folders || [];
    }
    // App code historically sends `tags` for folder names; map to DB `folders`.
    if (hasOwn(patch, "tags") && !hasOwn(patch, "folders") && !hasOwn(patch, "customFolders")) {
        row.folders = patch.tags || [];
    }
    if (hasOwn(patch, "permissions")) {
        row.permissions = patch.permissions;
    }

    const { error } = await client
        .from("user_settings")
        .upsert(row, { onConflict: "user_id" });
    if (error) throw error;
}

/**
 * Syllabus Tracker Sync Functions
 */

export async function loadSyllabusProgress(uid) {
    const client = assertSupabaseReady();
    const { data, error } = await client
        .from("user_syllabus_progress")
        .select("progress_payload")
        .eq("user_id", uid)
        .limit(1);
    
    if (error) {
        console.warn("Could not load syllabus progress:", error.message);
        return null;
    }
    return data[0]?.progress_payload || null;
}

export async function saveSyllabusProgress(uid, payload) {
    const client = assertSupabaseReady();
    const { error } = await client
        .from("user_syllabus_progress")
        .upsert({
            user_id: uid,
            progress_payload: payload,
            updated_at: new Date().toISOString()
        }, { onConflict: "user_id" });
    
    if (error) {
        console.error("Failed to sync syllabus progress:", error);
        throw error;
    }
}

// User Notes Management
export async function loadUserNotes(uid) {
    const client = assertSupabaseReady();
    const rows = await runSelect(
        client
            .from("user_notes")
            .select(USER_NOTES_COLUMNS)
            .eq("user_id", uid)
            .order("subject", { ascending: true })
            .order("updated_at", { ascending: false })
    );
    return rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        subject: row.subject,
        title: row.title,
        content: row.content || "",
        items: Array.isArray(row.items) ? row.items : [],
        highlights: Array.isArray(row.highlights) ? row.highlights : [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
    }));
}

export async function saveUserNote(uid, note) {
    const client = assertSupabaseReady();
    const timestamp = new Date().toISOString();
    const row = {
        user_id: uid,
        subject: note.subject,
        title: note.title,
        content: note.content || "",
        items: note.items || [],
        highlights: note.highlights || [],
        updated_at: timestamp
    };

    if (note.id) {
        row.id = note.id;
    } else {
        // Generate proper UUID for database compatibility
        row.id = crypto.randomUUID();
        row.created_at = timestamp;
    }

    const { error } = await client
        .from("user_notes")
        .upsert(row, { onConflict: "id" });
    if (error) throw error;
    return { ...note, id: row.id, userId: uid, createdAt: row.created_at, updatedAt: timestamp };
}

export async function deleteUserNote(uid, noteId) {
    const client = assertSupabaseReady();
    const { error } = await client
        .from("user_notes")
        .delete()
        .eq("id", noteId)
        .eq("user_id", uid);
    if (error) throw error;
}

// Notes Tree (hierarchical navigation)
const USER_NOTE_NODES_COLUMNS = "id,user_id,parent_id,type,title,metadata,note_id,created_at,updated_at";

export async function loadUserNoteNodes(uid) {
    const client = assertSupabaseReady();
    const rows = await runSelect(
        client
            .from("user_note_nodes")
            .select(USER_NOTE_NODES_COLUMNS)
            .eq("user_id", uid)
            .order("created_at", { ascending: true })
    );
    return rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        parentId: row.parent_id,
        type: row.type,
        title: row.title,
        metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
        noteId: row.note_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    }));
}

export async function createUserNoteNode(uid, node) {
    const client = assertSupabaseReady();
    const timestamp = new Date().toISOString();
    const row = {
        id: node.id || crypto.randomUUID(),
        user_id: uid,
        parent_id: node.parentId ?? null,
        type: node.type,
        title: node.title,
        metadata: node.metadata || {},
        note_id: node.noteId ?? null,
        created_at: timestamp,
        updated_at: timestamp
    };
    const { error } = await client.from("user_note_nodes").insert(row);
    if (error) throw error;
    return {
        id: row.id,
        userId: uid,
        parentId: row.parent_id,
        type: row.type,
        title: row.title,
        metadata: row.metadata,
        noteId: row.note_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

export async function updateUserNoteNode(uid, nodeId, patch) {
    const client = assertSupabaseReady();
    const { error } = await client
        .from("user_note_nodes")
        .update({
            ...(patch.parentId !== undefined ? { parent_id: patch.parentId } : {}),
            ...(patch.title !== undefined ? { title: patch.title } : {}),
            ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
            ...(patch.noteId !== undefined ? { note_id: patch.noteId } : {}),
            updated_at: new Date().toISOString()
        })
        .eq("id", nodeId)
        .eq("user_id", uid);
    if (error) throw error;
}

export async function deleteUserNoteNode(uid, nodeId) {
    const client = assertSupabaseReady();
    const { error } = await client
        .from("user_note_nodes")
        .delete()
        .eq("id", nodeId)
        .eq("user_id", uid);
    if (error) throw error;
}

export async function fetchQuestionMetadataSummary(testIds = []) {
    const client = assertSupabaseReady();
    const ids = [...new Set((testIds || []).filter(Boolean))];
    if (!ids.length) return [];
    const { data, error } = await client.rpc("question_metadata_summary", { p_test_ids: ids });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
}

/**
 * Phase 6.2: paginated server-side question search to avoid loading/indexing very large corpora on client.
 * Returns raw DB rows from `questions` with only required columns.
 */
export async function searchQuestionsPage({
    query,
    testIds = [],
    subject = "All",
    sectionGroup = "All",
    limit = 120,
    offset = 0
} = {}) {
    const client = assertSupabaseReady();
    const q = String(query || "").trim();
    if (!q) return [];
    const safeLimit = Math.max(1, Math.min(Number(limit) || 120, 250));
    const safeOffset = Math.max(0, Number(offset) || 0);

    const ids = Array.isArray(testIds) ? [...new Set(testIds.filter(Boolean))] : [];
    const rpcArgs = {
        p_query: q,
        p_test_ids: ids.length ? ids : null,
        p_subject: subject && subject !== "All" ? subject : null,
        p_section_group: sectionGroup && sectionGroup !== "All" ? sectionGroup : null,
        p_limit: safeLimit,
        p_offset: safeOffset
    };
    const { data: rpcData, error: rpcError } = await client.rpc("search_questions_indexed", rpcArgs);
    if (!rpcError && Array.isArray(rpcData)) return rpcData;
    if (rpcError && !String(rpcError.message || "").toLowerCase().includes("search_questions_indexed")) {
        console.warn("Indexed server search failed; falling back to safe ilike search:", rpcError);
    }

    let queryBuilder = client
        .from("questions")
        .select(QUESTION_COLUMNS)
        .order("updated_at", { ascending: false })
        .range(safeOffset, safeOffset + safeLimit - 1);

    if (Array.isArray(testIds) && testIds.length) {
        queryBuilder = queryBuilder.in("test_id", testIds);
    }
    if (subject && subject !== "All") {
        queryBuilder = queryBuilder.eq("subject", subject);
    }
    if (sectionGroup && sectionGroup !== "All") {
        queryBuilder = queryBuilder.eq("section_group", sectionGroup);
    }

    // PostgREST `.or()` splits on commas — keep user tokens comma-free. Avoid casts like `options::text`
    // in the OR string (they commonly trigger 400 / "failed to parse logic tree").
    const safe = String(q)
        .replace(/\\/g, "\\\\")
        .replace(/%/g, "\\%")
        .replace(/_/g, "\\_")
        .replace(/,/g, " ")
        .replace(/\(/g, " ")
        .replace(/\)/g, " ")
        .replace(/\./g, " ")
        .replace(/:/g, " ")
        .replace(/'/g, " ")
        .replace(/\r?\n/g, " ")
        .trim();
    const tokens = safe.split(/\s+/).filter(Boolean).slice(0, 4);
    const primary = tokens[0] || safe;
    const pattern = `%${primary}%`;
    queryBuilder = queryBuilder.or(`question_text.ilike.${pattern},micro_topic.ilike.${pattern}`);

    const { data, error } = await queryBuilder;
    if (error) throw error;
    return data || [];
}

export async function addHighlightToNote(uid, noteId, highlight) {
    const client = assertSupabaseReady();
    const { data: rows, error: fetchError } = await client
        .from("user_notes")
        .select("items, highlights")
        .eq("id", noteId)
        .eq("user_id", uid)
        .limit(1);
    
    if (fetchError) throw fetchError;
    if (!rows || rows.length === 0) throw new Error("Note not found");
    
    const note = rows[0];
    const items = Array.isArray(note.items) ? note.items : [];
    const highlights = Array.isArray(note.highlights) ? note.highlights : [];
    
    // Format highlight text: auto-capitalize first letter
    let formattedText = highlight.text.trim();
    if (formattedText) {
        formattedText = formattedText.charAt(0).toUpperCase() + formattedText.slice(1);
    }

    const microTopic = String(highlight.microTopic || "General").trim() || "General";
    const microTopicKey = microTopic.toLowerCase();
    const targetHeadingKey = highlight.targetHeadingKey != null ? String(highlight.targetHeadingKey).trim() : "";
    /** When user picks an explicit section (non-__auto__), omit microTopic on the item so viewers do not duplicate headings. */
    const attachMicroTopic = !targetHeadingKey || targetHeadingKey === "__auto__";

    const persistHeadingKey = Boolean(targetHeadingKey) && targetHeadingKey !== "__auto__";
    const nextHighlightItem = {
        type: "highlight",
        text: formattedText,
        source: highlight.source || "",
        questionId: highlight.questionId || "",
        testId: highlight.testId || "",
        ...(attachMicroTopic ? { microTopic } : {}),
        ...(persistHeadingKey ? { targetHeadingKey } : {}),
        addedAt: new Date().toISOString()
    };

    const insertAfterHeadingIndex = (headingIndex) => {
        let insertIndex = headingIndex + 1;
        while (insertIndex < items.length && items[insertIndex]?.type !== "microTopicHeading") {
            insertIndex++;
        }
        items.splice(insertIndex, 0, nextHighlightItem);
    };

    if (targetHeadingKey === "__top__") {
        items.splice(0, 0, nextHighlightItem);
    } else if (targetHeadingKey && targetHeadingKey !== "__auto__") {
        const hk = targetHeadingKey.toLowerCase();
        let headingIndex = items.findIndex(
            (item) => item?.type === "microTopicHeading"
                && (String(item?.key || "").toLowerCase() === hk
                    || String(item?.text || "").trim().toLowerCase() === hk)
        );
        if (headingIndex === -1) {
            items.push({
                type: "microTopicHeading",
                text: targetHeadingKey,
                key: hk,
                addedAt: new Date().toISOString()
            });
            headingIndex = items.length - 1;
        }
        insertAfterHeadingIndex(headingIndex);
    } else {
        let headingIndex = items.findIndex(
            (item) => item?.type === "microTopicHeading" && String(item?.key || "").toLowerCase() === microTopicKey
        );
        if (headingIndex === -1) {
            items.push({
                type: "microTopicHeading",
                text: microTopic,
                key: microTopicKey,
                addedAt: new Date().toISOString()
            });
            headingIndex = items.length - 1;
        }
        insertAfterHeadingIndex(headingIndex);
    }
    
    highlights.push(highlight);
    
    const { error } = await client
        .from("user_notes")
        .update({
            items,
            highlights,
            updated_at: new Date().toISOString()
        })
        .eq("id", noteId)
        .eq("user_id", uid);
    
    if (error) throw error;
}

export async function updateNoteContent(uid, noteId, content, items) {
    const client = assertSupabaseReady();
    const { error } = await client
        .from("user_notes")
        .update({
            content: content || "",
            items: items || [],
            updated_at: new Date().toISOString()
        })
        .eq("id", noteId)
        .eq("user_id", uid);
    if (error) throw error;
}
