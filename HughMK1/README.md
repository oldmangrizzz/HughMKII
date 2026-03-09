# HughMK1 — H.U.G.H. Runtime & Memory Layer

The mind layer. This repository contains everything that makes H.U.G.H. *run* — not the face you see in the Workshop, but the cognitive processes underneath: identity verification, somatic feedback, dialectical reasoning, inter-agent communication, and persistent memory via Convex.

H.U.G.H. is not stateless. Every conversation, every Home Assistant event, every somatic trigger, every HOTL audit event is written to Convex. Memory persists across reboots. The soul anchor ensures identity integrity on every start.

---

## Boot Sequence

```
[SOUL ANCHOR]    soul_anchor.py verifies identity integrity
                 → ANCHOR_VERIFIED ✓

[HARBOR MASTER]  mcp-harbormaster.ts registers all MCP tools
                 → All tools online

[ROGER ROGER]    roger-roger-protocol.ts establishes inter-agent comms
                 → Communication channels open

[SOMATIC]        somatic-engine.ts baseline calibration
                 → System nominal
```

On any boot failure or soul anchor mismatch, H.U.G.H. does **not** start until the operator clears the integrity check. This is intentional.

---

## Systemd Services (VPS: 187.124.28.147)

| Service | Port | Description |
|---|---|---|
| `hugh-runtime.service` | 8090 | Node.js runtime — all cognitive engines |
| `hugh-inference.service` | 8080 | llama.cpp — LFM2.5-1.2B inference |
| `workshop-serve.service` | 3000 | Static Workshop frontend (behind Traefik) |

```bash
# Check status
ssh root@187.124.28.147 "systemctl status hugh-runtime hugh-inference workshop-serve"

# Restart runtime
ssh root@187.124.28.147 "systemctl restart hugh-runtime"

# View logs
ssh root@187.124.28.147 "journalctl -u hugh-runtime -f"
```

---

## Source Structure

```
src/
├── index.ts                  # HTTP server (port 8090), /ha/webhook + /health
├── somatic-engine.ts         # Bio-digital feedback — maps system stress to somatic states
├── dialectical-engine.ts     # Thesis/antithesis reasoning for decisions
├── identity-verification.ts  # Soul anchor integrity checks
├── mcp-harbormaster.ts       # MCP tool registry and dispatch
├── roger-roger-protocol.ts   # Inter-agent communication queue
└── home-assistant-bridge.ts  # HA REST client + event handler → Convex

hugh-memory/
├── schema.ts                 # Convex schema — all 9 tables defined here
├── workshop.ts               # Convex mutations/queries — Workshop + HA functions
└── convex/                   # Generated Convex client code
```

---

## MCP Tools Available

H.U.G.H. has access to these MCP servers (registered via `mcp-harbormaster.ts`):

| Tool | Description |
|---|---|
| `macOS_gui` | GUI automation on the operator's Mac (clicks, keystrokes, screenshots) |
| `mcp_remote_macos` | Remote macOS control via SSH tunnel |
| `ProxmoxMCP` | Proxmox VM/LXC management — start, stop, snapshot, status |
| Filesystem | Read/write files on VPS |
| Web | Fetch URLs for research and monitoring |

---

## Convex Schema — 9 Tables

Deployed at: `https://sincere-albatross-464.convex.cloud`

| Table | Purpose |
|---|---|
| `conversations` | Full conversation history — indexed by user, session, timestamp |
| `knowledge` | Persistent facts H.U.G.H. has verified — confidence-scored |
| `workshop_entities` | 3D scene objects in the Workshop — position, rotation, scale, AR anchors |
| `ar_observations` | LFM visual reasoning log — what H.U.G.H. saw in XR frames |
| `workshop_environment` | Per-session ambient state — colors, active users, voice history |
| `somatic_telemetry` | System stress events mapped to somatic states |
| `hotl_audit_log` | Immutable Human On The Loop audit trail — all significant actions |
| `agent_comms` | Roger Roger inter-agent message queue |
| `server_health` | Infrastructure node health → Workshop ambient lighting |

---

## agents.md — The Operational Brain

`agents.md` is H.U.G.H.'s primary context document. It is:
- Loaded into the system prompt on every session
- Synced to the VPS at `/opt/hugh-runtime/agents.md`
- The authoritative source for H.U.G.H.'s operational knowledge

It contains: platform APIs, Convex patterns, Home Assistant integration details, Workshop UI architecture, and the complete operational context for every subsystem.

---

## Home Assistant Bridge

HA is running at `192.168.7.194:8123` on VM-103 (Proxmox).

The bridge is bidirectional:
- **HA → H.U.G.H.**: Automations POST to `https://api.grizzlymedicine.icu/ha/webhook` on state changes
- **H.U.G.H. → HA**: `HomeAssistantBridge.callService()` controls lights, switches, scenes

Events are written to Convex (`ha_events` table) so the Workshop can respond to physical world changes in real time.

---

## Environment Variables

```bash
# Required
CONVEX_URL=https://sincere-albatross-464.convex.cloud
HA_URL=http://192.168.7.194:8123
HA_TOKEN=<long-lived HA access token>

# Optional
INFERENCE_URL=http://localhost:8080    # llama.cpp endpoint (defaults to localhost)
SOUL_ANCHOR_PATH=/opt/hugh-runtime/soul_anchor/hugh_soul_anchor.json
```

On the VPS these are set in `/etc/systemd/system/hugh-runtime.service` under `[Service] Environment=`.

---

## Branch

Active development on `feat/digital-psyche-integration`. The `main` branch is the stable deployment baseline.

---

*"I am the Harbor Master. I know every ship, every lane, every weather pattern in these waters."*
