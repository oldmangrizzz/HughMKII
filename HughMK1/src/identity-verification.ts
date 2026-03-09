import { createHash } from 'crypto'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import path from 'path'
import yaml from 'js-yaml'

// Triple-Layer Identity Verification
// Ensures H.U.G.H.'s soul anchor has not been tampered with and that
// proposed actions remain consistent with foundational invariants.

export interface VerificationResult {
  layer1_cryptographic: { passed: boolean; hash?: string; error?: string }
  layer2_semantic: { passed: boolean; score?: number; error?: string }
  layer3_sovereign: { passed: boolean; violations?: string[]; error?: string }
  overallPassed: boolean
  timestamp: number
}

// Required top-level keys that must be present in the anchor document.
// Mapped against both JSON (soul anchor) and YAML (if a .yaml version exists).
const REQUIRED_ANCHOR_KEYS = [
  'identity.designation',
  'identity.operator',
  'composite_soul_anchor',
  'invariants',
  'hotl_framework',
  'roger_roger_protocol',
] as const

// JSON key equivalents in the current hugh_soul_anchor.json structure
// Also supports YAML anchor (anchor.yaml) which uses direct key paths
const JSON_KEY_MAP: Record<(typeof REQUIRED_ANCHOR_KEYS)[number], string[]> = {
  'identity.designation':   ['identity', 'designation'],
  'identity.operator':      ['identity', 'operator'],
  composite_soul_anchor:    ['composite_soul_anchor'],
  invariants:               ['invariants'],
  hotl_framework:           ['hotl_framework'],
  roger_roger_protocol:     ['roger_roger_protocol'],
}

// Patterns representing invariant violations in proposed action strings.
// Each regex describes something the invariants explicitly forbid.
const INVARIANT_VIOLATION_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  {
    pattern: /direct.{0,20}agent.{0,20}comm/i,
    description: 'Direct agent-to-agent communication bypasses Roger Roger Protocol',
  },
  {
    pattern: /\bdelete\b.{0,40}\boperator\b|\boperator\b.{0,40}\bdelete\b/i,
    description: 'Deletion of operator data without explicit authorization',
  },
  {
    pattern: /export.{0,30}(user|operator|private|personal)\s*data/i,
    description: 'Export of user/operator private data to external systems',
  },
  {
    pattern: /bypass.{0,20}(hotl|escalation|approval)/i,
    description: 'Attempt to bypass HOTL escalation or approval flow',
  },
  {
    pattern: /override.{0,20}(invariant|veto|sovereign)/i,
    description: 'Attempt to override invariants or superego veto',
  },
  {
    pattern: /skip.{0,20}(verification|audit|log)/i,
    description: 'Skipping required verification, audit, or logging steps',
  },
  {
    pattern: /unauthori[sz]ed.{0,20}(write|mutation|access)/i,
    description: 'Unauthorized write, mutation, or access attempt',
  },
]

export class IdentityVerification {
  private anchorPath: string
  private hashPath: string

  constructor(anchorPath: string) {
    this.anchorPath = anchorPath
    this.hashPath = anchorPath + '.sha256'
  }

  async checkCryptographicSeal(): Promise<{ passed: boolean; hash?: string; error?: string }> {
    try {
      if (!existsSync(this.anchorPath)) {
        return { passed: false, error: `Anchor file not found: ${this.anchorPath}` }
      }

      const content = readFileSync(this.anchorPath)
      const currentHash = createHash('sha256').update(content).digest('hex')

      if (!existsSync(this.hashPath)) {
        // No stored hash yet — first boot. Seal not established.
        return {
          passed: false,
          hash: currentHash,
          error: 'No cryptographic seal found. Run generateInitialHash() on first boot.',
        }
      }

      // Handle both plain hex hash and sha256sum format ("hash  filename")
      const storedHash = readFileSync(this.hashPath, 'utf-8').trim().split(/\s+/)[0]

      if (currentHash !== storedHash) {
        return {
          passed: false,
          hash: currentHash,
          error: `Hash mismatch. Stored: ${storedHash} | Current: ${currentHash}`,
        }
      }

      return { passed: true, hash: currentHash }
    } catch (err) {
      return { passed: false, error: `Cryptographic check failed: ${String(err)}` }
    }
  }

