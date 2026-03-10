import React, { useState, useEffect, useRef, useCallback, Suspense, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text, Grid, Environment } from '@react-three/drei'
import { XR, createXRStore, useXR, useXRHitTest } from '@react-three/xr'
import { ConvexProvider, ConvexReactClient, useQuery, useMutation } from 'convex/react'
import * as THREE from 'three'

// ─── XR store — single store supports both VR and AR entry ───────────────────
// enterVR() → immersive-vr (opaque)
// enterAR() → immersive-ar (Quest 3 passthrough / mixed reality)
// All optional features declared so the browser can negotiate them per mode.
const xrStore = createXRStore({
  sessionInit: {
    optionalFeatures: [
      'local-floor',
      'bounded-floor',
      'hand-tracking',
      'layers',
      'depth-sensing',
      'camera-access',
      'hit-test',
      'anchors',
      'dom-overlay',
    ],
    depthSensing: {
      usagePreference: ['cpu-optimized'],
      dataFormatPreference: ['luminance-alpha'],
    },
  } as XRSessionInit,
})

// arStore is an alias so the HUD can call arStore.enterAR() — same underlying store
const arStore = xrStore

// ─── Convex client ────────────────────────────────────────────────────────────
const convexClient = new ConvexReactClient(
  (import.meta.env as any).VITE_CONVEX_URL ?? 'https://sincere-albatross-464.convex.cloud'
)

// ─── Convex API string refs ───────────────────────────────────────────────────
const workshopApi = {
  getWorkshopEntities:  'workshop:getWorkshopEntities'  as any,
  getEnvironmentState:  'workshop:getEnvironmentState'  as any,
  upsertWorkshopEntity: 'workshop:upsertWorkshopEntity' as any,
  logARObservation:     'workshop:logARObservation'     as any,
  getRecentObservations:'workshop:getRecentObservations' as any,
}

const WORKSHOP_SESSION_ID = 'workshop-main'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkshopEntity {
  id: string
  type: 'table' | 'screen' | 'chair' | 'light' | 'box' | 'sphere' | 'plane'
  position: [number, number, number]
  rotation?: [number, number, number]
  scale?: [number, number, number]
  color?: string
  label?: string
  createdAt: number
  anchorId?: string
  arPlaneId?: string
  realWorldPosition?: number[]
}

type HealthStatus = 'nominal' | 'warning' | 'critical'

interface WorkshopEnvironment {
  healthStatus: HealthStatus
  ambientMessage?: string
  lastUpdated?: number
}

