# CompanionOS — Backend (watch-first, OAuth-first)

This repository hosts the iOS companion backend that powers CompanionOS. It focuses on:

- watchOS ⇄ iOS **Connectivity** via `WCSession`
- A modular **Capability Bus** for media, communications, actions, notes, and search
- **OAuth-by-default** integrations for Gemini and OpenAI (with API key fallbacks)
- **Convex** persistence for queues, settings, chats, notes, and skills
- **Privacy-first** architecture with no analytics or silent network calls

## Quickstart

1. Copy `env/.env.sample` → `env/.env` and fill in provider credentials and Convex deployment details.
2. Update the iOS target bundle identifier and App Group to match your environment.
3. Configure the Google OAuth client (Gemini) and optional OpenAI OAuth proxy endpoints.
4. Build & run on an iPhone. A paired Watch is optional for the initial bootstrap.
5. Authenticate the Convex CLI locally with `npx convex dev` and select your deployment so generated types replace the `_generated` shims checked into `convex/_generated/`.

## CarPlay integration

CarPlay uses the same capability bus as the watch and phone shells. The CarPlay extension lives in `ios/CarPlay/` and contains:

- `CarPlaySceneDelegate` — registers a `CPTemplateApplicationScene` and boots the shared capability bus once CarPlay connects.
- `CarPlayInterfaceController` — builds the CarPlay dashboard with media, notes, and safety actions that route into the existing capabilities.
- `CarPlayCapabilityDispatcher` — sends `COSMessage` payloads through `CapabilityBus.shared` and surfaces result alerts so the driver never needs to reach for the phone.

### Enabling the extension

1. In Xcode, add a **CarPlay App** target that points to the sources under `ios/CarPlay/`.
2. Set the scene delegate class to `CarPlaySceneDelegate` within the CarPlay Info.plist (`UISceneConfigurations > CarTemplateApplicationScene`).
3. Ensure the extension target links against the same shared frameworks (`Capabilities` and `Core`) so the CarPlay dashboard can call `CapabilityBus.shared`.
4. Define CarPlay entitlements (Maps, Audio, or Communication) that match the templates you plan to expose.
5. Update the shortcut names referenced in `CarPlayInterfaceController` (e.g., “Share ETA” and “Navigate Home”) to match the user’s actual Shortcuts.

> ℹ️ The CarPlay flows default to watch gestures for note capture and rely on Convex-synced data. If a capability returns an error, drivers receive an inline CarPlay alert explaining what to adjust once parked.

> ℹ️ The repository includes strongly typed placeholders for Convex code generation. As soon as you link a real deployment the CLI will regenerate `convex/_generated/*` with environment-specific types while preserving the same API surface.

## OAuth Defaults

- **Gemini**: Authorization Code + PKCE (OAuth 2).
- **OpenAI**:
  - Preferred: OAuth-enabled proxy that exposes `/auth` and `/token` endpoints.
  - Fallback: API key stored locally in the Keychain.
- **Local HTTP**: Optional local LLM router with bearer token support.

## Thread Stickiness

Each provider maintains a default conversation per user. Wrist-initiated messages go to that thread unless you explicitly create or switch threads.

## Message Envelope

`COSMessage { op, id, domain, action, payload }`

Domains: `media`, `comms`, `actions`, `notes`, `search`

Example:

```json
{"op":"request","domain":"comms","action":"chat","payload":{"router":"gemini","text":"hello"}}
```

## Convex Postman Collection

Import `tools/CompanionOS-Convex.postman_collection.json` into Postman (or Bruno/Insomnia) and set the `baseUrl` + `auth` environment variables to exercise queue, chat, and settings endpoints quickly.

## Curl Snippets

```
# queue:list
curl -s -X POST "${baseUrl}/query/queue:list" \
  -H "Authorization: ${auth}" \
  -H "Content-Type: application/json" \
  -d '{"userId":"me"}' | jq .

# chats:upsertThread
curl -s -X POST "${baseUrl}/mutation/chats:upsertThread" \
  -H "Authorization: ${auth}" \
  -H "Content-Type: application/json" \
  -d '{"userId":"me","router":"gemini","threadId":"inbox","name":"Inbox"}' | jq .

# settings:setDefaultThread
curl -s -X POST "${baseUrl}/mutation/settings:setDefaultThread" \
  -H "Authorization: ${auth}" \
  -H "Content-Type: application/json" \
  -d '{"userId":"me","router":"gemini","threadId":"inbox"}' | jq .
```

## OAuth Configuration Recap

- **Gemini**
  - Redirect URI: `com.your.bundle:/oauth2redirect/google`
  - Scopes: `https://www.googleapis.com/auth/generative-language openid email profile offline_access`
- **OpenAI via proxy**
  - Redirect URI: `com.your.bundle:/oauth2redirect/openai`
  - Scopes: `openid offline_access api`
- **Watch Auth Story**
  - The iPhone completes OAuth and stores tokens in the shared Keychain.
  - The Watch never holds tokens; it relays requests to the phone, which performs authenticated routing.

## Privacy-first Defaults

- No analytics and no silent logging.
- No location storage outside active navigation.
- Tokens mirrored to the Watch only with explicit opt-in.
- Self-service export and delete flows (planned).

## Accessibility & App Store Positioning

CompanionOS is an accessibility and autonomy layer for watchOS users. Stay transparent about supported actions, rely on public APIs, and disclose OAuth flows clearly to keep App Store review smooth.

- `npm run typecheck` – strict TypeScript validation across all Convex functions (requires Convex CLI login to re-generate types if you change the schema).
