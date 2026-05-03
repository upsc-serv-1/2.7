/**
 * IndexedDB store for durable pending student writes (Phase 0 — trust & data safety).
 * Each record: { id, enqueuedAt, kind, dedupeKey?, payload, failedAttempts, nextAttemptAt, lastError? }
 */

const DB_NAME = "dr_upsc_student_writes_v1";
const DB_VERSION = 1;
const STORE = "pending";

let dbPromise = null;

function openDb() {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onerror = () => reject(req.error);
            req.onsuccess = () => resolve(req.result);
            req.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    db.createObjectStore(STORE, { keyPath: "id" });
                }
            };
        });
    }
    return dbPromise;
}

export async function putWrite(record) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore(STORE).put(record);
    });
}

export async function getWrite(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(id);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
    });
}

export async function deleteWrite(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore(STORE).delete(id);
    });
}

export async function getAllWrites() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}

export async function countWrites() {
    const all = await getAllWrites();
    return all.length;
}

export async function removeByDedupeKey(dedupeKey) {
    if (!dedupeKey) return 0;
    const all = await getAllWrites();
    const targets = all.filter((w) => w.dedupeKey === dedupeKey).map((w) => w.id);
    if (!targets.length) return 0;
    const db = await openDb();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        const store = tx.objectStore(STORE);
        targets.forEach((id) => store.delete(id));
    });
    return targets.length;
}

/** Replace any existing row with the same dedupeKey, then insert. */
export async function upsertPendingWrite(record) {
    if (record.dedupeKey) {
        await removeByDedupeKey(record.dedupeKey);
    }
    await putWrite(record);
}
