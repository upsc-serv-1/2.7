export const adminBlueprint = {
    importPolicy: [
        "Use SOL-only if full English question and options exist.",
        "Use QP + SOL + Clarification fallback when SOL is incomplete.",
        "Never auto-merge near-duplicate questions without admin confirmation."
    ],
    adminTools: [
        "test import dashboard",
        "duplicate review queue",
        "manual topic-tag correction",
        "question status editor",
        "merge approval queue"
    ]
};
