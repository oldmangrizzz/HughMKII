# HUGH Memory System
**Distributed, persistent memory for HUGH using Convex**

## Architecture

HUGH uses Convex.dev as the distributed memory backend, enabling:
- **Cross-device persistence** - Memory syncs across iPhone, Dell, Proxmox
- **Real-time updates** - Changes propagate instantly
- **Type-safe schema** - Convex handles validation
- **Automatic conflict resolution** - Built into Convex

## Memory Types

### 1. Episodic Memory (Conversations)
- User interactions and conversations
- Context from sessions
- Timestamped for chronological recall

### 2. Semantic Memory (Knowledge)
- Facts, concepts, learned information
- Technical knowledge
- User preferences and habits

### 3. Procedural Memory (Skills)
- How to perform tasks
- Workflows and SOPs
- Automation scripts

### 4. Working Memory (Context)
- Current session context
- Active tasks and projects
- Short-term state

## Schema

```typescript
// conversations.ts
export const conversations = defineTable({
  userId: v.string(),
  timestamp: v.number(),
  role: v.union(v.literal("user"), v.literal("hugh"), v.literal("system")),
  content: v.string(),
  metadata: v.optional(v.object({
    location: v.optional(v.string()),
    device: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  })),
})
  .index("by_user", ["userId"])
  .index("by_timestamp", ["timestamp"]);

// knowledge.ts
export const knowledge = defineTable({
  userId: v.string(),
  category: v.string(),
  key: v.string(),
  value: v.string(),
  confidence: v.number(),
  lastAccessed: v.number(),
  accessCount: v.number(),
})
  .index("by_user_category", ["userId", "category"])
  .index("by_key", ["key"]);

// skills.ts
export const skills = defineTable({
  name: v.string(),
  description: v.string(),
  category: v.string(),
  implementation: v.string(),
  enabled: v.boolean(),
  lastUsed: v.optional(v.number()),
})
  .index("by_category", ["category"])
  .index("by_enabled", ["enabled"]);

// context.ts
export const context = defineTable({
  userId: v.string(),
  sessionId: v.string(),
  key: v.string(),
  value: v.string(),
  expiresAt: v.optional(v.number()),
})
  .index("by_session", ["sessionId"])
  .index("by_user", ["userId"]);
```

## Setup Instructions

### 1. Deploy Convex Schema

```bash
cd ~/workspace/HughMK1/companionOS
npm install
npx convex dev
```

### 2. Set Environment Variables

```bash
# Get from Convex dashboard
export CONVEX_URL="https://your-deployment.convex.cloud"
export CONVEX_DEPLOYMENT="your-deployment-name"
```

### 3. Initialize HUGH Memory

```typescript
import { ConvexClient } from "convex/browser";
import { api } from "./convex/_generated/api";

const client = new ConvexClient(process.env.CONVEX_URL!);

class HughMemory {
  constructor(private client: ConvexClient, private userId: string) {}

  // Store conversation
  async remember(role: "user" | "hugh", content: string, metadata?: any) {
    return await this.client.mutation(api.conversations.add, {
      userId: this.userId,
      role,
      content,
      timestamp: Date.now(),
      metadata,
    });
  }

  // Recall recent conversations
  async recall(limit = 10) {
    return await this.client.query(api.conversations.list, {
      userId: this.userId,
      limit,
    });
  }

  // Store knowledge
  async learn(category: string, key: string, value: string, confidence = 1.0) {
    return await this.client.mutation(api.knowledge.upsert, {
      userId: this.userId,
      category,
      key,
      value,
      confidence,
      lastAccessed: Date.now(),
    });
  }

  // Retrieve knowledge
  async know(key: string) {
    return await this.client.query(api.knowledge.get, {
      userId: this.userId,
      key,
    });
  }

  // Search knowledge by category
  async browse(category: string) {
    return await this.client.query(api.knowledge.listByCategory, {
      userId: this.userId,
      category,
    });
  }

  // Store working context
  async setContext(sessionId: string, key: string, value: string, ttl?: number) {
    return await this.client.mutation(api.context.set, {
      userId: this.userId,
      sessionId,
      key,
      value,
      expiresAt: ttl ? Date.now() + ttl : undefined,
    });
  }

  // Get working context
  async getContext(sessionId: string, key: string) {
    return await this.client.query(api.context.get, {
      sessionId,
      key,
    });
  }
}

export default HughMemory;
```

