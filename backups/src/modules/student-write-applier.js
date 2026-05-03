/**
 * Maps queued write kinds to Supabase mutations (single remote entry point for the processor).
 */
import {
    saveAttemptAndStates,
    saveAttemptDraft,
    saveSingleQuestionState,
    saveUserNote,
    saveUserSettings,
    saveSyllabusProgress,
    updateNoteContent,
    addHighlightToNote,
    deleteAttemptDraft,
    deleteUserNote
} from "./supabase-data.js";

export async function applyStudentWrite(kind, payload) {
    switch (kind) {
        case "attempt_draft":
            return saveAttemptDraft(payload.uid, payload.attempt);
        case "question_state":
            return saveSingleQuestionState(
                payload.uid,
                payload.testId,
                payload.questionId,
                payload.patch,
                payload.testMetadata ?? null
            );
        case "attempt_submit":
            return saveAttemptAndStates(payload.uid, payload.attempt);
        case "delete_attempt_draft":
            return deleteAttemptDraft(payload.uid, payload.testId);
        case "user_note":
            return saveUserNote(payload.uid, payload.note);
        case "note_content":
            return updateNoteContent(payload.uid, payload.noteId, payload.content, payload.items);
        case "note_highlight":
            return addHighlightToNote(payload.uid, payload.noteId, payload.highlight);
        case "user_settings":
            return saveUserSettings(payload.uid, payload.patch);
        case "syllabus_progress":
            return saveSyllabusProgress(payload.uid, payload.payload);
        case "delete_user_note":
            return deleteUserNote(payload.uid, payload.noteId);
        default:
            throw new Error(`Unknown student write kind: ${kind}`);
    }
}
