import MiniSearch from "minisearch";

let miniSearch = null;

function initEngine() {
    miniSearch = new MiniSearch({
        fields: ["questionText", "statementLines", "options", "microTopic", "subject", "provider", "tags"],
        storeFields: ["id", "testId", "questionNumber", "subject", "provider", "microTopic", "questionText"],
        searchOptions: {
            boost: { questionText: 2, microTopic: 1.5 },
            fuzzy: 0.2,
            prefix: true,
            combineWith: "OR"
        },
        extractField: (document, fieldName) => {
            if (fieldName === "options") {
                return Object.values(document.options || {}).join(" ");
            }
            if (fieldName === "statementLines") {
                return (document.statementLines || []).join(" ");
            }
            if (fieldName === "tags") {
                return (document.reviewTags || []).join(" ");
            }
            return document[fieldName];
        }
    });
}

initEngine();

self.onmessage = (event) => {
    const msg = event.data || {};
    const type = msg.type || "";
    try {
        if (type === "REBUILD_INDEX") {
            initEngine();
            const docs = Array.isArray(msg.docs) ? msg.docs : [];
            if (docs.length) {
                miniSearch.addAll(docs);
            }
            self.postMessage({
                type: "INDEX_READY",
                key: msg.key || "",
                count: docs.length
            });
            return;
        }

        if (type === "QUERY") {
            const query = String(msg.query || "").trim();
            if (!query) {
                self.postMessage({ type: "QUERY_RESULT", key: msg.key || "", results: [] });
                return;
            }
            const matchMode = msg.matchMode === "exact" ? "exact" : "fuzzy";
            const results = miniSearch.search(query, {
                fuzzy: matchMode === "exact" ? 0 : 0.2,
                prefix: matchMode !== "exact",
                combineWith: "OR"
            }).slice(0, Math.max(50, Math.min(Number(msg.limit) || 1500, 3000)));

            self.postMessage({
                type: "QUERY_RESULT",
                key: msg.key || "",
                results
            });
            return;
        }
    } catch (error) {
        self.postMessage({
            type: "WORKER_ERROR",
            phase: type,
            error: error?.message || String(error)
        });
    }
};

