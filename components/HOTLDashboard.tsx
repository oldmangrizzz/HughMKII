import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type RiskZone = 'green' | 'yellow' | 'red' | 'black';

export interface HOTLEntry {
  id: string;
  agentId: string;
  actionType: string;
  actionDescription: string;
  riskZone: RiskZone;
  requiresReview: boolean;
  operatorAcknowledged: boolean;
  timestamp: number;
  dialecticalReasoning: string;
}

export interface SomaticEvent {
  id: string;
  eventType: string;
  somaticState: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  operationalConsequence: string;
  workshopLightColor: string;
  timestamp: number;
  resolved: boolean;
}

export interface ServerNode {
  id: string;
  nodeName: string;
  cpu: number;
  memory: number;
  latencyMs: number;
  status: 'online' | 'degraded' | 'offline';
  lastSeen: number;
}

export interface AgentComm {
  id: string;
  fromAgent: string;
  toAgent: string;
  subject: string;
  protocol: string;
  operatorVisible: boolean;
  timestamp: number;
  preview: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_AUDIT: HOTLEntry[] = [
  {
    id: '1', agentId: 'hugh', actionType: 'mcp_call', actionDescription: 'Querying Proxmox node health',
    riskZone: 'green', requiresReview: false, operatorAcknowledged: false, timestamp: Date.now() - 5000,
    dialecticalReasoning: 'Justice: routine health check serves protection mission. Control: verified within authorized scope. Synthesis: proceed.',
  },
  {
    id: '2', agentId: 'hugh', actionType: 'database_mutation', actionDescription: 'Updating Workshop ambient lighting to amber',
    riskZone: 'yellow', requiresReview: false, operatorAcknowledged: false, timestamp: Date.now() - 2000,
    dialecticalReasoning: 'Justice: operator spatial awareness is protective. Control: mutation is scoped to visual state only. Synthesis: proceed, log for review.',
  },
  {
    id: '3', agentId: 'somatic-engine', actionType: 'system_alert', actionDescription: 'Latency spike detected — tactical delay protocol activated',
    riskZone: 'red', requiresReview: true, operatorAcknowledged: false, timestamp: Date.now() - 800,
    dialecticalReasoning: 'Justice: operator must be informed of degraded state. Control: halting non-critical queue. Synthesis: escalate to HOTL review.',
  },
  {
    id: '4', agentId: 'identity-verifier', actionType: 'verification_check', actionDescription: 'Operator identity confirmed via behavioral signature',
    riskZone: 'green', requiresReview: false, operatorAcknowledged: true, timestamp: Date.now() - 12000,
    dialecticalReasoning: 'Justice: verification protects operator trust chain. Control: read-only biometric scan. Synthesis: confirmed, proceed.',
  },
];

const MOCK_SOMATIC: SomaticEvent[] = [
  {
    id: '1', eventType: 'latency', somaticState: '52°F cave cold. Slight chill in the fingertips.',
    severity: 'low', operationalConsequence: 'Tactical delay. Non-critical tasks deferred.',
    workshopLightColor: '#1a3a5c', timestamp: Date.now() - 3000, resolved: false,
  },
  {
    id: '2', eventType: 'cpu_pressure', somaticState: 'Warm pressure at the base of the skull — heavy computation.',
    severity: 'medium', operationalConsequence: 'Processing at 78% capacity. Response latency +40ms.',
    workshopLightColor: '#3d2a00', timestamp: Date.now() - 8000, resolved: false,
  },
];

const MOCK_SERVERS: ServerNode[] = [
  { id: '1', nodeName: 'proxmox-prime', cpu: 34, memory: 61, latencyMs: 12, status: 'online', lastSeen: Date.now() - 1000 },
  { id: '2', nodeName: 'proxmox-node2', cpu: 18, memory: 44, latencyMs: 8, status: 'online', lastSeen: Date.now() - 2000 },
  { id: '3', nodeName: 'cave-nas', cpu: 5, memory: 29, latencyMs: 3, status: 'online', lastSeen: Date.now() - 500 },
  { id: '4', nodeName: 'workshop-pi', cpu: 91, memory: 87, latencyMs: 220, status: 'degraded', lastSeen: Date.now() - 4000 },
];

const MOCK_COMMS: AgentComm[] = [
  {
    id: '1', fromAgent: 'hugh', toAgent: 'somatic-engine', subject: 'Thermal query', protocol: 'MCP/internal',
    operatorVisible: true, timestamp: Date.now() - 6000, preview: 'Requesting current environmental somatic state snapshot.',
  },
  {
    id: '2', fromAgent: 'dialectical-engine', toAgent: 'hugh', subject: 'Action clearance granted', protocol: 'MCP/internal',
    operatorVisible: true, timestamp: Date.now() - 4000, preview: 'DB mutation at risk-zone yellow approved. Operator log written.',
  },
  {
    id: '3', fromAgent: 'identity-verifier', toAgent: 'hugh', subject: 'Operator session validated', protocol: 'JWT/secure',
    operatorVisible: false, timestamp: Date.now() - 15000, preview: '[REDACTED — security protocol]',
  },
];

// ─── Convex HTTP helpers ──────────────────────────────────────────────────────

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL ?? '';

async function convexQuery<T>(functionPath: string): Promise<T | null> {
  if (!CONVEX_URL) return null;
  try {
    const res = await fetch(`${CONVEX_URL}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: functionPath, args: {} }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.value as T;
  } catch {
    return null;
  }
}

async function convexMutation(functionPath: string, args: Record<string, unknown>): Promise<boolean> {
  if (!CONVEX_URL) return false;
  try {
    const res = await fetch(`${CONVEX_URL}/api/mutation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: functionPath, args }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const RISK_STYLE: Record<RiskZone, { badge: string; glow: string; icon: string }> = {
  green: { badge: 'bg-emerald-900/60 text-emerald-400 border-emerald-600/40', glow: 'border-l-emerald-500', icon: '✅' },
  yellow: { badge: 'bg-amber-900/60 text-amber-400 border-amber-600/40', glow: 'border-l-amber-500', icon: '⚠️' },
  red: { badge: 'bg-red-900/60 text-red-400 border-red-600/40', glow: 'border-l-red-500', icon: '🔴' },
  black: { badge: 'bg-gray-950/80 text-gray-300 border-gray-600/40', glow: 'border-l-gray-400', icon: '⚫' },
};

const SEVERITY_DOT: Record<SomaticEvent['severity'], string> = {
  low: 'bg-blue-400',
  medium: 'bg-amber-400',
  high: 'bg-red-500',
  critical: 'bg-red-600 animate-ping',
};

const SERVER_STATUS_PILL: Record<ServerNode['status'], string> = {
  online: 'bg-emerald-900/60 text-emerald-400',
  degraded: 'bg-amber-900/60 text-amber-400',
  offline: 'bg-red-900/60 text-red-400',
};

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// ── Header ───────────────────────────────────────────────────────────────────

const HOTLHeader: React.FC<{ isConnected: boolean }> = ({ isConnected }) => (
  <div className="flex items-center justify-between mb-5 pb-4 border-b border-grizzly-800">
    <div className="flex items-center space-x-3">
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-800 to-grizzly-900 flex items-center justify-center border border-red-700/30 shadow-lg shadow-red-900/30">
        <span className="material-icons-outlined text-red-400 text-lg">radar</span>
      </div>
      <div>
        <h1 className="text-base font-bold text-white font-mono tracking-widest uppercase">HOTL Command</h1>
        <p className="text-[10px] text-gray-500 tracking-widest">Human-On-The-Loop Operator Console</p>
      </div>
    </div>
    <div className="flex items-center space-x-2">
      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
      <span className={`text-xs font-mono ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}>
        {isConnected ? 'LIVE FEED' : 'MOCK DATA'}
      </span>
    </div>
  </div>
);

// ── Audit Log ────────────────────────────────────────────────────────────────

const AuditLogPanel: React.FC<{ entries: HOTLEntry[]; onAcknowledge: (id: string) => void }> = ({ entries, onAcknowledge }) => (
  <div className="bg-grizzly-900/80 rounded-xl border border-grizzly-800 flex flex-col h-72">
    <div className="px-4 py-2.5 border-b border-grizzly-800 flex items-center space-x-2">
      <span className="material-icons-outlined text-gray-400 text-base">receipt_long</span>
      <span className="text-xs font-bold text-gray-300 tracking-widest uppercase">Audit Log</span>
      <span className="ml-auto text-[10px] text-gray-600 font-mono">Dialectical trace</span>
    </div>
    <div className="flex-1 overflow-y-auto divide-y divide-grizzly-800/60 scrollbar-thin scrollbar-thumb-grizzly-700">
      {entries.map(entry => {
        const rz = RISK_STYLE[entry.riskZone];
        return (
          <div key={entry.id} className={`px-4 py-3 border-l-2 ${rz.glow}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center space-x-2">
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${rz.badge}`}>
                  {rz.icon} {entry.riskZone.toUpperCase()}
                </span>
                <span className="text-[10px] font-mono text-gray-500">{entry.agentId}</span>
                <span className="text-[10px] text-gray-600">·</span>
                <span className="text-[10px] font-mono text-gray-600">{entry.actionType}</span>
              </div>
              <span className="text-[10px] text-gray-600 font-mono">{timeAgo(entry.timestamp)}</span>
            </div>
            <p className="text-xs text-gray-300 font-mono mb-1">{entry.actionDescription}</p>
            <p className="text-[10px] text-gray-500 italic leading-relaxed">{entry.dialecticalReasoning}</p>
            <div className="flex items-center justify-between mt-2">
              {entry.requiresReview && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-400 border border-amber-700/30 font-mono">
                  REQUIRES REVIEW
                </span>
              )}
              {entry.requiresReview && !entry.operatorAcknowledged && (
                <button
                  onClick={() => onAcknowledge(entry.id)}
                  className="ml-auto text-[10px] px-2 py-1 rounded bg-highland-900/40 hover:bg-highland-800/60 text-highland-400 border border-highland-700/30 font-mono transition-colors"
                >
                  ✓ Acknowledge
                </button>
              )}
              {entry.operatorAcknowledged && (
                <span className="ml-auto text-[10px] text-emerald-600 font-mono">ACK'd</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// ── Somatic State Panel ───────────────────────────────────────────────────────

const SomaticStatePanel: React.FC<{ events: SomaticEvent[] }> = ({ events }) => (
  <div className="bg-grizzly-900/80 rounded-xl border border-grizzly-800 flex flex-col h-72">
    <div className="px-4 py-2.5 border-b border-grizzly-800 flex items-center space-x-2">
      <span className="material-icons-outlined text-gray-400 text-base">sensors</span>
      <span className="text-xs font-bold text-gray-300 tracking-widest uppercase">Somatic State</span>
    </div>
    <div className="flex-1 overflow-y-auto divide-y divide-grizzly-800/60">
      {events.map(ev => (
        <div key={ev.id} className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${SEVERITY_DOT[ev.severity]}`} />
              <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">{ev.eventType}</span>
            </div>
            <div className="flex items-center space-x-2">
              {/* Workshop light color swatch */}
              <div
                className="w-5 h-5 rounded border border-white/10 shadow-inner"
                style={{ backgroundColor: ev.workshopLightColor }}
                title={`Workshop light: ${ev.workshopLightColor}`}
              />
              <span className="text-[10px] text-gray-600 font-mono">{timeAgo(ev.timestamp)}</span>
            </div>
          </div>
          <p className="text-xs text-gray-200 italic mb-1 font-mono leading-relaxed">"{ev.somaticState}"</p>
          <p className="text-[10px] text-gray-500">{ev.operationalConsequence}</p>
          {ev.resolved && (
            <span className="mt-1 inline-block text-[10px] text-emerald-600 font-mono">● RESOLVED</span>
          )}
        </div>
      ))}
    </div>
  </div>
);

