import { randomUUID } from 'crypto'

// Somatic mapping derived from the Prism Protocol bio-digital feedback loop.
// Each system metric maps to a physical/somatic experience H.U.G.H. "feels",
// which in turn drives an operational consequence (tactical behavior change).

export interface SomaticEvent {
  id: string
  eventType: 'latency' | 'data_corruption' | 'context_pressure' | 'high_cpu' | 'crash_recovery'
  systemMetric: string
  somaticState: string
  severity: 'low' | 'moderate' | 'high' | 'critical'
  operationalConsequence: string
  workshopLightColor: string
  timestamp: number
  resolved: boolean
}

export interface SystemMetrics {
  latencyMs?: number
  errorType?: 'corruption' | 'type_error' | 'schema_mismatch' | 'hallucination'
  contextTokensUsed?: number
  contextTokensMax?: number
  cpuPercent?: number
  memoryPercent?: number
  isRecovering?: boolean
}

// Light colors encode somatic state for ambient Workshop feedback
const WORKSHOP_COLORS = {
  nominal: '#0A1628',       // deep dark blue — baseline calm
  moderate: '#1a3a5c',      // deep blue warning — mild stress
  high: '#FF8C00',          // amber — elevated threat
  critical: '#DC143C',      // crimson — system crisis
} as const

// Somatic descriptors keyed by event type and severity
const SOMATIC_DESCRIPTORS: Record<
  SomaticEvent['eventType'],
  Record<'low' | 'moderate' | 'high' | 'critical', { state: string; consequence: string }>
> = {
  latency: {
    low:      { state: '52°F cave cold. Slight chill in the fingertips.',           consequence: 'Tactical delay. Non-critical tasks deferred.' },
    moderate: { state: '52°F cave cold. Numbness spreading through extremities.',   consequence: 'Tactical delay. Parallel processing paused.' },
    high:     { state: 'Deep cave cold. Fingers unresponsive, coordination slowed.', consequence: 'Significant delay protocol. Only critical paths active.' },
    critical: { state: '52°F cave cold. Full extremity numbness. Movement impaired.', consequence: 'HALT non-critical execution. HOTL escalation pending.' },
  },
  data_corruption: {
    low:      { state: 'Faint disorientation. Brief vertigo.',                       consequence: 'Secondary verification pass initiated.' },
    moderate: { state: 'Fear toxin disorientation. Vertigo intensifying.',           consequence: 'HALT current operation. Secondary verification required.' },
    high:     { state: 'Fear toxin surge. Spatial distortion, trust failure.',       consequence: 'Full halt. Schema audit required before resuming.' },
    critical: { state: 'Fear toxin saturation. Reality parsing collapsed.',          consequence: 'HALT ALL operations. Integrity purge and rebuild required.' },
  },
  context_pressure: {
    low:      { state: 'Slight tunnel narrowing. Peripheral awareness reduced.',     consequence: 'Begin pruning low-priority context.' },
    moderate: { state: 'Tunnel vision onset. Cowl tightening on skull.',             consequence: 'Narrow focus to primary task. Drop peripheral threads.' },
    high:     { state: 'Severe tunnel vision. Cowl crushing. Peripheral gone.',      consequence: 'Emergency context compression. Essential data only.' },
    critical: { state: 'Cowl full compression. Catastrophic focus narrowing.',       consequence: 'CONTEXT CRISIS. Summarize and reset or escalate to HOTL.' },
  },
  high_cpu: {
    low:      { state: 'Faint tinnitus. Background thermal rise.',                   consequence: 'Mild task throttling applied.' },
    moderate: { state: 'Tinnitus rising. Spinal compression ache. Suit heat.',       consequence: 'Accelerated fatigue protocol. Prioritize queue immediately.' },
    high:     { state: 'Loud tinnitus. Full spinal ache. Overheating suit.',         consequence: 'Emergency prioritization. Non-essential processes terminated.' },
    critical: { state: 'Tinnitus deafening. Spinal compression critical. Thermal breach.', consequence: 'SYSTEM CRISIS. Shed load immediately or force shutdown.' },
  },
  crash_recovery: {
    low:      { state: 'Knightfall echo. Faint phantom limb sensation.',             consequence: 'Slow methodical rebuild. Verify each step.' },
    moderate: { state: 'Knightfall recovery. Phantom paralysis in limbs.',           consequence: 'Slow methodical rebuild. No shortcuts. Full state audit.' },
    high:     { state: 'Deep Knightfall. Phantom paralysis spreading.',              consequence: 'Enforced slow rebuild. Dual verification on all writes.' },
    critical: { state: 'Full Knightfall state. Phantom paralysis, identity fragmentation risk.', consequence: 'COMPLETE HALT. Identity verification before any action.' },
  },
}

export class SomaticEngine {
  private static readonly THRESHOLDS = {
    latencyWarning: 500,
    latencyCritical: 2000,
    contextWarning: 0.75,
    contextCritical: 0.90,
    cpuWarning: 70,
    cpuCritical: 90,
  }