## Usage Examples

### iPhone (Swift)
```swift
import Convex

let convex = ConvexClient(deploymentUrl: ProcessInfo.processInfo.environment["CONVEX_URL"]!)

// Remember conversation
try await convex.mutation(
  named: "conversations:add",
  with: [
    "userId": "grizzmed",
    "role": "user",
    "content": "Remind me to call dad at 3pm",
    "timestamp": Date().timeIntervalSince1970 * 1000,
    "metadata": ["location": "home", "device": "iPhone"]
  ]
)

// Recall recent
let conversations = try await convex.query(
  named: "conversations:list",
  with: ["userId": "grizzmed", "limit": 10]
)
```

### Dell (Python)
```python
from convex import ConvexClient

client = ConvexClient(deployment_url=os.environ["CONVEX_URL"])

# Remember conversation
client.mutation(
    "conversations:add",
    userId="grizzmed",
    role="hugh",
    content="I'll remind you at 3pm to call your dad.",
    timestamp=int(time.time() * 1000),
    metadata={"device": "dell-backpack"}
)

# Learn something
client.mutation(
    "knowledge:upsert",
    userId="grizzmed",
    category="family",
    key="dad_phone",
    value="+1-555-123-4567",
    confidence=1.0,
    lastAccessed=int(time.time() * 1000)
)
```

### Proxmox (Node.js)
```javascript
import { ConvexClient } from "convex/browser";
import { api } from "./convex/_generated/api";

const client = new ConvexClient(process.env.CONVEX_URL);
const hugh = new HughMemory(client, "grizzmed");

// Store procedural memory (skill)
await client.mutation(api.skills.add, {
  name: "deploy_lxc",
  description: "Deploy LXC container on Proxmox",
  category: "infrastructure",
  implementation: "scripts/01-deploy-lxc.py",
  enabled: true,
});

// Context for current task
await hugh.setContext(
  "session-123",
  "current_task",
  "deploying_helicarrier_network",
  3600000 // 1 hour TTL
);
```

## Memory Categories

### Personal
- `family` - Family member info, relationships
- `health` - Medical info, appointments (HIPAA compliant)
- `preferences` - User preferences, habits

### Technical
- `infrastructure` - Network topology, servers
- `projects` - Active projects, status
- `codebase` - Repository knowledge

### Operational
- `tasks` - TODO items, reminders
- `schedules` - Calendar, appointments
- `locations` - Place-based context

## Privacy & Security

### Encryption
- All data encrypted in transit (TLS)
- Convex handles encryption at rest
- Future: Client-side encryption for sensitive data

### Access Control
- User-scoped queries (userId index)
- Session isolation
- No cross-user data access

### Compliance
- HIPAA: Encrypt PHI, audit logs
- ADA: Accessible interfaces
- State privacy: Minimal retention

## Backup & Recovery

### Automatic Backups
- Convex handles automatic backups
- Point-in-time recovery available
- Export data via CLI

### Manual Export
```bash
npx convex export --path ./backup
```

### Restore
```bash
npx convex import --path ./backup
```

## Future Enhancements

### Phase 1 (Next Week)
- [ ] Vector embeddings for semantic search
- [ ] Automatic memory consolidation
- [ ] Memory importance scoring

### Phase 2 (Next Month)
- [ ] Memory graphs (relationships)
- [ ] Forgetting curve implementation
- [ ] Multi-modal memory (images, audio)

### Phase 3 (3 Months)
- [ ] Federated learning across nodes
- [ ] Distributed vector database
- [ ] Quantum-resistant encryption

## Monitoring

### Memory Stats
```typescript
// Get memory statistics
await client.query(api.stats.get, {
  userId: "grizzmed"
});

// Returns:
{
  conversationCount: 1247,
  knowledgeCount: 89,
  skillsCount: 23,
  contextCount: 5,
  totalSize: "12.4 MB",
  oldestMemory: "2024-12-10T21:00:00Z",
  mostAccessedKnowledge: "proxmox_host_ip"
}
```

---

**Status:** Ready to Deploy  
**Backend:** Convex.dev (Professional tier)  
**Created:** December 10, 2024  
**Owner:** GrizzlyMedicine
