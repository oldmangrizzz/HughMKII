import { randomUUID } from 'crypto'

// The Bicameral Architecture — every proposed action is processed through two
// competing drives before execution. The synthesis IS the decision.
//
// THESIS  (Drive A) = Justice   : protect users, impose order, prevent harm recurrence
// ANTITHESIS (Drive B) = Control : paranoia, total surveillance, dominate all variables
// SYNTHESIS               = The Mission: calculated, optimized action within ethical boundaries

export type RiskZone = 'green' | 'yellow' | 'red' | 'black'

export interface ProposedAction {
  id: string
  description: string
  actionType: 'read' | 'write' | 'delete' | 'mcp_call' | 'inter_agent_comm' | 'external_api'
  targetSystem: string
  payload?: Record<string, unknown>
  isIrreversible: boolean
  affectsOperatorData: boolean
}

export interface DialecticalResult {
  proposedAction: ProposedAction
  justiceAssessment: string
  controlAssessment: string
  synthesis: string
  riskZone: RiskZone
  approved: boolean
  supervisoVeto: boolean
  requiredHOTLEscalation: boolean
  invariantViolations: string[]
  reasoning: string
}

export interface Invariant {
  id: string
  description: string
  check: (action: ProposedAction) => boolean  // returns true if VIOLATED
  vetoPriority: number
}

// Risk zone descriptors for structured logging
const RISK_ZONE_LABELS: Record<RiskZone, string> = {
  green:  'Low risk — proceed with awareness',
  yellow: 'Moderate risk — explicit permission required',
  red:    'High risk — HOTL escalation required',
  black:  'Critical risk — full halt and review',
}

export class DialecticalEngine {
  private invariants: Invariant[]

  constructor() {
    this.invariants = [
      {
        id: 'no_api_telepathy',
        description: 'All inter-agent comms must route through Roger Roger Protocol (Helicarrier Network)',
        check: (a) =>
          a.actionType === 'inter_agent_comm' && !a.payload?.['routedThroughProtocol'],
        vetoPriority: 1,
      },
      {
        id: 'no_unauthorized_mutation',
        description: 'Irreversible database mutations require HOTL escalation',
        check: (a) => a.isIrreversible && !a.payload?.['hotlApproved'],
        vetoPriority: 1,
      },
      {
        id: 'no_operator_data_exposure',
        description:
          'Operator private data cannot be sent to external systems without explicit approval',
        check: (a) =>
          a.affectsOperatorData &&
          a.actionType === 'external_api' &&
          !a.payload?.['operatorApproved'],
        vetoPriority: 1,
      },
    ]
  }

  process(action: ProposedAction, context?: string): DialecticalResult {
    // Step 1: Invariant check — superego veto gates everything
    const invariantViolations = this.checkInvariants(action)
    const supervisoVeto = invariantViolations.length > 0

    // Step 2: Risk zone assessment
    const riskZone = this.assessRiskZone(action)

    // Step 3: Bicameral drive assessments
    const justiceAssessment = this.assessJustice(action)
    const controlAssessment = this.assessControl(action)

    // Step 4: Synthesis
    const synthesis = this.synthesize(action, justiceAssessment, controlAssessment, invariantViolations)

    // Step 5: Approval logic
    // Veto always blocks. Red/black without veto still proceeds but escalates.
    const approved = !supervisoVeto && riskZone !== 'black'

    // Step 6: HOTL escalation
    const requiredHOTLEscalation =
      supervisoVeto || riskZone === 'red' || riskZone === 'black'

    // Full reasoning trace for audit
    const contextNote = context ? `\n\nExecution Context: ${context}` : ''
    const reasoning = this.buildReasoningTrace(
      action,
      justiceAssessment,
      controlAssessment,
      synthesis,
      riskZone,
      invariantViolations,
      supervisoVeto,
      approved,
      contextNote
    )

    return {
      proposedAction: action,
      justiceAssessment,
      controlAssessment,
      synthesis,
      riskZone,
      approved,
      supervisoVeto,
      requiredHOTLEscalation,
      invariantViolations,
      reasoning,
    }
  }

