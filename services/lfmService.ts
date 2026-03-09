// LFM 2.5 — Liquid Foundation Models integration
// Audio:   LFM 2.5-Audio-1.5B  — real-time speech-to-speech
// Thinking: LFM 2.5-1.2B-Thinking — internal reasoning traces
//
// TODO: Verify exact endpoint paths and request/response shapes when
//       Liquid AI publishes their stable API spec. The implementation below
//       follows OpenAI-compatible conventions used by most modern LLM providers.

export interface LFMConfig {
  apiKey: string;
  /** e.g. 'lfm-2.5-audio-1.5b' */
  audioModel: string;
  /** e.g. 'lfm-2.5-1.2b-thinking' */
  thinkingModel: string;
  /** Liquid AI API base URL */
  baseURL: string;
}

export interface SpeechToSpeechRequest {
  /** Raw audio bytes or Blob from MediaRecorder */
  audioData: ArrayBuffer | Blob;
  /** H.U.G.H. persona system prompt */
  systemPrompt?: string;
  sessionId: string;
}

export interface SpeechToSpeechResponse {
  /** Response audio as raw PCM/WAV bytes */
  audioData: ArrayBuffer;
  /** ASR transcription of the user's speech */
  transcription: string;
  /** Text of what H.U.G.H. said */
  responseText: string;
  latencyMs: number;
}

export interface ThinkingRequest {
  prompt: string;
  context?: string;
  /** JSON-serialised MCP tool manifest so the model can reason about available actions */
  mcpToolContext?: string;
}

export interface ThinkingResponse {
  /** Scratchpad / chain-of-thought trace */
  reasoning: string;
  /** Final distilled answer */
  answer: string;
  /** 0-1 confidence estimate parsed from model output */
  confidence: number;
  suggestedActions?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────

export class LFMService {
  private config: LFMConfig;

  constructor(config?: Partial<LFMConfig>) {
    this.config = {
      apiKey: (typeof process !== 'undefined' ? process.env.LFM_API_KEY : undefined)
        ?? config?.apiKey
        ?? '',
      audioModel: config?.audioModel ?? 'lfm-2.5-audio-1.5b',
      thinkingModel: config?.thinkingModel ?? 'lfm-2.5-1.2b-thinking',
      // TODO: Update this URL once Liquid AI publishes their public API endpoint
      baseURL: config?.baseURL ?? 'https://api.liquid.ai/v1',
    };
  }

  // ── Speech-to-Speech ────────────────────────────────────────────────────────
  //
  // Sends raw audio to the LFM audio model and receives response audio back.
  // Target latency: sub-100ms for local inference, ~200ms cloud.
  //
  // TODO: Confirm Liquid AI's multimodal audio endpoint shape.
  //       The implementation below assumes an OpenAI-style /audio/chat endpoint
  //       with multipart form data.  If the API uses a WebSocket stream for
  //       true real-time s2s, swap the fetch() call for a WebSocket session.
  async speechToSpeech(request: SpeechToSpeechRequest): Promise<SpeechToSpeechResponse> {
    const t0 = Date.now();

    const blob =
      request.audioData instanceof Blob
        ? request.audioData
        : new Blob([request.audioData], { type: 'audio/webm' });

    const form = new FormData();
    form.append('file', blob, 'input.webm');
    form.append('model', this.config.audioModel);
    form.append('response_format', 'audio');
    if (request.systemPrompt) {
      form.append('system', request.systemPrompt);
    }
    form.append('session_id', request.sessionId);

    // TODO: Verify the exact path — LFM may use /audio/speech-to-speech or /audio/chat
    const res = await fetch(`${this.config.baseURL}/audio/speech-to-speech`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: form,
    });

    if (!res.ok) {
      throw new Error(`LFM audio API error: ${res.status} ${res.statusText}`);
    }

    // TODO: Confirm response envelope shape once Liquid API is stable.
    //       Assumption: JSON with { audio_b64, transcription, response_text }
    //       or binary audio with metadata in response headers.
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const json = await res.json() as {
        audio_b64?: string;
        transcription?: string;
        response_text?: string;
      };
      const audioData = json.audio_b64
        ? _base64ToArrayBuffer(json.audio_b64)
        : new ArrayBuffer(0);
      return {
        audioData,
        transcription: json.transcription ?? '',
        responseText: json.response_text ?? '',
        latencyMs: Date.now() - t0,
      };
    }

