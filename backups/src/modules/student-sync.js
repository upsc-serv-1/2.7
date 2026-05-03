/**
 * Phase 0 — Trust & data safety: local IndexedDB queue → Supabase with retry/backoff.
 *
 * AUDIT — Student data mutation paths (ensure local-first → remote; reads stay in supabase-data):
 * - Routed here (IndexedDB + Supabase): saveAttemptDraft, saveSingleQuestionState, saveAttemptAndStates,
 *   deleteAttemptDraft, saveUserNote, updateNoteContent, addHighlightToNote, deleteUserNote,
 *   saveUserSettings, saveSyllabusProgress (tracker imports this module).
 * - Remote-only / not queued (follow-up if policy tightens): flashcard-data.js (user_cards, folders,
 *   study_sessions, card_folder_map), admin/content saves (saveFullTest, deletePublicTest), firestore-data.js.
 */

import {
    upsertPendingWrite,
    deleteWrite,
    getWrite,
    getAllWrites,
    countWrites
} from "./pending-writes-store.js";
import { applyStudentWrite } from "./student-write-applier.js";

const MAX_BACKOFF_MS = 60_000;
const BASE_BACKOFF_MS = 1000;
const FLUSH_DEBOUNCE_MS = 120;
const SAVED_UI_CLEAR_MS = 2200;

let uiCallback = null;
let processTimer = null;
let savedClearTimer = null;
let activeFlush = null;

function emitUi(patch) {
    if (typeof uiCallback === "function") {
        uiCallback(patch);
    }
}

function scheduleSavedClear() {
    if (savedClearTimer) clearTimeout(savedClearTimer);
    savedClearTimer = setTimeout(async () => {
        const n = await countWrites();
        if (n === 0) {
            emitUi({ phase: "idle", pending: 0, detail: "" });
        }
    }, SAVED_UI_CLEAR_MS);
}

function nextBackoffMs(failedAttempts) {
    return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, failedAttempts - 1));
}

async function updateWriteBackoff(id, errMsg) {
    const w = await getWrite(id);
    if (!w) return;
    const failedAttempts = (w.failedAttempts || 0) + 1;
    const delay = nextBackoffMs(failedAttempts);
    await upsertPendingWrite({
        ...w,
        failedAttempts,
        lastError: String(errMsg || "error"),
        nextAttemptAt: Date.now() + delay
    });
}

async function refreshPendingUi() {
    const pending = await countWrites();
    emitUi({ phase: pending > 0 ? "pending" : "idle", pending });
}

/**
 * @param {{ setStatus: (patch: object) => void }} hooks
 */
export function initStudentSync(hooks) {
    uiCallback = hooks?.setStatus || null;

    window.addEventListener("online", () => {
        emitUi({ phase: "saving", detail: "" });
        scheduleProcessSoon();
    });
    window.addEventListener("offline", () => {
        emitUi({ phase: "offline", detail: "No network" });
    });

    const runFlush = (deadlineMs) => {
        void flushPendingWrites({ deadlineMs });
    };

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
            runFlush(4500);
        }
    });
    window.addEventListener("pagehide", () => {
        runFlush(2500);
    });

    scheduleProcessSoon();
}

export function scheduleProcessSoon() {
    if (processTimer) clearTimeout(processTimer);
    processTimer = setTimeout(() => {
        processTimer = null;
        void processDueWrites({ deadlineMs: 60_000 });
    }, FLUSH_DEBOUNCE_MS);
}

export async function flushPendingWrites(options = {}) {
    const deadlineMs = options.deadlineMs ?? 8000;
    if (activeFlush) {
        return activeFlush;
    }
    activeFlush = processDueWrites({ deadlineMs }).finally(() => {
        activeFlush = null;
    });
    return activeFlush;
}

export async function processDueWrites(options = {}) {
    const deadline = Date.now() + (options.deadlineMs ?? 60_000);

    while (Date.now() < deadline) {
        const all = await getAllWrites();
        const due = all
            .filter((w) => (w.nextAttemptAt ?? 0) <= Date.now())
            .sort((a, b) => (a.enqueuedAt || 0) - (b.enqueuedAt || 0));
        if (!due.length) break;

        const w = due[0];
        if (!navigator.onLine) {
            emitUi({ phase: "offline", pending: all.length, detail: "Queued locally" });
            break;
        }

        emitUi({ phase: "saving", pending: all.length, detail: "" });
        try {
            await applyStudentWrite(w.kind, w.payload);
            await deleteWrite(w.id);
            const remaining = await countWrites();
            emitUi({ phase: "saved", pending: remaining, detail: "" });
            scheduleSavedClear();
        } catch (err) {
            await updateWriteBackoff(w.id, err?.message || err);
            const remaining = await countWrites();
            emitUi({
                phase: navigator.onLine ? "error" : "offline",
                pending: remaining,
                detail: String(err?.message || err || "Sync failed")
            });
            const delay = nextBackoffMs((await getWrite(w.id))?.failedAttempts || 1);
            if (Date.now() + delay < deadline) {
                await new Promise((r) => setTimeout(r, Math.min(delay, deadline - Date.now())));
            } else {
                break;
            }
        }
    }

    await refreshPendingUi();
}

/**
 * @returns {{ applied: boolean, result?: any, error?: Error }}
 */
