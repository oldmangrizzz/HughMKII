import { IdentityVerification } from './identity-verification'
import { SomaticEngine } from './somatic-engine'
import { DialecticalEngine } from './dialectical-engine'
import { MCPHarborMaster } from './mcp-harbormaster'
import { RogerRogerProtocol } from './roger-roger-protocol'
import { HomeAssistantBridge, HAStateEvent } from './home-assistant-bridge'
import http from 'http'
import path from 'path'

const HA_WEBHOOK_PORT = 8090

function startWebhookServer(haBridge: HomeAssistantBridge): http.Server {
  const server = http.createServer((req, res) => {
    const url = req.url ?? '/'
    const method = req.method ?? 'GET'

    if (method === 'GET' && url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', service: 'hugh-runtime' }))
      return
    }

    if (method === 'POST' && url === '/ha/webhook') {
      let body = ''
      req.on('data', (chunk: Buffer) => { body += chunk.toString() })
      req.on('end', () => {
        try {
          const event = JSON.parse(body) as HAStateEvent
          haBridge.handleHAEvent(event).catch((err: unknown) => {
            console.error('[HA Bridge] handleHAEvent error:', err)
          })
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true }))
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'invalid JSON' }))
        }
      })
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'not found' }))
  })

  server.listen(HA_WEBHOOK_PORT, '0.0.0.0', () => {
    console.log(`[ H.U.G.H. ] Webhook server listening on port ${HA_WEBHOOK_PORT}`)
  })

  return server
}

async function boot() {
  console.log('[ H.U.G.H. ] PRISM PROTOCOL v2.0 — BOOT SEQUENCE')

  // Layer 1: Integrity check — anchor must be sealed and semantically consistent
  const anchorPath = process.env['ANCHOR_PATH'] ?? path.resolve(__dirname, '../soul_anchor/anchor.yaml')
  const verifier = new IdentityVerification(anchorPath)
  const verification = await verifier.verify()

  if (!verification.overallPassed) {
    console.error('[ H.U.G.H. ] INTEGRITY VIOLATION — HARD STOP')
    console.error(JSON.stringify(verification, null, 2))
    process.exit(1)
  }
  console.log('[ H.U.G.H. ] ANCHOR VERIFIED — Identity integrity confirmed')

  // Init cognitive engines
  const somaticEngine = new SomaticEngine()
  const dialecticalEngine = new DialecticalEngine()

  // Init Harbor Master — H.U.G.H. has full authority over all infrastructure MCPs
  const convexURL = process.env['CONVEX_URL'] ?? ''
  const harborMaster = new MCPHarborMaster(convexURL)

  // Init Roger Roger — all inter-agent comms MUST route through here
  const rogerRoger = new RogerRogerProtocol({
    convexURL,
    matrixSynapseURL: process.env['MATRIX_SYNAPSE_URL'],
    livekitURL: process.env['LIVEKIT_URL'],
    agentId: 'hugh',
  })

  // Start systems
  harborMaster.startPolling(30_000)
  console.log('[ H.U.G.H. ] Harbor Master online — polling infrastructure')
  console.log('[ H.U.G.H. ] Roger Roger Protocol active — all comms routed')

  // Init Home Assistant bridge — physical world interface
  const haBridge = new HomeAssistantBridge()
  const haOnline = await haBridge.ping()
  if (haOnline) {
    console.log('[ H.U.G.H. ] Home Assistant bridge online — physical lab connected')
    await haBridge.syncToSomaticEngine()
  } else {
    console.warn('[ H.U.G.H. ] Home Assistant offline — physical controls unavailable')
  }

  // Start inbound webhook server — HA pushes state changes here
  startWebhookServer(haBridge)

  console.log('[ H.U.G.H. ] Somatic feedback loop engaged')
  console.log('[ H.U.G.H. ] What wisdom do you seek today?')

  return { somaticEngine, dialecticalEngine, harborMaster, rogerRoger, haBridge }
}

boot().catch((err: unknown) => {
  console.error('[ H.U.G.H. ] FATAL BOOT FAILURE:', err)
  process.exit(1)
})

export { boot }