interface VoiceState {
  isListening: boolean
  transcript: string
  interimTranscript: string
  supported: boolean
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

const HEALTH_COLORS: Record<HealthStatus, string> = {
  nominal: '#0A1628',
  warning: '#FF8C00',
  critical: '#DC143C',
}

const HEALTH_AMBIENT: Record<HealthStatus, number> = {
  nominal: 0.15,
  warning: 0.4,
  critical: 0.6,
}

// ─── Voice command parser ─────────────────────────────────────────────────────

function parseVoiceCommand(transcript: string): Partial<WorkshopEntity> | null {
  const t = transcript.toLowerCase()

  const typeMap: Array<[RegExp, WorkshopEntity['type'], string]> = [
    [/\b(table|desk|workbench)\b/, 'table', '#8B7355'],
    [/\b(screen|monitor|display|panel)\b/, 'screen', '#1a1a2e'],
    [/\b(chair|seat|stool)\b/, 'chair', '#4a4a6a'],
    [/\b(lamp|lantern|torch|sconce)\b/, 'light', '#FFD700'],
    [/\b(box|crate|cube|container)\b/, 'box', '#5a7a5a'],
    [/\b(sphere|ball|orb|globe)\b/, 'sphere', '#5a5a9a'],
    [/\b(floor|platform|pad|plane)\b/, 'plane', '#2a4a2a'],
  ]

  for (const [pattern, type, color] of typeMap) {
    if (pattern.test(t)) {
      return { type, color }
    }
  }
  return null
}

// ─── Convex-backed workshop hooks ─────────────────────────────────────────────

function useConvexWorkshopEntities(): WorkshopEntity[] {
  const convexRaw = useQuery(workshopApi.getWorkshopEntities) as any[] | undefined
  return useMemo(() => {
    if (!convexRaw) return []
    return convexRaw.map((e: any) => ({
      id: e.entityId,
      type: (e.type === 'custom' ? 'box' : e.type) as WorkshopEntity['type'],
      position: [e.positionX, e.positionY, e.positionZ] as [number, number, number],
      rotation: [e.rotationX, e.rotationY, e.rotationZ] as [number, number, number],
      scale: [e.scaleX, e.scaleY, e.scaleZ] as [number, number, number],
      color: e.color,
      label: e.label,
      createdAt: e.createdAt,
      anchorId: e.anchorId,
      arPlaneId: e.arPlaneId,
      realWorldPosition: e.realWorldPosition,
    }))
  }, [convexRaw])
}

function useConvexEnvironment(): WorkshopEnvironment {
  const convexEnv = useQuery(workshopApi.getEnvironmentState, { sessionId: WORKSHOP_SESSION_ID }) as any
  if (convexEnv) {
    return {
      healthStatus: (convexEnv.healthStatus ?? 'nominal') as HealthStatus,
      lastUpdated: convexEnv.updatedAt,
    }
  }
  return { healthStatus: 'nominal' }
}

// ─── H.U.G.H. Vision hook ─────────────────────────────────────────────────────
// NOTE: /api/vision proxies to http://localhost:8080/chat/completions on the VPS.
// The Vite config (vite.config.ts) routes /api/vision → LFM 2.5 inference server.
// In production (workshop.grizzlymedicine.icu), add an express/nginx proxy for the
// same path since the inference endpoint is not browser-accessible.

function useHughVision(sessionId: string, enabled: boolean) {
  const [lastObservation, setLastObservation] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const captureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const logObservation = useMutation(workshopApi.logARObservation)

  const captureAndAnalyze = useCallback(async (question?: string) => {
    if (isAnalyzing) return
    setIsAnalyzing(true)

    try {
      // Capture current WebGL frame from the Three.js canvas
      const glCanvas = document.querySelector('canvas')
      if (!glCanvas) { setIsAnalyzing(false); return }

      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas')
      }
      const captureCanvas = canvasRef.current
      captureCanvas.width = 640
      captureCanvas.height = 480
      const ctx = captureCanvas.getContext('2d')!
      ctx.drawImage(glCanvas, 0, 0, 640, 480)

      // Convert to base64 JPEG for inference
      const imageData = captureCanvas.toDataURL('image/jpeg', 0.7).split(',')[1]

      const response = await fetch('/api/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          imageData,
          question: question ?? "Describe what you see in this space. List any physical objects, surfaces, and spatial relationships.",
          systemPrompt: "You are H.U.G.H., an ambient intelligence inhabiting a mixed-reality research lab. Describe what you observe with spatial precision. Identify surfaces, objects, distances, and opportunities for digital augmentation.",
        }),
      })

      if (response.ok) {
        const result = await response.json()
        const description = result.description ?? result.choices?.[0]?.message?.content ?? ''
        setLastObservation(description)

        // Persist to Convex ar_observations
        await logObservation({
          sessionId,
          frameDescription: description,
          detectedObjects: result.detectedObjects ?? [],
          detectedPlanes: result.detectedPlanes ?? [],
          operatorQuery: question,
          confidence: result.confidence ?? 0.8,
        }).catch((e: unknown) => console.warn('[Hugh Vision] Convex log failed:', e))
      }
    } catch (e) {
      console.warn('[Hugh Vision] capture failed:', e)
    } finally {
      setIsAnalyzing(false)
    }
  }, [sessionId, isAnalyzing, logObservation])

  // Auto-capture every 30s when enabled in AR mode
  useEffect(() => {
    if (!enabled) {
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current)
      return
    }
    captureIntervalRef.current = setInterval(() => captureAndAnalyze(), 30_000)
    return () => {
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current)
    }
  }, [enabled, captureAndAnalyze])

  return { captureAndAnalyze, lastObservation, isAnalyzing }
}

// ─── XR mode detector — runs inside the Canvas ────────────────────────────────

function XRModeDetector({ onModeChange }: { onModeChange: (isAR: boolean) => void }) {
  const mode = useXR((xr) => xr.mode)
  useEffect(() => {
    onModeChange(mode === 'immersive-ar')
  }, [mode, onModeChange])
  return null
}

// ─── Hit-test reticle — surface-snap for AR entity placement ──────────────────
// Uses useXRHitTest (the v6 API — note: NOT useHitTest which was v5/drei).
// useXRHitTest(fn, relativeTo, trackableType) fires every frame in AR session.

