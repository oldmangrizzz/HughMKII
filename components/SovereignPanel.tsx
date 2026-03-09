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
