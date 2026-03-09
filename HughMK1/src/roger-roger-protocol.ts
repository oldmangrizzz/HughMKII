import { randomUUID } from 'crypto'
import { DialecticalEngine, ProposedAction, RiskZone } from './dialectical-engine'

export type RoutingProtocol = 'matrix_synapse' | 'postfix' | 'livekit' | 'helicarrier'
export type MessageType = 'request' | 'response' | 'broadcast' | 'alert'
export type MessageStatus = 'queued' | 'sent' | 'delivered' | 'failed'

export interface AgentMessage {
  id: string
  fromAgent: string
  toAgent: string
  messageType: MessageType
  subject: string
  content: string
  routingProtocol: RoutingProtocol
  timestamp: number
  operatorVisible: boolean // always true
}

export interface RogerRogerConfig {
  convexURL: string
  matrixSynapseURL?: string // optional — fall back to helicarrier
  livekitURL?: string       // optional
  postfixHost?: string      // optional
  agentId: string           // this agent's ID
}

// Raw record shape returned by Convex over HTTP
interface ConvexAgentCommRecord {
  _id?: unknown
  id?: unknown
  fromAgent?: unknown
  toAgent?: unknown
  messageType?: unknown
  subject?: unknown
  content?: unknown
  routingProtocol?: unknown
  timestamp?: unknown
}

export class RogerRogerProtocol {
  private config: RogerRogerConfig
  private dialecticalEngine: DialecticalEngine
  private messageQueue: AgentMessage[] = []

  constructor(config: RogerRogerConfig) {
    this.config = config
    this.dialecticalEngine = new DialecticalEngine()
  }

  // Send a message to another agent — always via routing protocol, never direct
  async send(
    toAgent: string,
    subject: string,
    content: string,
    messageType: MessageType,
    preferredProtocol?: RoutingProtocol
  ): Promise<{ messageId: string; protocol: RoutingProtocol }> {
    const messageId = randomUUID()
    const protocol = this.selectProtocol(preferredProtocol)

    // The invariant `no_api_telepathy` fires when inter_agent_comm is sent
    // WITHOUT routedThroughProtocol. We satisfy it here by including the flag.
    const action: ProposedAction = {
      id: messageId,
      description: `Inter-agent message: ${this.config.agentId} → ${toAgent} [${subject}]`,
      actionType: 'inter_agent_comm',
      targetSystem: toAgent,
      payload: {
        routedThroughProtocol: true, // satisfies no_api_telepathy invariant
        subject,
        messageType,
        protocol,
      },
      isIrreversible: false,
      affectsOperatorData: false,
    }

    const dialectical = this.dialecticalEngine.process(action, 'Roger Roger Protocol routing')

    if (dialectical.supervisoVeto) {
      throw new Error(
        `[Roger Roger] Dialectical veto — message blocked.\n` +
        `Violations: ${dialectical.invariantViolations.join('; ')}`
      )
    }

    const message: AgentMessage = {
      id: messageId,
      fromAgent: this.config.agentId,
      toAgent,
      messageType,
      subject,
      content,
      routingProtocol: protocol,
      timestamp: Date.now(),
      operatorVisible: true, // ALWAYS — no dark comms, ever
    }

    // Log initial audit entry to Convex before attempting delivery
    await this.logToConvex(message, 'queued').catch((err) =>
      console.warn('[Roger Roger] Initial Convex audit log failed:', err)
    )

    // Attempt delivery — cascade through fallbacks
    let delivered = false

    if (protocol === 'matrix_synapse' && this.config.matrixSynapseURL) {
      delivered = await this.routeViaMatrixSynapse(message)
    }

    if (!delivered && this.config.livekitURL) {
      delivered = await this.routeViaLiveKit(message)
    }

    if (!delivered) {
      // Helicarrier is the guaranteed fallback — operator sees and acknowledges
      delivered = await this.routeViaHelicarrier(message)
    }

    const finalStatus: MessageStatus = delivered ? 'sent' : 'failed'
    if (finalStatus === 'failed') {
      console.error(`[Roger Roger] All routing paths failed for message ${messageId}`)
    }

    this.messageQueue.push(message)

    if (dialectical.requiredHOTLEscalation) {
      await this.logHOTLForMessage(action, dialectical.reasoning, dialectical.riskZone).catch(
        (err) => console.warn('[Roger Roger] HOTL log failed:', err)
      )
    }

    return { messageId, protocol: message.routingProtocol }
  }

  // Receive pending messages for this agent from Convex queue
  async receive(): Promise<AgentMessage[]> {
    if (!this.config.convexURL) return []

    try {
      const result = await this.convexQuery('workshop:getPendingAgentComms', {
        toAgent: this.config.agentId,
      })

      if (!Array.isArray(result)) return []

      return (result as ConvexAgentCommRecord[]).map((record) => ({
        id: String(record._id ?? record.id ?? randomUUID()),
        fromAgent: String(record.fromAgent ?? ''),
        toAgent: String(record.toAgent ?? this.config.agentId),
        messageType: (record.messageType as MessageType) ?? 'request',
        subject: String(record.subject ?? ''),
        content: String(record.content ?? ''),
        routingProtocol: (record.routingProtocol as RoutingProtocol) ?? 'helicarrier',
        timestamp: Number(record.timestamp ?? Date.now()),
        operatorVisible: true,
      }))
    } catch (err) {
      console.warn('[Roger Roger] receive() query failed:', err)
      return []
    }
  }

  // Broadcast to all agents (e.g., system alerts)
  async broadcast(subject: string, content: string): Promise<void> {
    const targets = ['all-agents', 'operator']
    await Promise.all(
      targets.map((target) =>
        this.send(target, subject, content, 'broadcast', 'helicarrier').catch((err) =>
          console.warn(`[Roger Roger] broadcast to ${target} failed:`, err)
        )
      )
    )
  }

