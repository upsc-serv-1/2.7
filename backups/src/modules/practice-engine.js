function clone(value) {
    return structuredClone(value);
}

export function createAttemptDraft(test, settings) {
    const now = new Date();
    const endsAt = settings.timerMode === "timed" ? new Date(now.getTime() + settings.timerMinutes * 60 * 1000).toISOString() : null;
    return {
        testId: test.id,
        title: test.title,
        provider: test.provider,
        subject: test.subject,
        sectionGroup: test.sectionGroup ?? null,
        currentIndex: 0,
        explanationMode: settings.explanationMode,
        timerMode: settings.timerMode,
        timerMinutes: settings.timerMinutes,
        startedAt: now.toISOString(),
        timerEndsAt: endsAt,
        submittedAt: null,
        questions: test.questions.map((question) => ({
            ...clone(question),
            selectedAnswer: "",
            confidence: "",
            note: question.note || "",
            highlightText: question.highlightText || "",
            savedFolders: question.savedFolders || [],
            reviewTags: question.reviewTags || [],
            questionTypeTags: question.questionTypeTags || [],
            reviewDifficulty: question.reviewDifficulty || "",
            attemptsHistory: question.attemptsHistory || [],
            markForReview: false
        }))
    };
}

export function updateAnswer(attempt, index, answer, confidence = null) {
    const next = clone(attempt);
    next.questions[index].selectedAnswer = answer ?? next.questions[index].selectedAnswer;
    if (confidence !== null) next.questions[index].confidence = confidence;
    return next;
}

export function updateQuestionNote(attempt, index, note) {
    const next = clone(attempt);
    next.questions[index].note = note;
    return next;
}

export function computeScore(questions, scoring) {
    let correct = 0;
    let incorrect = 0;
    let unattempted = 0;
    let answerConflicts = 0;

    questions.forEach((question) => {
        if (!question.selectedAnswer) {
            unattempted += 1;
        } else {
            // Always use official answer for scoring
            const officialAnswer = question.officialAnswer || question.correctAnswer;
            const isCorrect = question.selectedAnswer === officialAnswer;
            
            if (isCorrect) {
                correct += 1;
            } else {
                incorrect += 1;
            }
            
            // Track answer conflicts
            if (question.correctAnswer !== officialAnswer) {
                answerConflicts += 1;
            }
        }
    });

    const totalMarks = correct * scoring.correct + incorrect * scoring.incorrect;
    const attempted = correct + incorrect;
    const accuracy = attempted ? Math.round((correct / attempted) * 100) : 0;
    
    // Use official answers for all metrics
    const sureWrong = questions.filter((question) => {
        const officialAnswer = question.officialAnswer || question.correctAnswer;
        return question.confidence === "100% Sure" && question.selectedAnswer && question.selectedAnswer !== officialAnswer;
    }).length;
    const eliminationCorrect = questions.filter((question) => {
        const officialAnswer = question.officialAnswer || question.correctAnswer;
        return question.confidence === "Logical Elimination" && question.selectedAnswer === officialAnswer;
    }).length;
    const fundaCorrect = questions.filter((question) => {
        const officialAnswer = question.officialAnswer || question.correctAnswer;
        return question.confidence === "UPSC Funda" && question.selectedAnswer === officialAnswer;
    }).length;
    const guessWrong = questions.filter((question) => {
        const officialAnswer = question.officialAnswer || question.correctAnswer;
        return question.confidence === "Pure Guess" && question.selectedAnswer && question.selectedAnswer !== officialAnswer;
    }).length;
    const easyWrong = questions.filter((question) => {
        const officialAnswer = question.officialAnswer || question.correctAnswer;
        return question.reviewDifficulty === "Easy" && question.selectedAnswer && question.selectedAnswer !== officialAnswer;
    }).length;
    const hardCorrect = questions.filter((question) => {
        const officialAnswer = question.officialAnswer || question.correctAnswer;
        return question.reviewDifficulty === "Hard" && question.selectedAnswer === officialAnswer;
    }).length;
    const attemptQualityScore = Math.max(
        0,
        Math.min(
            100,
            Math.round(
                accuracy
                + hardCorrect * 2.4
                + eliminationCorrect * 1.6
                + fundaCorrect * 1.4
                - sureWrong * 3
                - guessWrong * 1.2
                - easyWrong * 2.2
                - unattempted * 0.3
            )
        )
    );

    let qualityLabel = "High-risk Attempt";
    if (attemptQualityScore >= 80) qualityLabel = "Excellent Performance";
    else if (attemptQualityScore >= 60) qualityLabel = "Stable Performance";
    else if (attemptQualityScore >= 40) qualityLabel = "Inconsistent Performance";

    return { 
        correct, 
        incorrect, 
        unattempted, 
        totalMarks: Number(totalMarks.toFixed(2)), 
        accuracy, 
        attemptQualityScore, 
        qualityLabel,
        answerConflicts,
        hasAnswerConflicts: answerConflicts > 0
    };
}

