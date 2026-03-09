import React, { useState, useEffect, useCallback } from 'react';

interface NodeStatus {
  name: string;
  status: 'online' | 'degraded' | 'offline' | 'unknown';
  detail: string;
  latencyMs?: number;
}

interface HASummary {
  totalEntities: number;
  lightsOn: number;
  lightsOff: number;
  sensors: number;
  unavailable: number;
}

export const Dashboard: React.FC = () => {
  const [nodes, setNodes] = useState<NodeStatus[]>([]);
  const [haSummary, setHASummary] = useState<HASummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);

    // Fetch in parallel
    const [hughHealth, inferenceHealth, haStates] = await Promise.allSettled([
      fetch('https://api.grizzlymedicine.icu/health', { signal: AbortSignal.timeout(5000) })
        .then(r => r.ok ? r.json() : Promise.reject(r.status)),
      fetch('/api/inference/health', { signal: AbortSignal.timeout(5000) })
        .then(r => r.ok ? r.json() : Promise.reject(r.status)),
      fetch('/api/ha/api/states', { signal: AbortSignal.timeout(8000) })
        .then(r => r.ok ? r.json() : Promise.reject(r.status)),
    ]);

    const updatedNodes: NodeStatus[] = [
      {
        name: 'H.U.G.H. API',
        status: hughHealth.status === 'fulfilled' ? 'online' : 'offline',
        detail: hughHealth.status === 'fulfilled'
          ? `v${hughHealth.value?.version ?? '?'} — ${hughHealth.value?.status ?? 'ok'}`
          : 'api.grizzlymedicine.icu unreachable',
      },
      {
        name: 'LFM Inference',
        status: inferenceHealth.status === 'fulfilled' ? 'online' : 'offline',
        detail: inferenceHealth.status === 'fulfilled'
          ? `${inferenceHealth.value?.status ?? 'running'}`
          : 'Inference node unreachable',
      },
      {
        name: 'Home Assistant',
        status: haStates.status === 'fulfilled' ? 'online' : 'offline',
        detail: haStates.status === 'fulfilled'
          ? `${(haStates.value as any[]).length} entities loaded`
          : 'HA tunnel not active',
      },
    ];

    setNodes(updatedNodes);

    if (haStates.status === 'fulfilled') {
      const states = haStates.value as Array<{ entity_id: string; state: string }>;
      const lights = states.filter(e => e.entity_id.startsWith('light.'));
      setHASummary({
        totalEntities: states.length,
        lightsOn: lights.filter(l => l.state === 'on').length,
        lightsOff: lights.filter(l => l.state === 'off').length,
        sensors: states.filter(e => e.entity_id.startsWith('sensor.')).length,
        unavailable: states.filter(e => e.state === 'unavailable').length,
      });
    }

    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const statusColor: Record<NodeStatus['status'], string> = {
    online: 'text-emerald-400',
    degraded: 'text-amber-400',
    offline: 'text-red-400',
    unknown: 'text-gray-500',
  };
  const statusDot: Record<NodeStatus['status'], string> = {
    online: 'bg-emerald-400',
    degraded: 'bg-amber-400 animate-pulse',
    offline: 'bg-red-500',
    unknown: 'bg-gray-600',
  };

  return (
    <div className="h-full p-8 overflow-y-auto">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-bold text-white mb-2">Mission Control</h2>
          <p className="text-gray-400 font-mono text-sm">
            {lastRefresh ? `Last sync: ${lastRefresh.toLocaleTimeString()}` : 'Initializing...'}
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="px-4 py-2 border border-grizzly-700 rounded-lg text-sm text-gray-400 hover:text-white hover:border-highland-500 transition-all font-mono disabled:opacity-50"
        >
          {loading ? '↻ Refreshing...' : '↻ Refresh'}
        </button>
      </header>

      {/* Node Status Grid */}
      <section className="mb-10">
        <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-4">
          Infrastructure Nodes
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {nodes.map((node) => (
            <div
              key={node.name}
              className="bg-grizzly-800/50 border border-grizzly-700 rounded-xl p-5 hover:border-highland-500/30 transition-all"
            >
              <div className="flex items-center space-x-2 mb-3">
                <div className={`w-2 h-2 rounded-full ${statusDot[node.status]}`}></div>
                <span className={`text-xs font-mono font-bold uppercase ${statusColor[node.status]}`}>
                  {node.status}
                </span>
              </div>
              <h4 className="text-white font-bold mb-1">{node.name}</h4>
              <p className="text-xs text-gray-500 font-mono">{node.detail}</p>
            </div>
          ))}

          {loading && nodes.length === 0 && [...Array(3)].map((_, i) => (
            <div key={i} className="bg-grizzly-800/30 border border-grizzly-800 rounded-xl p-5 animate-pulse h-28"></div>
          ))}
        </div>
      </section>

      {/* HA Summary */}
      {haSummary && (
        <section className="mb-10">
          <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-4">
            Home Assistant Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total Entities', value: haSummary.totalEntities, color: 'text-gray-300' },
              { label: 'Lights On', value: haSummary.lightsOn, color: 'text-amber-400' },
              { label: 'Lights Off', value: haSummary.lightsOff, color: 'text-gray-500' },
              { label: 'Sensors', value: haSummary.sensors, color: 'text-highland-400' },
              { label: 'Unavailable', value: haSummary.unavailable, color: 'text-red-400' },
            ].map(item => (
              <div
                key={item.label}
                className="bg-grizzly-800/50 border border-grizzly-700 rounded-xl p-4 text-center"
              >
                <div className={`text-3xl font-bold font-mono ${item.color}`}>{item.value}</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">{item.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* HA offline notice */}
      {!haSummary && !loading && (
        <section className="mb-10">
          <div className="bg-grizzly-800/30 border border-grizzly-800 rounded-xl p-6 text-center">
            <span className="material-icons-outlined text-3xl text-gray-700 mb-2 block">home</span>
            <p className="text-gray-600 text-sm font-mono">
              Home Assistant not reachable via /api/ha proxy.
            </p>
            <p className="text-gray-700 text-xs mt-1">
              Requires Pangolin/Gerbil tunnel from HA host to VPS.
            </p>
          </div>
        </section>
      )}
    </div>
  );
};
