function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function flattenEntries(value, prefix = "", depth = 0, maxDepth = 3, out = []) {
    if (depth > maxDepth || !isPlainObject(value)) return out;
    Object.entries(value).forEach(([key, child]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        if (child == null || typeof child === "string" || typeof child === "number" || typeof child === "boolean") {
            out.push({ path, key, value: child });
            return;
        }
        if (Array.isArray(child)) return;
        flattenEntries(child, path, depth + 1, maxDepth, out);
    });
    return out;
}

function readPath(object, path) {
    if (!object || !path) return undefined;
    return String(path)
        .split(".")
        .reduce((acc, part) => (acc == null ? undefined : acc[part]), object);
}

function pickBestPath(entries, matchers = [], { booleanOnly = false } = {}) {
    const scores = new Map();
    entries.forEach((entry) => {
        const key = String(entry.key || "");
        const path = String(entry.path || "");
        const value = entry.value;
        if (booleanOnly && typeof value !== "boolean") return;
        const score = matchers.reduce((sum, pattern, index) => sum + (pattern.test(key) || pattern.test(path) ? (matchers.length - index) * 10 : 0), 0);
        if (!score) return;
        const diversityBoost = typeof value === "string" && value.trim() ? 2 : typeof value === "boolean" ? 1 : 0;
        scores.set(path, (scores.get(path) || 0) + score + diversityBoost);
    });
    return [...scores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

let cachedSchemaKey = "";
let cachedSchema = null;

export function detectRuntimeSchema(tests = []) {
    const sample = (tests || []).slice(0, 30);
    const key = JSON.stringify(sample.map((test) => ({
        testKeys: Object.keys(test || {}).sort(),
        questionKeys: Object.keys((test?.questions || [])[0] || {}).sort()
    })));
    if (cachedSchema && cachedSchemaKey === key) return cachedSchema;

    const testEntries = [];
    const questionEntries = [];
    sample.forEach((test) => {
        flattenEntries(test, "", 0, 2, testEntries);
        (test?.questions || []).slice(0, 10).forEach((question) => flattenEntries(question, "", 0, 3, questionEntries));
    });

    const schema = {
        test: {
            institutePath: pickBestPath(testEntries, [/^institute$/i, /^provider$/i, /institute/i, /provider/i]),
            programPath: pickBestPath(testEntries, [/^program_id$/i, /^programid$/i, /program_id/i, /programid/i, /^program$/i]),
            programLabelPath: pickBestPath(testEntries, [/^program_name$/i, /^programname$/i, /program_name/i, /programname/i, /program.*name/i])
        },
        question: {
            subjectPath: pickBestPath(questionEntries, [/^subject$/i, /subject/i]),
            sectionPath: pickBestPath(questionEntries, [/^sectiongroup$/i, /^section_group$/i, /sectiongroup/i, /section_group/i, /section/i]),
            microTopicPath: pickBestPath(questionEntries, [/^microtopic$/i, /^micro_topic$/i, /microtopic/i, /micro_topic/i, /topic/i]),
            examInfoPath: pickBestPath(questionEntries, [/^exam_info$/i, /exam.*info/i]),
            sourceLabelPath: pickBestPath(questionEntries, [/source_attribution_label/i, /source.*label/i, /sourceText/i]),
            ncertFlagPath: pickBestPath(questionEntries, [/^is_ncert$/i, /^isncert$/i, /ncert/i], { booleanOnly: true }),
            cancelledFlagPath: pickBestPath(questionEntries, [/cancelled/i, /canceled/i], { booleanOnly: true })
        }
    };

    cachedSchemaKey = key;
    cachedSchema = schema;
    return schema;
}

export function detectTestInstitute(test, schema = detectRuntimeSchema([test])) {
    const direct = readPath(test, schema?.test?.institutePath);
    if (direct != null && String(direct).trim()) return String(direct).trim();
    return String(test?.provider || test?.institute || "").trim();
}

export function detectTestProgram(test, schema = detectRuntimeSchema([test])) {
    const direct = readPath(test, schema?.test?.programPath);
    if (direct != null && String(direct).trim()) return String(direct).trim();
    return String(test?.program_id || test?.program || "").trim();
}

export function detectTestProgramLabel(test, schema = detectRuntimeSchema([test])) {
    const direct = readPath(test, schema?.test?.programLabelPath);
    if (direct != null && String(direct).trim()) return String(direct).trim();
    return String(test?.program_name || detectTestProgram(test, schema) || "").trim();
}

export function detectQuestionSubject(question, schema = detectRuntimeSchema([])) {
    const direct = readPath(question, schema?.question?.subjectPath);
    if (direct != null && String(direct).trim()) return String(direct).trim();
    return String(question?.subject || question?.__subject || question?.subject_name || "").trim();
}

export function detectQuestionSection(question, schema = detectRuntimeSchema([])) {
    const direct = readPath(question, schema?.question?.sectionPath);
    if (direct == null) return String(question?.sectionGroup ?? question?.section_group ?? question?.__sectionGroup ?? "").trim() || null;
    return String(direct).trim() || null;
}

export function detectQuestionMicroTopic(question, schema = detectRuntimeSchema([])) {
    const direct = readPath(question, schema?.question?.microTopicPath);
    if (direct != null && String(direct).trim()) return String(direct).trim();
    return String(question?.microTopic || question?.micro_topic || question?.__tagMicroTopic || "").trim();
}

export function detectQuestionExamInfo(question, schema = detectRuntimeSchema([])) {
    const direct = readPath(question, schema?.question?.examInfoPath);
    if (isPlainObject(direct)) return direct;
    if (isPlainObject(question?.exam_info)) return question.exam_info;
    if (isPlainObject(question?.source?.exam_info)) return question.source.exam_info;
    if (isPlainObject(question?.source?.__vaultMeta?.exam_info)) return question.source.__vaultMeta.exam_info;
    return {};
}

export function detectQuestionFlags(question, schema = detectRuntimeSchema([])) {
    const examInfo = detectQuestionExamInfo(question, schema);
    const ncert = readPath(question, schema?.question?.ncertFlagPath);
    const cancelled = readPath(question, schema?.question?.cancelledFlagPath);
    return {
        is_ncert: ncert != null ? Boolean(ncert) : Boolean(examInfo?.is_ncert || question?.is_ncert || question?.isNcert || question?.isNCERT),
        is_cancelled: cancelled != null ? Boolean(cancelled) : Boolean(question?.is_cancelled || question?.isCancelled || examInfo?.is_cancelled),
        is_pyq: Boolean(examInfo?.isPyq || question?.isPyq),
        is_allied: Boolean(examInfo?.is_allied || question?.is_allied),
        is_others: Boolean(examInfo?.is_others || question?.is_others)
    };
}
