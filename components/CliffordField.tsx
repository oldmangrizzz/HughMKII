import React, { useMemo, useRef, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { AppMode } from '../types'

const LINE_COUNT = 500
const LINE_LENGTH = 100

interface AttractorParams { a: number; b: number; c: number; d: number }

const ATTRACTOR_PRESETS: AttractorParams[] = [
  { a: -1.4, b: 1.6, c: 1.0, d: 0.7 },
  { a: -1.7, b: 1.3, c: -0.1, d: -1.2 },
  { a: 1.5, b: -1.8, c: 1.6, d: 0.9 },
  { a: -1.8, b: -2.0, c: -0.5, d: -0.9 },
]

const MODE_HUE: Record<string, number> = {
  [AppMode.DASHBOARD]: 0.74,
  [AppMode.CHAT]: 0.47,
  [AppMode.WORKSHOP]: 0.38,
  [AppMode.HOME_CONTROL]: 0.07,
  [AppMode.LIVE]: 0.97,
  [AppMode.VISUALIZER]: 0.54,
  [AppMode.SYSTEM]: 0.72,
  [AppMode.HOTL_DASHBOARD]: 0.74,
  [AppMode.MEDIA_STUDIO]: 0.07,
  [AppMode.ANALYZER]: 0.54,
  [AppMode.SITUATIONAL_AWARENESS]: 0.38,
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s)
  switch (i % 6) {
    case 0: return [v, t, p]; case 1: return [q, v, p]; case 2: return [p, v, t]
    case 3: return [p, q, v]; case 4: return [t, p, v]; default: return [v, p, q]
  }
}

function cliffordStep(x: number, y: number, p: AttractorParams): [number, number] {
  return [Math.sin(p.a * y) + p.c * Math.cos(p.a * x), Math.sin(p.b * x) + p.d * Math.cos(p.b * y)]
}

function CameraRig({ mouse }: { mouse: React.MutableRefObject<[number, number]> }) {
  const { camera } = useThree()
  const smooth = useRef([0, 0])
  useFrame(() => {
    smooth.current[0] += (mouse.current[0] * 0.35 - smooth.current[0]) * 0.05
    smooth.current[1] += (mouse.current[1] * 0.25 - smooth.current[1]) * 0.05
    camera.position.x = smooth.current[0]
    camera.position.y = smooth.current[1]
    camera.position.z = 4
    camera.lookAt(0, 0, 0)
  })
  return null
}

