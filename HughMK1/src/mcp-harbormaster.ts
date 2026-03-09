import { randomUUID } from 'crypto'
import { spawn } from 'child_process'
import { SomaticEngine, SystemMetrics, SomaticEvent } from './somatic-engine'
import { DialecticalEngine, ProposedAction } from './dialectical-engine'

// MCP tool call types (what the Docker MCPs expose)
export interface MCPToolCall {
  serverName: 'proxmox' | 'hostinger-ssh' | 'convex'
  toolName: string
  args: Record<string, unknown>
}

export interface MCPToolResult {
  success: boolean
  data?: unknown
  error?: string
}

export interface NodeHealth {
  nodeId: string
  nodeName: string
  nodeType: 'proxmox_vm' | 'proxmox_lxc' | 'hostinger_vps' | 'convex'
  cpuPercent: number
  memoryPercent: number
  latencyMs: number
  status: 'healthy' | 'warning' | 'critical' | 'down'
}

// JSON-RPC 2.0 message shapes used over Docker stdio
interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: number
  method: string
  params?: unknown
}

interface JsonRpcResponse {
  jsonrpc: string
  id?: number
  result?: unknown
  error?: { code: number; message: string }
}

const MCP_IMAGES: Record<MCPToolCall['serverName'], string> = {
  'proxmox':       'grizzly/proxmox-mcp:latest',
  'hostinger-ssh': 'grizzly/hostinger-ssh-mcp:latest',
  'convex':        'grizzly/convex-mcp:latest',
}

export class MCPHarborMaster {
  private somaticEngine: SomaticEngine
  private dialecticalEngine: DialecticalEngine
  private convexURL: string
  private readonly inferenceBaseURL = process.env['INFERENCE_BASE_URL'] ?? 'http://localhost:8080'
  private pollingInterval: NodeJS.Timeout | null = null

  constructor(convexURL: string) {
    this.somaticEngine = new SomaticEngine()
    this.dialecticalEngine = new DialecticalEngine()
    this.convexURL = convexURL
  }

  // Execute an MCP tool call — routes through dialectical engine first
  async executeMCPTool(call: MCPToolCall): Promise<MCPToolResult> {
    const action: ProposedAction = {
      id: randomUUID(),
      description: `MCP tool call: ${call.serverName}/${call.toolName}`,
      actionType: 'mcp_call',
      targetSystem: call.serverName,
      payload: { ...call.args },
      isIrreversible: false,
      affectsOperatorData: false,
    }

    const dialectical = this.dialecticalEngine.process(action, 'Harbor Master polling cycle')

    if (dialectical.supervisoVeto) {
      throw new Error(
        `[Harbor Master] Dialectical veto — action blocked.\n` +
        `Violations: ${dialectical.invariantViolations.join('; ')}\n` +
        `Reasoning: ${dialectical.reasoning}`
      )
    }

    if (dialectical.requiredHOTLEscalation) {
      await this.convexMutate('workshop:logHOTLAction', {
        agentId: 'hugh-harbormaster',
        actionType: 'mcp_execution',
        actionDescription: action.description,
        toolName: call.toolName,
        payload: JSON.stringify(call.args),
        dialecticalReasoning: dialectical.reasoning,
        riskZone: dialectical.riskZone,
        requiresReview: true,
      }).catch((err) => console.warn('[Harbor Master] HOTL log failed:', err))
    }

    return this.invokeDockerMCP(call)
  }