    // Binary audio response path
    const audioData = await res.arrayBuffer();
    const transcription = res.headers.get('x-transcription') ?? '';
    const responseText = res.headers.get('x-response-text') ?? '';
    return { audioData, transcription, responseText, latencyMs: Date.now() - t0 };
  }

  // ── Thinking / Reasoning ────────────────────────────────────────────────────
  //
  // Uses the LFM thinking model to produce an explicit reasoning trace before
  // committing to a final answer.  Maps to POST /v1/chat/completions with a
  // thinking-enabled parameter (mirrors Anthropic extended-thinking pattern).
  //
  // TODO: Verify Liquid AI's exact param name for enabling thinking traces
  //       (candidates: "thinking": true, "reasoning_effort": "high", or a
  //        dedicated model suffix like lfm-2.5-1.2b-thinking automatically).
  async thinkAndRespond(request: ThinkingRequest): Promise<ThinkingResponse> {
    const messages: Array<{ role: string; content: string }> = [];

    if (request.context) {
      messages.push({ role: 'system', content: request.context });
    }
    if (request.mcpToolContext) {
      messages.push({
        role: 'system',
        content: `Available MCP tools:\n${request.mcpToolContext}`,
      });
    }
    messages.push({ role: 'user', content: request.prompt });

    const res = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.thinkingModel,
        messages,
        // TODO: Confirm Liquid AI's thinking trace parameter name
        thinking: true,
        temperature: 0.4,
      }),
    });

    if (!res.ok) {
      throw new Error(`LFM thinking API error: ${res.status} ${res.statusText}`);
    }

    // TODO: Map actual Liquid AI response envelope; assuming OpenAI-compatible
    //       chat completions with an optional `thinking` field in each choice.
    const json = await res.json() as {
      choices: Array<{
        message: {
          content: string;
          thinking?: string;
        };
      }>;
    };

    const choice = json.choices[0];
    const answer = choice?.message?.content ?? '';
    const reasoning = choice?.message?.thinking ?? _extractThinkingBlock(answer);

    // Heuristic confidence: look for phrases like "I'm [N]% confident"
    const confidence = _parseConfidence(answer);

    // Extract bullet-pointed suggested actions if present
    const suggestedActions = _extractActions(answer);

    return { reasoning, answer: _stripThinkingBlock(answer), confidence, suggestedActions };
  }

  // ── Availability check ──────────────────────────────────────────────────────

  async isAvailable(): Promise<boolean> {
    if (!this.config.apiKey) return false;
    try {
      // TODO: Replace with actual Liquid AI health endpoint if one exists
      const res = await fetch(`${this.config.baseURL}/models`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        signal: AbortSignal.timeout(4000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ── Fallback: Web Speech API + text response ────────────────────────────────
  //
  // When LFM is unreachable, fall back to the browser's built-in speech
  // recognition to at least capture a transcription.  The caller can then
  // pass the text to geminiService for a text response.
  async fallbackSpeechToText(audioBlob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const SpeechRecognition =
        window.SpeechRecognition ?? window.webkitSpeechRecognition;

      if (!SpeechRecognition) {
        reject(new Error('Web Speech API not available in this browser.'));
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript ?? '';
        resolve(transcript);
      };

      recognition.onerror = (event: any) => {
        reject(new Error(`SpeechRecognition error: ${event.error}`));
      };

      // Web Speech API doesn't accept a Blob directly — it listens from the
      // microphone.  If audio is already captured as a Blob, we attempt to
      // play it through an audio element connected to a MediaStream.
      // This is a best-effort fallback and may not work in all browsers.
      // TODO: Replace with a server-side Whisper endpoint for reliable fallback.
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.play().catch(() => {
        // If playback for transcription isn't possible, reject gracefully
        reject(new Error('Cannot play audio blob for fallback transcription.'));
      });

      recognition.start();
    });
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function _extractThinkingBlock(text: string): string {
  const match = text.match(/<thinking>([\s\S]*?)<\/thinking>/i);
  return match?.[1]?.trim() ?? '';
}

function _stripThinkingBlock(text: string): string {
  return text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
}

function _parseConfidence(text: string): number {
  const match = text.match(/(\d{1,3})\s*%\s*confident/i);
  if (match) return Math.min(parseInt(match[1], 10) / 100, 1);
  if (/\b(certain|definitely|absolutely)\b/i.test(text)) return 0.95;
  if (/\b(likely|probably|should)\b/i.test(text)) return 0.75;
  if (/\b(uncertain|unsure|might)\b/i.test(text)) return 0.45;
  return 0.7; // default mid-confidence
}

function _extractActions(text: string): string[] {
  const lines = text.split('\n');
  return lines
    .filter(l => /^[-•*]\s/.test(l.trim()))
    .map(l => l.replace(/^[-•*]\s+/, '').trim())
    .filter(Boolean)
    .slice(0, 5);
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const lfmService = new LFMService();
