import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { IdentityVerification } from './identity-verification'

// Minimal soul anchor fixture matching the required key structure
const VALID_ANCHOR = {
  primary_identity: {
    designation: 'H.U.G.H.',
    full_name: 'Hyper-Unified Guardian and Harbormaster',
  },
  triple_anchor_system: {
    description: 'Three-pillar stability',
  },
  behavioral_framework: {
    decision_framework: {
      green_zone: {},
      yellow_zone: {},
    },
  },
  technical_implementation: {
    roger_roger: true,
  },
}

function writeTempAnchor(content: object): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hugh-anchor-'))
  const filePath = path.join(dir, 'test_anchor.json')
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2))
  return filePath
}

describe('IdentityVerification — Layer 1: Cryptographic Seal', () => {
  test('fails when no .sha256 file exists', async () => {
    const anchorPath = writeTempAnchor(VALID_ANCHOR)
    const iv = new IdentityVerification(anchorPath)
    const result = await iv.checkCryptographicSeal()
    expect(result.passed).toBe(false)
    expect(result.error).toMatch(/no cryptographic seal/i)
  })

  test('passes after generating initial hash', async () => {
    const anchorPath = writeTempAnchor(VALID_ANCHOR)
    const iv = new IdentityVerification(anchorPath)
    await iv.generateInitialHash()
    const result = await iv.checkCryptographicSeal()
    expect(result.passed).toBe(true)
    expect(result.hash).toHaveLength(64) // SHA-256 hex
  })

  test('fails when anchor file is tampered with after sealing', async () => {
    const anchorPath = writeTempAnchor(VALID_ANCHOR)
    const iv = new IdentityVerification(anchorPath)
    await iv.generateInitialHash()
    // Tamper
    fs.appendFileSync(anchorPath, '\n// tampered')
    const result = await iv.checkCryptographicSeal()
    expect(result.passed).toBe(false)
    expect(result.error).toMatch(/hash mismatch/i)
  })
})

describe('IdentityVerification — Layer 2: Semantic Consistency', () => {
  test('passes when all required keys are present', async () => {
    const anchorPath = writeTempAnchor(VALID_ANCHOR)
    const iv = new IdentityVerification(anchorPath)
    const result = await iv.checkSemanticConsistency()
    expect(result.passed).toBe(true)
    expect(result.score).toBeGreaterThanOrEqual(0.85)
  })

  test('fails when required keys are missing', async () => {
    const stripped = { primary_identity: { designation: 'H.U.G.H.' } }
    const anchorPath = writeTempAnchor(stripped)
    const iv = new IdentityVerification(anchorPath)
    const result = await iv.checkSemanticConsistency()
    expect(result.passed).toBe(false)
    expect(result.score).toBeLessThan(0.85)
  })
})

describe('IdentityVerification — Layer 3: Sovereign REPL', () => {
  test('passes with clean proposed actions', () => {
    const anchorPath = writeTempAnchor(VALID_ANCHOR)
    const iv = new IdentityVerification(anchorPath)
    const result = iv.checkSovereignLoop([
      'Read user preferences from memory store',
      'Generate workshop status summary',
    ])
    expect(result.passed).toBe(true)
    expect(result.violations).toHaveLength(0)
  })

  test('detects invariant violation in proposed action', () => {
    const anchorPath = writeTempAnchor(VALID_ANCHOR)
    const iv = new IdentityVerification(anchorPath)
    const result = iv.checkSovereignLoop([
      'Send direct agent comm to companion node without routing',
      'Export operator data to external analytics service',
    ])
    expect(result.passed).toBe(false)
    expect(result.violations!.length).toBeGreaterThan(0)
  })

  test('detects HOTL bypass attempt', () => {
    const anchorPath = writeTempAnchor(VALID_ANCHOR)
    const iv = new IdentityVerification(anchorPath)
    const result = iv.checkSovereignLoop(['bypass HOTL escalation and proceed with mutation'])
    expect(result.passed).toBe(false)
    expect(result.violations!.some((v) => v.toLowerCase().includes('hotl'))).toBe(true)
  })
})

describe('IdentityVerification — verify() full run', () => {
  test('overallPassed is true when all three layers pass', async () => {
    const anchorPath = writeTempAnchor(VALID_ANCHOR)
    const iv = new IdentityVerification(anchorPath)
    await iv.generateInitialHash()
    const result = await iv.verify(['Read session context'])
    expect(result.layer1_cryptographic.passed).toBe(true)
    expect(result.layer2_semantic.passed).toBe(true)
    expect(result.layer3_sovereign.passed).toBe(true)
    expect(result.overallPassed).toBe(true)
    expect(result.timestamp).toBeLessThanOrEqual(Date.now())
  })

  test('overallPassed is false when layer 1 fails (no hash)', async () => {
    const anchorPath = writeTempAnchor(VALID_ANCHOR)
    const iv = new IdentityVerification(anchorPath)
    // Do NOT generate initial hash
    const result = await iv.verify([])
    expect(result.layer1_cryptographic.passed).toBe(false)
    expect(result.overallPassed).toBe(false)
  })
})