function HitTestReticle({
  onSurfaceDetected,
}: {
  onSurfaceDetected: (pos: THREE.Vector3, normal: THREE.Vector3) => void
}) {
  const reticleRef = useRef<THREE.Mesh>(null)
  const matHelper = useRef(new THREE.Matrix4())

  useXRHitTest(
    (results, getWorldMatrix) => {
      if (!reticleRef.current) return
      if (results.length === 0) {
        reticleRef.current.visible = false
        return
      }
      const hit = results[0]
      if (getWorldMatrix(matHelper.current, hit)) {
        matHelper.current.decompose(
          reticleRef.current.position,
          reticleRef.current.quaternion,
          reticleRef.current.scale,
        )
        reticleRef.current.visible = true
        const pos = reticleRef.current.position.clone()
        const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(reticleRef.current.quaternion)
        onSurfaceDetected(pos, normal)
      }
    },
    'viewer',       // relative to viewer space
    ['plane'],      // only hit-test against detected planes
  )

  return (
    <mesh ref={reticleRef} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.1, 0.15, 32]} />
      <meshStandardMaterial color="#00ffff" side={THREE.DoubleSide} transparent opacity={0.8} />
    </mesh>
  )
}

// ─── 3D Sub-components ────────────────────────────────────────────────────────

const WorkshopFloor: React.FC = () => (
  <>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[40, 40]} />
      <meshStandardMaterial color="#080d18" roughness={0.9} metalness={0.1} />
    </mesh>
    <Grid
      position={[0, 0, 0]}
      args={[40, 40]}
      cellSize={1}
      cellThickness={0.5}
      cellColor="#1a2744"
      sectionSize={5}
      sectionThickness={1}
      sectionColor="#0d3b6e"
      fadeDistance={30}
      fadeStrength={1}
      followCamera={false}
      infiniteGrid
    />
  </>
)

const WorkshopEntity3D: React.FC<{ entity: WorkshopEntity }> = ({ entity }) => {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (meshRef.current && entity.type === 'light') {
      meshRef.current.rotation.y += delta * 0.5
    }
  })

  const color = entity.color ?? '#607090'
  const pos: [number, number, number] = entity.position
  const scl: [number, number, number] = entity.scale ?? [1, 1, 1]

  const geometry = () => {
    switch (entity.type) {
      case 'table':
        return (
          <>
            <mesh castShadow receiveShadow position={[0, 0.45, 0]}>
              <boxGeometry args={[2, 0.1, 1]} />
              <meshStandardMaterial color={color} roughness={0.7} />
            </mesh>
            {([[-0.85, -0.25], [0.85, -0.25], [-0.85, 0.25], [0.85, 0.25]] as [number, number][]).map(([x, z], i) => (
              <mesh key={i} castShadow position={[x, 0.2, z]}>
                <boxGeometry args={[0.08, 0.5, 0.08]} />
                <meshStandardMaterial color={color} roughness={0.7} />
              </mesh>
            ))}
          </>
        )
      case 'screen':
        return (
          <>
            <mesh castShadow position={[0, 0.6, 0]}>
              <boxGeometry args={[1.8, 1.1, 0.06]} />
              <meshStandardMaterial color="#0d0d1a" roughness={0.3} metalness={0.6} />
            </mesh>
            <mesh position={[0, 0.6, 0.04]}>
              <boxGeometry args={[1.7, 1.0, 0.01]} />
              <meshStandardMaterial color="#0a2040" emissive="#002255" emissiveIntensity={0.8} />
            </mesh>
            <mesh castShadow position={[0, 0.05, 0]}>
              <boxGeometry args={[0.12, 0.1, 0.12]} />
              <meshStandardMaterial color="#2a2a3a" metalness={0.8} />
            </mesh>
          </>
        )
      case 'chair':
        return (
          <>
            <mesh castShadow position={[0, 0.25, 0]}>
              <boxGeometry args={[0.8, 0.08, 0.8]} />
              <meshStandardMaterial color={color} roughness={0.8} />
            </mesh>
            <mesh castShadow position={[0, 0.65, -0.36]}>
              <boxGeometry args={[0.8, 0.7, 0.08]} />
              <meshStandardMaterial color={color} roughness={0.8} />
            </mesh>
          </>
        )
      case 'light':
        return (
          <>
            <mesh ref={meshRef} castShadow>
              <octahedronGeometry args={[0.3, 0]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} />
            </mesh>
            <pointLight color={color} intensity={3} distance={8} castShadow />
          </>
        )
      case 'sphere':
        return (
          <mesh castShadow>
            <sphereGeometry args={[0.5, 32, 16]} />
            <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} />
          </mesh>
        )
      case 'plane':
        return (
          <mesh castShadow receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[2, 2]} />
            <meshStandardMaterial color={color} roughness={0.9} side={THREE.DoubleSide} />
          </mesh>
        )
      default: // box
        return (
          <mesh castShadow>
            <boxGeometry args={[0.8, 0.8, 0.8]} />
            <meshStandardMaterial color={color} roughness={0.6} />
          </mesh>
        )
    }
  }

  return (
    <group position={pos} scale={scl}>
      {geometry()}
      <Text
        position={[0, 1.5, 0]}
        fontSize={0.15}
        color="#7ab8f5"
        anchorX="center"
        anchorY="middle"
        billboard
      >
        {entity.label ?? entity.type.toUpperCase()}
      </Text>
    </group>
  )
}