export function buildAttemptSummary(attempt) {
    const score = attempt.score || computeScore(attempt.questions, { correct: 2, incorrect: -0.66, unattempted: 0 });
    return {
        scoreLabel: score.totalMarks,
        accuracy: score.accuracy,
        attemptQualityScore: score.attemptQualityScore,
        qualityLabel: score.qualityLabel
    };
}

export function buildConfidenceStats(questions) {
    return ["100% Sure", "Logical Elimination", "Pure Guess", "UPSC Funda"].map((label) => {
        const tagged = questions.filter((question) => question.confidence === label);
        const correct = tagged.filter((question) => question.selectedAnswer && question.selectedAnswer === question.correctAnswer).length;
        return {
            label,
            total: tagged.length,
            correct,
            accuracy: tagged.length ? Math.round((correct / tagged.length) * 100) : 0
        };
    });
}

export function buildReviewQueue(attempt, modes = ["incorrect"]) {
    const pool = attempt.questions;
    const activeModes = Array.isArray(modes) ? modes.filter(Boolean) : [modes].filter(Boolean);
    if (!activeModes.length || (activeModes.length === 1 && (activeModes[0] === "all" || activeModes[0] === "allQuestions"))) return pool;

    const predicates = {
        incorrect: (question) => question.selectedAnswer && question.selectedAnswer !== question.correctAnswer,
        correct: (question) => question.selectedAnswer && question.selectedAnswer === question.correctAnswer,
        notAttempted: (question) => !question.selectedAnswer,
        all: () => true,
        allQuestions: () => true,
        pyq: (question) => question.isPyq
    };

    const effectiveModes = activeModes.filter((mode) => mode !== "all" && mode !== "allQuestions");
    if (!effectiveModes.length) return pool;
    // Combine selected filters with OR logic.
    // Example: selecting both "incorrect" and "correct" should show both sets, not the impossible intersection.
    return pool.filter((question) => effectiveModes.some((mode) => {
        if (mode.startsWith("tag:")) {
            const tag = mode.slice(4);
            return (question.reviewTags || []).includes(tag);
        }
        return predicates[mode]?.(question) ?? false;
    }));
}

export function updateReviewMeta(attempt, questionId, mode, value) {
    const next = clone(attempt);
    const q = next.questions.find((question) => question.id === questionId);
    if (!q) return next;
    if (mode === "tag") {
        q.reviewTags ||= [];
        q.reviewTags = q.reviewTags.includes(value) ? q.reviewTags.filter((item) => item !== value) : [...q.reviewTags, value];
    }
    if (mode === "questionType") {
        q.questionTypeTags = q.questionTypeTags?.includes(value)
            ? q.questionTypeTags.filter((item) => item !== value)
            : [...(q.questionTypeTags || []), value];
    }
    if (mode === "difficulty") {
        q.reviewDifficulty = q.reviewDifficulty === value ? "" : value;
    }
    return next;
}