  // Poll all node health metrics
  async pollNodeHealth(): Promise<NodeHealth[]> {
    const nodes: NodeHealth[] = []

    // --- Proxmox ---
    try {
      const result = await this.executeMCPTool({
        serverName: 'proxmox',
        toolName: 'get_node_status',
        args: {},
      })
      if (result.success && result.data) {
        nodes.push(...this.parseProxmoxHealth(result.data))
      } else {
        nodes.push(this.mockNodeHealth('proxmox-1', 'proxmox-primary', 'proxmox_vm', true))
      }
    } catch (err) {
      console.warn('[Harbor Master] Proxmox MCP unreachable:', err)
      nodes.push(this.mockNodeHealth('proxmox-1', 'proxmox-primary', 'proxmox_vm', true))
    }

    // --- Hostinger VPS ---
    try {
      const result = await this.executeMCPTool({
        serverName: 'hostinger-ssh',
        toolName: 'execute_command',
        args: { command: "top -bn1 | grep -E 'Cpu|Mem' && free -m | grep Mem" },
      })
      if (result.success && result.data) {
        nodes.push(this.parseHostingerHealth(result.data))
      } else {
        nodes.push(this.mockNodeHealth('hostinger-vps-1', 'hostinger-primary', 'hostinger_vps', true))
      }
    } catch (err) {
      console.warn('[Harbor Master] Hostinger SSH MCP unreachable:', err)
      nodes.push(this.mockNodeHealth('hostinger-vps-1', 'hostinger-primary', 'hostinger_vps', true))
    }

    // --- Convex backend latency probe ---
    try {
      const start = Date.now()
      await this.convexQuery('workshop:getRecentSomaticEvents', { limit: 1 })
      const latencyMs = Date.now() - start
      nodes.push({
        nodeId: 'convex-backend',
        nodeName: 'convex-backend',
        nodeType: 'convex',
        cpuPercent: 0,
        memoryPercent: 0,
        latencyMs,
        status: latencyMs < 2000 ? 'healthy' : latencyMs < 5000 ? 'warning' : 'critical',
      })
    } catch {
      nodes.push(this.mockNodeHealth('convex-backend', 'convex-backend', 'convex', true))
    }

    return nodes
  }

  // Process health data through somatic engine, update Convex, trigger Workshop lighting
  async processHealthUpdate(nodes: NodeHealth[]): Promise<void> {
    const allSomaticEvents: SomaticEvent[] = []

    for (const node of nodes) {
      const metrics: SystemMetrics = {
        cpuPercent: node.cpuPercent,
        memoryPercent: node.memoryPercent,
        latencyMs: node.latencyMs,
        isRecovering: node.status === 'down',
      }

      const somaticEvents = this.somaticEngine.evaluate(metrics)
      allSomaticEvents.push(...somaticEvents)

      const workshopColor = this.somaticEngine.getWorkshopAmbientColor(somaticEvents)
      const primaryEvent: SomaticEvent | undefined = somaticEvents[0]

      // Write server health snapshot
      await this.convexMutate('workshop:updateServerHealth', {
        nodeId: node.nodeId,
        nodeName: node.nodeName,
        nodeType: node.nodeType,
        cpuPercent: node.cpuPercent,
        memoryPercent: node.memoryPercent,
        latencyMs: node.latencyMs,
        status: node.status,
        somaticTrigger: primaryEvent?.somaticState,
        workshopLightColor: workshopColor,
      }).catch((err) =>
        console.warn(`[Harbor Master] Health write failed for ${node.nodeId}:`, err)
      )

      // Write individual somatic events
      for (const event of somaticEvents) {
        await this.convexMutate('workshop:logSomaticEvent', {
          eventType: event.eventType,
          systemMetric: event.systemMetric,
          somaticState: event.somaticState,
          severity: event.severity,
          operationalConsequence: event.operationalConsequence,
          metadata: {},
        }).catch((err) => console.warn('[Harbor Master] Somatic event log failed:', err))
      }
    }

    // Aggregate worst status → ambient Workshop color
    const worstStatus = this.computeWorstStatus(nodes)
    const ambientColor = this.somaticEngine.getWorkshopAmbientColor(allSomaticEvents)
    const healthStatus = this.mapStatusToHealthStatus(worstStatus)

    await this.convexMutate('workshop:updateEnvironmentHealth', {
      sessionId: 'hugh-main',
      healthStatus,
      workshopLightColor: ambientColor,
      ambientIntensity: worstStatus === 'healthy' ? 1.0 : worstStatus === 'warning' ? 0.7 : 0.4,
    }).catch((err) => console.warn('[Harbor Master] Environment update failed:', err))
  }

