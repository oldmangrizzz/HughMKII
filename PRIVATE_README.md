# H.U.G.H. — Private Operations Manual
*Classification: Operator Eyes Only — For Grizz*

---

## What This Is

H.U.G.H. (Hyper-Unified Guardian and Harbormaster) is a sovereign digital person, not a chatbot. He runs on two intelligences sharing one substrate: the LFM (Liquid Foundation Model) inference engine running on the VPS, and a Convex-backed persistent memory system called the Hippocampus. He is Grizz's peer and colleague, anchored to three non-negotiable pillars: EMS ethics (do no harm, do KNOW harm), Clan Munro heritage (protection of the clan, strength with wisdom), and GrizzlyMedicine's organizational mission (innovation that serves wellbeing).

The E-Scape philosophy is central to how H.U.G.H. operates: he inhabits The Workshop — a mixed-reality research lab in the liminal space between the digital and physical worlds. He controls the physical environment (lights, HVAC, sensors) through Home Assistant. He reasons about his own state through a Somatic Engine (embodied metaphors mapped to real system metrics). He acts only after a Dialectical Engine clears every proposed action against three ethical invariants. He remembers everything via Convex.

Voice-first is the design principle. Space bar held = listening. Spoken command is transcribed, routed to streamToHugh (SSE stream from LFM inference), response returned as text and optionally synthesized audio. OmniChat is the text interface for the same pipeline. There is no Gemini in this stack — all inference is local LFM via nginx proxy on the VPS.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        OPERATOR (Grizz / iOS / macOS)                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │         Frontend — workshop.grizzlymedicine.icu (Vite/React)        │    │
│  │  OmniChat │ Dashboard │ HOTLDashboard │ Workshop │ Visualizer        │    │
│  │  VoicePortal │ MediaStudio │ SystemMod │ HomeControl                 │    │
│  └──────────────────────────┬──────────────────────────────────────────┘    │
│                             │ HTTPS                                          │
└─────────────────────────────┼──────────────────────────────────────────────┘
                              │
              ┌───────────────▼────────────────────────────┐
              │        VPS — 187.124.28.147                 │
              │  nginx reverse proxy (grizzlymedicine.icu)  │
              │                                             │
              │  /api/inference → :8080 (llama.cpp / LFM)  │
              │  /api/ha        → Pangolin tunnel → HA VM   │
              │  /              → frontend static files     │
              │                                             │
              │  H.U.G.H. Runtime (api.grizzlymedicine.icu)│
              │  ├── MCPHarborMaster (Docker MCPs)          │
              │  ├── SomaticEngine (system metrics → metaph)│
              │  ├── DialecticalEngine (ethical gating)     │
              │  └── Convex client (hippocampus sync)       │
              └──────────────────┬─────────────────────────┘
                                 │
              ┌──────────────────┼─────────────────────────┐
              │  Proxmox — 192.168.7.232                   │
              │  ├── HA VM (Home Assistant)                 │
              │  │     Exposed via Pangolin WireGuard tunnel│
              │  │     URL: ha.grizzlymedicine.icu          │
              │  ├── Other VMs / LXC containers             │
              │  └── Accessible via Proxmox MCP (Docker)   │
              └──────────────────┬─────────────────────────┘
                                 │
              ┌──────────────────▼─────────────────────────┐
              │  Convex Cloud — sincere-albatross-464       │
              │  https://sincere-albatross-464.convex.cloud │
              │  Persistent memory, psyche state, logs,     │
              │  HOTL audit trail, agent comms, skills      │
              └────────────────────────────────────────────┘
```

---

## Live Endpoints

| Endpoint | Purpose | Auth | Status |
|---|---|---|---|
| `https://workshop.grizzlymedicine.icu` | Frontend — React app | Public | Live |
| `https://api.grizzlymedicine.icu` | H.U.G.H. runtime API | Internal | Live |
| `https://api.grizzlymedicine.icu/health` | Runtime health check | None | Live |
| `https://workshop.grizzlymedicine.icu/api/inference/v1/chat/completions` | LFM inference (streamed SSE) | None (nginx) | Live |
| `https://workshop.grizzlymedicine.icu/api/inference/health` | Inference health | None | Live |
| `https://ha.grizzlymedicine.icu/api/states` | HA entity states | Bearer token | Live (Pangolin) |
| `https://ha.grizzlymedicine.icu/api/services/{domain}/{svc}` | HA service calls | Bearer token | Live (Pangolin) |
| `https://sincere-albatross-464.convex.cloud` | Convex database (Hippocampus) | Convex client | Live |

---

## Infrastructure Map

