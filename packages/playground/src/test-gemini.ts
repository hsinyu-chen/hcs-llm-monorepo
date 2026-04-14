import { GeminiProvider } from '@hcs/llm-provider-gemini';
import { LLMProviderRegistry, LLMManager, BrowserIndexedDBStorage } from '@hcs/llm-core';

/**
 * CLI Test Script for Gemini Provider
 * Run with: npm run test-gemini -- packages/playground
 */

async function runTest() {
    console.log('--- HCS LLM Provider CLI Test (Gemini) ---');

    // 1. Setup Registry and register pure TS provider
    const registry = new LLMProviderRegistry();
    registry.register(new GeminiProvider());
    console.log('Registered providers:', registry.listProviders());

    // 2. Mock storage (since we are in Node, IndexedDB isn't available naturally)
    // In a real Node app, you'd use a FileStorage implementation of ILLMStorage.
    const mockStorage = {
        getAll: async () => [],
        getById: async () => undefined,
        save: async () => {},
        delete: async () => {}
    };

    // 3. Initialize Manager
    const manager = new LLMManager(mockStorage, registry);

    // 4. Get Provider
    const provider = manager.getProvider('gemini');
    if (!provider) {
        console.error('Provider not found!');
        return;
    }

    // 5. Test API Key (Use your own for manual test)
    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) {
        console.warn('⚠️  No GEMINI_API_KEY found in environment variables.');
        console.warn('Skipping actual API call. Logic verification only.');
        return;
    }

    console.log('Sending stream request...');
    
    try {
        const stream = provider.generateContentStream(
            { apiKey, modelId: 'gemini-1.5-flash' },
            [{ role: 'user', parts: [{ text: 'Hello, this is a test from the HCS Monorepo. Please reply with "OK" if you receive this.' }] }],
            'You are a testing script.',
            {}
        );

        for await (const chunk of stream) {
            if (chunk.text) {
                process.stdout.write(chunk.text);
            }
        }
        console.log('\n\n✅ Test completed successfully!');
    } catch (e) {
        console.error('\n❌ Test failed:', e);
    }
}

runTest();
