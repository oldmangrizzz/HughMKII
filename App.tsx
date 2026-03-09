import React, { useState, useRef, useCallback } from 'react'
import { CliffordField } from './components/CliffordField'
import { TopNav } from './components/TopNav'
import { SovereignPanel } from './components/SovereignPanel'
import { HughPresenceOverlay, useHughStatus } from './components/HughPresence'
import { VoicePortal } from './components/VoicePortal'
import { Dashboard } from './components/Dashboard'
import { Visualizer } from './components/Visualizer'
import { OmniChat } from './components/OmniChat'
import { MediaStudio } from './components/MediaStudio'
import { LiveSession } from './components/LiveSession'
import { SystemMod } from './components/SystemMod'
import { HomeControl } from './components/HomeControl'
import { MapboxView } from './components/MapboxView'
import { Workshop } from './components/Workshop'
import { HOTLDashboard } from './components/HOTLDashboard'
import { AppMode } from './types'
import './symbiote.css'

const MODE_TITLES: Record<AppMode, string> = {
  [AppMode.DASHBOARD]: 'Mission Control',
  [AppMode.CHAT]: 'Comms Link',
  [AppMode.VISUALIZER]: 'Engineering',
  [AppMode.MEDIA_STUDIO]: 'Media Lab',
  [AppMode.ANALYZER]: 'Analysis',
  [AppMode.LIVE]: 'Live Link',
  [AppMode.SYSTEM]: 'Architecture',
  [AppMode.HOME_CONTROL]: 'Habitat Control',
  [AppMode.SITUATIONAL_AWARENESS]: 'Harbormaster',
  [AppMode.WORKSHOP]: 'Workshop ✦ VR',
  [AppMode.HOTL_DASHBOARD]: 'Command Center',
}

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.HOTL_DASHBOARD)
  const mouseRef = useRef<[number, number]>([0, 0])
  const innerRef = useRef<HTMLDivElement>(null)
  const hughStatus = useHughStatus()

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const nx = (e.clientX / window.innerWidth - 0.5) * 2
    const ny = -(e.clientY / window.innerHeight - 0.5) * 2
    mouseRef.current = [nx, ny]
    if (innerRef.current) {
      const tX = ny * 1.5
      const tY = nx * 1.0
      innerRef.current.style.transform = `rotateX(${tX}deg) rotateY(${tY}deg)`
    }
  }, [])

  const handleVoiceSubmit = useCallback((text: string) => {
    setMode(AppMode.CHAT)
    window.dispatchEvent(new CustomEvent('hugh:voice-submit', { detail: { text } }))
  }, [])

  if (mode === AppMode.WORKSHOP) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'var(--void)', overflow: 'hidden' }}>
        <TopNav currentMode={mode} setMode={setMode} />
        <div style={{ position: 'absolute', inset: 0, zIndex: 5 }}>
          <Workshop />
        </div>
      </div>
    )
  }

  const renderContent = (): React.ReactNode => {
    switch (mode) {
      case AppMode.DASHBOARD: return <Dashboard />
      case AppMode.CHAT: return <OmniChat />
      case AppMode.VISUALIZER: return <Visualizer />
      case AppMode.MEDIA_STUDIO: return <MediaStudio />
      case AppMode.LIVE: return <LiveSession />
      case AppMode.SYSTEM: return <SystemMod />
      case AppMode.HOME_CONTROL: return <HomeControl />
      case AppMode.SITUATIONAL_AWARENESS: return <MapboxView />
      case AppMode.HOTL_DASHBOARD: return <HOTLDashboard />
      case AppMode.ANALYZER: return (
        <div style={{ padding: '2rem', color: 'rgba(200,184,255,0.5)', fontFamily: 'Space Mono, monospace', fontSize: 12 }}>
          ⊛ ANALYZER MODULE INITIALIZING...
        </div>
      )
      default: return <Dashboard />
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'var(--void)', overflow: 'hidden' }}
      onMouseMove={handleMouseMove}
    >
      <CliffordField
        activeMode={mode}
        hughOnline={hughStatus.online}
        hughProcessing={hughStatus.processing}
        mouse={mouseRef}
      />

      <TopNav currentMode={mode} setMode={setMode} />
      <HughPresenceOverlay status={hughStatus} />

      <main className="sovereign-main" style={{ zIndex: 5 }}>
        <div ref={innerRef} className="sovereign-main-inner">
          <SovereignPanel key={mode} title={MODE_TITLES[mode]}>
            {renderContent()}
          </SovereignPanel>
        </div>
      </main>

      <VoicePortal onSubmit={handleVoiceSubmit} />
    </div>
  )
}

export default App
