import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { GeminiModel } from '../types';

export const LiveSession: React.FC = () => {
  const [connected, setConnected] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<any>(null); // Keep session instance
  
  // Audio Contexts
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  
  const addToLog = (msg: string) => setLog(prev => [...prev.slice(-4), msg]);

  const startSession = async () => {
    try {
        addToLog("Initializing Gemini 2.5 Live...");
        
        // 1. Setup Audio
        inputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { width: 640, height: 480 } });
        
        // Video Preview
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
        }

        // 2. Connect to API
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        let nextStartTime = 0;
        const sources = new Set<AudioBufferSourceNode>();

        // Helpers for Audio
        function createBlob(data: Float32Array) {
            const l = data.length;
            const int16 = new Int16Array(l);
            for (let i = 0; i < l; i++) {
                int16[i] = data[i] * 32768;
            }
            let binary = '';
            const bytes = new Uint8Array(int16.buffer);
            const len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const b64 = btoa(binary);
            return {
                data: b64,
                mimeType: 'audio/pcm;rate=16000',
            };
        }

        function decode(base64: string) {
            const binaryString = atob(base64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes;
        }

        async function decodeAudioData(data: Uint8Array, ctx: AudioContext) {
            const dataInt16 = new Int16Array(data.buffer);
            const frameCount = dataInt16.length;
            const buffer = ctx.createBuffer(1, frameCount, 24000);
            const channelData = buffer.getChannelData(0);
            for (let i = 0; i < frameCount; i++) {
                channelData[i] = dataInt16[i] / 32768.0;
            }
            return buffer;
        }

        const sessionPromise = ai.live.connect({
            model: GeminiModel.LIVE,
            callbacks: {
                onopen: () => {
                    setConnected(true);
                    addToLog("Connected! Start speaking.");
                    
                    // Setup Mic Stream
                    const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                    const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                    scriptProcessor.onaudioprocess = (e) => {
                        const inputData = e.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
                    };
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputAudioContextRef.current!.destination);

                    // Setup Video Stream (1FPS)
                    setInterval(() => {
                        if (canvasRef.current && videoRef.current) {
                            const ctx = canvasRef.current.getContext('2d');
                            canvasRef.current.width = videoRef.current.videoWidth;
                            canvasRef.current.height = videoRef.current.videoHeight;
                            ctx?.drawImage(videoRef.current, 0, 0);
                            const base64 = canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
                            sessionPromise.then(s => s.sendRealtimeInput({ media: { mimeType: 'image/jpeg', data: base64 }}));
                        }
                    }, 1000);
                },
                onmessage: async (msg: LiveServerMessage) => {
                    const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (audioData && outputAudioContextRef.current) {
                        const ctx = outputAudioContextRef.current;
                        nextStartTime = Math.max(nextStartTime, ctx.currentTime);
                        const audioBuffer = await decodeAudioData(decode(audioData), ctx);
                        const source = ctx.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(ctx.destination);
                        source.start(nextStartTime);
                        nextStartTime += audioBuffer.duration;
                        sources.add(source);
                        source.onended = () => sources.delete(source);
                    }
                },
                onclose: () => {
                    setConnected(false);
                    addToLog("Session closed.");
                },
                onerror: (e) => {
                    addToLog("Error: " + JSON.stringify(e));
                }
            },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
                },
                systemInstruction: "You are a helpful, knowledgeable assistant in an app called OmniVis. You can see what the user sees via camera and hear them."
            }
        });
        
        sessionRef.current = sessionPromise;

    } catch (err) {
        console.error(err);
        addToLog("Connection failed.");
    }
  };

  const stopSession = () => {
      // No explicit close method exposed easily in the wrapper without `session` object, 
      // but reloading or navigating away kills it. 
      // Ideally we call session.close() if stored.
      window.location.reload(); // Hard reset for safety in this demo
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 bg-black relative overflow-hidden">
      {/* Visualizer Background Effect */}
      <div className="absolute inset-0 z-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900 via-gray-900 to-black"></div>

      <div className="z-10 w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        
        {/* Camera Feed */}
        <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-700 bg-gray-900 aspect-video">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute top-4 left-4 flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className="text-xs font-mono uppercase text-white/80">{connected ? 'Live Signal' : 'Offline'}</span>
            </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col space-y-6">
            <div>
                <h2 className="text-4xl font-bold text-white mb-2">Live Conversation</h2>
                <p className="text-gray-400">Speak naturally. OmniVis sees and hears you in real-time.</p>
            </div>

            <div className="bg-gray-800/50 p-4 rounded-lg font-mono text-sm text-green-400 h-32 overflow-y-auto border border-gray-700">
                {log.map((l, i) => <div key={i}>{l}</div>)}
                {log.length === 0 && <span className="text-gray-600">Waiting for connection...</span>}
            </div>

            <div className="flex space-x-4">
                {!connected ? (
                    <button onClick={startSession} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/20 transition-all">
                        Connect Live
                    </button>
                ) : (
                    <button onClick={stopSession} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all">
                        End Session
                    </button>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
