export const authBlueprint = {
    providers: ["email-password"],
    roles: ["student", "admin"],
    signupMode: "open",
    adminCount: 1,
    notes: [
        "Use email/password in version 1.",
        "Keep admin tools role-gated in Firestore rules, not just hidden in the UI."
    ]
};
