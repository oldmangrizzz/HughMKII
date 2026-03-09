import React, { useState, useEffect, useRef } from 'react'

export interface HughStatus {
  online: boolean
  checking: boolean
  processing: boolean
}

const HEALTH_URL = 'https://api.grizzlymedicine.icu/health'

export function useHughStatus(): HughStatus {
  const [online, setOnline] = useState(false)
  const [checking, setChecking] = useState(true)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      setChecking(true)
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 5000)
        try {
          const res = await fetch(HEALTH_URL, { signal: controller.signal })
          if (!cancelled) setOnline(res.ok)
        } finally {
          clearTimeout(timer)
        }
      } catch {
        if (!cancelled) setOnline(false)
      } finally {
        if (!cancelled) setChecking(false)
      }
    }
    check()
    const interval = setInterval(check, 10_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  return { online, checking, processing }
}

interface HughPresenceOverlayProps {
  status: HughStatus
}

export const HughPresenceOverlay: React.FC<HughPresenceOverlayProps> = ({ status }) => {
  const dotRef = useRef<HTMLDivElement>(null)

  return (
    <div className="hugh-presence-overlay" aria-live="polite" aria-label="H.U.G.H. status">
      <div
        className={`hugh-presence-dot ${status.online ? 'online' : 'offline'} ${status.processing ? 'processing' : ''}`}
        ref={dotRef}
      />
      <div className="hugh-presence-label">
        <span className="hugh-presence-name">H.U.G.H.</span>
        <span className="hugh-presence-status">
          {status.checking ? '...' : status.online ? (status.processing ? 'PROCESSING' : 'ONLINE') : 'OFFLINE'}
        </span>
      </div>
    </div>
  )
}
