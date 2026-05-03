import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    setDoc,
    where,
    writeBatch
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db } from "../firebase-config.js";
import { appConfig } from "../config/app-config.js";
import { publicCollectionPath, questionStateDocId, testAttemptDocId, userCollectionPath } from "./firestore-paths.js";

function normalizeTableRow(row) {
    if (Array.isArray(row)) {
        return row.reduce((acc, cell, index) => {
            acc[`c${index + 1}`] = cell;
            return acc;
        }, {});
    }

    if (!row || typeof row !== "object") {
        return { c1: row };
    }

    if (Array.isArray(row.cells)) {
        return row.cells.reduce((acc, cell, index) => {
            acc[`c${index + 1}`] = cell;
            return acc;
        }, {});
    }

    return row;
}

function normalizeQuestionBlock(block) {
    if (!block || typeof block !== "object") return block;

    if (block.type === "text") {
        const text = Array.isArray(block.lines)
            ? block.lines.join("\n")
            : String(block.text ?? "");
        return {
            type: "text",
            text
        };
    }

    if (block.type === "table") {
        return {
            type: "table",
            caption: block.caption ?? "",
            headers: Array.isArray(block.headers) ? block.headers.map((header) => String(header)) : [],
            rows: Array.isArray(block.rows) ? block.rows.map(normalizeTableRow) : []
        };
    }

    return block;
}

function normalizeQuestionForFirestore(question) {
    if (!question || typeof question !== "object") return question;

    const nextQuestion = { ...question };

    if (Array.isArray(nextQuestion.questionBlocks)) {
        nextQuestion.questionBlocks = nextQuestion.questionBlocks.map(normalizeQuestionBlock);
    }

    if (nextQuestion.questionTable && typeof nextQuestion.questionTable === "object") {
        nextQuestion.questionTable = normalizeQuestionBlock({
            type: "table",
            ...nextQuestion.questionTable
        });
    }

    return nextQuestion;
}

function normalizeTestForFirestore(test) {
    if (!test || typeof test !== "object") return test;

    return {
        ...test,
        sectionGroup: test.sectionGroup ?? null,
        questionCount: Array.isArray(test.questions) ? test.questions.length : 0,
        questions: Array.isArray(test.questions) ? test.questions.map(normalizeQuestionForFirestore) : []
    };
}

function normalizeAttemptForFirestore(attempt) {
    if (!attempt || typeof attempt !== "object") return attempt;

    return {
        ...attempt,
        questions: Array.isArray(attempt.questions) ? attempt.questions.map(normalizeQuestionForFirestore) : []
    };
}

async function ensurePublicScaffold() {
    const timestamp = new Date().toISOString();
    await setDoc(doc(db, "artifacts", appConfig.appId), {
        id: appConfig.appId,
        updatedAt: timestamp
    }, { merge: true });
    await setDoc(doc(db, "artifacts", appConfig.appId, "public", "shared"), {
        id: "shared",
        scope: "public",
        updatedAt: timestamp
    }, { merge: true });
}

export async function savePublicTest(test) {
    await ensurePublicScaffold();
    const ref = doc(collection(db, ...publicCollectionPath("tests")), test.id);
    const nextTest = normalizeTestForFirestore(test);
    await setDoc(ref, {
        id: nextTest.id,
        title: nextTest.title,
        provider: nextTest.provider,
        series: nextTest.series,
        level: nextTest.level,
        year: nextTest.year,
        subject: nextTest.subject,
        sectionGroup: nextTest.sectionGroup ?? null,
        paperType: nextTest.paperType,
        questionCount: nextTest.questionCount,
        defaultMinutes: nextTest.defaultMinutes,
        sourceMode: nextTest.sourceMode,
        questions: nextTest.questions
    }, { merge: true });
}

export async function saveFullTest(test) {
    await ensurePublicScaffold();
    const ref = doc(collection(db, ...publicCollectionPath("tests")), test.id);
    const nextTest = normalizeTestForFirestore(test);
    await setDoc(ref, nextTest, { merge: true });
}

export async function loadPublicTests() {
    const testsRef = collection(db, ...publicCollectionPath("tests"));
    const snapshot = await getDocs(testsRef);
    return snapshot.docs.map((item) => item.data()).filter((item) => item?.id);
}

export async function deletePublicTest(testId) {
    const ref = doc(collection(db, ...publicCollectionPath("tests")), testId);
    await deleteDoc(ref);
}

