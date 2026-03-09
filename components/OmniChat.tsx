import React, { useState, useRef, useEffect, useCallback } from 'react';
import { streamToHugh, HughMessage } from '../services/hughService';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  streaming?: boolean;
}

export const OmniChat: React.FC = () => {
  const [history, setHistory] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(scrollToBottom, [history]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text.trim(),
      timestamp: Date.now(),
    };

    setHistory(prev => [...prev, userMsg]);
    setLoading(true);

    const aiMsgId = (Date.now() + 1).toString();
    const aiMsg: Message = {
      id: aiMsgId,
      role: 'assistant',
      text: '',
      timestamp: Date.now(),
      streaming: true,
    };
    setHistory(prev => [...prev, aiMsg]);

    // Build message history for context
    const contextMessages: HughMessage[] = history
      .slice(-10)
      .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
    contextMessages.push({ role: 'user', content: text.trim() });

    await streamToHugh(
      contextMessages,
      (chunk) => {
        setHistory(prev =>
          prev.map(m =>
            m.id === aiMsgId ? { ...m, text: m.text + chunk } : m
          )
        );
      },
      () => {
        setHistory(prev =>
          prev.map(m =>
            m.id === aiMsgId ? { ...m, streaming: false } : m
          )
        );
        setLoading(false);
      }
    );
  }, [loading, history]);

  const handleSend = useCallback(() => {
    sendMessage(input);
    setInput('');
  }, [input, sendMessage]);

  // Listen for voice-submit events from VoicePortal
  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as CustomEvent<{ text: string }>).detail?.text;
      if (text) sendMessage(text);
    };
    window.addEventListener('hugh:voice-submit', handler);
    return () => window.removeEventListener('hugh:voice-submit', handler);
  }, [sendMessage]);

  const handleMic = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('Speech recognition not supported.'); return; }

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const rec = new SpeechRecognition();
    recognitionRef.current = rec;
    rec.continuous = false;
    rec.interimResults = false;
    rec.onstart = () => setIsListening(true);
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    rec.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };
    rec.start();
  };

  return (
    <div className="h-full flex flex-col bg-grizzly-900">
      {/* Header */}
      <div className="h-16 border-b border-grizzly-800 flex items-center justify-between px-6 bg-grizzly-900/90 backdrop-blur">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 bg-highland-500 rounded-full animate-pulse-slow"></span>
          <h2 className="text-lg font-bold text-gray-200 font-mono">Secure Comms</h2>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-mono text-highland-400 uppercase tracking-wider">LFM / Local</span>
          <div className="w-1.5 h-1.5 bg-highland-500 rounded-full animate-pulse"></div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {history.length === 0 && (
          <div className="text-center text-gray-600 mt-20 opacity-60">
            <div className="w-20 h-20 bg-grizzly-800 rounded-full flex items-center justify-center mx-auto mb-6 border border-grizzly-700">
              <span className="material-icons-outlined text-4xl text-highland-500">fingerprint</span>
            </div>
            <p className="font-mono text-sm">H.U.G.H. System Online.</p>
            <p className="text-xs mt-2">LFM inference active. GrizzlyMedicine Protocol engaged.</p>
          </div>
        )}

        {history.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl px-5 py-4 ${
              msg.role === 'user'
                ? 'bg-highland-900/30 border border-highland-600/30 text-gray-100 rounded-br-none'
                : 'bg-grizzly-800 text-gray-200 rounded-bl-none border border-grizzly-700'
            }`}>
              {msg.streaming && msg.text === '' && (
                <span className="text-xs text-highland-500 font-mono animate-pulse">Processing...</span>
              )}
              <p className="whitespace-pre-wrap leading-relaxed text-sm font-sans">{msg.text}</p>
              {msg.streaming && msg.text !== '' && (
                <span className="inline-block w-1.5 h-3.5 bg-highland-500 ml-0.5 animate-pulse align-middle"></span>
              )}
              {msg.role === 'assistant' && !msg.streaming && (
                <div className="mt-2 flex justify-end">
                  <span className="text-[9px] font-mono text-gray-600 uppercase">H.U.G.H. / LFM</span>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-grizzly-900 border-t border-grizzly-800">
        <div className="relative flex items-center bg-grizzly-800 rounded-xl border border-grizzly-700 focus-within:border-highland-500/50 focus-within:ring-1 focus-within:ring-highland-500/50 transition-all">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={isListening ? 'Listening...' : 'Execute command...'}
            className="flex-1 bg-transparent text-gray-200 px-4 py-4 focus:outline-none placeholder-gray-600 font-mono text-sm"
          />
          <div className="flex items-center pr-2 space-x-2">
            <button
              onClick={handleMic}
              className={`p-2 rounded-lg transition-all ${
                isListening
                  ? 'bg-munro-red text-white animate-pulse'
                  : 'text-gray-400 hover:text-white hover:bg-grizzly-700'
              }`}
              title="Voice Input"
            >
              <span className="material-icons-outlined">mic</span>
            </button>
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="p-2 bg-highland-700 text-white rounded-lg hover:bg-highland-600 disabled:opacity-50 transition-colors shadow-lg"
            >
              <span className="material-icons-outlined">arrow_upward</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
