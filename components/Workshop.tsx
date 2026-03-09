import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text, Grid, Environment } from '@react-three/drei'
import * as THREE from 'three'

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

// ─── Convex mock / stub (swappable for real convex/react hooks) ───────────────

function useWorkshopEntities(): [WorkshopEntity[], (e: WorkshopEntity) => void] {
  const [entities, setEntities] = useState<WorkshopEntity[]>([])

  const addEntity = useCallback((entity: WorkshopEntity) => {
    setEntities(prev => [...prev, entity])
    // TODO: replace with useMutation('workshop:createEntity') when Convex is wired
  }, [])

  return [entities, addEntity]
}

function useWorkshopEnvironment(): WorkshopEnvironment {
  const [env, setEnv] = useState<WorkshopEnvironment>({ healthStatus: 'nominal' })

  useEffect(() => {
    // TODO: replace with useQuery('workshop:getEnvironment') when Convex is wired
    // Simulate a nominal environment; real integration reads from somatic_telemetry
    const id = setInterval(() => {
      setEnv(prev => ({ ...prev, lastUpdated: Date.now() }))
    }, 30000)
    return () => clearInterval(id)
  }, [])

  return env
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
            {/* Tabletop */}
            <mesh castShadow receiveShadow position={[0, 0.45, 0]}>
              <boxGeometry args={[2, 0.1, 1]} />
              <meshStandardMaterial color={color} roughness={0.7} />
            </mesh>
            {/* Legs */}
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
            {/* Screen face */}
            <mesh position={[0, 0.6, 0.04]}>
              <boxGeometry args={[1.7, 1.0, 0.01]} />
              <meshStandardMaterial color="#0a2040" emissive="#002255" emissiveIntensity={0.8} />
            </mesh>
            {/* Stand */}
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
    // Gentle bob
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

// Ambient light that shifts colour based on server health
const AmbientHealthLight: React.FC<{ status: HealthStatus }> = ({ status }) => {
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
    ambRef.current.intensity = THREE.MathUtils.lerp(
      ambRef.current.intensity,
      HEALTH_AMBIENT[status],
      delta * 1.2
    )
  })

  return (
    <>
      <ambientLight ref={ambRef} color={HEALTH_COLORS[status]} intensity={HEALTH_AMBIENT[status]} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={0.6}
        color="#4080c0"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[0, 6, 0]} intensity={0.8} color="#103050" distance={20} />
    </>
  )
}

// ─── Workshop HUD ─────────────────────────────────────────────────────────────

interface HUDProps {
  voice: VoiceState
  health: HealthStatus
  entities: WorkshopEntity[]
  xrSupported: boolean
  onVoiceToggle: () => void
  onEnterVR: () => void
}

