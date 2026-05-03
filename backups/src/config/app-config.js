export const appConfig = {
    appId: "upsc-vault-test-v1",
    firebaseProjectId: "upsc-vault",
    storageBasePath: "vault/upsc-vault-test-v1",
    adminEmails: [
        "admin@upscvault.com",
        "your@email.com"
    ],
    subjects: [
        "Polity",
        "History",
        "Geography",
        "Economy",
        "Environment",
        "Agriculture",
        "Science & Technology",
        "International Relations",
        "Current Affairs",
        "CSAT",
    ],
    providers: [
        "Vision FLT",
        "Vision Mini",
        "Vajiram PowerUp GS",
        "Vajiram PowerUp CA",
        "Forum SFG Level 1",
        "Forum SFG Level 2",
        "Vajiram Camp",
        "Forum Simulator",
        "Forum PTS",
        "UPSC CSE PYQ",
        "UPSC CSE + CDS + CAPF + Allied PYQ"
    ],
    confidenceTags: [
        "100% Sure",
        "Logical Elimination",
        "Pure Guess",
        "UPSC Funda"
    ],
    reviewTags: [
        "Imp. Fact",
        "Imp. Concept",
        "Trap Question",
        "Must Revise"
    ],
    questionTypeTags: [],
    scoring: {
        correct: 2,
        incorrect: -0.66,
        unattempted: 0
    }
};
