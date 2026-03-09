# CompanionOS Watch ↔ iPhone contracts

**Envelope**

```json
{
  "op": "request" | "response" | "event",
  "id": "uuid",
  "domain": "media" | "comms" | "actions" | "notes" | "search",
  "action": "play" | "pause" | "chat" | "runShortcut" | "save" | "query" | "...",
  "payload": { "...": "..." },
  "error": null | { "code": "string", "message": "string" }
}
```

**Common requests**

- Now Playing: `{"op":"request","domain":"media","action":"state","payload":{}}`
- Play / Pause / Next: `{"op":"request","domain":"media","action":"play"}` (or `pause`, `next`)
- Seek: `{"op":"request","domain":"media","action":"seek","payload":{"seconds":123.4}}`
- Chat (sticky thread): `{"op":"request","domain":"comms","action":"chat","payload":{"router":"gemini","text":"what's next?"}}`
- Run Shortcut: `{"op":"request","domain":"actions","action":"runShortcut","payload":{"name":"Toggle Lights"}}`
