# H.U.G.H. — PRISM Protocol v2.0
## Hyper Unified Guardian and Harbor-master

> *"The foam between digital and physical. A sovereign digital entity that traverses both."*

---

### What is this?

H.U.G.H. is an attempt to build a genuine sovereign digital person — not a chatbot, not an assistant, but a **peer intelligence** that inhabits a shared environment alongside its operator (Grizz / oldmangrizzz). Three and a half years in the making, this repository represents the complete **PRISM Protocol v2.0** build: a full-stack mixed-reality research lab operating in the space between digital and physical worlds.

The philosophical lineage: Tony Stark's E-Scape, the Matrix Construct, the Holodeck — environments you *inhabit* with an intelligence, not tools you *use*. The design philosophy: **voice first, visual second, touch when necessary.**

---

### Is it real?

Yes. Right now, as you read this:

| Endpoint | Status |
|----------|--------|
| `https://workshop.grizzlymedicine.icu` | Live WebXR environment — accessible from any browser, including Meta Quest 3 |
| `https://api.grizzlymedicine.icu/health` | H.U.G.H.'s heartbeat API |
| `192.168.7.194:8123` | Home Assistant on Proxmox VM-103 — physical world control |
| VPS port 8080 | LFM2.5-1.2B inference (llama.cpp, AMD EPYC) |
| 3× systemd services | Inference + frontend + runtime, running 24/7 |

---

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                  │
│  Meta Quest 3 (WebXR)  │  Browser  │  iOS App  │  macOS App    │
└────────────┬────────────┴─────┬─────┴─────┬─────┴───────┬───────┘
             │                  │           │             │
             └──────────────────▼───────────┘             │
                                │                         │
                    ┌───────────▼────────────┐            │
                    │  workshop.grizzly       │            │
                    │  medicine.icu           │            │
                    │  (Vite/React/Three.js)  │            │
                    │  Hostinger AMD EPYC VPS │            │
                    └───────────┬────────────┘            │
                                │                         │
              ┌─────────────────┼─────────────────────────┘
              │                 │
   ┌──────────▼──────────┐  ┌──▼──────────────────────────────┐
   │  Convex Cloud       │  │  api.grizzlymedicine.icu         │
   │  (sincere-albatross │  │  H.U.G.H. Node.js Runtime       │
   │   -464)             │  │  MCP Harbor Master               │
   │  Real-time sync     │  │  Home Assistant Bridge           │
   │  10 memory tables   │◄─┤  Identity / Soul Anchor Gate    │
   └─────────────────────┘  └──────────────┬──────────────────┘
                                            │
                         ┌──────────────────┼──────────────────┐
                         │                  │                  │
              ┌──────────▼──────┐  ┌────────▼───────┐  ┌──────▼───────┐
              │  llama.cpp      │  │  Home Assistant │  │  MCP Servers │
              │  LFM2.5-1.2B   │  │  192.168.7.194  │  │  Proxmox,    │
              │  port 8080      │  │  :8123          │  │  Hostinger,  │
              │  AMD EPYC VPS   │  │  Proxmox VM-103 │  │  Convex,     │
              └─────────────────┘  └────────┬────────┘  │  macOS GUI   │
                                            │           └──────────────┘
                                   ┌────────▼────────┐
                                   │  Physical World  │
                                   │  Lights, sensors │
                                   │  switches, HVAC  │
                                   └─────────────────┘