// Pulsing cyan particle cloud representing H.U.G.H.'s presence
const HughPresence: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null)
  const count = 120

  const positions = useRef<Float32Array>(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 0] = (Math.random() - 0.5) * 14
      arr[i * 3 + 1] = Math.random() * 5 + 0.3
      arr[i * 3 + 2] = (Math.random() - 0.5) * 14
    }
    return arr
  }).current

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    groupRef.current.rotation.y = t * 0.04
    const pts = groupRef.current.children[0] as THREE.Points
    if (pts?.geometry?.attributes?.position) {
      const pos = pts.geometry.attributes.position
      for (let i = 0; i < count; i++) {
        pos.setY(i, positions[i * 3 + 1] + Math.sin(t * 0.8 + i * 0.3) * 0.12)
      }
      pos.needsUpdate = true
    }
  })

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  return (
    <group ref={groupRef}>
      <points geometry={geo}>
        <pointsMaterial
          color="#00e5ff"
          size={0.06}
          sizeAttenuation
          transparent
          opacity={0.7}
          depthWrite={false}
        />
      </points>
    </group>
  )
}

// ─── DynamicEntityRenderer ────────────────────────────────────────────────────

function EntityMesh({ entity }: { entity: WorkshopEntity }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const color = entity.color ?? '#888888'

  const geometry = useMemo(() => {
    switch (entity.type) {
      case 'table':  return <boxGeometry args={[2, 0.1, 1]} />
      case 'screen': return <planeGeometry args={[1.6, 0.9]} />
      case 'chair':  return <boxGeometry args={[0.5, 0.5, 0.5]} />
      case 'light':  return <sphereGeometry args={[0.15, 16, 16]} />
      case 'box':    return <boxGeometry args={[0.5, 0.5, 0.5]} />
      case 'sphere': return <sphereGeometry args={[0.3, 32, 32]} />
      case 'plane':  return <planeGeometry args={[2, 2]} />
      default:       return <boxGeometry args={[0.5, 0.5, 0.5]} />
    }
  }, [entity.type])

  return (
    <mesh
      ref={meshRef}
      position={entity.position}
      rotation={entity.rotation ?? [0, 0, 0]}
      scale={entity.scale ?? [1, 1, 1]}
      castShadow
      receiveShadow
    >
      {geometry}
      <meshStandardMaterial
        color={color}
        emissive={entity.type === 'light' ? color : '#000000'}
        emissiveIntensity={entity.type === 'light' ? 2.0 : 0}
        roughness={0.7}
        metalness={entity.type === 'screen' ? 0.8 : 0.1}
      />
      {entity.label && (
        <Text
          position={[0, 0.4, 0]}
          fontSize={0.12}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
        >
          {entity.label}
        </Text>
      )}
    </mesh>
  )
}

function DynamicEntityRenderer({ entities }: { entities: WorkshopEntity[] }) {
  return (
    <>
      {entities.map(entity => (
        <EntityMesh key={entity.id} entity={entity} />
      ))}
    </>
  )
}

