// services/config.ts
// Real production defaults — single source of truth, no manual config needed

export const DEFAULTS = {
  homeAssistantUrl: '/api/ha',       // proxied through nginx (requires Pangolin tunnel to HA)
  homeAssistantToken: '',            // injected server-side via proxy — no token needed client-side
  inferenceUrl: '/api/inference',    // proxied through nginx → llama.cpp on VPS:8080
  hughApiUrl: 'https://api.grizzlymedicine.icu',
  convexUrl: 'https://sincere-albatross-464.convex.cloud',
  ollamaUrl: '',
  useLocalLlm: true,
  useSpinalCord: false,
  spinalCordUrl: '',
  mapboxToken: '',
}

export type SystemConfig = typeof DEFAULTS

export function getConfig(): SystemConfig {
  try {
    const saved = localStorage.getItem('hugh_system_config')
    if (saved) {
      return { ...DEFAULTS, ...JSON.parse(saved) }
    }
  } catch {}
  return DEFAULTS
}

export function saveConfig(config: Partial<SystemConfig>) {
  localStorage.setItem('hugh_system_config', JSON.stringify({ ...getConfig(), ...config }))
}

// Auto-seed on import — ensures localStorage always has real values
if (typeof window !== 'undefined') {
  const existing = localStorage.getItem('hugh_system_config')
  if (!existing) {
    localStorage.setItem('hugh_system_config', JSON.stringify(DEFAULTS))
  }
}
