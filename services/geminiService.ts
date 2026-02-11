import { GoogleGenAI, Type, FunctionDeclaration, Modality } from "@google/genai";
import { GeminiModel, MapData, VisualizationData, SystemConfig } from "../types";
import { getSystemPrompt } from "./soul";
import { memoryService } from "./memoryService";
import { chatWithOllama } from "./ollamaService";
import { callHAService } from "./homeAssistant";

// Helper to ensure API Key is ready for paid features
export const ensureApiKey = async (): Promise<void> => {
  if (window.aistudio) {
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await window.aistudio.openSelectKey();
    }
  }
};

const getClient = async () => {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const getConfig = (): SystemConfig => {
    return JSON.parse(localStorage.getItem('hugh_system_config') || '{}');
};

// --- TOOLS ---

const homeControlTool: FunctionDeclaration = {
    name: "control_home_device",
    description: "Control a smart home device via Home Assistant. Use this to turn lights on/off, switches, etc.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            domain: { type: Type.STRING, description: "The domain, e.g., 'light', 'switch'." },
            service: { type: Type.STRING, description: "The service, e.g., 'turn_on', 'turn_off'." },
            entity_id: { type: Type.STRING, description: "The entity ID, e.g., 'light.living_room'." }
        },
        required: ["domain", "service", "entity_id"]
    }
};

// --- ORCHESTRATOR ---

const generateWithFallback = async (primaryModel: string, operation: (model: string) => Promise<any>): Promise<{response: any, usedModel: string}> => {
    const config = getConfig();
    
    // 1. Try Local First if configured
    if (config.useLocalLlm) {
        try {
            console.log("[H.U.G.H.] Attempting Local Neuro-Link (Ollama)...");
            // We pass a special flag or handle this in the operation wrapper
            const res = await operation("local-model"); 
            return { response: res, usedModel: "Ollama (Local)" };
        } catch (e) {
            console.warn("[H.U.G.H.] Local link failed. Re-routing to Cloud Uplink.");
        }
    }

    // 2. Try Primary Cloud
    try {
        const res = await operation(primaryModel);
        return { response: res, usedModel: primaryModel };
    } catch (error: any) {
        console.warn(`[H.U.G.H. System] Model ${primaryModel} failed. Degrading...`);
        
        // 3. Fallback Logic
        let fallbackModel = GeminiModel.FLASH_PREVIEW;
        if (primaryModel === GeminiModel.PRO_PREVIEW) fallbackModel = GeminiModel.FLASH_PREVIEW;
        else if (primaryModel === GeminiModel.FLASH_PREVIEW) fallbackModel = GeminiModel.FLASH_LITE;
        else throw error; 

        try {
             const res = await operation(fallbackModel);
             return { response: res, usedModel: fallbackModel };
        } catch (e2) {
            throw e2; 
        }
    }
};

// --- TEXT & CHAT ---

export const sendChatMessage = async (
  model: string,
  history: any[],
  message: string,
  imagePart?: string,
  tools: 'none' | 'search' | 'maps' | 'home' = 'none',
  thinking: boolean = false
) => {
  const ai = await getClient();
  const context = await memoryService.retrieveRelevant(message);
  const systemInstruction = getSystemPrompt(context);
  memoryService.storeMemory(`User: ${message}`, 'episodic');

  const performChat = async (targetModel: string) => {
      // HANDLE LOCAL OLLAMA
      if (targetModel === "local-model") {
          const config = getConfig();
          // Construct message list for Ollama
          const msgs = [
              { role: 'system', parts: [{ text: systemInstruction }] },
              ...history,
              { role: 'user', parts: [{ text: message }] }
          ];
          return await chatWithOllama('gemini-flash', msgs); // Assuming user pulled 'gemini-flash' in ollama
      }

      // HANDLE GOOGLE CLOUD
      let config: any = { systemInstruction };

      // Thinking Mode
      if (thinking && targetModel === GeminiModel.PRO_PREVIEW) {
          config.thinkingConfig = { thinkingBudget: 32768 };
      }

      // Tool Config
      const toolDefs: any[] = [];
      if (tools === 'search') toolDefs.push({ googleSearch: {} });
      if (tools === 'maps' && targetModel === GeminiModel.MAPS_GROUNDING) toolDefs.push({ googleMaps: {} });
      if (tools === 'home' || tools === 'none') {
          // Always allow home control if we are in general chat or explicitly asked
          // But only if we have config
          const sysConfig = getConfig();
          if (sysConfig.homeAssistantToken) {
             toolDefs.push({ functionDeclarations: [homeControlTool] });
          }
      }
      
      if (toolDefs.length > 0) config.tools = toolDefs;

      const chat = ai.chats.create({
          model: targetModel,
          config: config,
          history: history
      });

      const result = await chat.sendMessage({ message: message });
      
      // Handle Function Calls (Home Assistant) automatically
      const functionCalls = result.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
          const call = functionCalls[0];
          if (call.name === "control_home_device") {
              const { domain, service, entity_id } = call.args as any;
              console.log(`[H.U.G.H.] Executing Home Protocol: ${domain}.${service} on ${entity_id}`);
              await callHAService(domain, service, entity_id);
              // Send tool response back to model
              return await chat.sendMessage({
                  functionResponses: [{
                      id: call.id,
                      name: call.name,
                      response: { result: "Device command executed successfully." }
                  }]
              });
          }
      }

      return result;
  };

  const { response, usedModel } = await generateWithFallback(model, performChat);
  
  if (response.text) {
      memoryService.storeMemory(`H.U.G.H.: ${response.text}`, 'episodic');
  }

  return { ...response, usedModel };
};