export function resetQuestionHistory(attempt, questionId) {
    const next = clone(attempt);
    const q = next.questions.find((question) => question.id === questionId);
    if (!q) return next;
    q.selectedAnswer = "";
    q.confidence = "";
    q.note = "";
    q.reviewTags = [];
    q.reviewDifficulty = "";
    q.attemptsHistory = [];
    q.markForReview = false;
    return next;
}

export function updateQuestionField(attempt, index, field, value) {
    const next = clone(attempt);
    next.questions[index][field] = value;
    return next;
}

// Canonical question system - ONE unique UPSC question = ONE canonical record

function normalizeQuestionText(text, options = { lowercase: true }) {
    if (!text) return "";
    let result = String(text);
    if (options.lowercase) result = result.toLowerCase();
    return result
        .replace(/\s+/g, " ")
        .replace(/[^\w\s\-\.\,\;\:\?\!]/g, "")
        .trim();
}

function normalizeOptions(options, textOptions = { lowercase: true }) {
    if (!options || typeof options !== "object") return {};
    
    const normalized = {};
    Object.entries(options).forEach(([key, value]) => {
        normalized[key.toLowerCase()] = normalizeQuestionText(value, textOptions);
    });
    
    return normalized;
}

function extractYearAndExam(question) {
    const sourceText = question.source?.sourceText || question.__studyTestTitle || "";
    const yearMatch = sourceText.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? yearMatch[0] : "";
    
    let exam = "";
    if (/upsc\s*cse|csc|pre/i.test(sourceText)) {
        exam = "UPSC CSE";
    } else if (/capf/i.test(sourceText)) {
        exam = "UPSC CAPF";
    } else if (/cds/i.test(sourceText)) {
        exam = "UPSC CDS";
    }
    
    return { year, exam };
}

function generateCanonicalId(question) {
    // Enhanced canonical ID generation with year/exam context
    const normalizedText = normalizeQuestionText(question.questionText || question.statementLines?.join(" "), { lowercase: true });
    const normalizedOptions = normalizeOptions(question.options, { lowercase: true });
    const { year, exam } = extractYearAndExam(question);
    
    // Create content signature for canonical identification
    const content = [
        normalizedText,
        JSON.stringify(normalizedOptions),
        (question.correctAnswer || "").toLowerCase(),
        year,
        exam
    ].join("|");
    
    // Enhanced hash function
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    
    return `canonical_${year || "unknown"}_${exam || "unknown"}_${Math.abs(hash).toString(36)}`;
}