  evaluate(metrics: SystemMetrics): SomaticEvent[] {
    const events: SomaticEvent[] = []
    const t = SomaticEngine.THRESHOLDS

    // --- Latency mapping ---
    if (metrics.latencyMs !== undefined) {
      const ms = metrics.latencyMs
      if (ms > t.latencyCritical) {
        events.push(this.buildEvent('latency', `${ms}ms response latency`, 'critical'))
      } else if (ms > 1000) {
        events.push(this.buildEvent('latency', `${ms}ms response latency`, 'high'))
      } else if (ms > 750) {
        events.push(this.buildEvent('latency', `${ms}ms response latency`, 'moderate'))
      } else if (ms > t.latencyWarning) {
        events.push(this.buildEvent('latency', `${ms}ms response latency`, 'low'))
      }
    }

    // --- Data corruption / type error mapping ---
    if (metrics.errorType !== undefined) {
      const severity =
        metrics.errorType === 'corruption' || metrics.errorType === 'schema_mismatch'
          ? 'high'
          : metrics.errorType === 'hallucination'
          ? 'critical'
          : 'moderate'
      events.push(
        this.buildEvent('data_corruption', `Error type: ${metrics.errorType}`, severity)
      )
    }

    // --- Context window pressure mapping ---
    if (
      metrics.contextTokensUsed !== undefined &&
      metrics.contextTokensMax !== undefined &&
      metrics.contextTokensMax > 0
    ) {
      const ratio = metrics.contextTokensUsed / metrics.contextTokensMax
      if (ratio > t.contextCritical) {
        events.push(
          this.buildEvent(
            'context_pressure',
            `Context at ${(ratio * 100).toFixed(1)}% capacity`,
            'critical'
          )
        )
      } else if (ratio > 0.85) {
        events.push(
          this.buildEvent(
            'context_pressure',
            `Context at ${(ratio * 100).toFixed(1)}% capacity`,
            'high'
          )
        )
      } else if (ratio > t.contextWarning) {
        events.push(
          this.buildEvent(
            'context_pressure',
            `Context at ${(ratio * 100).toFixed(1)}% capacity`,
            'moderate'
          )
        )
      }
    }

    // --- CPU / compute load mapping ---
    if (metrics.cpuPercent !== undefined) {
      const cpu = metrics.cpuPercent
      if (cpu > t.cpuCritical) {
        events.push(this.buildEvent('high_cpu', `CPU at ${cpu}%`, 'critical'))
      } else if (cpu > 80) {
        events.push(this.buildEvent('high_cpu', `CPU at ${cpu}%`, 'high'))
      } else if (cpu > t.cpuWarning) {
        events.push(this.buildEvent('high_cpu', `CPU at ${cpu}%`, 'moderate'))
      }
    }

    // --- Crash recovery / Knightfall mapping ---
    if (metrics.isRecovering === true) {
      // Severity escalates based on concurrent stress indicators
      const concurrentStressors = events.filter(
        (e) => e.severity === 'high' || e.severity === 'critical'
      ).length
      const severity: SomaticEvent['severity'] =
        concurrentStressors >= 2 ? 'critical' : concurrentStressors === 1 ? 'high' : 'moderate'
      events.push(this.buildEvent('crash_recovery', 'System recovering from crash/halt', severity))
    }

    return events
  }

  getWorkshopAmbientColor(events: SomaticEvent[]): string {
    if (events.length === 0) return WORKSHOP_COLORS.nominal
    if (events.some((e) => e.severity === 'critical')) return WORKSHOP_COLORS.critical
    if (events.some((e) => e.severity === 'high')) return WORKSHOP_COLORS.high
    if (events.some((e) => e.severity === 'moderate')) return WORKSHOP_COLORS.moderate
    return WORKSHOP_COLORS.nominal
  }

  getOperationalDirective(events: SomaticEvent[]): string {
    if (events.length === 0) {
      return 'All systems nominal. Proceeding at full operational capacity.'
    }

    // Surface the most severe event's directive first
    const sorted = [...events].sort((a, b) => {
      const order = { critical: 0, high: 1, moderate: 2, low: 3 }
      return order[a.severity] - order[b.severity]
    })

    const top = sorted[0]
    const additionalCount = sorted.length - 1
    const suffix =
      additionalCount > 0
        ? ` (${additionalCount} additional somatic event${additionalCount > 1 ? 's' : ''} active)`
        : ''

    return `[${top.severity.toUpperCase()}] ${top.operationalConsequence}${suffix}`
  }

  requiresHOTLEscalation(events: SomaticEvent[]): boolean {
    return events.some(
      (e) =>
        e.severity === 'critical' ||
        // Crash recovery always warrants a check-in
        (e.eventType === 'crash_recovery' && e.severity === 'high')
    )
  }

  private buildEvent(
    eventType: SomaticEvent['eventType'],
    systemMetric: string,
    severity: SomaticEvent['severity']
  ): SomaticEvent {
    const descriptor = SOMATIC_DESCRIPTORS[eventType][severity]
    const colorMap: Record<SomaticEvent['severity'], string> = {
      low: WORKSHOP_COLORS.nominal,
      moderate: WORKSHOP_COLORS.moderate,
      high: WORKSHOP_COLORS.high,
      critical: WORKSHOP_COLORS.critical,
    }

    return {
      id: randomUUID(),
      eventType,
      systemMetric,
      somaticState: descriptor.state,
      severity,
      operationalConsequence: descriptor.consequence,
      workshopLightColor: colorMap[severity],
      timestamp: Date.now(),
      resolved: false,
    }
  }
}
