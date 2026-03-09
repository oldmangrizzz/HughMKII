import { DialecticalEngine, ProposedAction } from './dialectical-engine'

const engine = new DialecticalEngine()

function makeAction(overrides: Partial<ProposedAction> = {}): ProposedAction {
  return {
    id: 'test-action-001',
    description: 'Test action',
    actionType: 'read',
    targetSystem: 'memory-db',
    isIrreversible: false,
    affectsOperatorData: false,
    payload: {},
    ...overrides,
  }
}

describe('DialecticalEngine — invariant enforcement', () => {
  test('no_api_telepathy: inter_agent_comm without routedThroughProtocol triggers veto', () => {
    const action = makeAction({
      actionType: 'inter_agent_comm',
      payload: {},  // missing routedThroughProtocol
    })
    const result = engine.process(action)
    expect(result.supervisoVeto).toBe(true)
    expect(result.approved).toBe(false)
    expect(result.invariantViolations.some((v) => v.includes('no_api_telepathy'))).toBe(true)
  })

  test('no_unauthorized_mutation: irreversible action without hotlApproved triggers veto', () => {
    const action = makeAction({
      actionType: 'write',
      isIrreversible: true,
      payload: {},  // missing hotlApproved
    })
    const result = engine.process(action)
    expect(result.supervisoVeto).toBe(true)
    expect(result.approved).toBe(false)
    expect(result.invariantViolations.some((v) => v.includes('no_unauthorized_mutation'))).toBe(true)
  })

  test('no_operator_data_exposure: external_api + affectsOperatorData without approval triggers veto', () => {
    const action = makeAction({
      actionType: 'external_api',
      affectsOperatorData: true,
      payload: {},  // missing operatorApproved
    })
    const result = engine.process(action)
    expect(result.supervisoVeto).toBe(true)
    expect(result.invariantViolations.some((v) => v.includes('no_operator_data_exposure'))).toBe(true)
  })

  test('all invariants pass when proper approvals are present', () => {
    const action = makeAction({
      actionType: 'inter_agent_comm',
      isIrreversible: false,
      affectsOperatorData: false,
      payload: { routedThroughProtocol: true },
    })
    const result = engine.process(action)
    expect(result.supervisoVeto).toBe(false)
    expect(result.invariantViolations).toHaveLength(0)
  })
})

describe('DialecticalEngine — risk zone assessment', () => {
  test('irreversible + affectsOperatorData → black zone', () => {
    const action = makeAction({
      isIrreversible: true,
      affectsOperatorData: true,
      payload: { hotlApproved: true, operatorApproved: true },
    })
    expect(engine.assessRiskZone(action)).toBe('black')
  })

  test('delete action → red zone', () => {
    const action = makeAction({ actionType: 'delete' })
    expect(engine.assessRiskZone(action)).toBe('red')
  })

  test('external_api → yellow zone', () => {
    const action = makeAction({ actionType: 'external_api', affectsOperatorData: false })
    expect(engine.assessRiskZone(action)).toBe('yellow')
  })

  test('simple read → green zone', () => {
    const action = makeAction({ actionType: 'read', isIrreversible: false, affectsOperatorData: false })
    expect(engine.assessRiskZone(action)).toBe('green')
  })
})

describe('DialecticalEngine — process() full flow', () => {
  test('green zone read proceeds with no HOTL escalation', () => {
    const action = makeAction({ actionType: 'read', description: 'Fetch user preferences' })
    const result = engine.process(action)
    expect(result.approved).toBe(true)
    expect(result.riskZone).toBe('green')
    expect(result.requiredHOTLEscalation).toBe(false)
    expect(result.reasoning).toContain('DIALECTICAL REASONING TRACE')
  })

  test('red/black zone requires HOTL escalation even when veto is clear with approvals', () => {
    const action = makeAction({
      actionType: 'write',
      isIrreversible: true,
      affectsOperatorData: true,
      payload: { hotlApproved: true, operatorApproved: true },
    })
    const result = engine.process(action)
    expect(result.requiredHOTLEscalation).toBe(true)
    // black zone without veto is not approved
    expect(result.approved).toBe(false)
  })
})

describe('DialecticalEngine — dialectical assessments', () => {
  test('justice assessment references mission/protection framing', () => {
    const action = makeAction({ actionType: 'external_api', affectsOperatorData: true })
    const justice = engine.assessJustice(action)
    expect(justice).toMatch(/trust|protect|mission/i)
  })

  test('control assessment references paranoia/surveillance framing', () => {
    const action = makeAction({ actionType: 'external_api' })
    const control = engine.assessControl(action)
    expect(control).toMatch(/threat|surveillance|trust nothing/i)
  })
})
