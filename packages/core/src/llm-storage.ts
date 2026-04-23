import { LLMConfig } from './llm-provider';

/**
 * ILLMStorage - Abstract interface for persisting LLM configurations.
 */
export interface ILLMStorage {
    getAll(): Promise<LLMConfig[]>;
    getById(id: string): Promise<LLMConfig | undefined>;
    save(config: LLMConfig): Promise<void>;
    delete(id: string): Promise<void>;
    
    // For reactive updates (Simple event system substitute for signals)
    onChanged?: (configs: LLMConfig[]) => void;
    
    /**
     * Subscribe to changes in the storage.
     * @param callback Function to call when configs change.
     * @returns Unsubscribe function.
     */
    subscribe(callback: (configs: LLMConfig[]) => void): () => void;
}

/**
 * BrowserIndexedDBStorage - Standard web implementation of ILLMStorage.
 */
export class BrowserIndexedDBStorage implements ILLMStorage {
    private dbName = 'HCSLLMDB';
    private storeName = 'configs';
    private db: IDBDatabase | null = null;
    
    private listeners: ((configs: LLMConfig[]) => void)[] = [];
    onChanged?: (configs: LLMConfig[]) => void;

    constructor(dbName?: string) {
        if (dbName) this.dbName = dbName;
    }

    subscribe(callback: (configs: LLMConfig[]) => void): () => void {
        this.listeners.push(callback);
        // Initial trigger with current state if possible, though getAll is async
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    private async notifyListeners() {
        const configs = await this.getAll();
        if (this.onChanged) {
            this.onChanged(configs);
        }
        for (const listener of this.listeners) {
            listener(configs);
        }
    }

    private async initDB(): Promise<IDBDatabase> {
        if (this.db) return this.db;
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
                const target = event.target as IDBOpenDBRequest;
                const db = target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };

            request.onsuccess = (event: Event) => {
                const target = event.target as IDBOpenDBRequest;
                this.db = target.result;
                resolve(this.db);
            };

            request.onerror = (event: Event) => {
                const target = event.target as IDBOpenDBRequest;
                reject(target.error);
            };
        });
    }

    private async getStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
        const db = await this.initDB();
        const transaction = db.transaction(this.storeName, mode);
        return transaction.objectStore(this.storeName);
    }

    async getAll(): Promise<LLMConfig[]> {
        const store = await this.getStore('readonly');
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getById(id: string): Promise<LLMConfig | undefined> {
        const store = await this.getStore('readonly');
        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async save(config: LLMConfig): Promise<void> {
        const store = await this.getStore('readwrite');
        return new Promise((resolve, reject) => {
            const request = store.put(config);
            request.onsuccess = async () => {
                await this.notifyListeners();
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    async delete(id: string): Promise<void> {
        const store = await this.getStore('readwrite');
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = async () => {
                await this.notifyListeners();
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }
}