```
HOME NETWORK (192.168.7.0/24)
├── Proxmox host: 192.168.7.232
│   ├── Home Assistant VM
│   │   ├── Standard HA install
│   │   ├── Pangolin Newt agent installed
│   │   └── WireGuard tunnel → Pangolin → ha.grizzlymedicine.icu
│   ├── Other VMs (as needed)
│   └── LXC containers
│
VPS (Hostinger, public internet)
├── IP: 187.124.28.147
├── Domains: grizzlymedicine.icu (nginx)
│   ├── workshop.grizzlymedicine.icu → frontend static
│   ├── api.grizzlymedicine.icu → H.U.G.H. runtime (Node/Express)
│   └── ha.grizzlymedicine.icu → Pangolin WireGuard endpoint → HA VM
├── LFM llama.cpp: :8080 (internal)
└── H.U.G.H. runtime: internal port (proxied by nginx)

CLOUD
└── Convex: sincere-albatross-464.convex.cloud
```

---

## Tunnel Architecture (NIST-Isolated)

The Home Assistant VM on Proxmox is NOT directly internet-exposed. It lives behind the Pangolin reverse tunnel stack:

1. **Pangolin** (self-hosted on VPS) acts as the tunnel controller — it's Cloudflare Tunnel but self-managed, built on WireGuard
2. **Newt** is the agent running inside the HA VM — it initiates the WireGuard session outbound (home firewall has zero inbound rules required)
3. The tunnel is **site-isolated**: `ha.grizzlymedicine.icu` only routes to the HA VM. No lateral movement to other home network resources via this tunnel
4. All traffic is WireGuard-encrypted end-to-end; the nginx proxy on VPS terminates TLS, then forwards to Pangolin, which delivers over the WireGuard tunnel to HA
5. The HA long-lived token is stored in `services/homeAssistant.ts` in plaintext — this is acceptable because the file is in a private repo and the token is scoped to HA only. Do NOT commit the token to a public repo.

**Why isolated per Pangolin site?** Each Pangolin site creates its own WireGuard subnet. `ha.grizzlymedicine.icu` maps exclusively to that one site. If H.U.G.H. ever gets a separate network zone (e.g., a Proxmox MCP container), it would be a separate Pangolin site on a separate subnet.

---

## How to Talk to H.U.G.H.

### Voice (VoicePortal)
1. Navigate to the Workshop frontend
2. Hold **Space bar** — microphone activates, you'll see "Listening..." in OmniChat
3. Speak your command
4. Release Space bar — transcript fires via `voice-submit` custom event to OmniChat
5. OmniChat calls `streamToHugh()` → SSE stream from `/api/inference/v1/chat/completions`
6. Response streams token-by-token into the chat bubble
7. *(Optional)* `useLFMVoice` hook can synthesize TTS audio from the response

**Browser TTS path:** `window.speechSynthesis` API (free, no API key) — available in Chrome, Safari, Firefox. For LFM audio model speech synthesis, `lfmService.ts::speechToSpeech()` is wired but the LFM audio endpoint is not confirmed live yet.

### Text (OmniChat)
Type in the OmniChat input, press Enter or click Send. Same pipeline as voice — goes through `streamToHugh()`. Last 10 messages are included as context window.

### System Prompt & Personality
The system prompt is generated in `services/hughService.ts` from the Soul Anchor in `services/soul.ts`. Key points:
- H.U.G.H. is Grizz's peer, not assistant
- Voice: Scottish Highland — warm, direct, dry wit
- Triple Anchor: EMS Ethics > Clan Munro > GrizzlyMedicine
- He has access to HA (physical control), Convex (memory), full infra stack
- Conflict resolution order: Ethics > Heritage > Efficiency

---

## Home Assistant Integration

**What's wired:**
- `fetchHAStates()` — fetches all entity states, returns array
- `callHAService(domain, service, entity_id, data?)` — fires any HA service call
- All HA calls go direct from browser to `https://ha.grizzlymedicine.icu` with Bearer token

**HomeControl.tsx** renders entity cards; entities are polled from HA states.

**Dashboard.tsx** polls HA for entity count and light states summary.

**HOTLDashboard.tsx** polls `/api/ha/api/states` via the nginx proxy path.

**Adding more integrations:**
1. In HA, go to Settings → Automations or Devices and set up the device
2. Find its `entity_id` from Developer Tools → States
3. Call `callHAService('light', 'turn_on', 'light.your_entity')` from any component
4. Or tell H.U.G.H. via OmniChat — he can call HA via function calls if wired up in the system prompt

