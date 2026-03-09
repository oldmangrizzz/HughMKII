import { getConfig } from './config'

export const fetchHAStates = async () => {
  try {
    const res = await fetch('/api/ha/api/states')
    if (!res.ok) {
      console.warn('[HA] fetch failed:', res.status)
      return []
    }
    return await res.json()
  } catch (e) {
    console.error('[HA] fetch failed:', e)
    return []
  }
}

export const callHAService = async (
  domain: string,
  service: string,
  entity_id: string,
  data?: Record<string, unknown>
) => {
  try {
    const res = await fetch(`/api/ha/api/services/${domain}/${service}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_id, ...data }),
    })
    if (!res.ok) {
      console.warn('[HA] service call failed:', res.status)
    }
  } catch (e) {
    console.error('[HA] service call failed:', e)
  }
}

// Keep legacy config export so old imports don't break
export { getConfig }
