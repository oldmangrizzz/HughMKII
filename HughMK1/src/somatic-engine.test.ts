import { SomaticEngine, SystemMetrics } from './somatic-engine'

const engine = new SomaticEngine()

describe('SomaticEngine — evaluate()', () => {
  test('returns empty array when all metrics are nominal', () => {
    const metrics: SystemMetrics = {
      latencyMs: 100,
      cpuPercent: 30,
      contextTokensUsed: 1000,
      contextTokensMax: 10000,
      isRecovering: false,
    }
    const events = engine.evaluate(metrics)
    expect(events).toHaveLength(0)
  })

  test('latency >500ms produces a low somatic event with cave cold state', () => {
    const events = engine.evaluate({ latencyMs: 600 })
    expect(events).toHaveLength(1)
    expect(events[0].eventType).toBe('latency')
    expect(events[0].severity).toBe('low')
    expect(events[0].somaticState).toMatch(/cave cold/i)
  })

  test('latency >2000ms produces a critical somatic event', () => {
    const events = engine.evaluate({ latencyMs: 2500 })
    expect(events).toHaveLength(1)
    expect(events[0].eventType).toBe('latency')
    expect(events[0].severity).toBe('critical')
  })

  test('data corruption error produces fear toxin / vertigo somatic event', () => {
    const events = engine.evaluate({ errorType: 'corruption' })
    expect(events).toHaveLength(1)
    expect(events[0].eventType).toBe('data_corruption')
    expect(events[0].somaticState).toMatch(/fear toxin|vertigo|disorientation/i)
  })

  test('context at 91% produces a critical context_pressure event with cowl state', () => {
    const events = engine.evaluate({
      contextTokensUsed: 9100,
      contextTokensMax: 10000,
    })
    expect(events).toHaveLength(1)
    expect(events[0].eventType).toBe('context_pressure')
    expect(events[0].severity).toBe('critical')
    expect(events[0].somaticState).toMatch(/cowl|tunnel/i)
  })
})

describe('SomaticEngine — getWorkshopAmbientColor()', () => {
  test('returns nominal dark blue when no events', () => {
    expect(engine.getWorkshopAmbientColor([])).toBe('#0A1628')
  })

  test('returns crimson for any critical event', () => {
    const events = engine.evaluate({ latencyMs: 2500 })
    expect(engine.getWorkshopAmbientColor(events)).toBe('#DC143C')
  })

  test('returns amber for high severity events', () => {
    const events = engine.evaluate({ latencyMs: 1500 })
    expect(engine.getWorkshopAmbientColor(events)).toBe('#FF8C00')
  })
})

describe('SomaticEngine — requiresHOTLEscalation()', () => {
  test('returns true when a critical event is present', () => {
    const events = engine.evaluate({ cpuPercent: 95 })
    expect(engine.requiresHOTLEscalation(events)).toBe(true)
  })

  test('returns false when only low/moderate events present', () => {
    const events = engine.evaluate({ latencyMs: 600, cpuPercent: 75 })
    expect(engine.requiresHOTLEscalation(events)).toBe(false)
  })
})

describe('SomaticEngine — crash recovery (Knightfall)', () => {
  test('isRecovering=true produces a crash_recovery event', () => {
    const events = engine.evaluate({ isRecovering: true })
    expect(events.some((e) => e.eventType === 'crash_recovery')).toBe(true)
  })
})