function createCanonicalQuestion(question) {
    const { year, exam } = extractYearAndExam(question);
    
    return {
        canonicalId: generateCanonicalId(question),
        questionText: normalizeQuestionText(question.questionText || question.statementLines?.[0] || "", { lowercase: false }),
        options: normalizeOptions(question.options, { lowercase: false }),
        officialAnswer: (question.correctAnswer || "").toUpperCase(),
        year,
        exam,
        paperId: question.__studyTestId || question.testId || "",
        sequenceNumber: question.questionNumber || 0,
        sources: [{
            sourceName: question.__studyProvider || "Unknown",
            explanation: question.explanationMarkdown || "",
            tags: question.reviewTags || []
        }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

function addSourceToCanonical(canonicalQuestion, sourceName, explanation, tags = []) {
    const existingSource = canonicalQuestion.sources.find(s => s.sourceName === sourceName);
    
    if (existingSource) {
        // Update existing source
        existingSource.explanation = explanation || existingSource.explanation;
        existingSource.tags = tags.length ? tags : existingSource.tags;
    } else {
        // Add new source
        canonicalQuestion.sources.push({
            sourceName,
            explanation,
            tags,
            addedAt: new Date().toISOString()
        });
    }
    
    canonicalQuestion.updatedAt = new Date().toISOString();
    return canonicalQuestion;
}

export function mergeQuestionState(test, states) {
    const byId = new Map(states.map((item) => [item.questionId, item]));
    const canonicalStates = new Map();
    
    // Build canonical states map
    states.forEach(state => {
        // Find the question in the test to get canonical ID
        const question = test.questions.find(q => q.id === state.questionId);
        if (question) {
            const canonicalId = generateCanonicalId(question);
            canonicalStates.set(canonicalId, state);
        }
    });
    
    return {
        ...test,
        questions: test.questions.map((question) => {
            const saved = byId.get(question.id);
            const canonicalId = generateCanonicalId(question);
            const canonicalState = canonicalStates.get(canonicalId);
            
            return saved || canonicalState
                ? {
                      ...question,
                        note: (saved || canonicalState)?.note || "",
                        highlightText: (saved || canonicalState)?.highlightText || "",
                        savedFolders: (saved || canonicalState)?.savedFolders || [],
                        spacedRevision: (saved || canonicalState)?.spacedRevision || question.spacedRevision || null,
                        reviewTags: (saved || canonicalState)?.reviewTags || [],
                        questionTypeTags: (saved || canonicalState)?.questionTypeTags || question.questionTypeTags || [],
                        reviewDifficulty: (saved || canonicalState)?.reviewDifficulty || "",
                        attemptsHistory: (saved || canonicalState)?.attemptsHistory || [],
                        canonicalId: canonicalId, // Store canonical ID for reference
                        isCanonical: true // Mark as having canonical processing
                    }
                : {
                    ...question,
                    canonicalId: canonicalId,
                    isCanonical: true
                };
        })
    };
}

export function getCanonicalQuestionStates(allTests, allStates) {
    // Aggregate states across all tests by canonical ID
    const canonicalMap = new Map();
    
    allTests.forEach(test => {
        test.questions.forEach(question => {
            const canonicalId = generateCanonicalId(question);
            const state = allStates.find(s => s.questionId === question.id);
            
            if (!canonicalMap.has(canonicalId)) {
                canonicalMap.set(canonicalId, {
                    canonicalId,
                    question,
                    allStates: [],
                    bestState: null,
                    testSources: new Set()
                });
            }
            
            const canonical = canonicalMap.get(canonicalId);
            canonical.testSources.add(test.title);
            if (state) {
                canonical.allStates.push(state);
                // Determine best state based on confidence and correctness
                if (!canonical.bestState || 
                    (state.selectedAnswer === question.correctAnswer && 
                     (!canonical.bestState.selectedAnswer || canonical.bestState.selectedAnswer !== question.correctAnswer))) {
                    canonical.bestState = state;
                }
            }
        });
    });
    
    return Array.from(canonicalMap.values());
}

export function isOfficialUpscPaper(test) {
    return test.provider === "UPSC CSE PYQ" || 
           test.title.includes("UPSC") || 
           test.series?.includes("UPSC");
}

export function createOfficialPaperStructure(test) {
    if (!isOfficialUpscPaper(test)) {
        return test;
    }
    
    // Create canonical questions in exact sequence
    const canonicalQuestions = test.questions
        .sort((a, b) => (a.questionNumber || 0) - (b.questionNumber || 0))
        .map(question => createCanonicalQuestion(question));
    
    // Create master paper structure
    const masterPaper = {
        ...test,
        canonicalQuestions,
        isOfficialPaper: true,
        sequencePreserved: true,
        canonicalIds: canonicalQuestions.map(q => q.canonicalId),
        year: canonicalQuestions[0]?.year || "",
        exam: canonicalQuestions[0]?.exam || ""
    };
    
    return masterPaper;
}

export function renderOfficialPaperWithLinkedExplanations(test, linkedSources) {
    if (!isOfficialUpscPaper(test)) {
        return test; // Return unchanged for non-official papers
    }
    
    // Create or get master paper structure
    const masterPaper = createOfficialPaperStructure(test);
    
    // Attach linked sources to canonical questions
    const questionsWithLinkedExplanations = masterPaper.canonicalQuestions.map(canonicalQuestion => {
        const linkedSource = linkedSources?.find(source => 
            source.canonicalId === canonicalQuestion.canonicalId && source.explanation
        );
        
        if (linkedSource) {
            // Add source to canonical question
            addSourceToCanonical(canonicalQuestion, linkedSource.sourceName, linkedSource.explanation, linkedSource.tags);
        }
        
        // Convert back to display format
        return {
            ...canonicalQuestion,
            id: canonicalQuestion.canonicalId, // Use canonical ID
            questionNumber: canonicalQuestion.sequenceNumber,
            questionText: canonicalQuestion.questionText,
            options: canonicalQuestion.options,
            correctAnswer: canonicalQuestion.officialAnswer, // Use official answer
            officialAnswer: canonicalQuestion.officialAnswer,
            explanationMarkdown: linkedSource?.explanation || canonicalQuestion.sources[0]?.explanation || "",
            availableSources: canonicalQuestion.sources.map(s => s.sourceName),
            selectedSource: linkedSource?.sourceName || canonicalQuestion.sources[0]?.sourceName || "Official",
            year: canonicalQuestion.year,
            exam: canonicalQuestion.exam
        };
    });
    
    return {
        ...masterPaper,
        questions: questionsWithLinkedExplanations,
        canonicalMode: true
    };
}

export function getLinkedExplanationSources(canonicalQuestion) {
    // This would fetch linked sources from the database
    // For now, return empty array - to be implemented with database
    return [];
}

// Source linking system
export function linkSourceToCanonical(canonicalId, sourceName, explanation, tags = []) {
    // This function would be called when linking a source to a canonical question
    // In a real implementation, this would update the database
    return {
        canonicalId,
        sourceName,
        explanation,
        tags,
        linkedAt: new Date().toISOString()
    };
}

export function findCanonicalQuestionForSource(sourceQuestion, canonicalDatabase) {
    // Find the canonical question that matches this source question
    const sourceCanonicalId = generateCanonicalId(sourceQuestion);
    return canonicalDatabase.find(cq => cq.canonicalId === sourceCanonicalId);
}

export function processSourceTest(test, canonicalDatabase) {
    // Process a source test (Vision, Forum, PW) and link to canonical questions
    const processedQuestions = test.questions.map(sourceQuestion => {
        const canonicalQuestion = findCanonicalQuestionForSource(sourceQuestion, canonicalDatabase);
        
        if (canonicalQuestion) {
            // Link this source to the canonical question
            const sourceLink = linkSourceToCanonical(
                canonicalQuestion.canonicalId,
                test.provider || "Unknown",
                sourceQuestion.explanationMarkdown || "",
                sourceQuestion.reviewTags || []
            );
            
            return {
                ...sourceQuestion,
                canonicalId: canonicalQuestion.canonicalId,
                officialAnswer: canonicalQuestion.officialAnswer,
                isLinked: true,
                sourceLink
            };
        } else {
            // No matching canonical question found - create new canonical entry
            const newCanonical = createCanonicalQuestion(sourceQuestion);
            return {
                ...sourceQuestion,
                canonicalId: newCanonical.canonicalId,
                officialAnswer: newCanonical.officialAnswer,
                isLinked: false,
                needsCanonicalReview: true
            };
        }
    });
    
    return {
        ...test,
        questions: processedQuestions,
        processedAsSource: true
    };
}

export function buildCanonicalDatabase(tests) {
    // Build the canonical database from all tests
    const canonicalMap = new Map();
    
    tests.forEach(test => {
        test.questions.forEach(question => {
            const canonicalQuestion = createCanonicalQuestion(question);
            const canonicalId = canonicalQuestion.canonicalId;
            
            if (canonicalMap.has(canonicalId)) {
                // Merge sources if canonical question already exists
                const existing = canonicalMap.get(canonicalId);
                const sourceName = test.provider || "Unknown";
                addSourceToCanonical(existing, sourceName, question.explanationMarkdown, question.reviewTags);
            } else {
                canonicalMap.set(canonicalId, canonicalQuestion);
            }
        });
    });
    
    return Array.from(canonicalMap.values());
}

export function buildTopicWeaknessReport(questions) {
    const bucket = new Map();
    questions.forEach((question) => {
        const key = question.microTopic || "Unmapped";
        if (!bucket.has(key)) bucket.set(key, { topic: key, total: 0, incorrect: 0, correct: 0 });
        const row = bucket.get(key);
        row.total += 1;
        if (question.selectedAnswer && question.selectedAnswer === question.correctAnswer) row.correct += 1;
        if (question.selectedAnswer && question.selectedAnswer !== question.correctAnswer) row.incorrect += 1;
    });
    return [...bucket.values()]
        .map((item) => ({
            ...item,
            accuracy: item.total ? Math.round((item.correct / item.total) * 100) : 0
        }))
        .sort((a, b) => b.incorrect - a.incorrect || a.accuracy - b.accuracy);
}

export function buildSubjectPerformanceReport(questions) {
    const bucket = new Map();
    questions.forEach((question) => {
        const key = question.subject || "Unassigned";
        if (!bucket.has(key)) bucket.set(key, { subject: key, total: 0, correct: 0, incorrect: 0 });
        const row = bucket.get(key);
        row.total += 1;
        if (question.selectedAnswer && question.selectedAnswer === question.correctAnswer) row.correct += 1;
        if (question.selectedAnswer && question.selectedAnswer !== question.correctAnswer) row.incorrect += 1;
    });
    return [...bucket.values()].map((item) => ({
        ...item,
        accuracy: item.total ? Math.round((item.correct / item.total) * 100) : 0
    }));
}

export function buildDecisionMetrics(questions) {
    const labels = ["100% Sure", "Logical Elimination", "Pure Guess", "UPSC Funda"];
    return labels.map((label) => {
        const tagged = questions.filter((question) => question.confidence === label);
        const correct = tagged.filter((question) => question.selectedAnswer === question.correctAnswer).length;
        const incorrect = tagged.filter((question) => question.selectedAnswer && question.selectedAnswer !== question.correctAnswer).length;
        return {
            label,
            total: tagged.length,
            correct,
            incorrect,
            accuracy: tagged.length ? Math.round((correct / tagged.length) * 100) : 0
        };
    });
}

export function buildDifficultyMetrics(questions) {
    return ["Easy", "Moderate", "Hard"].map((level) => {
        const tagged = questions.filter((question) => question.reviewDifficulty === level);
        const correct = tagged.filter((question) => question.selectedAnswer === question.correctAnswer).length;
        const incorrect = tagged.filter((question) => question.selectedAnswer && question.selectedAnswer !== question.correctAnswer).length;
        return {
            level,
            total: tagged.length,
            correct,
            incorrect,
            accuracy: tagged.length ? Math.round((correct / tagged.length) * 100) : 0
        };
    });
}

export function buildSourcePerformanceReport(questions) {
    const bucket = new Map();
    questions.forEach((question) => {
        const key = question.provider || question.source?.sourceText || "Unknown Source";
        if (!bucket.has(key)) bucket.set(key, { source: key, total: 0, correct: 0, incorrect: 0 });
        const row = bucket.get(key);
        row.total += 1;
        if (question.selectedAnswer === question.correctAnswer) row.correct += 1;
        if (question.selectedAnswer && question.selectedAnswer !== question.correctAnswer) row.incorrect += 1;
    });
    return [...bucket.values()].map((item) => ({
        ...item,
        accuracy: item.total ? Math.round((item.correct / item.total) * 100) : 0
    }));
}

export function buildRevisionBacklog(questions) {
    const incorrect = questions.filter((question) => question.selectedAnswer && question.selectedAnswer !== question.correctAnswer).length;
    const mustRevise = questions.filter((question) => question.reviewTags.includes("Must Revise")).length;
    return [
        { label: "Incorrect", count: incorrect },
        { label: "Must Revise", count: mustRevise }
    ];
}

export function buildIncorrectTrendReport(questions) {
    const totalIncorrect = questions.filter((question) => question.selectedAnswer && question.selectedAnswer !== question.correctAnswer).length;
    const firstHalf = questions.slice(0, Math.ceil(questions.length / 2));
    const secondHalf = questions.slice(Math.ceil(questions.length / 2));
    const firstHalfIncorrect = firstHalf.filter((question) => question.selectedAnswer && question.selectedAnswer !== question.correctAnswer).length;
    const secondHalfIncorrect = secondHalf.filter((question) => question.selectedAnswer && question.selectedAnswer !== question.correctAnswer).length;
    return [
        { label: "First half", count: firstHalfIncorrect },
        { label: "Second half", count: secondHalfIncorrect },
        { label: "Total incorrect", count: totalIncorrect }
    ];
}

export function buildConfidenceInsights(questions) {
    const sureWrong = questions.filter((question) => question.confidence === "100% Sure" && question.selectedAnswer && question.selectedAnswer !== question.correctAnswer).length;
    const guessedCorrect = questions.filter((question) => question.confidence === "Pure Guess" && question.selectedAnswer === question.correctAnswer).length;
    const eliminationCorrect = questions.filter((question) => question.confidence === "Logical Elimination" && question.selectedAnswer === question.correctAnswer).length;
    const fundaCorrect = questions.filter((question) => question.confidence === "UPSC Funda" && question.selectedAnswer === question.correctAnswer).length;
    return {
        sureWrong,
        guessedCorrect,
        eliminationCorrect,
        fundaCorrect
    };
}

export function buildConceptualFactualMetrics(questions) {
    const categories = ["Imp. Fact", "Imp. Concept", "Trap Question", "Must Revise"];
    return categories.map((tag) => ({
        tag,
        count: questions.filter((question) => question.reviewTags.includes(tag)).length
    }));
}

export function buildStrengthAreas(questions) {
    return buildTopicWeaknessReport(questions)
        .filter((item) => item.correct > 0)
        .sort((a, b) => b.accuracy - a.accuracy || b.correct - a.correct)
        .slice(0, 5);
}

export function buildQuestionCategoryReview(questions) {
    return [
        { label: "Incorrect Questions", count: questions.filter((question) => question.selectedAnswer && question.selectedAnswer !== question.correctAnswer).length },
        { label: "Imp. Concept", count: questions.filter((question) => question.reviewTags.includes("Imp. Concept")).length },
        { label: "Imp. Fact", count: questions.filter((question) => question.reviewTags.includes("Imp. Fact")).length },
        { label: "Trap Question", count: questions.filter((question) => question.reviewTags.includes("Trap Question")).length },
        { label: "Must Revise", count: questions.filter((question) => question.reviewTags.includes("Must Revise")).length }
    ];
}

export function buildAdvancedAnalyticalMetrics(questions) {
    const difficultCorrect = questions.filter((question) => question.reviewDifficulty === "Hard" && question.selectedAnswer === question.correctAnswer).length;
    const easyWrong = questions.filter((question) => question.reviewDifficulty === "Easy" && question.selectedAnswer && question.selectedAnswer !== question.correctAnswer).length;
    const sureWrong = questions.filter((question) => question.confidence === "100% Sure" && question.selectedAnswer && question.selectedAnswer !== question.correctAnswer).length;
    const eliminationCorrect = questions.filter((question) => question.confidence === "Logical Elimination" && question.selectedAnswer === question.correctAnswer).length;
    return {
        emd: {
            difficultCorrect,
            easyWrong
        },
        confidence: {
            sureWrong,
            eliminationCorrect
        }
    };
}

