import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

export function onUserChanged(auth, callback) {
    return onAuthStateChanged(auth, callback);
}

export function signInWithEmailPassword(auth, email, password) {
    return signInWithEmailAndPassword(auth, email, password);
}

export function signUpWithEmailPassword(auth, email, password) {
    return createUserWithEmailAndPassword(auth, email, password);
}

export function sendPasswordReset(auth, email) {
    return sendPasswordResetEmail(auth, email);
}

export function ensureSignedOut(auth) {
    return signOut(auth);
}
