/**
 * storage.js - Habit register capability.
 * Summary: Provides a browser capability for the habit register.
 *
 * Author:  KaisarCode
 * Website: https://kaisarcode.com
 * License: https://www.gnu.org/licenses/lgpl-3.0.html
 */

const DB_NAME = "registro-habitos";
const TABLE = "entries";
let dbPromise;

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
function connect() {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(TABLE)) {
                    const store = db.createObjectStore(TABLE, { keyPath: "id" });
                    store.createIndex("occurredAt", "occurredAt");
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    return dbPromise;
}

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
async function transact(mode, action) {
    const db = await connect();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(TABLE, mode);
        const req = action(tx.objectStore(TABLE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        tx.onerror = () => reject(tx.error);
    });
}
export const storage = {

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    async list() {
        const entries = await transact("readonly", store => store.getAll());
        return entries.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    },

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    async save(entry) {
        const now = new Date().toISOString();
        const record = { ...entry, id: entry.id || (globalThis.crypto && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : "entry-" + Date.now() + "-" + Math.random().toString(36).slice(2)), createdAt: entry.createdAt || now, updatedAt: now };
        await transact("readwrite", store => store.put(record));
        return record;
    },

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    async importEntries(records) {
        const db = await connect();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(TABLE, "readwrite");
            const store = tx.objectStore(TABLE);
            let imported = 0, skipped = 0;
            for (const record of records) {
                const request = store.get(record.id);
                request.onsuccess = () => {
                    if (request.result) { skipped++; return; }
                    store.add(record);
                    imported++;
                };
            }
            tx.oncomplete = () => resolve({ imported, skipped });
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error("Import cancelled"));
        });
    },

/**
 * Provides the associated interface operation.
 * @return The operation result.
 */
    async remove(id) { await transact("readwrite", store => store.delete(id)); },
};
