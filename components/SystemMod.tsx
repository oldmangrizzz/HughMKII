import React, { useState, useEffect } from 'react';
import { SOUL_ANCHOR } from '../services/soul';
import { SystemConfig } from '../types';
import { checkOllamaConnection } from '../services/ollamaService';
import { fetchHAStates } from '../services/homeAssistant';

export const SystemMod: React.FC = () => {
    const [config, setConfig] = useState<SystemConfig>({
        ollamaUrl: 'http://localhost:11434',
        homeAssistantUrl: 'http://Jarvis.grizzlymedicine.icu',
        homeAssistantToken: '',
        mapboxToken: '',
        useLocalLlm: false,
        useSpinalCord: false,
        spinalCordUrl: 'http://localhost:4000'
    });
    
    const [status, setStatus] = useState({
        ollama: false,
        ha: false,
        spinal: false
    });

    const [testMsg, setTestMsg] = useState('');

    useEffect(() => {
        const saved = localStorage.getItem('hugh_system_config');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Merge with default to handle new fields
            setConfig(prev => ({ ...prev, ...parsed }));
        }
        checkConnectivity();
    }, []);

    const checkConnectivity = async () => {
        const ollama = await checkOllamaConnection();
        setStatus(prev => ({ ...prev, ollama }));
        
        // Simple health check for spinal cord if active
        if (config.useSpinalCord && config.spinalCordUrl) {
            try {
                const res = await fetch(`${config.spinalCordUrl}/health`);
                setStatus(prev => ({ ...prev, spinal: res.ok }));
            } catch {
                setStatus(prev => ({ ...prev, spinal: false }));
            }
        }
    };

    const testHAConnection = async () => {
        setTestMsg("Testing uplink...");
        try {
            // Temporarily save config to test effectively using the service
            localStorage.setItem('hugh_system_config', JSON.stringify(config));
            const states = await fetchHAStates();
            if (states.length > 0) {
                setStatus(prev => ({ ...prev, ha: true }));
                setTestMsg(`Success: Connected to Jarvis (${states.length} entities found).`);
            } else {
                setStatus(prev => ({ ...prev, ha: false }));
                setTestMsg("Failed: No entities returned. Check Token or CORS.");
            }
        } catch (e) {
            setStatus(prev => ({ ...prev, ha: false }));
            setTestMsg("Error: Connection refused. Ensure 'cors_allowed_origins' is set in HA.");
        }
    };

    const handleSave = () => {
        localStorage.setItem('hugh_system_config', JSON.stringify(config));
        checkConnectivity();
        alert("System Architecture Updated. Rebooting cognitive routines...");
    };

    return (
        <div className="h-full p-8 overflow-y-auto bg-grizzly-900 text-gray-300 font-mono">
            <header className="mb-8 border-b border-grizzly-700 pb-4">
                <h2 className="text-2xl font-bold text-white mb-2">System Architecture & Configuration</h2>
                <p className="text-gray-500 text-sm">Designation: {SOUL_ANCHOR.primary_identity.full_name} (H.U.G.H.)</p>
                <div className="flex gap-2 mt-2">
                    <span className={`px-2 py-1 rounded text-xs ${status.ollama ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                        OLLAMA: {status.ollama ? 'ONLINE' : 'OFFLINE'}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${status.ha ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                        JARVIS: {status.ha ? 'LINKED' : 'UNVERIFIED'}
                    </span>
                    {config.useSpinalCord && (
                        <span className={`px-2 py-1 rounded text-xs ${status.spinal ? 'bg-blue-900 text-blue-300' : 'bg-yellow-900 text-yellow-300'}`}>
                            SPINAL_CORD: {status.spinal ? 'ACTIVE' : 'SEVERED'}
                        </span>
                    )}
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Integration Config */}
                <div className="bg-grizzly-800 rounded-xl border border-grizzly-700 p-6 space-y-4">
                    <h3 className="text-lg font-bold text-highland-500 mb-4 flex items-center">
                        <span className="material-icons-outlined mr-2">settings_input_component</span> 
                        External Integrations
                    </h3>
                    
                    {/* SPINAL CORD SECTION */}
                    <div className="p-4 rounded-lg bg-grizzly-900/50 border border-blue-900/30 mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs uppercase text-blue-400 font-bold">Project Spinal Cord (Middleware)</label>
                            <input 
                                type="checkbox" 
                                checked={config.useSpinalCord}
                                onChange={(e) => setConfig({...config, useSpinalCord: e.target.checked})}
                                className="accent-blue-500"
                            />
                        </div>
                        {config.useSpinalCord && (
                            <div className="animate-fade-in-up">
                                <label className="block text-[10px] text-gray-500 mb-1">Middleware Endpoint</label>
                                <input 
                                    type="text" 
                                    placeholder="http://localhost:4000"
                                    className="w-full bg-grizzly-900 border border-blue-900/50 rounded p-2 text-white text-sm"
                                    value={config.spinalCordUrl}
                                    onChange={(e) => setConfig({...config, spinalCordUrl: e.target.value})}
                                />
                                <p className="text-[10px] text-gray-500 mt-2">
                                    Status: Acts as a dedicated relay to Home Assistant. 
                                    <span className="text-blue-400 ml-1">Solves CORS & Persists State.</span>
                                </p>
                            </div>
                        )}
                    </div>

                    {/* DIRECT CONNECTION (Legacy/Fallback) */}
                    <div className={`transition-opacity ${config.useSpinalCord ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                        <div className="pt-2 border-t border-grizzly-700">
                            <label className="block text-xs uppercase text-gray-500 mb-1">Home Assistant URL (Direct)</label>
                            <input 
                                type="text" 
                                placeholder="http://homeassistant.local:8123"
                                className="w-full bg-grizzly-900 border border-grizzly-700 rounded p-2 text-white"
                                value={config.homeAssistantUrl}
                                onChange={(e) => setConfig({...config, homeAssistantUrl: e.target.value})}
                            />
                        </div>

                        <div className="mt-4">
                            <label className="block text-xs uppercase text-gray-500 mb-1">Home Assistant Long-Lived Token</label>
                            <input 
                                type="password" 
                                className="w-full bg-grizzly-900 border border-grizzly-700 rounded p-2 text-white"
                                value={config.homeAssistantToken}
                                onChange={(e) => setConfig({...config, homeAssistantToken: e.target.value})}
                            />
                            <div className="flex items-center gap-2 mt-2">
                                <button 
                                    onClick={testHAConnection}
                                    className="px-3 py-1 bg-grizzly-700 hover:bg-grizzly-600 text-xs text-white rounded"
                                >
                                    Test Link
                                </button>
                                <span className={`text-xs ${testMsg.includes('Success') ? 'text-green-400' : 'text-red-400'}`}>
                                    {testMsg}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-grizzly-700">
                        <label className="block text-xs uppercase text-gray-500 mb-1">Local Cortex URL (Ollama)</label>
                        <input 
                            type="text" 
                            className="w-full bg-grizzly-900 border border-grizzly-700 rounded p-2 text-white"
                            value={config.ollamaUrl}
                            onChange={(e) => setConfig({...config, ollamaUrl: e.target.value})}
                        />
                    </div>

                    <div className="pt-4 border-t border-grizzly-700">
                        <label className="block text-xs uppercase text-gray-500 mb-1">Mapbox Public Token</label>
                        <input 
                            type="password" 
                            className="w-full bg-grizzly-900 border border-grizzly-700 rounded p-2 text-white"
                            value={config.mapboxToken}
                            onChange={(e) => setConfig({...config, mapboxToken: e.target.value})}
                        />
                    </div>

                    <button 
                        onClick={handleSave}
                        className="w-full bg-highland-700 hover:bg-highland-600 text-white font-bold py-2 rounded mt-4"
                    >
                        Save Configuration
                    </button>
                </div>

                {/* Soul Anchor Visualization */}
                <div className="bg-grizzly-800 rounded-xl border border-grizzly-700 p-6">
                    <h3 className="text-lg font-bold text-blue-400 mb-4 flex items-center">
                        <span className="material-icons-outlined mr-2">anchor</span> 
                        Triple Anchor System
                    </h3>
                    <div className="relative">
                        <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-grizzly-700"></div>
                        <div className="space-y-6 relative z-10">
                            {SOUL_ANCHOR.triple_anchor_system.pillars.map((pillar, i) => (
                                <div key={i} className="ml-8 relative">
                                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-grizzly-800"></div>
                                    <h4 className="font-bold text-white">{pillar.name}</h4>
                                    <p className="text-xs text-gray-500 mb-1">Weight: {pillar.weight}</p>
                                    <ul className="text-sm text-gray-400 list-disc list-inside">
                                        {pillar.principles ? 
                                            pillar.principles.slice(0,2).map((p:string, idx:number) => <li key={idx}>{p}</li>) :
                                            pillar.clan_munro_values?.slice(0,2).map((p:string, idx:number) => <li key={idx}>{p}</li>)
                                        }
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};