async function enqueueAndTry(kind, payload, dedupeKey) {
    const id = crypto.randomUUID();
    const enqueuedAt = Date.now();
    const record = {
        id,
        enqueuedAt,
        kind,
        dedupeKey: dedupeKey || null,
        payload,
        failedAttempts: 0,
        nextAttemptAt: enqueuedAt,
        lastError: null
    };
    await upsertPendingWrite(record);
    emitUi({ phase: "saving", pending: await countWrites(), detail: "" });

    if (!navigator.onLine) {
        emitUi({ phase: "offline", pending: await countWrites(), detail: "Saved on device" });
        scheduleProcessSoon();
        return { applied: false, error: new Error("offline") };
    }

    try {
        const result = await applyStudentWrite(kind, payload);
        await deleteWrite(id);
        emitUi({ phase: "saved", pending: await countWrites(), detail: "" });
        scheduleSavedClear();
        return { applied: true, result };
    } catch (err) {
        await updateWriteBackoff(id, err?.message || err);
        emitUi({
            phase: "error",
            pending: await countWrites(),
            detail: String(err?.message || err)
        });
        scheduleProcessSoon();
        return { applied: false, error: err };
    }
}

export async function saveAttemptDraft(uid, attempt) {
    const dedupeKey = `attempt_draft:${uid}:${attempt?.testId}`;
    await enqueueAndTry("attempt_draft", { uid, attempt }, dedupeKey);
}

export async function saveSingleQuestionState(uid, testId, questionId, patch, testMetadata = null) {
    const dedupeKey = `question_state:${uid}:${testId}:${questionId}`;
    const { applied, error } = await enqueueAndTry(
        "question_state",
        { uid, testId, questionId, patch, testMetadata },
        dedupeKey
    );
    if (!applied && error && error.message !== "offline") {
        throw error;
    }
    if (!applied && error?.message === "offline") {
        throw new Error("Network unavailable — changes are saved on this device and will sync when online.");
    }
}

export async function saveAttemptAndStates(uid, attempt) {
    const submittedAt = attempt?.submittedAt || new Date().toISOString();
    const dedupeKey = `attempt_submit:${uid}:${attempt?.testId}:${submittedAt}`;
    const { applied, error } = await enqueueAndTry("attempt_submit", { uid, attempt }, dedupeKey);
    if (!applied && error && error.message !== "offline") {
        throw error;
    }
    if (!applied && error?.message === "offline") {
        throw new Error("Network unavailable — attempt is saved on this device; will sync when online.");
    }
}

export async function deleteAttemptDraft(uid, testId) {
    const dedupeKey = `delete_draft:${uid}:${testId}`;
    await enqueueAndTry("delete_attempt_draft", { uid, testId }, dedupeKey);
}

export async function saveUserNote(uid, note) {
    const noteWithId = { ...note, id: note.id || crypto.randomUUID() };
    const dedupeKey = `user_note:${uid}:${noteWithId.id}`;
    const { applied, result, error } = await enqueueAndTry(
        "user_note",
        { uid, note: noteWithId },
        dedupeKey
    );
    if (applied) {
        return result;
    }
    throw new Error(`${error?.message || "Sync failed"} — saved on this device; will sync when online.`);
}

export async function updateNoteContent(uid, noteId, content, items) {
    const dedupeKey = `note_content:${uid}:${noteId}`;
    const { applied, error } = await enqueueAndTry(
        "note_content",
        { uid, noteId, content, items },
        dedupeKey
    );
    if (!applied && error && error.message !== "offline") {
        throw error;
    }
    if (!applied && error?.message === "offline") {
        throw new Error("Network unavailable — note is saved on this device and will sync when online.");
    }
}

export async function addHighlightToNote(uid, noteId, highlight) {
    const dedupeKey = `note_highlight:${uid}:${noteId}:${crypto.randomUUID()}`;
    const { applied, error } = await enqueueAndTry(
        "note_highlight",
        { uid, noteId, highlight },
        dedupeKey
    );
    if (!applied && error && error.message !== "offline") {
        throw error;
    }
    if (!applied && error?.message === "offline") {
        throw new Error("Network unavailable — queued on this device.");
    }
}

export async function deleteUserNote(uid, noteId) {
    const dedupeKey = `delete_note:${uid}:${noteId}`;
    const { applied, error } = await enqueueAndTry("delete_user_note", { uid, noteId }, dedupeKey);
    if (!applied && error && error.message !== "offline") {
        throw error;
    }
    if (!applied && error?.message === "offline") {
        throw new Error("Network unavailable — delete will sync when online.");
    }
}

export async function saveUserSettings(uid, patch) {
    const { applied, error } = await enqueueAndTry("user_settings", { uid, patch }, null);
    if (!applied && error && error.message !== "offline") {
        throw error;
    }
    if (!applied && error?.message === "offline") {
        throw new Error("Network unavailable — settings saved on this device and will sync when online.");
    }
}

export async function saveSyllabusProgress(uid, payload) {
    const dedupeKey = `syllabus_progress:${uid}`;
    const { applied, error } = await enqueueAndTry("syllabus_progress", { uid, payload }, dedupeKey);
    if (!applied && error && error.message !== "offline") {
        throw error;
    }
    if (!applied && error?.message === "offline") {
        throw new Error("Network unavailable — progress saved on this device and will sync when online.");
    }
}
