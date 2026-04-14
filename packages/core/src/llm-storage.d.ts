import { LLMConfig } from './llm-provider';
/**
 * ILLMStorage - Abstract interface for persisting LLM configurations.
 */
export interface ILLMStorage {
    getAll(): Promise<LLMConfig[]>;
    getById(id: string): Promise<LLMConfig | undefined>;
    save(config: LLMConfig): Promise<void>;
    delete(id: string): Promise<void>;
    onChanged?: (configs: LLMConfig[]) => void;
}
/**
 * BrowserIndexedDBStorage - Standard web implementation of ILLMStorage.
 */
export declare class BrowserIndexedDBStorage implements ILLMStorage {
    private dbName;
    private storeName;
    private db;
    onChanged?: (configs: LLMConfig[]) => void;
    constructor(dbName?: string);
    private initDB;
    private getStore;
    getAll(): Promise<LLMConfig[]>;
    getById(id: string): Promise<LLMConfig | undefined>;
    save(config: LLMConfig): Promise<void>;
    delete(id: string): Promise<void>;
}
//# sourceMappingURL=llm-storage.d.ts.map