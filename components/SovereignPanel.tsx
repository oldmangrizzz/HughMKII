// SovereignPanel.tsx — Liquid glass panel wrapper for Workshop content sections
// Applies SVG displacement filter at edges, hue-rotating backdrop-filter,
// chromatic aberration on titles, and 0.28 opacity glass effect.
// All styling lives in symbiote.css (.sovereign-panel-*).
// Wraps any content section; pass isActive=false to render children unwrapped.

import React from 'react'

interface SovereignPanelProps {
  children: React.ReactNode
  title: string
  isActive?: boolean
}

export const SovereignPanel: React.FC<SovereignPanelProps> = ({
  children,
  title,
  isActive = true,
}) => {
  if (!isActive) return <>{children}</>

  return (
    <div className="sovereign-panel-wrapper">
      <div className="sovereign-panel">
        <div className="sovereign-panel-header">
          <div className="sovereign-panel-title">{title}</div>
          <div className="sovereign-panel-title-line" aria-hidden="true" />
        </div>
        <div className="sovereign-panel-body">
          {children}
        </div>
      </div>
    </div>
  )
}