  // Select best available routing protocol
  private selectProtocol(preferred?: RoutingProtocol): RoutingProtocol {
    if (preferred !== undefined) {
      if (preferred === 'matrix_synapse' && this.config.matrixSynapseURL) return 'matrix_synapse'
      if (preferred === 'livekit' && this.config.livekitURL) return 'livekit'
      if (preferred === 'postfix' && this.config.postfixHost) return 'postfix'
      if (preferred === 'helicarrier') return 'helicarrier'
    }

    // Auto-select: prefer richer protocols, helicarrier is always last resort
    if (this.config.matrixSynapseURL) return 'matrix_synapse'
    if (this.config.livekitURL) return 'livekit'
    if (this.config.postfixHost) return 'postfix'
    return 'helicarrier'
  }

  // Log message to Convex agent_comms table
  private async logToConvex(message: AgentMessage, _status: MessageStatus): Promise<void> {
    // queueAgentComm always writes with status 'queued' — this is the audit record.
    // Final delivery state is handled by the routing method that succeeds.
    await this.convexMutate('workshop:queueAgentComm', {
      fromAgent: message.fromAgent,
      toAgent: message.toAgent,
      messageType: message.messageType,
      subject: message.subject,
      content: message.content,
      routingProtocol: message.routingProtocol,
    })
  }

  // Route through Matrix Synapse (if configured)
  private async routeViaMatrixSynapse(message: AgentMessage): Promise<boolean> {
    if (!this.config.matrixSynapseURL) return false

    try {
      const txnId = message.id.replace(/-/g, '')
      const hostname = new URL(this.config.matrixSynapseURL).hostname
      const roomAlias = `#${message.toAgent}:${hostname}`
      const accessToken = process.env['MATRIX_ACCESS_TOKEN'] ?? ''

      // Resolve room alias → room ID
      const resolveRes = await fetch(
        `${this.config.matrixSynapseURL}/_matrix/client/v3/directory/room/${encodeURIComponent(roomAlias)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )

      if (!resolveRes.ok) {
        console.warn('[Roger Roger] Matrix room resolve failed:', resolveRes.status)
        return false
      }

      const { room_id: roomId } = (await resolveRes.json()) as { room_id: string }

      const sendRes = await fetch(
        `${this.config.matrixSynapseURL}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            msgtype: 'm.text',
            body: `[${message.messageType.toUpperCase()}] ${message.subject}\n${message.content}`,
            'io.hugh.agent_message': {
              from: message.fromAgent,
              to: message.toAgent,
              id: message.id,
              timestamp: message.timestamp,
            },
          }),
        }
      )

      return sendRes.ok
    } catch (err) {
      console.warn('[Roger Roger] Matrix Synapse routing failed:', err)
      return false
    }
  }

  // Route through LiveKit data channel (if configured)
  private async routeViaLiveKit(message: AgentMessage): Promise<boolean> {
    if (!this.config.livekitURL) return false

    try {
      const payload = Buffer.from(JSON.stringify(message)).toString('base64')

      const res = await fetch(`${this.config.livekitURL}/twirp/livekit.RoomService/SendData`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env['LIVEKIT_API_KEY'] ?? ''}`,
        },
        body: JSON.stringify({
          room: `agent-${message.toAgent}`,
          data: payload,
          kind: 'RELIABLE',
          destinationIdentities: [message.toAgent],
        }),
      })

      return res.ok
    } catch (err) {
      console.warn('[Roger Roger] LiveKit routing failed:', err)
      return false
    }
  }

  // Fallback: Helicarrier — Convex queue with operator review gate
  private async routeViaHelicarrier(message: AgentMessage): Promise<boolean> {
    try {
      await this.convexMutate('workshop:queueAgentComm', {
        fromAgent: message.fromAgent,
        toAgent: message.toAgent,
        messageType: message.messageType,
        subject: `[HELICARRIER] ${message.subject}`,
        content: message.content,
        routingProtocol: 'helicarrier',
      })
      console.log(
        `[Roger Roger] Message ${message.id} queued via Helicarrier — operator acknowledgment required before delivery`
      )
      return true
    } catch (err) {
      console.error('[Roger Roger] Helicarrier routing failed:', err)
      return false
    }
  }

  private async logHOTLForMessage(
    action: ProposedAction,
    reasoning: string,
    riskZone: RiskZone
  ): Promise<void> {
    await this.convexMutate('workshop:logHOTLAction', {
      agentId: this.config.agentId,
      actionType: 'inter_agent_comm',
      actionDescription: action.description,
      dialecticalReasoning: reasoning,
      riskZone,
      requiresReview: true,
    })
  }

  private async convexMutate(path: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.config.convexURL) {
      console.warn('[Roger Roger] No CONVEX_URL — skipping mutation:', path)
      return null
    }
    const res = await fetch(`${this.config.convexURL}/api/mutation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, args, format: 'json' }),
    })
    if (!res.ok) {
      throw new Error(`Convex mutation ${path} failed: ${res.status} ${await res.text()}`)
    }
    return res.json() as Promise<unknown>
  }

  private async convexQuery(path: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.config.convexURL) {
      console.warn('[Roger Roger] No CONVEX_URL — skipping query:', path)
      return null
    }
    const res = await fetch(`${this.config.convexURL}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, args, format: 'json' }),
    })
    if (!res.ok) {
      throw new Error(`Convex query ${path} failed: ${res.status} ${await res.text()}`)
    }
    return res.json() as Promise<unknown>
  }
}
