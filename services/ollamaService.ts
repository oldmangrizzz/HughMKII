import { SystemConfig } from "../types";

const getConfig = (): SystemConfig => {
    return JSON.parse(localStorage.getItem('hugh_system_config') || '{}');
};

export const checkOllamaConnection = async (): Promise<boolean> => {
    const config = getConfig();
    const url = config.ollamaUrl || 'http://localhost:11434';
    try {
        const res = await fetch(`${url}/api/tags`);
        return res.ok;
    } catch (e) {
        return false;
    }
};

export const chatWithOllama = async (model: string, messages: any[]) => {
    const config = getConfig();
    const url = config.ollamaUrl || 'http://localhost:11434';
    
    // Convert Gemini format history to Ollama format if needed, 
    // but for now assuming standard role/content structure matches well enough for basic usage.
    const ollamaMessages = messages.map(m => ({
        role: m.role,
        content: typeof m.parts[0].text === 'string' ? m.parts[0].text : ''
    }));

    try {
        const response = await fetch(`${url}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model, // e.g., 'gemini-flash' via ollama or 'llama3'
                messages: ollamaMessages,
                stream: false
            })
        });
        
        if (!response.ok) throw new Error("Ollama Error");
        const data = await response.json();
        
        // Return in a format compatible with our Gemini service expected output
        return {
            text: data.message.content,
            usedModel: `local:${data.model}`
        };
    } catch (e) {
        console.error("Ollama Generation Failed", e);
        throw e;
    }
};
