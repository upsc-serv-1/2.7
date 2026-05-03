import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyDzF_y8NkApLHRpvtKt-t7DEas0N3K8Kk0",
    authDomain: "upsc-vault.firebaseapp.com",
    projectId: "upsc-vault",
    storageBucket: "upsc-vault.firebasestorage.app",
    messagingSenderId: "603163559900",
    appId: "1:603163559900:web:4a15014d3a7855a2c53119"
};

const firebaseApp = initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
export default firebaseApp;
