export const v1Scope = [
    "Email/password auth",
    "Test selector by provider and subject",
    "Timer choice before every test",
    "Confidence tags during attempt",
    "Answer change allowed until submit",
    "Review tags after submission",
    "Personal notes",
    "Incorrect/tough/revise filters",
    "Analytics skeleton",
    "Admin import workflow"
];

export const practiceSettings = [
    "Ask before every test whether explanations should appear immediately or only after submission.",
    "Ask before every test whether the session is timed and auto-submit on timer completion.",
    "Store the last two attempts for each question per user, including answer choice and confidence mode.",
    "Allow full reset of a question's attempt history from the review layer.",
    "Track review-only difficulty marking: Easy, Moderate, Hard."
];

export const importTargets = [
    {
        label: "Primary source path",
        value: "Forum/SFG/SFG- 2026 - Level 1/Test 1 SOL Polity Level 1 SFG 2026.pdf"
    },
    {
        label: "Fallback question source",
        value: "Forum/SFG/SFG- 2026 - Level 1/Test 1 QP Polity Level 1 SFG 2026.pdf"
    },
    {
        label: "Import rule",
        value: "Use SOL-only if it contains full English question and options. Fall back to QP + SOL if needed."
    },
    {
        label: "Tagging rule",
        value: "Map to syllabus labels, store original source topic separately, and avoid auto-merging duplicate questions."
    }
];
