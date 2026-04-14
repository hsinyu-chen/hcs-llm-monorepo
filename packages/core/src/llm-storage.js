"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserIndexedDBStorage = void 0;
/**
 * BrowserIndexedDBStorage - Standard web implementation of ILLMStorage.
 */
class BrowserIndexedDBStorage {
    dbName = 'HCSLLMDB';
    storeName = 'configs';
    db = null;
    onChanged;
    constructor(dbName) {
        if (dbName)
            this.dbName = dbName;
    }
    async initDB() {
        if (this.db)
            return this.db;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = (event) => {
                const target = event.target;
                const db = target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
            request.onsuccess = (event) => {
                const target = event.target;
                this.db = target.result;
                resolve(this.db);
            };
            request.onerror = (event) => {
                const target = event.target;
                reject(target.error);
            };
        });
    }
    async getStore(mode) {
        const db = await this.initDB();
        const transaction = db.transaction(this.storeName, mode);
        return transaction.objectStore(this.storeName);
    }
    async getAll() {
        const store = await this.getStore('readonly');
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    async getById(id) {
        const store = await this.getStore('readonly');
        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    async save(config) {
        const store = await this.getStore('readwrite');
        return new Promise((resolve, reject) => {
            const request = store.put(config);
            request.onsuccess = async () => {
                if (this.onChanged) {
                    const all = await this.getAll();
                    this.onChanged(all);
                }
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }
    async delete(id) {
        const store = await this.getStore('readwrite');
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = async () => {
                if (this.onChanged) {
                    const all = await this.getAll();
                    this.onChanged(all);
                }
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }
}
exports.BrowserIndexedDBStorage = BrowserIndexedDBStorage;
//# sourceMappingURL=llm-storage.js.map