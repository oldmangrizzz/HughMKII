// TopNav.tsx — Ghost navigation bar for the Workshop
// Only appears when the mouse enters the top 80px of the viewport.
// Auto-hides after 1.2s of inactivity. Active mode shows a 60vh drop-line into content.
// No persistent sidebar — visibility is purely proximity-triggered.
// Connects to: App.tsx setMode, AppMode enum in types.ts.

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { AppMode } from '../types'

interface NavLabel {
  mode: AppMode
  label: string
  short: string
}

const NAV_LABELS: NavLabel[] = [
  { mode: AppMode.HOTL_DASHBOARD, label: 'COMMAND', short: 'CMD' },
  { mode: AppMode.CHAT, label: 'COMMS', short: 'COM' },
  { mode: AppMode.WORKSHOP, label: 'WORKSHOP', short: 'WRK' },
  { mode: AppMode.HOME_CONTROL, label: 'HABITAT', short: 'HAB' },
  { mode: AppMode.LIVE, label: 'LIVE', short: 'LVE' },
  { mode: AppMode.SYSTEM, label: 'SYSTEMS', short: 'SYS' },
  { mode: AppMode.DASHBOARD, label: 'MISSION', short: 'MSN' },
  { mode: AppMode.VISUALIZER, label: 'ENGINEERING', short: 'ENG' },
  { mode: AppMode.SITUATIONAL_AWARENESS, label: 'HARBORMASTER', short: 'HBR' },
]

interface TopNavProps {
  currentMode: AppMode
  setMode: (m: AppMode) => void
}

export const TopNav: React.FC<TopNavProps> = ({ currentMode, setMode }) => {
  const [visible, setVisible] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setVisible(true)
  }, [])

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setVisible(false), 1200)
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (e.clientY < 80) show()
      else if (e.clientY > 120) scheduleHide()
    }
    const onTouch = (e: TouchEvent) => {
      if (e.touches[0]?.clientY < 80) show()
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('touchstart', onTouch)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('touchstart', onTouch)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [show, scheduleHide])

  return (
    <nav
      className={`top-nav ${visible ? 'visible' : ''}`}
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      aria-label="H.U.G.H. Navigation"
    >
      <div className="top-nav-inner">
        <span className="top-nav-identity">H.U.G.H.</span>
        <div className="top-nav-sep" aria-hidden="true" />
        <div className="top-nav-items">
          {NAV_LABELS.map(({ mode, label }) => (
            <button
              key={mode}
              className={`top-nav-item ${currentMode === mode ? 'active' : ''}`}
              onClick={() => setMode(mode)}
              aria-current={currentMode === mode ? 'page' : undefined}
            >
              <span className="top-nav-label">{label}</span>
              {currentMode === mode && <span className="top-nav-active-drop" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}