const WorkshopHUD: React.FC<HUDProps> = ({
  voice, health, entities, xrSupported, onVoiceToggle, onEnterVR,
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
            <span className="text-xs font-mono text-cyan-400 tracking-widest uppercase">Workshop Active</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${healthDot[health]} ${health !== 'nominal' ? 'animate-pulse' : ''}`} />
            <span className={`text-xs font-mono tracking-wider ${health === 'critical' ? 'text-red-400' : health === 'warning' ? 'text-amber-400' : 'text-gray-400'}`}>
              SOMATIC: {healthLabel[health]}
            </span>
          </div>
          <div className="text-[10px] font-mono text-gray-600 border-t border-gray-800 pt-1">
            ENTITIES: {entities.length}
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

      {/* Bottom controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center space-x-3 pointer-events-auto">
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

        {xrSupported && (
          <button
            onClick={onEnterVR}
            className="flex items-center space-x-2 px-5 py-3 rounded-xl font-mono text-sm font-bold tracking-wider bg-indigo-700/40 border border-indigo-500/60 text-indigo-300 hover:bg-indigo-600/50 transition-all shadow-lg shadow-indigo-900/30"
          >
            <span className="material-icons-outlined text-base">vrpanos</span>
            <span>ENTER VR</span>
          </button>
        )}
      </div>

      {/* Help hint */}
      {entities.length === 0 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-center">
          <p className="text-xs font-mono text-gray-700 tracking-wider">
            Say &ldquo;create a table&rdquo; · &ldquo;add a screen&rdquo; · &ldquo;spawn a light&rdquo;
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
}> = ({ entities, health }) => (
  <>
    <AmbientHealthLight status={health} />
    <WorkshopFloor />
    <HughPresence />
    {entities.map(entity => (
      <WorkshopEntity3D key={entity.id} entity={entity} />
    ))}
    <OrbitControls
      enablePan
      enableZoom
      enableRotate
      minDistance={2}
      maxDistance={30}
      target={[0, 0.5, 0]}
    />
  </>
)

// ─── Main Workshop component ──────────────────────────────────────────────────

export const Workshop: React.FC = () => {
  const [entities, addEntity] = useWorkshopEntities()
  const env = useWorkshopEnvironment()
  const [xrSupported, setXrSupported] = useState(false)
  const [voice, setVoice] = useState<VoiceState>({
    isListening: false,
    transcript: '',
    interimTranscript: '',
    supported: !!(window.SpeechRecognition ?? window.webkitSpeechRecognition),
  })
  const [canvasError, setCanvasError] = useState<string | null>(null)

  const recognitionRef = useRef<any>(null)
  const entityCountRef = useRef(0)

  // Check WebXR support
  useEffect(() => {
    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-vr')
        .then(supported => setXrSupported(supported))
        .catch(() => setXrSupported(false))
    }
  }, [])

  // Spawn entity from parsed voice command
  const spawnEntity = useCallback((partial: Partial<WorkshopEntity>) => {
    const id = `entity-${Date.now()}-${entityCountRef.current++}`
    const angle = Math.random() * Math.PI * 2
    const radius = 1.5 + Math.random() * 3
    const entity: WorkshopEntity = {
      id,
      type: partial.type ?? 'box',
      position: [
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius,
      ],
      color: partial.color,
      label: partial.type?.toUpperCase(),
      createdAt: Date.now(),
    }
    addEntity(entity)
  }, [addEntity])

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

  // Enter VR via raw WebXR API
  const handleEnterVR = useCallback(async () => {
    if (!navigator.xr) return
    try {
      const session = await navigator.xr.requestSession('immersive-vr', {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['bounded-floor', 'hand-tracking'],
      })
      session.addEventListener('end', () => console.log('[Workshop] XR session ended'))
      console.log('[Workshop] XR session started:', session)
    } catch (e) {
      console.warn('[Workshop] Failed to start XR session:', e)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => () => { recognitionRef.current?.stop() }, [])

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
        <WorkshopHUD
          voice={voice}
          health={env.healthStatus}
          entities={entities}
          xrSupported={xrSupported}
          onVoiceToggle={handleVoiceToggle}
          onEnterVR={handleEnterVR}
        />
      </div>
    )
  }

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* HUD layer */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <WorkshopHUD
          voice={voice}
          health={env.healthStatus}
          entities={entities}
          xrSupported={xrSupported}
          onVoiceToggle={handleVoiceToggle}
          onEnterVR={handleEnterVR}
        />
      </div>

      {/* 3D Canvas */}
      <Canvas
        shadows
        gl={{ antialias: true, alpha: false }}
        camera={{ position: [0, 4, 10], fov: 60, near: 0.1, far: 100 }}
        style={{ background: '#04080f' }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color('#04080f'))
          gl.shadowMap.enabled = true
          gl.shadowMap.type = THREE.PCFSoftShadowMap
        }}
        onError={() => setCanvasError('WebGL context failed to initialise.')}
      >
        <Suspense fallback={null}>
          <WorkshopScene entities={entities} health={env.healthStatus} />
        </Suspense>
      </Canvas>
    </div>
  )
}

export default Workshop