export async function saveAttemptAndStates(uid, attempt) {
    const batch = writeBatch(db);
    const attemptsRef = collection(db, ...userCollectionPath(uid, "testAttempts"));
    const attemptId = testAttemptDocId(attempt.testId, attempt.submittedAt || new Date().toISOString());
    const nextAttempt = normalizeAttemptForFirestore(attempt);
    batch.set(doc(attemptsRef, attemptId), {
        id: attemptId,
        testId: nextAttempt.testId,
        title: nextAttempt.title,
        provider: nextAttempt.provider,
        subject: nextAttempt.subject,
        explanationMode: nextAttempt.explanationMode,
        timerMode: nextAttempt.timerMode,
        timerMinutes: nextAttempt.timerMinutes,
        startedAt: nextAttempt.startedAt,
        submittedAt: nextAttempt.submittedAt,
        score: nextAttempt.score,
        questions: nextAttempt.questions
    });

    const stateCollection = collection(db, ...userCollectionPath(uid, "questionStates"));
    nextAttempt.questions.forEach((question) => {
        const prevHistory = Array.isArray(question.attemptsHistory) ? question.attemptsHistory : [];
        const nextHistory = [
            {
                submittedAt: nextAttempt.submittedAt,
                selectedAnswer: question.selectedAnswer,
                confidence: question.confidence,
                wasCorrect: question.selectedAnswer ? question.selectedAnswer === question.correctAnswer : false
            },
            ...prevHistory
        ].slice(0, 2);

        batch.set(doc(stateCollection, questionStateDocId(question.id)), {
            id: question.id,
            testId: attempt.testId,
            questionId: question.id,
            selectedAnswer: question.selectedAnswer,
            confidence: question.confidence,
            note: question.note,
            highlightText: question.highlightText || "",
            savedFolders: question.savedFolders || [],
            reviewTags: question.reviewTags,
            questionTypeTags: question.questionTypeTags || [],
            reviewDifficulty: question.reviewDifficulty,
            isIncorrectLastAttempt: !!question.selectedAnswer && question.selectedAnswer !== question.correctAnswer,
            markedTough: question.reviewTags.includes("Tough"),
            markedMustRevise: question.reviewTags.includes("Must Revise"),
            attemptsHistory: nextHistory,
            updatedAt: nextAttempt.submittedAt
        }, { merge: true });
    });

    await batch.commit();
}

export async function loadLatestAttempt(uid, testId) {
    const attemptsRef = collection(db, ...userCollectionPath(uid, "testAttempts"));
    const snapshot = await getDocs(attemptsRef);
    const matches = snapshot.docs
        .map((item) => item.data())
        .filter((item) => item?.testId === testId);
    if (!matches.length) return null;
    matches.sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());
    return matches[0];
}

export async function loadQuestionStates(uid, testId) {
    const statesRef = collection(db, ...userCollectionPath(uid, "questionStates"));
    const q = query(statesRef, where("testId", "==", testId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((item) => item.data());
}

export async function loadAllQuestionStates(uid) {
    const statesRef = collection(db, ...userCollectionPath(uid, "questionStates"));
    const snapshot = await getDocs(statesRef);
    return snapshot.docs.map((item) => item.data());
}

export async function saveSingleQuestionState(uid, testId, questionId, patch) {
    const stateCollection = collection(db, ...userCollectionPath(uid, "questionStates"));
    await setDoc(doc(stateCollection, questionStateDocId(questionId)), {
        id: questionId,
        testId,
        questionId,
        updatedAt: new Date().toISOString(),
        ...patch
    }, { merge: true });
}

export async function saveAttemptDraft(uid, attempt) {
    const ref = doc(collection(db, ...userCollectionPath(uid, "draftAttempts")), attempt.testId);
    const nextAttempt = normalizeAttemptForFirestore(attempt);
    await setDoc(ref, {
        id: nextAttempt.testId,
        testId: nextAttempt.testId,
        updatedAt: new Date().toISOString(),
        attempt: nextAttempt
    }, { merge: true });
}

export async function loadAttemptDraft(uid, testId) {
    const ref = doc(collection(db, ...userCollectionPath(uid, "draftAttempts")), testId);
    const snapshot = await getDoc(ref);
    return snapshot.exists() ? snapshot.data()?.attempt || null : null;
}

export async function deleteAttemptDraft(uid, testId) {
    const ref = doc(collection(db, ...userCollectionPath(uid, "draftAttempts")), testId);
    await deleteDoc(ref);
}

export async function loadUserSettings(uid) {
    const ref = doc(collection(db, ...userCollectionPath(uid, "settings")), "profile");
    const snapshot = await getDoc(ref);
    return snapshot.exists() ? snapshot.data() : null;
}

export async function saveUserSettings(uid, patch) {
    const ref = doc(collection(db, ...userCollectionPath(uid, "settings")), "profile");
    await setDoc(ref, {
        id: "profile",
        updatedAt: new Date().toISOString(),
        ...patch
    }, { merge: true });
}
