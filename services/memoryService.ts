// This service mimics the Convex.dev interface. 
// In a real deployment, you would replace the localStorage logic with `convex.query` and `convex.mutation`.

const STORAGE_KEY = 'hugh_episodic_memory';

export interface Memory {
    id: string;
    timestamp: number;
    text: string;
    type: 'episodic' | 'semantic';
    importance: number;
}

export const memoryService = {
    // Mimic mutation
    storeMemory: async (text: string, type: 'episodic' | 'semantic' = 'episodic'): Promise<void> => {
        const memories = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        const newMemory: Memory = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            text,
            type,
            importance: 1 // Baseline
        };
        memories.push(newMemory);
        
        // Prune if too large (simulating DB limits in local storage)
        if (memories.length > 100) {
            memories.shift();
        }
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
        console.log(`[H.U.G.H. Memory] Stored: ${text.substring(0, 20)}...`);
    },

    // Mimic query (Vector search simulation)
    retrieveRelevant: async (query: string): Promise<string> => {
        const memories = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as Memory[];
        // Naive keyword match for simulation. 
        // Real implementation would use Convex vector search.
        const keywords = query.toLowerCase().split(' ').filter(w => w.length > 3);
        
        const relevant = memories.filter(m => {
            return keywords.some(k => m.text.toLowerCase().includes(k));
        }).slice(-5); // Get last 5 relevant

        return relevant.map(m => `[${new Date(m.timestamp).toISOString()}] ${m.text}`).join('\n');
    },

    // Get recent context
    getRecentContext: async (): Promise<string> => {
        const memories = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as Memory[];
        return memories.slice(-5).map(m => `[Prior Interaction] ${m.text}`).join('\n');
    }
};