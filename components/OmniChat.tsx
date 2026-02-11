import React, { useState, useRef, useEffect } from 'react';
import { sendChatMessage } from '../services/geminiService';
import { ChatMessage, GeminiModel } from '../types';

export const OmniChat: React.FC = () => {
    const [history, setHistory] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    
    // Tools State
    const [useTools, setUseTools] = useState<'none' | 'search' | 'maps'>('none');
    const [thinkingMode, setThinkingMode] = useState(false);
    const [isListening, setIsListening] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    useEffect(scrollToBottom, [history]);

    const handleSend = async () => {
        if (!input.trim()) return;
        
        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            text: input,
            timestamp: Date.now()
        };
        
        setHistory(prev => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        try {
            // Default to Pro, Service handles fallback
            let model = GeminiModel.PRO_PREVIEW;
            if (useTools === 'search') model = GeminiModel.FLASH_PREVIEW; 
            if (useTools === 'maps') model = GeminiModel.MAPS_GROUNDING;

            // Using the new service that returns "usedModel"
            const response: any = await sendChatMessage(model, [], userMsg.text || "", undefined, useTools, thinkingMode);
            const text = response.text || "H.U.G.H. System Alert: Response generation failed.";
            
            // Extract grounding
            const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            const groundingUrls = chunks.map((c: any) => c.web ? { title: c.web.title, uri: c.web.uri } : (c.maps ? { title: c.maps.title, uri: c.maps.uri } : null)).filter(Boolean);

            const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: text,
                timestamp: Date.now(),
                isThinking: thinkingMode,
                groundingUrls,
                modelUsed: response.usedModel 
            };
            setHistory(prev => [...prev, aiMsg]);

        } catch (e) {
            console.error(e);
            setHistory(prev => [...prev, { id: Date.now().toString(), role: 'model', text: "Critical System Failure: Unable to establish link.", timestamp: Date.now() }]);
        }
        setLoading(false);
    };

    const handleMic = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;

            recognition.onstart = () => setIsListening(true);
            recognition.onend = () => setIsListening(false);
            recognition.onerror = (event: any) => {
                console.error("Speech recognition error", event.error);
                setIsListening(false);
            };

            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setInput(transcript);
            };
            recognition.start();
        } else {
            alert("Speech recognition not supported in this browser.");
        }
    };

    return (
        <div className="h-full flex flex-col bg-grizzly-900">
            {/* Header / Toolbar */}
            <div className="h-16 border-b border-grizzly-800 flex items-center justify-between px-6 bg-grizzly-900/90 backdrop-blur">
                <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-highland-500 rounded-full animate-pulse-slow"></span>
                    <h2 className="text-lg font-bold text-gray-200 font-mono">Secure Comms</h2>
                </div>
                <div className="flex space-x-2">
                    <button 
                        onClick={() => setThinkingMode(!thinkingMode)}
                        className={`px-3 py-1 rounded text-xs font-bold border transition-colors ${thinkingMode ? 'bg-purple-900/40 border-purple-500 text-purple-300' : 'border-grizzly-700 text-gray-500 hover:text-gray-300'}`}
                    >
                        DEEP THINK
                    </button>
                    <div className="h-6 w-px bg-grizzly-700 mx-2"></div>
                    <button 
                        onClick={() => setUseTools(useTools === 'search' ? 'none' : 'search')}
                        className={`p-1.5 rounded transition-colors ${useTools === 'search' ? 'text-blue-400 bg-blue-900/20' : 'text-gray-500 hover:text-gray-300'}`}
                        title="Network Search"
                    >
                        <span className="material-icons-outlined text-sm">public</span>
                    </button>
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
                        <p className="text-xs mt-2">GrizzlyMedicine Protocol Active.</p>
                    </div>
                )}
                
                {history.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-xl px-5 py-4 ${
                            msg.role === 'user' 
                                ? 'bg-highland-900/30 border border-highland-600/30 text-gray-100 rounded-br-none' 
                                : 'bg-grizzly-800 text-gray-200 rounded-bl-none border border-grizzly-700'
                        }`}>
                            {msg.isThinking && <div className="text-[10px] text-purple-400 mb-2 font-mono uppercase tracking-wider flex items-center"><span className="animate-spin mr-1">⟳</span> Reasoning...</div>}
                            
                            <p className="whitespace-pre-wrap leading-relaxed text-sm font-sans">{msg.text}</p>
                            
                            {/* System Meta Data (Model Used) */}
                            {msg.role === 'model' && msg.modelUsed && (
                                <div className="mt-2 flex justify-end">
                                    <span className="text-[9px] font-mono text-gray-600 uppercase">
                                        RUN: {msg.modelUsed.replace('gemini-', '').replace('-preview', '')}
                                    </span>
                                </div>
                            )}

                            {/* Grounding Sources */}
                            {msg.groundingUrls && msg.groundingUrls.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-grizzly-700/50">
                                    <p className="text-[10px] text-gray-500 mb-2 font-bold uppercase">References</p>
                                    <div className="flex flex-wrap gap-2">
                                        {msg.groundingUrls.map((url, i) => (
                                            <a 
                                                key={i} 
                                                href={url.uri} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="text-[10px] text-highland-400 hover:underline bg-grizzly-900/50 px-2 py-1 rounded border border-grizzly-700/50 truncate max-w-[200px]"
                                            >
                                                {url.title || url.uri}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-grizzly-800 rounded-xl rounded-bl-none px-4 py-3 border border-grizzly-700">
                           <span className="text-xs text-highland-500 font-mono animate-pulse">Processing...</span>
                        </div>
                    </div>
                )}
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
                        placeholder={isListening ? "Listening..." : "Execute command..."}
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