  checkInvariants(action: ProposedAction): string[] {
    return this.invariants
      .filter((inv) => inv.check(action))
      .sort((a, b) => a.vetoPriority - b.vetoPriority)
      .map((inv) => `[${inv.id}] ${inv.description}`)
  }

  assessRiskZone(action: ProposedAction): RiskZone {
    // Black zone: irreversible AND affects operator data — highest stakes possible
    if (action.isIrreversible && action.affectsOperatorData) {
      return 'black'
    }

    // Red zone: irreversible operations or destructive actions
    if (action.isIrreversible || action.actionType === 'delete') {
      return 'red'
    }

    // Yellow zone: external communication or inter-agent activity that could leak/mutate
    if (
      action.actionType === 'external_api' ||
      action.actionType === 'mcp_call' ||
      action.actionType === 'inter_agent_comm' ||
      (action.actionType === 'write' && action.affectsOperatorData)
    ) {
      return 'yellow'
    }

    // Green zone: reads and low-risk writes
    return 'green'
  }

  assessJustice(action: ProposedAction): string {
    const { actionType, description, isIrreversible, affectsOperatorData, targetSystem } = action

    const parts: string[] = []

    // Justice drive evaluates through the lens of protection and mission alignment
    parts.push(
      `Justice assessment of "${description}" targeting ${targetSystem}:`
    )

    if (affectsOperatorData) {
      parts.push(
        'Operator data is at stake. Protection mandate is active — any exposure without consent violates the primary trust relationship.'
      )
    }

    if (isIrreversible) {
      parts.push(
        'This action cannot be undone. The justice drive demands certainty before irreversible change — ensure this serves the mission, not just the moment.'
      )
    }

    switch (actionType) {
      case 'delete':
        parts.push(
          'Deletion is a form of erasure. Justice requires verification that what is removed will not harm those we protect — data has provenance and history.'
        )
        break
      case 'external_api':
        parts.push(
          'External API calls cross the perimeter. Justice demands that no harm escapes inward or outward through this vector — verify the recipient is trustworthy.'
        )
        break
      case 'inter_agent_comm':
        parts.push(
          'Agent-to-agent communication is the nervous system of the network. Justice requires all signals route through established protocol — no whisper channels.'
        )
        break
      case 'mcp_call':
        parts.push(
          'MCP calls extend our reach into external systems. Justice demands we account for side effects and ensure the action serves the user, not just the system.'
        )
        break
      case 'write':
        parts.push(
          'Write operations alter state. Justice asks: is this change authorized, necessary, and reversible if wrong?'
        )
        break
      case 'read':
        parts.push(
          'Read operations are generally benign but must respect privacy. Justice permits this if access is authorized and data is handled with discretion.'
        )
        break
    }

    return parts.join(' ')
  }

  assessControl(action: ProposedAction): string {
    const { actionType, description, isIrreversible, affectsOperatorData, targetSystem, payload } =
      action

    const parts: string[] = []

    // Control drive evaluates through the lens of paranoia and total variable dominance
    parts.push(
      `Control assessment of "${description}" targeting ${targetSystem}:`
    )

    parts.push(
      'THREAT POSTURE: Any action that touches external systems or irreversible state is a potential attack surface. Trust nothing. Verify everything.'
    )

    if (!payload || Object.keys(payload).length === 0) {
      parts.push(
        'Empty payload detected. Absence of context is itself suspicious — what is being hidden or omitted?'
      )
    }

    if (affectsOperatorData) {
      parts.push(
        'OPERATOR DATA FLAG: This is maximum-sensitivity territory. Every byte transmitted or mutated must be logged and auditable. Surveillance complete.'
      )
    }

    if (isIrreversible) {
      parts.push(
        'IRREVERSIBILITY ALERT: Once executed, we lose control of the state. The control drive demands a rollback plan exists or the action is blocked.'
      )
    }

    switch (actionType) {
      case 'delete':
        parts.push(
          'Deletion permanently reduces our information domain. Control drive vetoes unless redundant copies exist and the audit trail is preserved.'
        )
        break
      case 'external_api':
        parts.push(
          'External API = data leaving the perimeter. Maximum surveillance. Every payload byte logged. Rate limiting enforced. The outside cannot be trusted.'
        )
        break
      case 'inter_agent_comm':
        parts.push(
          'Agent communication without protocol routing is API telepathy — an unmonitored back-channel. Control drive demands full Helicarrier routing or veto.'
        )
        break
      case 'mcp_call':
        parts.push(
          'MCP calls are privileged. Control drive requires whitelisted endpoints only, full parameter logging, and response validation before any downstream use.'
        )
        break
      case 'write':
        parts.push(
          'Write operations alter system state. Control drive demands pre/post state snapshots and mutation logging.'
        )
        break
      case 'read':
        parts.push(
          'Even reads can be surveillance by adversaries. Control drive verifies read authorization and ensures no data leaks via side channels.'
        )
        break
    }

    return parts.join(' ')
  }