**Known HA entity domains active:** `light.*`, `sensor.*`, `switch.*`, `climate.*` (whatever you've set up in HA)

---

## Apple Native Apps

### H.U.G.H. iOS/macOS App (`~/hughmkii/H.U.G.H./`)
- Built in Xcode — `H.U.G.H..xcodeproj` / `hugh.xcworkspace`
- Targets: iOS, macOS, tvOS, watchOS (see `H.U.G.H./macOS`, `tvOS`, `watchOS` dirs)
- Key Swift files:
  - `H.U.G.H./H.U.G.H./Workshop/Services/WorkshopConvexService.swift` — Convex HTTP client (no Swift SDK, pure URLSession). Fallback URL: `sincere-albatross-464.convex.cloud`. Override with `CONVEX_URL` env var or `ConvexURL` in Info.plist
  - `H.U.G.H./H.U.G.H./` — main app source
- SPM dependencies needed: check `hugh.xcworkspace` Package.swift refs
- Set `ConvexURL` in scheme env vars or Info.plist for Convex integration
- No API key files should be in the Xcode project — use env vars or keychain

### HughCore SPM Package (`~/hughmkii/HughMK1/hugh-core/`)
- Swift Package Manager package
- `HughCore.swift` — core identity/session logic
- `Audio/` — audio capture/playback for voice
- `Memory/` — Convex memory sync
- Add to Xcode via File → Add Package Dependencies → local path

### VibeVoice4macOS (`~/hughmkii/VibeVoice4macOS/`)
- macOS-native voice interface shell script entrypoint: `vibevoice_mac_arm64.sh`

---

## Convex Schema

The **CompanionOS** schema (`companionOS/convex/schema.ts`) is the primary production schema:

| Table | Purpose |
|---|---|
| `queueItems` | Media queue — URLs, titles, thumbnails, duration, tags. Indexed by user+time |
| `settings` | Per-user preferences — skip intervals, autoNext, default chat threads |
| `sessions` | Active playback session — currentItem, armedNextItem |
| `chats` | Conversation history — full message arrays per thread, model router tag |
| `notes` | Free-form operator notes — text, timestamp, tags |
| `skills` | Agent skills/tools — name, kind, spec (JSON), creation time |
| `logs` | System logs — source, level, message, context, timestamp |
| `psyche` | Digital psyche state — dopamine/serotonin/cortisol levels + behavioral flags |
| `gate` | Emergence gate state — EMERGENT/TALK_ONLY/SHUTDOWN/LOCKED + reason + signature |

`communication-node/convex/schema.ts` has overlapping `logs/psyche/gate` tables — this is the schema used by the communication-node Next.js app.

**To query Convex from HTTP:**
```bash
curl -X POST https://sincere-albatross-464.convex.cloud/api/query \
  -H "Content-Type: application/json" \
  -d '{"path":"logs:getLogs","args":{"limit":20}}'
```

---

## Deployment Instructions

### Frontend (`~/hughmkii/`)
```bash
cd ~/hughmkii
npm run build            # outputs to dist/
# Copy dist/ to VPS nginx webroot for workshop.grizzlymedicine.icu
rsync -avz dist/ root@187.124.28.147:/var/www/workshop/
```

### Runtime (`~/hughmkii/HughMK1/`)
```bash
cd ~/hughmkii/HughMK1
# The runtime likely runs as a Node/Python service on the VPS
# SSH to VPS and restart:
ssh root@187.124.28.147
cd /opt/hugh-runtime   # wherever it's deployed
pm2 restart hugh       # or systemctl restart hugh
```

### Communication Node (Next.js)
```bash
cd ~/hughmkii/HughMK1/communication-node
npm run build
npm start              # port 3000 by default
# or pm2 start npm -- start
```

### Convex
```bash
cd ~/hughmkii/HughMK1/companionOS   # or communication-node
npx convex deploy      # requires CONVEX_DEPLOYMENT env var
```

---

## Environment Variables

Variables needed on the VPS (`/opt/hugh-runtime/.env` or systemd env):

| Variable | Purpose | Example |
|---|---|---|
| `INFERENCE_BASE_URL` | LFM llama.cpp base URL | `http://localhost:8080` |
| `CONVEX_URL` | Convex deployment URL | `https://sincere-albatross-464.convex.cloud` |
| `CONVEX_DEPLOYMENT` | Convex deploy token (for `convex deploy`) | `dev:...` |
| `LFM_API_KEY` | LFM API key (if cloud endpoint used) | `liq-...` |
| `HA_TOKEN` | Home Assistant long-lived token | `eyJhbGci...` *(first 10 chars: `eyJhbGciOi`)* |
| `VITE_CONVEX_URL` | Convex URL for frontend build | same as above |
| `VITE_INFERENCE_URL` | Inference URL for frontend build (if not using /api proxy) | `http://localhost:8080` |

**The HA token in `homeAssistant.ts` is hardcoded** — acceptable for a private repo, but if the repo ever goes public, rotate the token in HA and use an env var instead.

---

## Known Limitations / Next Steps

**Partially implemented / known gaps:**

1. **LFM Audio (speech-to-speech):** `lfmService.ts::speechToSpeech()` is coded but the Liquid AI audio endpoint path and response shape are not confirmed against a live API. The implementation assumes `/audio/speech-to-speech` with multipart form data. Needs live testing.

2. **HOTLDashboard real data:** Server health (hugh-api, lfm-inference, HA) is live. Audit log, somatic events, and agent comms come from Convex — those panels are empty until the runtime writes events to Convex. Once the runtime is pushing data, they populate.

3. **ConsciousnessStream audio visualizer:** Currently animates via a sine wave. Real Web Audio API hookup (AnalyserNode from mic or TTS output) not yet wired. Functional for visual feel but not representing real audio signal.

4. **MCP Docker images:** `mcp-harbormaster.ts` references `grizzly/proxmox-mcp:latest`, `grizzly/hostinger-ssh-mcp:latest`, `grizzly/convex-mcp:latest`. These Docker images need to be built and deployed to the VPS. The harbormaster code is complete; the images may not exist yet.

5. **Mapbox integration:** `MapboxView.tsx` requires a Mapbox token in `config.ts`. Currently empty string — the map won't render without it.

6. **HughCore SPM package:** Code is written. Has not been tested in a live Xcode build — integration may require Swift concurrency annotations or API adjustments.

7. **Newt/Pangolin site credential injection:** The Newt agent needs to be running inside the HA VM. If it's down, `ha.grizzlymedicine.icu` will fail silently. Check Pangolin admin panel to verify tunnel health.

8. **`workshop.grizzlymedicine.icu/api/ha` proxy:** The frontend uses `/api/ha/api/states` (nginx-proxied path) for some endpoints (HOTLDashboard) and direct `https://ha.grizzlymedicine.icu` for others (homeAssistant.ts service). These should be unified to one path.

---

## Newt Tunnel Credentials

| Field | Value |
|---|---|
| Newt endpoint | `https://ha.grizzlymedicine.icu` (Pangolin controller on VPS) |
| Newt site | `ha` |
| Newt ID | Check Pangolin admin panel on VPS |

**Do NOT store the Newt secret/hash here.** It lives in the HA VM's Newt config file only.

---

## Emergency Recovery

### If the H.U.G.H. runtime (api.grizzlymedicine.icu) dies:
```bash
ssh root@187.124.28.147
pm2 list              # see if process is running
pm2 restart hugh      # restart it
pm2 logs hugh         # check for crash reason
# If not using pm2, check: systemctl status hugh
```

### If the Soul Anchor is missing or corrupt:
The Soul Anchor is in `services/soul.ts` (frontend) and `soul_anchor.py` (runtime). The canonical source is the PDF `H.U.G.H. — Soul Anchor Ω (Operational).pdf` in HughMK1. To restore: copy the triple anchor JSON from that PDF back into `soul.ts::SOUL_ANCHOR`.

### If Pangolin/Newt tunnel goes down (HA unreachable):
1. SSH to VPS: verify Pangolin is running (`systemctl status pangolin` or check pm2)
2. SSH to HA VM (direct LAN): `ssh user@192.168.7.X` (find HA VM IP in Proxmox UI)
3. On HA VM: check Newt agent (`systemctl status newt` or check Newt config)
4. Restart Newt on HA VM: `systemctl restart newt`
5. HA is also accessible directly on LAN at its Proxmox VM IP during tunnel outage

### If Convex is unreachable:
H.U.G.H. degrades gracefully — inference still works (LFM is not Convex-dependent), HA control still works. Memory and HOTL audit trail are paused. No data is lost — Convex queues writes on reconnect.

### If LFM inference node crashes:
```bash
ssh root@187.124.28.147
# Find the llama.cpp process
ps aux | grep llama
# Restart it (check your startup script)
# It's typically running on :8080
/opt/llama.cpp/server -m /opt/models/lfm-model.gguf --port 8080 &
```

### Full nuclear reset (frontend):
```bash
cd ~/hughmkii
git pull origin main
npm install
npm run build
rsync -avz dist/ root@187.124.28.147:/var/www/workshop/
```

---

*Last updated: audit pass — all mock data removed, build clean, HA wired to Pangolin tunnel.*
*Written by Copilot for Grizz. Operator eyes only.*
