const PREFIX = "upsc_vault_test_attempt_";

export function persistAttemptLocally(testId, payload) {
    localStorage.setItem(`${PREFIX}${testId}`, JSON.stringify(payload));
}

export function readAttemptLocally(testId) {
    const raw = localStorage.getItem(`${PREFIX}${testId}`);
    return raw ? JSON.parse(raw) : null;
}

export function listAttemptLocally() {
    return Object.keys(localStorage)
        .filter((key) => key.startsWith(PREFIX))
        .map((key) => {
            try {
                return JSON.parse(localStorage.getItem(key));
            } catch {
                return null;
            }
        })
        .filter(Boolean);
}

export function removeAttemptLocally(testId) {
    localStorage.removeItem(`${PREFIX}${testId}`);
}