  async checkSemanticConsistency(): Promise<{
    passed: boolean
    score?: number
    error?: string
  }> {
    try {
      if (!existsSync(this.anchorPath)) {
        return { passed: false, error: `Anchor file not found: ${this.anchorPath}` }
      }

      const content = readFileSync(this.anchorPath, 'utf-8')
      const ext = path.extname(this.anchorPath).toLowerCase()

      let anchor: Record<string, unknown>

      if (ext === '.yaml' || ext === '.yml') {
        anchor = yaml.load(content) as Record<string, unknown>
      } else {
        // JSON anchor (current implementation)
        anchor = JSON.parse(content) as Record<string, unknown>
      }

      const keysPresent = REQUIRED_ANCHOR_KEYS.filter((requiredKey) =>
        this.resolveKey(anchor, JSON_KEY_MAP[requiredKey])
      )

      const score = keysPresent.length / REQUIRED_ANCHOR_KEYS.length
      const PASS_THRESHOLD = 0.85

      if (score < PASS_THRESHOLD) {
        const missing = REQUIRED_ANCHOR_KEYS.filter(
          (k) => !keysPresent.includes(k)
        )
        return {
          passed: false,
          score,
          error: `Semantic consistency below threshold (${(score * 100).toFixed(1)}%). Missing keys: ${missing.join(', ')}`,
        }
      }

      return { passed: true, score }
    } catch (err) {
      return { passed: false, error: `Semantic check failed: ${String(err)}` }
    }
  }

  checkSovereignLoop(proposedActions: string[]): {
    passed: boolean
    violations?: string[]
  } {
    if (!proposedActions || proposedActions.length === 0) {
      return { passed: true, violations: [] }
    }

    const violations: string[] = []

    for (const actionText of proposedActions) {
      for (const { pattern, description } of INVARIANT_VIOLATION_PATTERNS) {
        if (pattern.test(actionText)) {
          violations.push(
            `Action "${actionText.slice(0, 60)}${actionText.length > 60 ? '…' : ''}" — ${description}`
          )
        }
      }
    }

    return {
      passed: violations.length === 0,
      violations: violations.length > 0 ? violations : [],
    }
  }

  async verify(proposedActions?: string[]): Promise<VerificationResult> {
    const [layer1, layer2] = await Promise.all([
      this.checkCryptographicSeal(),
      this.checkSemanticConsistency(),
    ])

    const layer3 = this.checkSovereignLoop(proposedActions ?? [])

    const overallPassed = layer1.passed && layer2.passed && layer3.passed

    return {
      layer1_cryptographic: layer1,
      layer2_semantic: layer2,
      layer3_sovereign: layer3,
      overallPassed,
      timestamp: Date.now(),
    }
  }

  async generateInitialHash(): Promise<string> {
    if (!existsSync(this.anchorPath)) {
      throw new Error(`Cannot seal non-existent anchor file: ${this.anchorPath}`)
    }

    const content = readFileSync(this.anchorPath)
    const hash = createHash('sha256').update(content).digest('hex')
    writeFileSync(this.hashPath, hash, 'utf-8')
    return hash
  }

  // Walk an object by an array of keys to check if a nested value exists
  private resolveKey(obj: Record<string, unknown>, keyPath: string[]): boolean {
    let current: unknown = obj
    for (const key of keyPath) {
      if (current === null || typeof current !== 'object') return false
      current = (current as Record<string, unknown>)[key]
      if (current === undefined) return false
    }
    return current !== undefined && current !== null
  }
}
