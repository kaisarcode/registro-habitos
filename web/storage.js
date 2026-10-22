// Storage interface: replace this adapter with SQLite without changing capture.
const DB_NAME = "registro-habitos";
const TABLE = "entries";
let dbPromise;

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
    async list() {
        const entries = await transact("readonly", store => store.getAll());
        return entries.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    },
    async save(entry) {
        const now = new Date().toISOString();
        const record = { ...entry, id: entry.id || crypto.randomUUID(), createdAt: entry.createdAt || now, updatedAt: now };
        await transact("readwrite", store => store.put(record));
        return record;
    },
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
    async remove(id) { await transact("readwrite", store => store.delete(id)); },
};