function HughLocusMesh({ online, processing }: { online: boolean; processing: boolean }) {
  const coreRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const drift = useRef({ x: 1.2, y: 0.7, vx: 0.0015, vy: 0.001 })

  useFrame((state) => {
    const d = drift.current
    d.x += d.vx; d.y += d.vy
    if (d.x > 1.9 || d.x < 0.5) d.vx *= -1
    if (d.y > 1.2 || d.y < 0.2) d.vy *= -1

    const t = state.clock.elapsedTime
    const pulse = Math.sin(t * (processing ? 5 : 1.5)) * 0.5 + 0.5

    if (coreRef.current) {
      coreRef.current.position.set(d.x, d.y, 0.05)
      const sc = (online ? 1 : 0.3) * (1 + (processing ? pulse * 0.8 : pulse * 0.15))
      coreRef.current.scale.setScalar(sc)
      ;(coreRef.current.material as THREE.MeshBasicMaterial).opacity = online
        ? (processing ? 0.5 + pulse * 0.5 : 0.25 + pulse * 0.1)
        : 0.08
    }
    if (ringRef.current) {
      ringRef.current.position.set(d.x, d.y, 0)
      ringRef.current.rotation.z = t * 0.25
      ringRef.current.scale.setScalar(1 + Math.sin(t * 0.7) * 0.15)
      ;(ringRef.current.material as THREE.MeshBasicMaterial).opacity = online ? 0.12 : 0.03
    }
  })

  return (
    <group>
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshBasicMaterial color="#00ffcc" transparent opacity={0.25} />
      </mesh>
      <mesh ref={ringRef}>
        <ringGeometry args={[0.09, 0.12, 32]} />
        <meshBasicMaterial color="#00ffcc" transparent opacity={0.12} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

interface FlowFieldProps {
  activeMode: AppMode
  hughOnline: boolean
  hughProcessing: boolean
}

function FlowField({ activeMode, hughOnline, hughProcessing }: FlowFieldProps) {
  const groupRef = useRef<THREE.Group>(null)
  const seeds = useRef<Float32Array>(new Float32Array(LINE_COUNT * 2))

  const iterState = useRef({
    presetIndex: 0, presetTimer: 0, lerpT: 1.0,
    currentParams: { ...ATTRACTOR_PRESETS[0] } as AttractorParams,
    nextParams: { ...ATTRACTOR_PRESETS[1] } as AttractorParams,
  })

  const targetHue = useRef(MODE_HUE[activeMode] ?? 0.74)
  const currentHue = useRef(MODE_HUE[activeMode] ?? 0.74)

  useEffect(() => { targetHue.current = MODE_HUE[activeMode] ?? 0.74 }, [activeMode])

  const { geometry, material } = useMemo(() => {
    const segPerLine = LINE_LENGTH - 1
    const totalVerts = LINE_COUNT * segPerLine * 2
    const positions = new Float32Array(totalVerts * 3)
    const colors = new Float32Array(totalVerts * 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const p = ATTRACTOR_PRESETS[0]
    let sx = 0.1, sy = 0.2
    for (let i = 0; i < LINE_COUNT; i++) {
      for (let w = 0; w < 60 + i * 3; w++) {
        const [nx, ny] = cliffordStep(sx, sy, p)
        sx = nx; sy = ny
      }
      seeds.current[i * 2] = sx
      seeds.current[i * 2 + 1] = sy
    }

    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    })
    return { geometry: geo, material: mat }
  }, [])

  useFrame((state, delta) => {
    const s = iterState.current
    s.presetTimer += delta
    if (s.presetTimer > 30) {
      s.presetTimer = 0
      s.presetIndex = (s.presetIndex + 1) % ATTRACTOR_PRESETS.length
      s.nextParams = { ...ATTRACTOR_PRESETS[(s.presetIndex + 1) % ATTRACTOR_PRESETS.length] }
      s.lerpT = 0
    }
    if (s.lerpT < 1) {
      s.lerpT = Math.min(s.lerpT + delta * 0.04, 1)
      const curr = ATTRACTOR_PRESETS[s.presetIndex]
      const t = s.lerpT
      s.currentParams = {
        a: curr.a + (s.nextParams.a - curr.a) * t, b: curr.b + (s.nextParams.b - curr.b) * t,
        c: curr.c + (s.nextParams.c - curr.c) * t, d: curr.d + (s.nextParams.d - curr.d) * t,
      }
    }

    currentHue.current += (targetHue.current - currentHue.current) * delta * 0.4
    const hue = (currentHue.current + state.clock.elapsedTime * 0.008) % 1
    const speedMult = hughProcessing ? 2 : 1
    const brightness = hughOnline ? 1.0 : 0.55

    const p = s.currentParams
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
    const colAttr = geometry.getAttribute('color') as THREE.BufferAttribute
    const posArr = posAttr.array as Float32Array
    const colArr = colAttr.array as Float32Array

    const segPerLine = LINE_LENGTH - 1
    const vertsPerLine = segPerLine * 2

    for (let i = 0; i < LINE_COUNT; i++) {
      let x = seeds.current[i * 2]
      let y = seeds.current[i * 2 + 1]
      for (let adv = 0; adv < speedMult; adv++) {
        const [nx, ny] = cliffordStep(x, y, p); x = nx; y = ny
      }
      seeds.current[i * 2] = x; seeds.current[i * 2 + 1] = y

      const pts: [number, number][] = [[x, y]]
      let lx = x, ly = y
      for (let j = 1; j < LINE_LENGTH; j++) {
        const [nx, ny] = cliffordStep(lx, ly, p); lx = nx; ly = ny; pts.push([lx, ly])
      }

      const lineHue = (hue + i * 0.00025) % 1
      const base = i * vertsPerLine

      for (let j = 0; j < segPerLine; j++) {
        const tHead = j / segPerLine
        const tTail = (j + 1) / segPerLine
        const valH = (1 - tHead) * brightness
        const valT = (1 - tTail) * brightness

        const [rH, gH, bH] = hsvToRgb(lineHue, 0.7 + (1-tHead)*0.3, valH)
        const [rT, gT, bT] = hsvToRgb(lineHue, 0.7 + (1-tTail)*0.3, valT)

        const v0 = base + j * 2, v1 = v0 + 1
        const [ax, ay] = pts[j]; const [bx, by_] = pts[j + 1]
        posArr[v0*3]=ax*2; posArr[v0*3+1]=ay*2; posArr[v0*3+2]=0
        posArr[v1*3]=bx*2; posArr[v1*3+1]=by_*2; posArr[v1*3+2]=0
        const aA = (1-tHead)*0.75, bA = (1-tTail)*0.75
        colArr[v0*3]=rH*aA; colArr[v0*3+1]=gH*aA; colArr[v0*3+2]=bH*aA
        colArr[v1*3]=rT*bA; colArr[v1*3+1]=gT*bA; colArr[v1*3+2]=bT*bA
      }
    }
    posAttr.needsUpdate = true; colAttr.needsUpdate = true
    if (groupRef.current) groupRef.current.rotation.z += delta * 0.007
  })

  return <group ref={groupRef}><lineSegments geometry={geometry} material={material} /></group>
}

export interface CliffordFieldProps {
  activeMode: AppMode
  hughOnline?: boolean
  hughProcessing?: boolean
  mouse: React.MutableRefObject<[number, number]>
}

export const CliffordField: React.FC<CliffordFieldProps> = ({
  activeMode, hughOnline = true, hughProcessing = false, mouse,
}) => (
  <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
    <Canvas
      camera={{ position: [0, 0, 4], fov: 65 }}
      gl={{ alpha: true, antialias: false, powerPreference: 'high-performance' }}
      style={{ width: '100%', height: '100%' }}
      dpr={[1, 1.5]}
    >
      <CameraRig mouse={mouse} />
      <FlowField activeMode={activeMode} hughOnline={hughOnline} hughProcessing={hughProcessing} />
      <HughLocusMesh online={hughOnline} processing={hughProcessing} />
    </Canvas>
  </div>
)