  // Start polling loop (default 30 seconds)
  startPolling(intervalMs = 30_000): void {
    if (this.pollingInterval !== null) {
      clearInterval(this.pollingInterval)
    }
    // Kick off an immediate cycle before the interval fires
    this.runPollCycle().catch((err) =>
      console.error('[Harbor Master] Initial poll cycle failed:', err)
    )
    this.pollingInterval = setInterval(() => {
      this.runPollCycle().catch((err) =>
        console.error('[Harbor Master] Poll cycle failed:', err)
      )
    }, intervalMs)
  }

  // Stop polling
  stopPolling(): void {
    if (this.pollingInterval !== null) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
  }

  // Convex mutation helper
  private async convexMutate(path: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.convexURL) {
      console.warn('[Harbor Master] No CONVEX_URL — skipping mutation:', path)
      return null
    }
    const res = await fetch(`${this.convexURL}/api/mutation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, args, format: 'json' }),
    })
    if (!res.ok) {
      throw new Error(`Convex mutation ${path} failed: ${res.status} ${await res.text()}`)
    }
    return res.json() as Promise<unknown>
  }

  // Convex query helper
  private async convexQuery(path: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.convexURL) {
      console.warn('[Harbor Master] No CONVEX_URL — skipping query:', path)
      return null
    }
    const res = await fetch(`${this.convexURL}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, args, format: 'json' }),
    })
    if (!res.ok) {
      throw new Error(`Convex query ${path} failed: ${res.status} ${await res.text()}`)
    }
    return res.json() as Promise<unknown>
  }

  // Invoke a Docker MCP container via stdio JSON-RPC 2.0
  private invokeDockerMCP(call: MCPToolCall): Promise<MCPToolResult> {
    return new Promise((resolve) => {
      const image = MCP_IMAGES[call.serverName]
      const proc = spawn('docker', ['run', '--rm', '-i', image], {
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      if (!proc.stdin || !proc.stdout) {
        resolve({ success: false, error: `Failed to open stdio pipes for ${image}` })
        return
      }

      const stdin = proc.stdin
      const stdout = proc.stdout

      let buffer = ''
      const initId = 1
      const toolCallId = 2
      let phase: 'init' | 'initialized' | 'done' = 'init'

      const timeout = setTimeout(() => {
        proc.kill()
        resolve({ success: false, error: `MCP timeout: ${call.serverName}/${call.toolName}` })
      }, 15_000)

      stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf-8')
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          let msg: JsonRpcResponse
          try {
            msg = JSON.parse(trimmed) as JsonRpcResponse
          } catch {
            continue // Non-JSON debug output — skip
          }

          if (phase === 'init' && msg.id === initId && msg.result !== undefined) {
            phase = 'initialized'
            // Acknowledge initialization per MCP spec
            const initialized: JsonRpcRequest = {
              jsonrpc: '2.0',
              method: 'notifications/initialized',
            }
            stdin.write(JSON.stringify(initialized) + '\n')
            // Dispatch the actual tool call
            const toolCall: JsonRpcRequest = {
              jsonrpc: '2.0',
              id: toolCallId,
              method: 'tools/call',
              params: { name: call.toolName, arguments: call.args },
            }
            stdin.write(JSON.stringify(toolCall) + '\n')
          } else if (phase === 'initialized' && msg.id === toolCallId) {
            phase = 'done'
            clearTimeout(timeout)
            proc.kill()
            if (msg.error) {
              resolve({ success: false, error: msg.error.message })
            } else {
              resolve({ success: true, data: msg.result })
            }
          }
        }
      })

      proc.on('error', (err) => {
        clearTimeout(timeout)
        resolve({ success: false, error: `Docker spawn error: ${err.message}` })
      })

      proc.on('close', (code) => {
        if (phase !== 'done') {
          clearTimeout(timeout)
          resolve({
            success: false,
            error: `MCP process exited with code ${String(code)} before completing`,
          })
        }
      })

      // Kick off MCP handshake
      const initMsg: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: initId,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: { roots: { listChanged: false }, sampling: {} },
          clientInfo: { name: 'hugh-harbormaster', version: '2.0.0' },
        },
      }
      stdin.write(JSON.stringify(initMsg) + '\n')
    })
  }

  private runPollCycle(): Promise<void> {
    console.log('[Harbor Master] Polling infrastructure health...')
    return this.pollNodeHealth().then((nodes) =>
      this.processHealthUpdate(nodes).then(() =>
        console.log(`[Harbor Master] Health update complete — ${nodes.length} nodes reported`)
      )
    )
  }

  // Parse Proxmox MCP response (array of node objects or single object)
  private parseProxmoxHealth(data: unknown): NodeHealth[] {
    const items: unknown[] = Array.isArray(data) ? data : [data]
    const nodes: NodeHealth[] = []

    for (const item of items) {
      if (!item || typeof item !== 'object') continue
      const n = item as Record<string, unknown>

      const rawCpu = typeof n['cpu'] === 'number' ? n['cpu'] : 0
      const cpuPercent = rawCpu <= 1 ? rawCpu * 100 : rawCpu // Proxmox returns 0–1 fraction
      const memUsed = typeof n['mem'] === 'number' ? n['mem'] : 0
      const memMax = typeof n['maxmem'] === 'number' && n['maxmem'] > 0 ? n['maxmem'] : 1
      const memPercent = (memUsed / memMax) * 100

      nodes.push({
        nodeId: String(n['id'] ?? n['node'] ?? 'proxmox-unknown'),
        nodeName: String(n['name'] ?? n['node'] ?? 'proxmox-unknown'),
        nodeType: n['type'] === 'lxc' ? 'proxmox_lxc' : 'proxmox_vm',
        cpuPercent: Math.min(100, Math.round(cpuPercent)),
        memoryPercent: Math.min(100, Math.round(memPercent)),
        latencyMs: 0,
        status: this.computeNodeStatus(cpuPercent, memPercent),
      })
    }

    return nodes.length > 0
      ? nodes
      : [this.mockNodeHealth('proxmox-1', 'proxmox-primary', 'proxmox_vm', false)]
  }

  // Parse Hostinger SSH command output (top + free -m)
  private parseHostingerHealth(data: unknown): NodeHealth {
    const output =
      typeof data === 'string'
        ? data
        : data && typeof data === 'object' && 'content' in data
        ? String((data as Record<string, unknown>)['content'])
        : ''

    const cpuMatch = output.match(/[Cc]pu\S*[\s:]+([0-9.]+)\s*us/i)
    const cpuPercent = cpuMatch ? parseFloat(cpuMatch[1]) : 25

    const memMatch = output.match(/Mem\S*\s+(\d+)\s+(\d+)/i)
    const memPercent = memMatch
      ? Math.round((parseInt(memMatch[2], 10) / parseInt(memMatch[1], 10)) * 100)
      : 40

    return {
      nodeId: 'hostinger-vps-1',
      nodeName: 'hostinger-primary',
      nodeType: 'hostinger_vps',
      cpuPercent: Math.min(100, Math.round(cpuPercent)),
      memoryPercent: Math.min(100, memPercent),
      latencyMs: 0,
      status: this.computeNodeStatus(cpuPercent, memPercent),
    }
  }

  private mockNodeHealth(
    nodeId: string,
    nodeName: string,
    nodeType: NodeHealth['nodeType'],
    warning: boolean
  ): NodeHealth {
    return {
      nodeId,
      nodeName,
      nodeType,
      cpuPercent: warning ? 50 : 20,
      memoryPercent: warning ? 60 : 30,
      latencyMs: warning ? 999 : 100,
      status: warning ? 'warning' : 'healthy',
    }
  }

  private computeNodeStatus(cpuPercent: number, memPercent: number): NodeHealth['status'] {
    if (cpuPercent > 90 || memPercent > 90) return 'critical'
    if (cpuPercent > 70 || memPercent > 75) return 'warning'
    return 'healthy'
  }

  private computeWorstStatus(nodes: NodeHealth[]): NodeHealth['status'] {
    if (nodes.some((n) => n.status === 'down')) return 'down'
    if (nodes.some((n) => n.status === 'critical')) return 'critical'
    if (nodes.some((n) => n.status === 'warning')) return 'warning'
    return 'healthy'
  }

  private mapStatusToHealthStatus(
    status: NodeHealth['status']
  ): 'nominal' | 'warning' | 'critical' {
    switch (status) {
      case 'healthy': return 'nominal'
      case 'warning': return 'warning'
      case 'critical':
      case 'down':    return 'critical'
    }
  }
}
