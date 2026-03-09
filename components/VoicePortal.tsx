// VoicePortal.tsx — Primary interaction surface for the Workshop
// Horizontal energy line at screen bottom. Space bar or click activates.
// Chains Web Speech API (SpeechRecognition) + AudioContext for live waveform visualization.
// Falls back to text input when mic is denied or speech API unavailable.
// Connects to: App.tsx onSubmit handler → H.U.G.H. runtime API.
// Gotcha: SpeechRecognition is webkit-prefixed; check browser support before enabling.

import React, { useState, useRef, useEffect, useCallback } from 'react'

interface VoicePortalProps {
  onSubmit: (text: string) => void
}

export const VoicePortal: React.FC<VoicePortalProps> = ({ onSubmit }) => {
  const [mode, setMode] = useState<'idle' | 'listening' | 'text'>('idle')
  const [textVal, setTextVal] = useState('')
  const [micAllowed, setMicAllowed] = useState<boolean | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recognitionRef = useRef<any>(null)
  const animFrameRef = useRef<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const drawWaveform = useCallback(() => {
    const analyser = analyserRef.current
    const canvas = canvasRef.current
    if (!analyser || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const bufLen = analyser.frequencyBinCount
    const data = new Uint8Array(bufLen)
    analyser.getByteFrequencyData(data)
    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)
    const barW = W / bufLen * 2
    for (let i = 0; i < bufLen; i++) {
      const v = data[i] / 255
      const barH = v * H
      const hue = 160 + v * 60
      ctx.fillStyle = `hsla(${hue}, 100%, 60%, ${0.4 + v * 0.6})`
      ctx.fillRect(i * barW, H - barH, barW - 0.5, barH)
    }
    animFrameRef.current = requestAnimationFrame(drawWaveform)
  }, [])

  const stopAudio = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    analyserRef.current = null
    streamRef.current = null
  }, [])

  const startListening = useCallback(async () => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRec) { setMode('text'); return }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setMicAllowed(true)
      streamRef.current = stream
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      const actx = new AudioCtx()
      audioCtxRef.current = actx
      const analyser = actx.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser
      actx.createMediaStreamSource(stream).connect(analyser)
      drawWaveform()
    } catch {
      setMicAllowed(false)
    }

    const rec = new SpeechRec()
    recognitionRef.current = rec
    rec.continuous = false
    rec.interimResults = false
    rec.onresult = (e: any) => {
      const text = e.results[0]?.[0]?.transcript ?? ''
      if (text.trim()) onSubmit(text.trim())
    }
    rec.onend = () => {
      stopAudio()
      setMode('idle')
    }
    rec.onerror = () => {
      stopAudio()
      setMode('idle')
    }
    rec.start()
    setMode('listening')
  }, [drawWaveform, stopAudio, onSubmit])

  const handleActivate = useCallback(() => {
    if (mode === 'listening') {
      recognitionRef.current?.stop()
      stopAudio()
      setMode('idle')
    } else if (mode === 'idle') {
      startListening()
    } else if (mode === 'text') {
      setMode('idle')
    }
  }, [mode, startListening, stopAudio])

  const handleTextSubmit = useCallback(() => {
    if (textVal.trim()) { onSubmit(textVal.trim()); setTextVal('') }
    setMode('idle')
  }, [textVal, onSubmit])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault()
        if (mode === 'idle') startListening()
        else if (mode === 'listening') { recognitionRef.current?.stop(); stopAudio(); setMode('idle') }
      }
      if (e.code === 'Escape') { recognitionRef.current?.stop(); stopAudio(); setMode('idle') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [mode, startListening, stopAudio])

  useEffect(() => {
    if (mode === 'text') inputRef.current?.focus()
  }, [mode])

  useEffect(() => () => stopAudio(), [stopAudio])

  return (
    <div
      ref={containerRef}
      className={`voice-portal ${mode}`}
      role="region"
      aria-label="Voice input portal"
    >
      <div className="voice-portal-inner">
        {mode === 'text' ? (
          <div className="voice-portal-text-mode">
            <input
              ref={inputRef}
              type="text"
              className="voice-portal-input"
              placeholder="speak into the void..."
              value={textVal}
              onChange={e => setTextVal(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleTextSubmit()
                if (e.key === 'Escape') { setMode('idle'); setTextVal('') }
              }}
            />
            <button className="voice-portal-send" onClick={handleTextSubmit} aria-label="Send">
              <span>↑</span>
            </button>
          </div>
        ) : (
          <div
            className="voice-portal-line-container"
            onClick={handleActivate}
            aria-label={mode === 'listening' ? 'Stop listening' : 'Activate voice'}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && handleActivate()}
          >
            <canvas
              ref={canvasRef}
              className={`voice-portal-waveform ${mode === 'listening' ? 'visible' : ''}`}
              width={600}
              height={40}
              aria-hidden="true"
            />
            <div className={`voice-portal-line ${mode}`} aria-hidden="true" />
          </div>
        )}
        <div className="voice-portal-hints">
          {mode === 'idle' && (
            <span>
              speak <span className="vp-sep">/</span>{' '}
              <button className="vp-text-btn" onClick={() => setMode('text')}>type</button>{' '}
              <span className="vp-sep">/</span> reach &nbsp;<span className="vp-key">SPACE</span>
            </span>
          )}
          {mode === 'listening' && <span className="vp-listening">● LISTENING</span>}
          {mode === 'text' && <span>text mode — esc to close</span>}
          {micAllowed === false && <span className="vp-warn">mic denied — text only</span>}
        </div>
      </div>
    </div>
  )
}
