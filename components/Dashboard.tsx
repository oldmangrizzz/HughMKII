import React, { useState } from 'react';
import { generateMap } from '../services/geminiService';
import { MapData, MapNode } from '../types';

export const Dashboard: React.FC = () => {
    const [prompt, setPrompt] = useState("");
    const [loading, setLoading] = useState(false);
    const [mapData, setMapData] = useState<MapData | null>(null);

    const handleMap = async () => {
        if (!prompt) return;
        setLoading(true);
        try {
            const data = await generateMap(prompt);
            setMapData(data);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const handleMic = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.onresult = (event: any) => {
                setPrompt(event.results[0][0].transcript);
            };
            recognition.start();
        } else {
            alert("Voice input not supported in this browser.");
        }
    };

    // --- Renderers ---

    const renderTimeline = (nodes: MapNode[]) => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {nodes.sort((a,b) => (a.step || 0) - (b.step || 0)).map((node, i) => (
                <div key={node.id} className="min-h-[120px] p-4 rounded-xl border border-gray-800 bg-gray-900/50 relative group hover:border-blue-500/30 transition-all">
                    <span className="absolute top-3 right-4 text-2xl font-bold text-gray-700 select-none group-hover:text-blue-500/20">
                        {node.step || i + 1}
                    </span>
                    <div className="mb-2">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-500 text-white">
                            {node.category}
                        </span>
                    </div>
                    <h4 className="font-semibold text-white text-sm mb-1">{node.label}</h4>
                    <p className="text-xs text-gray-400">{node.description}</p>
                </div>
            ))}
        </div>
    );

    const renderProcess = (nodes: MapNode[]) => (
        <div className="flex flex-col space-y-4 max-w-2xl mx-auto">
            {nodes.sort((a,b) => (a.step || 0) - (b.step || 0)).map((node, i) => (
                <div key={node.id} className="relative pl-8 border-l-2 border-gray-800 hover:border-blue-500 transition-colors pb-6 last:pb-0">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-600 border-4 border-gray-900"></div>
                    <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                        <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-white text-lg">{node.label}</h4>
                            <span className="text-xs font-mono text-gray-500 px-2 py-1 bg-gray-900 rounded">{node.category}</span>
                        </div>
                        <p className="text-gray-300">{node.description}</p>
                    </div>
                    {i < nodes.length - 1 && (
                        <div className="absolute left-[-2px] bottom-[-10px] text-gray-800">▼</div>
                    )}
                </div>
            ))}
        </div>
    );

    const renderConcept = (nodes: MapNode[]) => (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {nodes.map((node) => (
                <div key={node.id} className="bg-gray-800/40 p-6 rounded-2xl border border-gray-700 hover:bg-gray-800/80 transition-all hover:-translate-y-1">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center mb-4">
                        <span className="material-icons-outlined text-xl">lightbulb</span>
                    </div>
                    <h4 className="font-bold text-white text-lg mb-2">{node.label}</h4>
                    <span className="text-xs uppercase tracking-wider text-purple-400 mb-3 block">{node.category}</span>
                    <p className="text-sm text-gray-400 leading-relaxed">{node.description}</p>
                </div>
            ))}
        </div>
    );

    return (
        <div className="h-full p-8 overflow-y-auto">
            <header className="mb-8">
                <h2 className="text-4xl font-bold text-white mb-2">Universal Mapper</h2>
                <p className="text-gray-400">Literally map anything. Timelines, processes, physics concepts, or life plans.</p>
            </header>

            <div className="flex gap-4 mb-10 max-w-4xl">
                <div className="flex-1 relative">
                    <input 
                        type="text" 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Try 'Map the physics of a curveball' or 'Plan a wedding timeline'"
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-4 pr-12 py-4 text-white focus:outline-none focus:border-blue-500 shadow-lg text-lg"
                        onKeyDown={(e) => e.key === 'Enter' && handleMap()}
                    />
                    <button onClick={handleMic} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-2">
                        <span className="material-icons-outlined">mic</span>
                    </button>
                </div>
                <button 
                    onClick={handleMap}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/30 disabled:opacity-50"
                >
                    {loading ? (
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : "Map It"}
                </button>
            </div>

            {/* Output Area */}
            {mapData ? (
                <div className="animate-fade-in-up">
                    <div className="flex items-center space-x-4 mb-6">
                        <h3 className="text-2xl font-bold text-white">{mapData.title}</h3>
                        <span className="px-3 py-1 rounded-full border border-gray-700 text-xs font-mono uppercase text-gray-400">
                            TYPE: {mapData.type}
                        </span>
                    </div>
                    
                    {mapData.type === 'timeline' && renderTimeline(mapData.nodes)}
                    {mapData.type === 'process' && renderProcess(mapData.nodes)}
                    {mapData.type === 'concept' && renderConcept(mapData.nodes)}
                </div>
            ) : (
                <div className="text-center py-20 opacity-50">
                    <span className="material-icons-outlined text-8xl text-gray-700 mb-4">explore</span>
                    <p className="text-gray-500 text-lg">Enter a prompt to generate a visual map.</p>
                </div>
            )}
        </div>
    );
};