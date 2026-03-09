import React, { useMemo, useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { AppMode } from '../types'

const POINT_COUNT = 80_000
const STEPS_PER_FRAME = 300

interface AttractorPreset {
  a: number
  b: number
  c: number
  d: number
}

const ATTRACTOR_PRESETS: AttractorPreset[] = [
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

function generateClifford(n: number, a: number, b: number, c: number, d: number): Float32Array {
  const positions = new Float32Array(n * 3)
  let x = 0, y = 0
  for (let i = 0; i < n; i++) {
    const nx = Math.sin(a * y) + c * Math.cos(a * x)
    const ny = Math.sin(b * x) + d * Math.cos(b * y)
    x = nx; y = ny
    positions[i * 3] = x
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.02
  }
  return positions
}

const vertexShader = /* glsl */`
  uniform float uTime;
  uniform float uBaseHue;
  attribute float aVelocity;
  varying vec3 vColor;
  varying float vAlpha;

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  void main() {
    float hue = mod(uBaseHue + uTime * 0.015 + aVelocity * 0.18, 1.0);
    float sat = 0.75 + aVelocity * 0.25;
    float val = 0.6 + aVelocity * 0.4;
    vColor = hsv2rgb(vec3(hue, sat, val));
    vAlpha = 0.35 + aVelocity * 0.65;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = (1.2 + aVelocity * 2.8) * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const fragmentShader = /* glsl */`
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.0, d) * vAlpha;
    gl_FragColor = vec4(vColor, alpha);
  }
`

interface ParticleFieldProps {
  activeMode: AppMode
}

function ParticleField({ activeMode }: ParticleFieldProps) {
  const pointsRef = useRef<THREE.Points>(null)

  const iterState = useRef({
    x: 0.1,
    y: 0.1,
    writeIndex: 0,
    presetIndex: 0,
    presetTimer: 0.0,
    lerpT: 1.0,
    currentParams: { ...ATTRACTOR_PRESETS[0] } as AttractorPreset,
    nextParams: { ...ATTRACTOR_PRESETS[1] } as AttractorPreset,
  })

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const p = ATTRACTOR_PRESETS[0]
    const positions = generateClifford(POINT_COUNT, p.a, p.b, p.c, p.d)
    const velocities = new Float32Array(POINT_COUNT)
    for (let i = 0; i < POINT_COUNT - 1; i++) {
      const dx = positions[(i + 1) * 3] - positions[i * 3]
      const dy = positions[(i + 1) * 3 + 1] - positions[i * 3 + 1]
      velocities[i] = Math.min(Math.sqrt(dx * dx + dy * dy), 1.0)
    }
    velocities[POINT_COUNT - 1] = 0.5
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aVelocity', new THREE.BufferAttribute(velocities, 1))
    return geo
  }, [])

  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uBaseHue: { value: MODE_HUE[activeMode] ?? 0.74 },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [])

  useEffect(() => {
    material.uniforms.uBaseHue.value = MODE_HUE[activeMode] ?? 0.74
  }, [activeMode, material])

  useFrame((state, delta) => {
    const s = iterState.current
    s.presetTimer += delta

    if (s.presetTimer > 30) {
      s.presetTimer = 0
      s.presetIndex = (s.presetIndex + 1) % ATTRACTOR_PRESETS.length
      s.nextParams = { ...ATTRACTOR_PRESETS[(s.presetIndex + 1) % ATTRACTOR_PRESETS.length] }
      s.lerpT = 0
    }

    if (s.lerpT < 1.0) {
      s.lerpT = Math.min(s.lerpT + delta * 0.04, 1.0)
      const curr = ATTRACTOR_PRESETS[s.presetIndex]
      const t = s.lerpT
      s.currentParams = {
        a: curr.a + (s.nextParams.a - curr.a) * t,
        b: curr.b + (s.nextParams.b - curr.b) * t,
        c: curr.c + (s.nextParams.c - curr.c) * t,
        d: curr.d + (s.nextParams.d - curr.d) * t,
      }
    }

    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
    const velAttr = geometry.getAttribute('aVelocity') as THREE.BufferAttribute
    const posArr = posAttr.array as Float32Array
    const velArr = velAttr.array as Float32Array

    const { a, b, c, d } = s.currentParams

    for (let i = 0; i < STEPS_PER_FRAME; i++) {
      const nx = Math.sin(a * s.y) + c * Math.cos(a * s.x)
      const ny = Math.sin(b * s.x) + d * Math.cos(b * s.y)
      const ddx = nx - s.x
      const ddy = ny - s.y
      s.x = nx; s.y = ny

      const idx = s.writeIndex % POINT_COUNT
      posArr[idx * 3] = s.x
      posArr[idx * 3 + 1] = s.y
      posArr[idx * 3 + 2] = (Math.random() - 0.5) * 0.02
      velArr[idx] = Math.min(Math.sqrt(ddx * ddx + ddy * ddy), 1.0)
      s.writeIndex++
    }

    posAttr.needsUpdate = true
    velAttr.needsUpdate = true

    if (pointsRef.current) {
      pointsRef.current.rotation.z += delta * 0.015
    }

    material.uniforms.uTime.value = state.clock.elapsedTime
  })

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
      scale={[2.0, 2.0, 1.0]}
    />
  )
}

interface CliffordFieldProps {
  activeMode: AppMode
}

export const CliffordField: React.FC<CliffordFieldProps> = ({ activeMode }) => {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <Canvas
        camera={{ position: [0, 0, 4], fov: 65 }}
        gl={{ alpha: true, antialias: false, powerPreference: 'high-performance' }}
        style={{ width: '100%', height: '100%' }}
        dpr={[1, 1.5]}
      >
        <ParticleField activeMode={activeMode} />
      </Canvas>
    </div>
  )
}