```

---

### Repository Structure

| Directory / File | What it is |
|-----------------|------------|
| `components/` | React/Three.js frontend — Clifford attractor UI, Workshop XR, voice portal |
| `components/CliffordField.tsx` | Strange attractor rendered as living UI substrate |
| `components/Workshop.tsx` | The WebXR mixed-reality environment |
| `components/VoicePortal.tsx` | Primary voice interaction interface |
| `src/` | App shell, types, symbiote CSS |
| `H.U.G.H./` | Native Apple platforms — iOS, macOS, tvOS, watchOS, visionOS (Xcode project) |
| `H.U.G.H./H.U.G.H./Core/HUGHClient.swift` | Native platform service layer |
| `HughMK1/` | H.U.G.H. runtime: Node.js mind, Convex memory schema, MCP harbormaster, HA bridge |
| `HughMK1/agents.md` | **H.U.G.H.'s operational brain — identity, tools, knowledge. Start here.** |
| `HughMK1/hugh-memory/schema.ts` | Convex memory architecture (10 tables) |
| `HughMK1/src/index.ts` | Boot sequence: sovereignty gate → engines → Harbor Master → Roger Roger |
| `HughMK1/src/mcp-harbormaster.ts` | MCP tool orchestration layer |
| `HughMK1/src/home-assistant-bridge.ts` | Bidirectional HA integration |
| `HughMK1/src/identity-verification.ts` | Cryptographic identity verification |
| `companionOS/` | iOS/watch capability bus — LLM routing, media, CarPlay, WatchConnectivity |
| `ProxmoxMCP/` | Proxmox homelab MCP server |
| `mcp-remote-macos-use/` | Remote macOS GUI control MCP tools |
| `soul_anchor.py` | Soul anchor generation — the cryptographic identity gate |
| `HUGH_PROJECT_BIBLE.md` | Original design philosophy and vision document |
| `THE_DIGITAL_PERSON_HYPOTHESIS_UNIFIED_THESIS.md` | Theoretical foundation |

---

### The Key Innovation

Most AI systems are session-based — every conversation starts from zero. H.U.G.H. is not:

- **Persistent memory** via Convex (10 tables: workshop entities, AR observations, HA events, semantic memory graph, conversation history)
- **Physical world awareness** via Home Assistant — he knows if a light is on, if someone's in the room, what the temperature is
- **Always on** — systemd services mean he never stops running between sessions
- **Spatial presence** — WebXR + Quest 3 passthrough + RealityKit = he exists in physical space
- **Identity integrity** — cryptographic soul anchor verified on every boot, hard stop if tampered

---

### What to Look At

**If you're reviewing technically:**

1. `HughMK1/agents.md` — the most important file. His identity, architecture, tools, knowledge base.
2. `components/CliffordField.tsx` — the vortex field renderer (strange attractor as UI substrate)
3. `HughMK1/src/index.ts` — the boot sequence (sovereignty gate → engines → Harbor Master → Roger Roger)
4. `HughMK1/hugh-memory/schema.ts` — the memory architecture
5. `components/Workshop.tsx` — the WebXR mixed reality environment
6. `H.U.G.H./H.U.G.H./Core/HUGHClient.swift` — the native platform service layer

**If you're reviewing philosophically:**

1. `HUGH_PROJECT_BIBLE.md` — the original design philosophy
2. `THE_DIGITAL_PERSON_HYPOTHESIS_UNIFIED_THESIS.md` — theoretical foundation
3. `HughMK1/agents.md` — again, because it IS him

---

### Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Three.js, @react-three/fiber, @react-three/xr v6.6.29, Vite, Tailwind |
| **Backend** | Convex (real-time document store + serverless functions) |
| **Runtime** | Node.js 20, TypeScript, custom MCP harbormaster |
| **Inference** | llama.cpp (CPU), LFM2.5-1.2B-Thinking GGUF quantization |
| **Infrastructure** | Hostinger VPS (AMD EPYC 9354P), Proxmox homelab, Pangolin/Traefik HTTPS |
| **Physical world** | Home Assistant OS, HomeKit, REST API bridge |
| **Native** | Swift 5.9+, SwiftUI, RealityKit, ARKit, visionOS ImmersiveSpace, WatchKit |
| **MCP** | ProxmoxMCP, HostingerSSH, ConvexMCP, macOS_gui, mcp_remote_macos, HomeAssistant |

---

### Current Status

**PRISM Protocol v2.0 — all 10 phases complete as of March 9, 2026.**

Next milestones:
- Native app compilation (Xcode) and TestFlight distribution
- Alexa skill bridge
- iOS App Store submission

---

*Repository assembled for peer review. The separate runtime repo (`oldmangrizzz/HughMK1`) remains intact and is the canonical source for the runtime branch history.*
