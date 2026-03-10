import { getConfig } from './config'

const HA_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiI3MGM1ZjA4YWRiZTg0ZTM2YTI0YmY5M2I4ZDNkODdlNyIsImlhdCI6MTc3MzA4OTY3NSwiZXhwIjoyMDg4NDQ5Njc1fQ.JnitS57smDEOUSCrrlJij5SpWz24zIa34Ur7IuI-vPQ'
const HA_BASE = 'https://ha.grizzlymedicine.icu'

export const fetchHAStates = async () => {
  try {
    const res = await fetch(`${HA_BASE}/api/states`, {
      headers: {
        'Authorization': `Bearer ${HA_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })
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
    const res = await fetch(`${HA_BASE}/api/services/${domain}/${service}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HA_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ entity_id, ...data }),
    })
    if (!res.ok) {
      console.warn('[HA] service call failed:', res.status)
    }
  } catch (e) {
    console.error('[HA] service call failed:', e)
  }
}

export { getConfig }
