import { useState, useCallback, useRef, useEffect } from 'react';
import { lfmService } from './lfmService';

export interface UseLFMVoiceReturn {
  isListening: boolean;
  isSpeaking: boolean;
  transcription: string;
  response: string;
  latencyMs: number | null;
  error: string | null;
  isAvailable: boolean;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
}

export function useLFMVoice(hugSystemPrompt: string): UseLFMVoiceReturn {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [response, setResponse] = useState('');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionIdRef = useRef(`lfm-session-${Date.now()}`);
  const responseAudioRef = useRef<HTMLAudioElement | null>(null);

  // Check LFM availability once on mount
  useEffect(() => {
    lfmService.isAvailable().then(setIsAvailable);
  }, []);

  const startListening = useCallback(async () => {
    if (isListening) return;
    setError(null);
    setTranscription('');
    setResponse('');
    setLatencyMs(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(250); // collect chunks every 250ms
      setIsListening(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied.';
      setError(msg);
    }
  }, [isListening]);

  const stopListening = useCallback(async () => {
    if (!isListening || !mediaRecorderRef.current) return;

    setIsListening(false);

    await new Promise<void>((resolve) => {
      const recorder = mediaRecorderRef.current!;
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    // Release mic stream
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });
    chunksRef.current = [];

    if (audioBlob.size < 1000) {
      // Too small — probably just noise or silence
      setError('No audio captured — try speaking for a moment before releasing.');
      return;
    }

    if (isAvailable) {
      // ── LFM speech-to-speech path ─────────────────────────────────────────
      try {
        const result = await lfmService.speechToSpeech({
          audioData: audioBlob,
          systemPrompt: hugSystemPrompt,
          sessionId: sessionIdRef.current,
        });

        setTranscription(result.transcription);
        setResponse(result.responseText);
        setLatencyMs(result.latencyMs);

        if (result.audioData.byteLength > 0) {
          await _playAudioBuffer(result.audioData, responseAudioRef, setIsSpeaking);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'LFM request failed.';
        setError(`LFM error: ${msg} — falling back to Web Speech.`);
        await _webSpeechFallback(audioBlob, hugSystemPrompt, setTranscription, setResponse, setError);
      }
    } else {
      // ── Fallback: Web Speech API transcription ────────────────────────────
      await _webSpeechFallback(audioBlob, hugSystemPrompt, setTranscription, setResponse, setError);
    }
  }, [isListening, isAvailable, hugSystemPrompt]);

  return { isListening, isSpeaking, transcription, response, latencyMs, error, isAvailable, startListening, stopListening };
}

// ─── Private helpers ──────────────────────────────────────────────────────────

async function _playAudioBuffer(
  buffer: ArrayBuffer,
  audioRef: React.MutableRefObject<HTMLAudioElement | null>,
  setIsSpeaking: (v: boolean) => void,
): Promise<void> {
  const blob = new Blob([buffer], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);

  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current.src = '';
  }

  const audio = new Audio(url);
  audioRef.current = audio;
  setIsSpeaking(true);

  await new Promise<void>((resolve) => {
    audio.onended = () => {
      URL.revokeObjectURL(url);
      setIsSpeaking(false);
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      setIsSpeaking(false);
      resolve();
    };
    audio.play().catch(() => {
      setIsSpeaking(false);
      resolve();
    });
  });
}

async function _webSpeechFallback(
  audioBlob: Blob,
  _systemPrompt: string,
  setTranscription: (v: string) => void,
  setResponse: (v: string) => void,
  setError: (v: string | null) => void,
): Promise<void> {
  // Web Speech API transcribes from live mic, not a blob.
  // Best-effort: use SpeechRecognition if available and prompt the user.
  // For a richer fallback, wire this into geminiService.sendMessage(transcription).
  try {
    const transcript = await lfmService.fallbackSpeechToText(audioBlob);
    setTranscription(transcript);
    if (transcript) {
      // Placeholder response — caller can hook this into geminiService
      setResponse(`[LFM unavailable — transcription only]: "${transcript}"`);
    }
  } catch {
    setError('Fallback transcription unavailable. Check microphone permissions.');
  }
}
