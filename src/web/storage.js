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
     * Read one bounded History page, newest first, using the existing
     * occurredAt index. Search terms are checked as the cursor advances:
     * only matching records count toward the page size.
     *
     * after contains the last returned (occurredAt, id) pair. IndexedDB
     * sorts duplicate index keys by primary key, so both fields are needed
     * to avoid repeating/skipping entries sharing a timestamp.
     */
    async listPage({ limit = 25, after = null, from = null, to = null, query = "", category = "" } = {}) {
        const size = Math.max(1, Math.min(100, Math.floor(limit) || 25));
        const db = await connect();
        const lower = from || null;
        const upper = after ? after.occurredAt : (to || null);
        const upperOpen = !after && Boolean(to);
        if (lower && upper && (lower > upper || (lower === upper && upperOpen))) {
            return { items: [], next: null, hasMore: false };
        }
        const range = lower && upper
            ? IDBKeyRange.bound(lower, upper, false, upperOpen)
            : lower ? IDBKeyRange.lowerBound(lower)
                : upper ? IDBKeyRange.upperBound(upper, upperOpen) : null;
        const needle = query.trim().toLocaleLowerCase("es-AR");
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(TABLE, "readonly");
            const request = transaction.objectStore(TABLE).index("occurredAt").openCursor(range, "prev");
            const items = [];
            let settled = false;
            const fail = error => { if (!settled) { settled = true; reject(error); } };
            request.onerror = () => fail(request.error || new Error("Could not read history"));
            transaction.onerror = () => fail(transaction.error || new Error("History transaction failed"));
            transaction.onabort = () => fail(transaction.error || new Error("History transaction aborted"));
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) {
                    if (!settled) { settled = true; resolve({ items, next: null, hasMore: false }); }
                    return;
                }
                const record = cursor.value;
                // Descending traversal includes the boundary's timestamp.
                // Skip the boundary and any already-seen duplicate keys.
                if (after && cursor.key === after.occurredAt
                    && String(cursor.primaryKey) >= String(after.id)) {
                    cursor.continue();
                    return;
                }
                const matches = (!category || record.category === category)
                    && (!needle || [record.description, record.notes, record.category]
                        .join(" ").toLocaleLowerCase("es-AR").includes(needle));
                if (matches) {
                    if (items.length === size) {
                        const last = items[items.length - 1];
                        settled = true;
                        resolve({ items, next: { occurredAt: last.occurredAt, id: last.id }, hasMore: true });
                        return;
                    }
                    items.push(record);
                }
                cursor.continue();
            };
        });
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