export const generateMap = async (prompt: string): Promise<MapData> => {
    const ai = await getClient();
    const performGen = async (m: string) => {
        return await ai.models.generateContent({
            model: m,
            contents: `Create a structured map based on: "${prompt}". Return ONLY JSON matching MapData schema.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        type: { type: Type.STRING, enum: ['timeline', 'process', 'concept'] },
                        nodes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    label: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    category: { type: Type.STRING },
                                    step: { type: Type.INTEGER }
                                },
                                required: ['id', 'label', 'description', 'category']
                            }
                        }
                    },
                    required: ['title', 'type', 'nodes']
                }
            }
        });
    };
    const { response } = await generateWithFallback(GeminiModel.PRO_PREVIEW, performGen);
    return JSON.parse(response.text || "{}");
};

export const generateVisualization = async (prompt: string): Promise<VisualizationData> => {
    const ai = await getClient();
    const performGen = async (m: string) => {
        return await ai.models.generateContent({
            model: m,
            contents: `Generate visualization data for: "${prompt}". Return ONLY JSON.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        type: { type: Type.STRING, enum: ['line', 'bar', 'scatter', 'pie'] },
                        title: { type: Type.STRING },
                        xAxisKey: { type: Type.STRING },
                        description: { type: Type.STRING },
                        data: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {} } }
                    }
                }
            }
        });
    }
    const { response } = await generateWithFallback(GeminiModel.PRO_PREVIEW, performGen);
    return JSON.parse(response.text || "{}");
};

// --- MEDIA GENERATION ---
// (Kept similar, omitting for brevity as they don't change logic, just standard export)
export const generateImage = async (prompt: string, aspectRatio: string = "1:1", size: string = "1K", model: string = GeminiModel.PRO_IMAGE) => {
    await ensureApiKey();
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const config: any = { imageConfig: { aspectRatio: aspectRatio } };
    if (model === GeminiModel.PRO_IMAGE) config.imageConfig.imageSize = size;
    const response = await ai.models.generateContent({ model: model, contents: { parts: [{ text: prompt }] }, config: config });
    for (const part of response.candidates?.[0]?.content?.parts || []) { if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`; }
    return null;
};

export const editImage = async (base64Image: string, prompt: string) => {
    const ai = await getClient();
    const response = await ai.models.generateContent({ model: GeminiModel.FLASH_IMAGE, contents: { parts: [{ inlineData: { mimeType: 'image/png', data: base64Image } }, { text: prompt }] } });
     for (const part of response.candidates?.[0]?.content?.parts || []) { if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`; }
    return null;
}

export const generateVideo = async (prompt: string, aspectRatio: '16:9' | '9:16', imageBase64?: string) => {
    await ensureApiKey();
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    let request: any = { model: GeminiModel.VEO_FAST, config: { numberOfVideos: 1, aspectRatio: aspectRatio, resolution: '720p' } };
    if (imageBase64) { request.image = { imageBytes: imageBase64, mimeType: 'image/png' }; request.prompt = prompt || "Animate this image"; } else { request.prompt = prompt; }
    let operation = await ai.models.generateVideos(request);
    while (!operation.done) { await new Promise(resolve => setTimeout(resolve, 5000)); operation = await ai.operations.getVideosOperation({ operation }); }
    const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (uri) { const videoRes = await fetch(`${uri}&key=${process.env.API_KEY}`); const blob = await videoRes.blob(); return URL.createObjectURL(blob); }
    return null;
};

export const transcribeAudio = async (audioBase64: string) => {
    const ai = await getClient();
    const response = await ai.models.generateContent({ model: GeminiModel.FLASH_PREVIEW, contents: { parts: [{ inlineData: { mimeType: 'audio/wav', data: audioBase64 } }, { text: "Transcribe this audio." }] } });
    return response.text;
};

export const analyzeVideo = async (videoBase64: string, prompt: string) => {
    await ensureApiKey(); 
    const ai = await getClient();
    const response = await ai.models.generateContent({ model: GeminiModel.PRO_PREVIEW, contents: { parts: [{ inlineData: { mimeType: 'video/mp4', data: videoBase64 } }, { text: prompt }] } });
    return response.text;
};

export const textToSpeech = async (text: string) => {
    const ai = await getClient();
    const response = await ai.models.generateContent({ model: GeminiModel.TTS, contents: { parts: [{ text }] }, config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } } });
    const base64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64) {
         const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
         const binaryString = atob(base64); const len = binaryString.length; const bytes = new Uint8Array(len); for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
         const dataInt16 = new Int16Array(bytes.buffer); const frameCount = dataInt16.length; const audioBuffer = ctx.createBuffer(1, frameCount, 24000); const channelData = audioBuffer.getChannelData(0); for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i] / 32768.0;
         const source = ctx.createBufferSource(); source.buffer = audioBuffer; source.connect(ctx.destination); source.start();
    }
};