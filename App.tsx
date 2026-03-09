import React, { useState } from 'react'
import { CliffordField } from './components/CliffordField'
import { SymbioteNav } from './components/SymbioteNav'
import { SovereignPanel } from './components/SovereignPanel'
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
  const [mode, setMode] = useState<AppMode>(AppMode.DASHBOARD)

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

  const isWorkshop = mode === AppMode.WORKSHOP

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--void)', overflow: 'hidden' }}>
      {/* Clifford attractor background — hidden in Workshop to avoid canvas querySelector conflict */}
      {!isWorkshop && <CliffordField activeMode={mode} />}

      {/* Navigation overlay */}
      <SymbioteNav currentMode={mode} setMode={setMode} />

      {/* Workshop: full-screen, no panel wrapper, no nav offset */}
      {isWorkshop && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 5 }}>
          <Workshop />
        </div>
      )}

      {/* All other modes: offset from nav, wrapped in SovereignPanel */}
      {!isWorkshop && (
        <main
          className="sovereign-main"
          style={{ zIndex: 5 }}
        >
          <SovereignPanel key={mode} title={MODE_TITLES[mode]}>
            {renderContent()}
          </SovereignPanel>
        </main>
      )}
    </div>
  )
}

export default App