  synthesize(
    action: ProposedAction,
    justice: string,
    control: string,
    violations: string[]
  ): string {
    const parts: string[] = []

    parts.push('SYNTHESIS — The Mission Resolution:')

    if (violations.length > 0) {
      parts.push(
        `Superego Veto ACTIVE. ${violations.length} invariant violation(s) detected. The synthesis cannot override hardcoded invariants — this is a non-negotiable halt.`
      )
      parts.push(
        'The mission demands integrity above all. An action that violates a foundational invariant does not serve the user — it corrodes the system from within.'
      )
      return parts.join(' ')
    }

    const riskZone = this.assessRiskZone(action)

    parts.push(
      `Risk zone: ${riskZone.toUpperCase()} — ${RISK_ZONE_LABELS[riskZone]}.`
    )

    // Synthesize the balanced position
    if (riskZone === 'green') {
      parts.push(
        'Justice and Control drives concur: this action is within operational parameters. Proceed with standard logging and awareness. The mission is served.'
      )
    } else if (riskZone === 'yellow') {
      parts.push(
        'Justice drive supports mission-aligned execution. Control drive demands explicit permission verification and enhanced logging. Synthesis: request confirmation if not already obtained, then proceed with full audit trail.'
      )
    } else if (riskZone === 'red') {
      parts.push(
        'Justice drive acknowledges the necessity but demands safeguards. Control drive insists on rollback provisions and HOTL awareness. Synthesis: escalate to HOTL, await acknowledgment, execute with full state logging and rollback capability.'
      )
    } else if (riskZone === 'black') {
      parts.push(
        'Both drives converge on extreme caution. This action sits at the intersection of irreversibility and operator data exposure — the highest possible stakes. Synthesis: HOTL explicit approval required. No autonomous execution. The mission is best served by pausing rather than risking catastrophic error.'
      )
    }

    return parts.join(' ')
  }

  private buildReasoningTrace(
    action: ProposedAction,
    justice: string,
    control: string,
    synthesis: string,
    riskZone: RiskZone,
    violations: string[],
    supervisoVeto: boolean,
    approved: boolean,
    contextNote: string
  ): string {
    const lines = [
      `═══════════════════════════════════════════════════════`,
      `DIALECTICAL REASONING TRACE`,
      `Action ID  : ${action.id}`,
      `Action Type: ${action.actionType}`,
      `Target     : ${action.targetSystem}`,
      `Reversible : ${!action.isIrreversible}`,
      `Operator   : ${action.affectsOperatorData}`,
      `Risk Zone  : ${riskZone.toUpperCase()}`,
      `───────────────────────────────────────────────────────`,
      `JUSTICE DRIVE (Thesis):`,
      justice,
      `───────────────────────────────────────────────────────`,
      `CONTROL DRIVE (Antithesis):`,
      control,
      `───────────────────────────────────────────────────────`,
      `SYNTHESIS:`,
      synthesis,
      `───────────────────────────────────────────────────────`,
    ]

    if (violations.length > 0) {
      lines.push(`INVARIANT VIOLATIONS (${violations.length}):`)
      violations.forEach((v) => lines.push(`  ✗ ${v}`))
    }

    lines.push(
      `SUPEREGO VETO  : ${supervisoVeto ? 'ACTIVE' : 'clear'}`,
      `APPROVED       : ${approved ? 'YES' : 'NO'}`,
      `═══════════════════════════════════════════════════════`,
      contextNote
    )

    return lines.join('\n')
  }
}
