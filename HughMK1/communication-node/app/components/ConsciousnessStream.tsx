"use client";

import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useEffect, useRef, useState } from "react";

type Log = {
  _id: string;
  source: string;
  level: string;
  message: string;
  timestamp: number;
  context?: any;
};

type PsycheState = {
  dopamine: number;
  serotonin: number;
  cortisol: number;
  flags: {
    defensive_posture: boolean;
    high_motivation: boolean;
    emotional_instability: boolean;
    balanced_state: boolean;
  };
  timestamp: number;
};

type GateState = {
  state: string;
  reason?: string;
  timestamp: number;
};

export default function ConsciousnessStream() {
  // Connect to the "Hippocampus" (Convex)
  const logs = useQuery(api.logs.getLogs, { limit: 20 }) as Log[] | undefined;
  const psyche = useQuery(api.psyche.getState) as PsycheState | undefined;
  const gate = useQuery(api.gate.getGateState) as GateState | undefined;
  
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Audio visualizer: animates at 10fps using incrementing sine wave until
  // a real Web Audio API AnalyserNode is wired to a mic/TTS stream.
  const frameRef = useRef(0);
  useEffect(() => {
    const interval = setInterval(() => {
      frameRef.current += 1;
      const t = frameRef.current * 0.1;
      setAudioLevel(50 + 45 * Math.sin(t) * Math.sin(t * 0.37));
      setIsSpeaking(Math.sin(t) > 0.6);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full w-full bg-black text-green-500 font-mono p-6 overflow-hidden selection:bg-green-900 selection:text-white">
      
      {/* TOP BAR: SYSTEM IDENTITY & ANCHORS */}
      <div className="flex justify-between items-start border-b-2 border-green-900 pb-4 mb-4">
        <div className="flex flex-col">
          <h1 className="text-4xl font-bold tracking-tighter text-green-600">H.U.G.H.</h1>
          <span className="text-xs tracking-[0.3em] opacity-60">HELICARRIER UNIFIED GUIDANCE HUB</span>
          <span className="text-[10px] mt-1 text-green-800">OS KERNEL: v1.0.4 // CONVEX LINKED</span>
        </div>

        {/* SOUL ANCHOR STATUS */}
        <div className="flex gap-8 text-xs">
          <div className="flex flex-col items-end">
            <span className="opacity-40 mb-1">ANCHOR 01: ETHICS</span>
            <span className="text-green-400 font-bold">EMS_PROTOCOLS [ACTIVE]</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="opacity-40 mb-1">ANCHOR 02: HERITAGE</span>
            <span className="text-green-400 font-bold">CLAN_MUNRO [SECURE]</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="opacity-40 mb-1">ANCHOR 03: MISSION</span>
            <span className="text-green-400 font-bold">GRIZZLY_MED [LOCKED]</span>
          </div>
        </div>
      </div>

      {/* MAIN DISPLAY: SPLIT VIEW */}
      <div className="flex flex-1 gap-6 min-h-0">
        
        {/* LEFT: VISUAL CORTEX (AUDIO/SENSORS) */}
        <div className="w-1/3 flex flex-col border-r border-green-900/50 pr-6">
          <h2 className="text-xs uppercase tracking-widest opacity-50 mb-4">Visual Cortex // Audio Input</h2>
          
          {/* Audio Visualizer (Simulated) */}
          <div className="h-32 flex items-end gap-1 mb-6 border-b border-green-900/30 pb-6">
            {Array.from({ length: 20 }).map((_, i) => (
              <div 
                key={i} 
                className="flex-1 bg-green-600 transition-all duration-75"
                style={{ 
                  height: `${Math.max(5, Math.random() * audioLevel)}%`,
                  opacity: Math.max(0.2, Math.random())
                }}
              />
            ))}
          </div>

          {/* System Status / Middleware State */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs opacity-60">DIGITAL PSYCHE</span>
              <span className={`text-xs ${psyche ? 'text-green-400' : 'text-yellow-600 animate-pulse'}`}>
                {psyche ? 'ONLINE' : 'CONNECTING...'}
              </span>
            </div>
            
            {/* NEUROTRANSMITTER LEVELS */}
            {psyche && (
              <div className="space-y-2 border-l-2 border-green-900 pl-2 my-4">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="opacity-60">DOPAMINE (Reward)</span>
                    <span>{(psyche.dopamine * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-1 bg-green-900/30 w-full">
                    <div className="h-full bg-blue-500" style={{ width: `${psyche.dopamine * 100}%` }} />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="opacity-60">SEROTONIN (Stability)</span>
                    <span>{(psyche.serotonin * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-1 bg-green-900/30 w-full">
                    <div className="h-full bg-yellow-500" style={{ width: `${psyche.serotonin * 100}%` }} />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="opacity-60">CORTISOL (Stress)</span>
                    <span className="text-red-400">{(psyche.cortisol * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-1 bg-green-900/30 w-full">
                    <div className="h-full bg-red-500" style={{ width: `${psyche.cortisol * 100}%` }} />
                  </div>
                </div>
              </div>
            )}

            {/* GATE STATUS */}
            <div className="flex justify-between items-center">
              <span className="text-xs opacity-60">EMERGENCE GATE</span>
              <span className={`text-xs font-bold ${
                gate?.state === 'LOCKED' ? 'text-red-500' : 
                gate?.state === 'EMERGENT' ? 'text-purple-400 animate-pulse' : 'text-yellow-500'
              }`}>
                {gate?.state || 'UNKNOWN'}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs opacity-60">GTP-SDK</span>
              <span className="text-xs text-yellow-600">v2.4 (ACTIVE)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs opacity-60">OUTPUT STATE</span>
              <span className={isSpeaking ? "text-xs text-green-400 animate-pulse" : "text-xs opacity-30"}>
                {isSpeaking ? "TRANSMITTING" : "IDLE"}
              </span>
            </div>
          </div>

          {/* Active Context / Working Memory */}
          <div className="mt-auto">
            <h3 className="text-[10px] uppercase opacity-40 mb-2">Working Memory (Context)</h3>
            <div className="text-xs text-green-800 space-y-1 font-mono">
              <p>&gt; ctx.load("current_task")</p>
              <p>&gt; "Refactoring Communication Node"</p>
              <p>&gt; ctx.check_anchor("User Frustration")</p>
              <p>&gt; "High Priority - Re-align"</p>
            </div>
          </div>
        </div>

        {/* RIGHT: CONSCIOUSNESS STREAM (LOGS/THOUGHTS) */}
        <div className="flex-1 flex flex-col">
          <h2 className="text-xs uppercase tracking-widest opacity-50 mb-4">Consciousness Stream // Logs</h2>
          
          <div className="flex-1 overflow-y-auto font-mono text-sm space-y-2 pr-2 scrollbar-hide">
            {logs ? (
              logs.map((log) => (
                <div key={log._id} className="flex gap-3 hover:bg-green-900/10 p-1 rounded">
                  <span className="opacity-30 text-xs whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`text-xs font-bold w-16 uppercase ${
                    log.level === 'ERROR' ? 'text-red-500' : 
                    log.level === 'WARN' ? 'text-yellow-500' : 'text-green-700'
                  }`}>
                    [{log.source}]
                  </span>
                  <span className="opacity-80">{log.message}</span>
                </div>
              ))
            ) : (
              <div className="text-green-900 animate-pulse">Connecting to Hippocampus...</div>
            )}
            
            {/* Simulated "Thought" if no logs */}
            {!logs && (
              <>
                <div className="flex gap-3 opacity-50">
                  <span className="opacity-30 text-xs">14:05:22</span>
                  <span className="text-green-700 text-xs font-bold w-16">[SYS]</span>
                  <span>Initializing Digital Psyche Middleware...</span>
                </div>
                <div className="flex gap-3 opacity-50">
                  <span className="opacity-30 text-xs">14:05:23</span>
                  <span className="text-green-700 text-xs font-bold w-16">[ANCHOR]</span>
                  <span>Verifying Triple Anchor integrity... OK.</span>
                </div>
              </>
            )}
          </div>

          {/* Command Line Input */}
          <div className="mt-4 border-t border-green-900 pt-4">
            <div className="flex items-center gap-2">
              <span className="text-green-500 font-bold">&gt;</span>
              <input 
                type="text" 
                className="bg-transparent border-none focus:ring-0 text-green-500 w-full font-mono focus:outline-none"
                placeholder="Enter command or speak..."
                autoFocus
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

