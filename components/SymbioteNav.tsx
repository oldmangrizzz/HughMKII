import React from 'react'
import { AppMode } from '../types'

interface NavItemDef {
  mode: AppMode
  glyph: string
  label: string
  section?: string
}

const NAV_ITEMS: NavItemDef[] = [
  { mode: AppMode.HOTL_DASHBOARD, glyph: '◈', label: 'Command Center', section: 'COMMAND' },
  { mode: AppMode.DASHBOARD, glyph: '⬡', label: 'Mission Control' },
  { mode: AppMode.CHAT, glyph: '◎', label: 'Comms Link' },
  { mode: AppMode.HOME_CONTROL, glyph: '⬟', label: 'Habitat Control' },
  { mode: AppMode.SITUATIONAL_AWARENESS, glyph: '◉', label: 'Harbormaster' },
  { mode: AppMode.VISUALIZER, glyph: '⌬', label: 'Engineering', section: 'ANALYSIS' },
  { mode: AppMode.MEDIA_STUDIO, glyph: '◫', label: 'Media Lab' },
  { mode: AppMode.ANALYZER, glyph: '⊛', label: 'Analysis' },
  { mode: AppMode.LIVE, glyph: '⬮', label: 'Live Link', section: 'SYSTEMS' },
  { mode: AppMode.SYSTEM, glyph: '⊹', label: 'Architecture' },
  { mode: AppMode.WORKSHOP, glyph: '⟁', label: 'Workshop ✦ VR' },
]

interface SymbioteNavProps {
  currentMode: AppMode
  setMode: (mode: AppMode) => void
}

export const SymbioteNav: React.FC<SymbioteNavProps> = ({ currentMode, setMode }) => {
  return (
    <nav className="symbiote-nav" aria-label="H.U.G.H. Navigation">
      <div className="symbiote-spine" aria-hidden="true" />
      <div className="symbiote-nav-content">
        <div className="symbiote-identity">
          <span className="symbiote-identity-mark glow-text">H.U.G.H.</span>
          <span className="symbiote-identity-sub">Guardian System</span>
        </div>

        <div className="symbiote-nav-items">
          {NAV_ITEMS.map((item) => (
            <React.Fragment key={item.mode}>
              {item.section && (
                <div className="symbiote-nav-section-label">{item.section}</div>
              )}
              <button
                className={`symbiote-nav-item${currentMode === item.mode ? ' active' : ''}`}
                onClick={() => setMode(item.mode)}
                aria-current={currentMode === item.mode ? 'page' : undefined}
              >
                <span className="symbiote-nav-glyph" aria-hidden="true">{item.glyph}</span>
                <span className="symbiote-nav-label">{item.label}</span>
                {currentMode === item.mode && (
                  <span className="symbiote-active-line" aria-hidden="true" />
                )}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className="symbiote-soul-status">
          <div className="symbiote-soul-row">
            <div className="symbiote-soul-dot" aria-hidden="true" />
            <span className="symbiote-soul-text">SOUL: ARAGON-1.0</span>
          </div>
          <div className="symbiote-particle-count">⬡ 80K PARTICLES ACTIVE</div>
        </div>
      </div>
    </nav>
  )
}