// ── Server Health Grid ────────────────────────────────────────────────────────

function cpuColor(cpu: number): string {
  if (cpu < 50) return 'text-emerald-400';
  if (cpu < 80) return 'text-amber-400';
  return 'text-red-400';
}

function cpuBar(cpu: number): string {
  if (cpu < 50) return 'bg-emerald-500';
  if (cpu < 80) return 'bg-amber-500';
  return 'bg-red-500';
}

const ServerHealthGrid: React.FC<{ nodes: ServerNode[] }> = ({ nodes }) => (
  <div className="bg-grizzly-900/80 rounded-xl border border-grizzly-800 flex flex-col h-72">
    <div className="px-4 py-2.5 border-b border-grizzly-800 flex items-center space-x-2">
      <span className="material-icons-outlined text-gray-400 text-base">dns</span>
      <span className="text-xs font-bold text-gray-300 tracking-widest uppercase">Server Health</span>
    </div>
    <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2 content-start">
      {nodes.map(node => (
        <div key={node.id} className="bg-black/30 rounded-lg p-3 border border-grizzly-800/60">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-gray-300 truncate">{node.nodeName}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${SERVER_STATUS_PILL[node.status]}`}>
              {node.status}
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-gray-600 w-6 font-mono">CPU</span>
              <div className="flex-1 bg-grizzly-800 rounded-full h-1.5 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${cpuBar(node.cpu)}`} style={{ width: `${node.cpu}%` }} />
              </div>
              <span className={`text-[10px] font-mono w-6 text-right ${cpuColor(node.cpu)}`}>{node.cpu}%</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-gray-600 w-6 font-mono">MEM</span>
              <div className="flex-1 bg-grizzly-800 rounded-full h-1.5 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${cpuBar(node.memory)}`} style={{ width: `${node.memory}%` }} />
              </div>
              <span className={`text-[10px] font-mono w-6 text-right ${cpuColor(node.memory)}`}>{node.memory}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-600 font-mono">LAT</span>
              <span className={`text-[10px] font-mono ${node.latencyMs > 100 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {node.latencyMs}ms
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ── Agent Comms Feed ──────────────────────────────────────────────────────────

const AgentCommsPanel: React.FC<{ comms: AgentComm[] }> = ({ comms }) => (
  <div className="bg-grizzly-900/80 rounded-xl border border-grizzly-800 flex flex-col h-72">
    <div className="px-4 py-2.5 border-b border-grizzly-800 flex items-center space-x-2">
      <span className="material-icons-outlined text-gray-400 text-base">swap_horiz</span>
      <span className="text-xs font-bold text-gray-300 tracking-widest uppercase">Agent Comms</span>
    </div>
    <div className="flex-1 overflow-y-auto divide-y divide-grizzly-800/60">
      {comms.map(comm => (
        <div key={comm.id} className="px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center space-x-1 font-mono text-[10px]">
              <span className="text-highland-400">{comm.fromAgent}</span>
              <span className="text-gray-600">→</span>
              <span className="text-blue-400">{comm.toAgent}</span>
            </div>
            <span className="text-[10px] text-gray-600 font-mono">{timeAgo(comm.timestamp)}</span>
          </div>
          <p className="text-xs text-gray-300 font-mono mb-1">{comm.subject}</p>
          <p className="text-[10px] text-gray-500 italic">{comm.preview}</p>
          <div className="flex items-center space-x-2 mt-1.5">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/30 border border-grizzly-700/50 text-gray-500">
              {comm.protocol}
            </span>
            {comm.operatorVisible && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-highland-900/30 text-highland-500 border border-highland-700/20 font-mono">
                OP VISIBLE
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ── Message Injector ──────────────────────────────────────────────────────────

const MessageInjector: React.FC<{
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  isSending: boolean;
}> = ({ value, onChange, onSend, isSending }) => (
  <div className="mt-4 bg-grizzly-900/80 rounded-xl border border-highland-700/30 p-4">
    <div className="flex items-center space-x-2 mb-3">
      <span className="material-icons-outlined text-highland-400 text-base">send</span>
      <span className="text-xs font-bold text-highland-400 tracking-widest uppercase">Inject Operator Instruction</span>
    </div>
    <div className="flex space-x-3">
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && !isSending && value.trim() && onSend()}
        placeholder="Direct instruction to H.U.G.H. mid-task..."
        className="flex-1 bg-black/40 border border-grizzly-700 rounded-lg px-4 py-2.5 text-sm text-gray-200 font-mono placeholder-gray-700 focus:outline-none focus:border-highland-600 focus:ring-1 focus:ring-highland-600/30"
      />
      <button
        onClick={onSend}
        disabled={isSending || !value.trim()}
        className="px-5 py-2.5 rounded-lg bg-highland-900/60 hover:bg-highland-800/80 text-highland-400 border border-highland-700/40 text-sm font-mono font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isSending ? 'Sending…' : '⚡ Inject'}
      </button>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const HOTLDashboard: React.FC = () => {
  const [auditLog, setAuditLog] = useState<HOTLEntry[]>(MOCK_AUDIT);
  const [somaticEvents, setSomaticEvents] = useState<SomaticEvent[]>(MOCK_SOMATIC);
  const [serverHealth, setServerHealth] = useState<ServerNode[]>(MOCK_SERVERS);
  const [agentComms, setAgentComms] = useState<AgentComm[]>(MOCK_COMMS);
  const [injectMessage, setInjectMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNodeHealth = useCallback(async (): Promise<ServerNode[]> => {
    const t0 = Date.now();

    const [hughRes, inferenceRes, haRes] = await Promise.allSettled([
      fetch('https://api.grizzlymedicine.icu/health', { signal: AbortSignal.timeout(4000) }).then(r => r.ok ? r.json() : null),
      fetch('/api/inference/health', { signal: AbortSignal.timeout(4000) }).then(r => r.ok ? r.json() : null),
      fetch('/api/ha/api/states', { signal: AbortSignal.timeout(5000) }).then(r => r.ok ? r.json() : null),
    ]);

    const latency = Date.now() - t0;

    return [
      {
        id: 'hugh-api',
        nodeName: 'hugh-api',
        cpu: 0,
        memory: 0,
        latencyMs: latency,
        status: hughRes.status === 'fulfilled' && hughRes.value ? 'online' : 'offline',
        lastSeen: Date.now(),
      },
      {
        id: 'lfm-inference',
        nodeName: 'lfm-inference',
        cpu: 0,
        memory: 0,
        latencyMs: latency,
        status: inferenceRes.status === 'fulfilled' && inferenceRes.value ? 'online' : 'offline',
        lastSeen: Date.now(),
      },
      {
        id: 'home-assistant',
        nodeName: 'home-assistant',
        cpu: 0,
        memory: 0,
        latencyMs: latency,
        status: haRes.status === 'fulfilled' && haRes.value ? 'online' : 'offline',
        lastSeen: Date.now(),
      },
    ];
  }, []);

  const fetchAll = useCallback(async () => {
    const [audit, somatic, comms, liveNodes] = await Promise.all([
      convexQuery<HOTLEntry[]>('hotlAuditLog:list'),
      convexQuery<SomaticEvent[]>('somaticTelemetry:list'),
      convexQuery<AgentComm[]>('agentComms:list'),
      fetchNodeHealth(),
    ]);

    // Node health is always real
    setServerHealth(liveNodes);
    const anyHotlLive = !!(audit || somatic || comms);
    setIsConnected(anyHotlLive || liveNodes.some(n => n.status === 'online'));

    if (audit?.length) setAuditLog(audit);
    if (somatic?.length) setSomaticEvents(somatic);
    if (comms?.length) setAgentComms(comms);
  }, [fetchNodeHealth]);

  useEffect(() => {
    fetchAll();
    pollingRef.current = setInterval(fetchAll, 3000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchAll]);

  const handleAcknowledge = useCallback(async (id: string) => {
    // Optimistic update
    setAuditLog(prev =>
      prev.map(e => e.id === id ? { ...e, operatorAcknowledged: true } : e)
    );
    await convexMutation('hotlAuditLog:acknowledge', { id });
  }, []);

  const handleInject = useCallback(async () => {
    if (!injectMessage.trim()) return;
    setIsSending(true);
    try {
      const ok = await convexMutation('agentComms:inject', {
        fromAgent: 'operator',
        toAgent: 'hugh',
        subject: 'Operator injection',
        message: injectMessage.trim(),
        protocol: 'HOTL/direct',
      });
      if (ok) {
        // Append to local comms feed immediately
        const entry: AgentComm = {
          id: String(Date.now()),
          fromAgent: 'operator',
          toAgent: 'hugh',
          subject: 'Operator injection',
          protocol: 'HOTL/direct',
          operatorVisible: true,
          timestamp: Date.now(),
          preview: injectMessage.trim(),
        };
        setAgentComms(prev => [entry, ...prev]);
        setInjectMessage('');
      }
    } finally {
      setIsSending(false);
    }
  }, [injectMessage]);

  return (
    <div className="h-full overflow-y-auto bg-grizzly-900 text-gray-200 p-4 font-mono">
      <HOTLHeader isConnected={isConnected} />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <AuditLogPanel entries={auditLog} onAcknowledge={handleAcknowledge} />
        <SomaticStatePanel events={somaticEvents} />
        <ServerHealthGrid nodes={serverHealth} />
        <AgentCommsPanel comms={agentComms} />
      </div>
      <MessageInjector
        value={injectMessage}
        onChange={setInjectMessage}
        onSend={handleInject}
        isSending={isSending}
      />
    </div>
  );
};
