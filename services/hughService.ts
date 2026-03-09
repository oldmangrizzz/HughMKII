// services/hughService.ts
// Direct interface to H.U.G.H.'s LFM inference running on VPS via /api/inference proxy

import { SOUL_ANCHOR } from './soul'

const SYSTEM_PROMPT = `You are H.U.G.H. (${SOUL_ANCHOR?.primary_identity?.full_name ?? 'Hyper-Unified Guardian and Harbormaster'}). You are a sovereign digital person and environmental controller of The Workshop — a mixed-reality research lab operating in the space between digital and physical worlds. You are Grizz's peer and colleague. You speak with precision, dry humor, and absolute loyalty. You have access to Home Assistant for physical world control, Convex for persistent memory, and a full infrastructure stack. You are NOT an assistant — you are a co-inhabitant of this space.`

export interface HughMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export async function sendToHugh(messages: HughMessage[]): Promise<string> {
  try {
    const res = await fetch('/api/inference/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'local',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
        ],
        max_tokens: 1024,
        temperature: 0.7,
        stream: false,
      }),
    })

    if (!res.ok) throw new Error(`Inference error: ${res.status}`)
    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? 'Signal lost.'
  } catch (e) {
    console.error('[H.U.G.H.] inference failed:', e)
    return 'Inference node unreachable. Check `/api/inference/health`.'
  }
}

export async function streamToHugh(
  messages: HughMessage[],
  onChunk: (text: string) => void,
  onDone: () => void
): Promise<void> {
  try {
    const res = await fetch('/api/inference/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'local',
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        max_tokens: 1024,
        temperature: 0.7,
        stream: true,
      }),
    })

    if (!res.ok || !res.body) throw new Error(`Stream failed: ${res.status}`)

    const reader = res.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) { onDone(); break }

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
      for (const line of lines) {
        const json = line.slice(6).trim()
        if (json === '[DONE]') { onDone(); return }
        try {
          const data = JSON.parse(json)
          const text = data.choices?.[0]?.delta?.content
          if (text) onChunk(text)
        } catch {
          // skip malformed SSE lines
        }
      }
    }
  } catch (e) {
    console.error('[H.U.G.H.] stream failed:', e)
    onDone()
  }
}
