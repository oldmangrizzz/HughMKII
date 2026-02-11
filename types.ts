export enum AppMode {
  DASHBOARD = 'DASHBOARD',
  CHAT = 'CHAT', 
  VISUALIZER = 'VISUALIZER', 
  MEDIA_STUDIO = 'MEDIA_STUDIO', 
  ANALYZER = 'ANALYZER', 
  LIVE = 'LIVE',
  SYSTEM = 'SYSTEM',
  HOME_CONTROL = 'HOME_CONTROL', // Home Assistant
  SITUATIONAL_AWARENESS = 'SITUATIONAL_AWARENESS' // Mapbox
}

export enum GeminiModel {
  FLASH_LITE = 'gemini-flash-lite-latest',
  FLASH_PREVIEW = 'gemini-3-flash-preview',
  PRO_PREVIEW = 'gemini-3-pro-preview',
  PRO_IMAGE = 'gemini-3-pro-image-preview',
  FLASH_IMAGE = 'gemini-2.5-flash-image',
  VEO_FAST = 'veo-3.1-fast-generate-preview',
  VEO_GENERATE = 'veo-3.1-generate-preview',
  TTS = 'gemini-2.5-flash-preview-tts',
  MAPS_GROUNDING = 'gemini-2.5-flash',
  LIVE = 'gemini-2.5-flash-native-audio-preview-12-2025'
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text?: string;
  images?: string[]; 
  timestamp: number;
  isThinking?: boolean;
  groundingUrls?: Array<{title: string, uri: string}>;
  modelUsed?: string; 
  toolCalls?: string[];
}

export interface MapNode {
  id: string;
  label: string;
  description: string;
  category: string; 
  step?: number; 
}

export interface MapData {
  title: string;
  type: 'timeline' | 'process' | 'concept';
  nodes: MapNode[];
}

export interface VisualizationData {
  type: 'line' | 'bar' | 'scatter' | 'pie';
  title: string;
  xAxisKey: string;
  data: any[];
  description: string;
}

export interface SystemModule {
  id: string;
  name: string;
  status: 'active' | 'degraded' | 'offline';
  modelTarget: string;
  fallbackModel: string;
  description: string;
  configKey?: string; // Key for local storage config
}

export interface SystemConfig {
  ollamaUrl: string;
  homeAssistantUrl: string;
  homeAssistantToken: string;
  mapboxToken: string;
  useLocalLlm: boolean;
  // Middleware Integration
  useSpinalCord: boolean;
  spinalCordUrl: string; // e.g., http://localhost:4000
}

declare global {
  interface AIStudio {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
  }

  interface Window {
    webkitAudioContext: typeof AudioContext;
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    aistudio?: AIStudio;
    mapboxgl: any;
  }
}