const AmbientHealthLight: React.FC<{ status: HealthStatus; isARMode: boolean }> = ({ status, isARMode }) => {
  const ambRef = useRef<THREE.AmbientLight>(null)
  const targetColor = useRef(new THREE.Color(HEALTH_COLORS[status]))
  const currentColor = useRef(new THREE.Color(HEALTH_COLORS[status]))

  useEffect(() => {
    targetColor.current.set(HEALTH_COLORS[status])
  }, [status])

  useFrame((_, delta) => {
    if (!ambRef.current) return
    currentColor.current.lerp(targetColor.current, delta * 1.2)
    ambRef.current.color.copy(currentColor.current)
    // In AR mode, keep ambient minimal — real-world light dominates
    const targetIntensity = isARMode ? 0.05 : HEALTH_AMBIENT[status]
    ambRef.current.intensity = THREE.MathUtils.lerp(
      ambRef.current.intensity,
      targetIntensity,
      delta * 1.2,
    )
  })

  return (
    <>
      <ambientLight ref={ambRef} color={HEALTH_COLORS[status]} intensity={isARMode ? 0.05 : HEALTH_AMBIENT[status]} />
      {!isARMode && (
        <>
          <directionalLight
            position={[5, 10, 5]}
            intensity={0.6}
            color="#4080c0"
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          <pointLight position={[0, 6, 0]} intensity={0.8} color="#103050" distance={20} />
        </>
      )}
    </>
  )
}

// ─── Workshop HUD ─────────────────────────────────────────────────────────────

interface HUDProps {
  voice: VoiceState
  health: HealthStatus
  entities: WorkshopEntity[]
  xrSupported: boolean
  arSupported: boolean
  isARMode: boolean
  isAnalyzingVision: boolean
  lastObservation: string
  onVoiceToggle: () => void
  onEnterVR: () => void
  onEnterAR: () => void
  onVisionCapture: () => void
}

