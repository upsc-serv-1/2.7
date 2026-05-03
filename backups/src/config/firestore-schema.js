export const firestoreSchema = [
    {
        path: "artifacts/upsc-vault-test-v1/public/tests",
        title: "Tests",
        summary: "Master test metadata: provider, series, level, subject, timing defaults, and import status."
    },
    {
        path: "artifacts/upsc-vault-test-v1/public/questions",
        title: "Questions",
        summary: "Question bank with unique IDs, options, correct answers, explanation markdown, and syllabus tags."
    },
    {
        path: "artifacts/upsc-vault-test-v1/public/imports",
        title: "Imports",
        summary: "Tracks source PDF paths, import mode, extraction notes, and admin review state."
    },
    {
        path: "artifacts/upsc-vault-test-v1/users/{uid}/questionStates",
        title: "Question States",
        summary: "Per-student tags, last two attempts, notes, confidence choice, and review metadata."
    },
    {
        path: "artifacts/upsc-vault-test-v1/users/{uid}/testAttempts",
        title: "Test Attempts",
        summary: "Per-test sessions with score, timing, filters used, explanation mode, and analytics aggregates."
    },
    {
        path: "artifacts/upsc-vault-test-v1/users/{uid}/reports",
        title: "Reports Cache",
        summary: "Optional cached summaries for faster dashboards and downloadable reports."
    },
    {
        path: "artifacts/upsc-vault-test-v1/admin/importLogs",
        title: "Admin Logs",
        summary: "Import audit trail, merge decisions, duplicate review, and manual topic-tag corrections."
    }
];