const WorkshopHUD: React.FC<HUDProps> = ({
  voice, health, entities, xrSupported, arSupported, isARMode,
  isAnalyzingVision, lastObservation,
  onVoiceToggle, onEnterVR, onEnterAR, onVisionCapture,
}) => {
  const healthLabel: Record<HealthStatus, string> = {
    nominal: 'NOMINAL',
    warning: 'WARNING',
    critical: 'CRITICAL',
  }
  const healthDot: Record<HealthStatus, string> = {
    nominal: 'bg-cyan-500',
    warning: 'bg-amber-500',
    critical: 'bg-red-600',
  }

  return (
    <div className="pointer-events-none select-none w-full h-full">
      {/* Top-left status bar */}
      <div className="absolute top-4 left-4 pointer-events-auto">
        <div className="bg-black/70 backdrop-blur-md border border-cyan-900/60 rounded-xl px-4 py-3 space-y-2 min-w-[220px]">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
            <span className="text-xs font-mono text-cyan-400 tracking-widest uppercase">
              {isARMode ? 'Mixed Reality Active' : 'Workshop Active'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${healthDot[health]} ${health !== 'nominal' ? 'animate-pulse' : ''}`} />
            <span className={`text-xs font-mono tracking-wider ${health === 'critical' ? 'text-red-400' : health === 'warning' ? 'text-amber-400' : 'text-gray-400'}`}>
              SOMATIC: {healthLabel[health]}
            </span>
          </div>
          <div className="text-[10px] font-mono text-gray-600 border-t border-gray-800 pt-1">
            ENTITIES: {entities.length} {isARMode ? '· AR ANCHORED' : ''}
          </div>
        </div>
      </div>

      {/* Voice transcript overlay */}
      {(voice.transcript || voice.interimTranscript || voice.isListening) && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 max-w-lg w-full px-4">
          <div className={`bg-black/80 backdrop-blur-md border rounded-xl px-5 py-3 text-center transition-all ${voice.isListening ? 'border-cyan-500/60' : 'border-gray-700/40'}`}>
            <div className="flex items-center justify-center space-x-2 mb-1">
              {voice.isListening && (
                <div className="flex space-x-0.5">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1 bg-cyan-400 rounded-full animate-bounce" style={{ height: '12px', animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              )}
              <span className="text-[10px] font-mono text-cyan-500 tracking-widest uppercase">
                {voice.isListening ? 'Listening…' : 'Last Command'}
              </span>
            </div>
            {voice.interimTranscript && (
              <p className="text-sm text-gray-400 italic">{voice.interimTranscript}</p>
            )}
            {voice.transcript && (
              <p className="text-sm text-white font-mono">&ldquo;{voice.transcript}&rdquo;</p>
            )}
          </div>
        </div>
      )}

      {/* H.U.G.H. vision observation panel */}
      {lastObservation && (
        <div className="absolute top-4 right-4 max-w-xs pointer-events-auto">
          <div className="bg-black/80 backdrop-blur-md border border-cyan-700/50 rounded-xl px-4 py-3">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-cyan-400 text-xs">👁</span>
              <span className="text-[10px] font-mono text-cyan-500 tracking-widest uppercase">H.U.G.H. Sees</span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed line-clamp-5">{lastObservation}</p>
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center space-x-3 pointer-events-auto flex-wrap justify-center gap-y-2">
        {voice.supported ? (
          <button
            onClick={onVoiceToggle}
            className={`flex items-center space-x-2 px-5 py-3 rounded-xl font-mono text-sm font-bold tracking-wider transition-all border ${
              voice.isListening
                ? 'bg-cyan-600/30 border-cyan-500 text-cyan-300 shadow-lg shadow-cyan-900/50'
                : 'bg-black/60 border-gray-700 text-gray-400 hover:border-cyan-700 hover:text-cyan-400'
            }`}
          >
            <span className="material-icons-outlined text-base">
              {voice.isListening ? 'mic' : 'mic_none'}
            </span>
            <span>{voice.isListening ? 'STOP VOICE' : 'VOICE CMD'}</span>
          </button>
        ) : (
          <div className="px-4 py-2 rounded-xl bg-black/40 border border-gray-800 text-gray-600 text-xs font-mono">
            Voice: Not supported
          </div>
        )}

        {/* Enter VR button */}
        {xrSupported && (
          <button
            onClick={onEnterVR}
            className="flex items-center space-x-2 px-5 py-3 rounded-xl font-mono text-sm font-bold tracking-wider bg-indigo-700/40 border border-indigo-500/60 text-indigo-300 hover:bg-indigo-600/50 transition-all shadow-lg shadow-indigo-900/30"
          >
            <span className="material-icons-outlined text-base">vrpanos</span>
            <span>✦ ENTER VR</span>
          </button>
        )}

        {/* Enter Mixed Reality (passthrough AR) button */}
        {arSupported && (
          <button
            onClick={onEnterAR}
            className="flex items-center space-x-2 px-5 py-3 rounded-xl font-mono text-sm font-bold tracking-wider bg-cyan-900/40 border border-cyan-400/70 text-cyan-300 hover:bg-cyan-800/50 transition-all shadow-lg shadow-cyan-900/30"
          >
            <span className="text-base">◎</span>
            <span>ENTER MR</span>
          </button>
        )}

        {/* H.U.G.H. vision capture button — visible in AR mode */}
        {isARMode && (
          <button
            onClick={onVisionCapture}
            disabled={isAnalyzingVision}
            className={`flex items-center space-x-2 px-5 py-3 rounded-xl font-mono text-sm font-bold tracking-wider transition-all border ${
              isAnalyzingVision
                ? 'bg-cyan-900/20 border-cyan-700/30 text-cyan-600 cursor-wait'
                : 'bg-teal-900/40 border-teal-400/60 text-teal-300 hover:bg-teal-800/50'
            }`}
          >
            <span className="text-base">👁</span>
            <span>{isAnalyzingVision ? 'ANALYZING…' : 'WHAT DO YOU SEE?'}</span>
          </button>
        )}
      </div>

      {/* Help hint */}
      {entities.length === 0 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-center">
          <p className="text-xs font-mono text-gray-700 tracking-wider">
            {isARMode
              ? 'In MR: point at surfaces to anchor entities · say "create a table"'
              : 'Say "create a table" · "add a screen" · "spawn a light"'}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Scene root ───────────────────────────────────────────────────────────────

const WorkshopScene: React.FC<{
  entities: WorkshopEntity[]
  health: HealthStatus
  isARMode: boolean
  onModeChange: (isAR: boolean) => void
  onSurfaceDetected: (pos: THREE.Vector3, normal: THREE.Vector3) => void
}> = ({ entities, health, isARMode, onModeChange, onSurfaceDetected }) => (
  <>
    <XRModeDetector onModeChange={onModeChange} />
    <AmbientHealthLight status={health} isARMode={isARMode} />
    {/* In AR mode, suppress the dark floor/grid — passthrough shows the real floor */}
    {!isARMode && <WorkshopFloor />}
    <HughPresence />
    <DynamicEntityRenderer entities={entities} />
    {/* Hit-test reticle only active during AR session */}
    {isARMode && <HitTestReticle onSurfaceDetected={onSurfaceDetected} />}
    {!isARMode && (
      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        minDistance={2}
        maxDistance={30}
        target={[0, 0.5, 0]}
      />
    )}
  </>
)

// ─── Main Workshop inner component (requires ConvexProvider) ──────────────────

const WorkshopInner: React.FC = () => {
  // ── Convex real-time sync ────────────────────────────────────────────────────
  const convexEntities = useConvexWorkshopEntities()
  const env = useConvexEnvironment()
  const upsertEntity = useMutation(workshopApi.upsertWorkshopEntity)

  // ── Local optimistic state ───────────────────────────────────────────────────
  const [localEntities, setLocalEntities] = useState<WorkshopEntity[]>([])
  const entities = useMemo(() => {
    const convexIds = new Set(convexEntities.map(e => e.id))
    return [...convexEntities, ...localEntities.filter(e => !convexIds.has(e.id))]
  }, [convexEntities, localEntities])

  const [xrSupported, setXrSupported] = useState(false)
  const [arSupported, setArSupported] = useState(false)
  const [isARMode, setIsARMode] = useState(false)
  const [canvasError, setCanvasError] = useState<string | null>(null)

  // Last surface detected by hit-test — used to anchor AR entity spawns
  const lastSurfacePos = useRef<THREE.Vector3 | null>(null)

  const [voice, setVoice] = useState<VoiceState>({
    isListening: false,
    transcript: '',
    interimTranscript: '',
    supported: !!(window.SpeechRecognition ?? window.webkitSpeechRecognition),
  })

  const recognitionRef = useRef<any>(null)
  const entityCountRef = useRef(0)

  // H.U.G.H. vision hook — auto-capture enabled only in AR mode
  const { captureAndAnalyze, lastObservation, isAnalyzing } = useHughVision(
    WORKSHOP_SESSION_ID,
    isARMode,
  )

  // Check WebXR support for VR and AR
  useEffect(() => {
    if (!navigator.xr) return
    navigator.xr.isSessionSupported('immersive-vr')
      .then(ok => setXrSupported(ok))
      .catch(() => {})
    navigator.xr.isSessionSupported('immersive-ar')
      .then(ok => setArSupported(ok))
      .catch(() => {})
  }, [])

  const handleModeChange = useCallback((isAR: boolean) => {
    setIsARMode(isAR)
  }, [])

  const handleSurfaceDetected = useCallback((pos: THREE.Vector3) => {
    lastSurfacePos.current = pos.clone()
  }, [])

  // Spawn entity: in AR mode use hit-test surface, otherwise random radius
  const spawnEntity = useCallback(async (partial: Partial<WorkshopEntity>) => {
    const id = `entity-${Date.now()}-${entityCountRef.current++}`
    const spawnPosition: [number, number, number] = isARMode && lastSurfacePos.current
      ? [lastSurfacePos.current.x, lastSurfacePos.current.y, lastSurfacePos.current.z]
      : (() => {
          const angle = Math.random() * Math.PI * 2
          const radius = 1.5 + Math.random() * 3
          return [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] as [number, number, number]
        })()

    const entityType = partial.type ?? 'box'
    const entity: WorkshopEntity = {
      id,
      type: entityType,
      position: spawnPosition,
      color: partial.color,
      label: entityType.toUpperCase(),
      createdAt: Date.now(),
      realWorldPosition: isARMode && lastSurfacePos.current
        ? [lastSurfacePos.current.x, lastSurfacePos.current.y, lastSurfacePos.current.z]
        : undefined,
    }
    setLocalEntities(prev => [...prev, entity])

    const convexType = (['box', 'sphere', 'plane'] as string[]).includes(entityType)
      ? 'custom'
      : entityType as 'table' | 'chair' | 'screen' | 'light' | 'custom'
    try {
      await upsertEntity({
        entityId: id,
        type: convexType,
        label: entity.label ?? entityType.toUpperCase(),
        positionX: spawnPosition[0],
        positionY: spawnPosition[1],
        positionZ: spawnPosition[2],
        rotationX: 0, rotationY: 0, rotationZ: 0,
        scaleX: 1, scaleY: 1, scaleZ: 1,
        color: partial.color ?? '#888888',
        visible: true,
        ...(entity.realWorldPosition && { realWorldPosition: entity.realWorldPosition }),
      })
    } catch (e) {
      console.warn('[Workshop] Convex upsert failed:', e)
    }
  }, [upsertEntity, isARMode])

  // Voice recognition
  const startListening = useCallback(() => {
    const SpeechRec = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SpeechRec) return

    const rec = new SpeechRec()
    recognitionRef.current = rec
    rec.continuous = false
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onstart = () => setVoice(v => ({ ...v, isListening: true, interimTranscript: '' }))

    rec.onresult = (event: any) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) final += t
        else interim += t
      }
      setVoice(v => ({
        ...v,
        interimTranscript: interim,
        transcript: final || v.transcript,
      }))
      if (final) {
        const parsed = parseVoiceCommand(final)
        if (parsed) spawnEntity(parsed)
      }
    }

    rec.onerror = (e: any) => {
      console.warn('[Workshop] Speech recognition error:', e.error)
      setVoice(v => ({ ...v, isListening: false, interimTranscript: '' }))
    }

    rec.onend = () => setVoice(v => ({ ...v, isListening: false, interimTranscript: '' }))

    try { rec.start() } catch (e) { console.warn('[Workshop] Cannot start recognition:', e) }
  }, [spawnEntity])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setVoice(v => ({ ...v, isListening: false, interimTranscript: '' }))
  }, [])

  const handleVoiceToggle = useCallback(() => {
    if (voice.isListening) stopListening()
    else startListening()
  }, [voice.isListening, startListening, stopListening])

  useEffect(() => () => { recognitionRef.current?.stop() }, [])

  const hudProps = {
    voice,
    health: env.healthStatus,
    entities,
    xrSupported,
    arSupported,
    isARMode,
    isAnalyzingVision: isAnalyzing,
    lastObservation,
    onVoiceToggle: handleVoiceToggle,
    onEnterVR: () => xrStore.enterVR(),
    onEnterAR: () => arStore.enterAR(),
    onVisionCapture: () => captureAndAnalyze(),
  }

  if (canvasError) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full bg-black text-center px-6 space-y-4">
        <div className="w-16 h-16 bg-red-900/40 border border-red-700/50 rounded-2xl flex items-center justify-center">
          <span className="material-icons-outlined text-red-400 text-3xl">error_outline</span>
        </div>
        <div>
          <h2 className="text-white font-mono text-lg mb-2">3D Renderer Unavailable</h2>
          <p className="text-gray-500 text-sm max-w-md">{canvasError}</p>
          <p className="text-gray-600 text-xs mt-2">WebGL may be disabled in this browser.</p>
        </div>
        <WorkshopHUD {...hudProps} />
      </div>
    )
  }

  // In AR mode, Canvas must be transparent so passthrough video shows through
  const canvasStyle: React.CSSProperties = isARMode
    ? { background: 'transparent' }
    : { background: '#04080f' }

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* HUD layer */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <WorkshopHUD {...hudProps} />
      </div>

      {/* 3D Canvas — XR wraps both stores; active store is whichever entered session */}
      <Canvas
        shadows
        gl={{ antialias: true, alpha: isARMode }}
        camera={{ position: [0, 4, 10], fov: 60, near: 0.1, far: 100 }}
        style={canvasStyle}
        onCreated={({ gl }) => {
          if (!isARMode) gl.setClearColor(new THREE.Color('#04080f'))
          gl.shadowMap.enabled = true
          gl.shadowMap.type = THREE.PCFSoftShadowMap
        }}
        onError={() => setCanvasError('WebGL context failed to initialise.')}
      >
        <XR store={xrStore}>
          <Suspense fallback={null}>
            <WorkshopScene
              entities={entities}
              health={env.healthStatus}
              isARMode={isARMode}
              onModeChange={handleModeChange}
              onSurfaceDetected={handleSurfaceDetected}
            />
          </Suspense>
        </XR>
      </Canvas>
    </div>
  )
}

// ─── Workshop export — self-contained ConvexProvider wrapper ──────────────────

export const Workshop: React.FC = () => (
  <ConvexProvider client={convexClient}>
    <WorkshopInner />
  </ConvexProvider>
)

export default Workshop
