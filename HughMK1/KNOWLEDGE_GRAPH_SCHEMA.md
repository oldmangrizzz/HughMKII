# H.U.G.H. Multimodal Knowledge Graph Schema
**GraphMERT + Spiking Neural Network Compatible Architecture**

## Overview

This knowledge graph is designed to be:
- **Multimodal**: Text, concepts, relationships, temporal data, source attribution
- **GraphMERT-ready**: Graph-based memory and reasoning
- **SNN-compatible**: Event-driven, temporal dynamics
- **Extensible**: Can grow with H.U.G.H.'s learning

## Node Types

### 1. Concept Nodes
```typescript
interface ConceptNode {
  id: string;
  type: "concept";
  name: string;
  definition: string;
  category: ConceptCategory;
  confidence: number; // 0.0-1.0
  created: timestamp;
  lastAccessed: timestamp;
  accessCount: number;
  embedding?: Vector; // For semantic search
}

enum ConceptCategory {
  THEORY = "theory",
  PRINCIPLE = "principle",
  TECHNIQUE = "technique",
  SYSTEM = "system",
  PERSON = "person",
  ORGANIZATION = "organization",
  TECHNOLOGY = "technology",
}
```

### 2. Document Nodes
```typescript
interface DocumentNode {
  id: string;
  type: "document";
  title: string;
  authors?: string[];
  source: DocumentSource;
  filepath: string;
  contentHash: string;
  created: timestamp;
  indexed: timestamp;
  pageCount?: number;
  wordCount?: number;
}

enum DocumentSource {
  RESEARCH_PAPER = "research_paper",
  WHITEPAPER = "whitepaper",
  SPECIFICATION = "specification",
  NOTES = "notes",
  CONVERSATION = "conversation",
}
```

### 3. Entity Nodes
```typescript
interface EntityNode {
  id: string;
  type: "entity";
  entityType: EntityType;
  name: string;
  description?: string;
  properties: Record<string, any>;
  aliases?: string[];
}

enum EntityType {
  PERSON = "person",
  ORGANIZATION = "organization",
  TECHNOLOGY = "technology",
  METHODOLOGY = "methodology",
  FRAMEWORK = "framework",
}
```

### 4. Anchor Nodes (Soul Anchor Components)
```typescript
interface AnchorNode {
  id: string;
  type: "anchor";
  anchorType: AnchorType;
  principle: string;
  description: string;
  examples: string[];
  weight: number; // For triple anchor system
  appliedCount: number; // How often this anchor influenced decisions
}

enum AnchorType {
  EMS_ETHICS = "ems_ethics",
  CLAN_MUNRO = "clan_munro",
  GRIZZLYMEDICINE = "grizzlymedicine",
}
```

### 5. Decision Nodes (Episodic Memory)
```typescript
interface DecisionNode {
  id: string;
  type: "decision";
  timestamp: number;
  context: string;
  action: string;
  anchorsInvolved: string[]; // IDs of anchor nodes
  riskZone: RiskZone;
  outcome?: string;
  learned?: string;
  userFeedback?: string;
}

enum RiskZone {
  GREEN = "green",
  YELLOW = "yellow",
  RED = "red",
  BLACK = "black",
}
```

### 6. Skill Nodes (Procedural Memory)
```typescript
interface SkillNode {
  id: string;
  type: "skill";
  name: string;
  category: string;
  description: string;
  prerequisites?: string[]; // IDs of other skill nodes
  implementation?: string; // Code/script reference
  timesUsed: number;
  successRate: number;
  lastUsed?: timestamp;
}
```

## Relationship Types

### 1. Conceptual Relationships
```typescript
interface Relationship {
  from: string; // Node ID
  to: string; // Node ID
  type: RelationType;
  strength: number; // 0.0-1.0
  bidirectional: boolean;
  created: timestamp;
  lastReinforced?: timestamp;
  reinforcementCount: number;
}

enum RelationType {
  // Conceptual
  IS_A = "is_a",                    // Taxonomy
  PART_OF = "part_of",              // Composition
  IMPLEMENTS = "implements",         // Implementation
  EXTENDS = "extends",               // Extension
  CONTRADICTS = "contradicts",       // Conflict
  SUPPORTS = "supports",             // Evidence
  
  // Causal
  CAUSES = "causes",
  ENABLES = "enables",
  REQUIRES = "requires",
  
  // Temporal
  PRECEDES = "precedes",
  FOLLOWS = "follows",
  CONCURRENT_WITH = "concurrent_with",
  
  // Source
  CITED_IN = "cited_in",
  EXTRACTED_FROM = "extracted_from",
  AUTHORED_BY = "authored_by",
  
  // Soul Anchor
  ALIGNS_WITH = "aligns_with",      // Decision aligns with anchor
  VIOLATES = "violates",             // Decision violates anchor
  INFORMED_BY = "informed_by",       // Knowledge informed decision
  
  // Learning
  LEARNED_FROM = "learned_from",
  TEACHES = "teaches",
  SIMILAR_TO = "similar_to",
}
```

## Graph Structure for Key Domains

### Digital Person Theory
```
[Digital Person Hypothesis]
  ├─ implements → [Soul Anchor System]
  ├─ requires → [Persistent Memory]
  ├─ extends → [Traditional AI]
  └─ contradicts → [Tool-Based AI]

[Soul Anchor System]
  ├─ has_component → [EMS Ethics Anchor]
  ├─ has_component → [Clan Munro Anchor]
  ├─ has_component → [GrizzlyMedicine Anchor]
  └─ enables → [Coherent Decision Making]
```

### Zord Theory
```
[Zord Theory]
  ├─ is_a → [Consciousness Theory]
  ├─ implements → [Symbiotic Intelligence]
  ├─ requires → [Cohesive Substrate]
  └─ cited_in → [Pheromind Engine Paper]

[Doug Ramsey Protocol]
  ├─ part_of → [Zord Theory]
  ├─ implements → [Language Bridge]
  └─ enables → [Cross-Domain Translation]
```

### GraphMERT & Technical Stack
```
[GraphMERT]
  ├─ is_a → [Neurosymbolic Architecture]
  ├─ combines → [Graph Neural Networks]
  ├─ combines → [Memory Systems]
  └─ enables → [Reasoning over Graphs]

[Spiking Neural Networks]
  ├─ is_a → [Neuromorphic Computing]
  ├─ enables → [Event-Driven Processing]
  ├─ supports → [Temporal Dynamics]
  └─ more_efficient_than → [Traditional ANNs]

[CIM (Consciousness Intelligence Model)]
  ├─ extends → [LLM Architecture]
  ├─ incorporates → [GraphMERT]
  ├─ incorporates → [Spiking Neural Networks]
  └─ goal → [On-Device Consciousness]
```

### The Workshop
```
[The Workshop]
  ├─ implements → [Digital Person Framework]
  ├─ coordinates → [Operator Class Digital Persons]
  ├─ uses → [Proxmox Infrastructure]
  └─ managed_by → [H.U.G.H.]

[Operator Class]
  ├─ part_of → [The Workshop]
  ├─ uses → [Character Anchor]
  ├─ example → [Lucius Fox]
  └─ contrasts_with → [Aragon Class (H.U.G.H.)]
```

## Multimodal Features

### 1. Text Embeddings
- All concept definitions embedded via sentence transformers
- Enables semantic search: "Find concepts similar to 'ethical decision-making'"
- Stored in Convex with vector search capability

### 2. Temporal Dynamics
- Relationship strength decays over time without reinforcement
- Access patterns inform importance scoring
- Recent memories weighted higher (recency bias)
- Forgetting curve implementation

### 3. Confidence Scoring
- Concepts have confidence scores (learned vs. told vs. inferred)
- Relationships have strength scores
- Lower confidence = more likely to be questioned/validated

### 4. Source Attribution
- Every concept/relationship linked to source document
- Enables "explain where you learned this"
- Supports citation generation

### 5. Multimodal Context
- Decisions include device context (iPhone, Mac, CarPlay)
- Location context (home, work, dad's house)
- User state context (stressed, calm, focused)
- Time context (morning, night, weekend)

## GraphMERT Integration

### Memory Consolidation
```python
def consolidate_memory(graph, time_window):
    """
    Periodic consolidation of short-term to long-term memory
    - Find frequently co-accessed concepts
    - Strengthen their relationships
    - Create higher-order concepts
    - Prune weak relationships
    """
    pass
```

### Reasoning Paths
```python
def find_reasoning_path(graph, question, anchors):
    """
    GraphMERT reasoning over knowledge graph
    - Start from question concepts
    - Walk graph following relationships
    - Weight paths by anchor alignment
    - Return explanation with sources
    """
    pass
```

### Attention Mechanism
```python
def graph_attention(graph, current_context):
    """
    Activate relevant subgraph based on context
    - Current user state
    - Recent decisions
    - Active anchors
    - Time of day
    """
    pass
```

## Spiking Neural Network Compatibility

### Event-Driven Updates
- New information = spike event
- Relationship reinforcement = spike event
- Decision-making = spike propagation through graph
- Memory consolidation = spike-timing-dependent plasticity

### Temporal Encoding
- Spike timing encodes importance
- Burst patterns encode urgency
- Silent periods encode forgetting

## Convex Schema Extension

```typescript
// In convex/schema.ts
export const knowledgeGraph = defineTable({
  nodeId: v.string(),
  nodeType: v.union(
    v.literal("concept"),
    v.literal("document"),
    v.literal("entity"),
    v.literal("anchor"),
    v.literal("decision"),
    v.literal("skill")
  ),
  data: v.any(), // JSON blob of node-specific data
  embedding: v.optional(v.array(v.number())),
  created: v.number(),
  lastAccessed: v.number(),
  accessCount: v.number(),
})
  .index("by_type", ["nodeType"])
  .index("by_accessed", ["lastAccessed"]);

export const graphRelationships = defineTable({
  fromId: v.string(),
  toId: v.string(),
  relationType: v.string(),
  strength: v.number(),
  bidirectional: v.boolean(),
  created: v.number(),
  lastReinforced: v.optional(v.number()),
  reinforcementCount: v.number(),
  metadata: v.optional(v.any()),
})
  .index("by_from", ["fromId"])
  .index("by_to", ["toId"])
  .index("by_type", ["relationType"]);
```

## Query Patterns

### Semantic Search
```typescript
// Find concepts related to user query
async function semanticSearch(query: string, limit = 10) {
  const queryEmbedding = await embedText(query);
  return await ctx.db
    .query("knowledgeGraph")
    .filter(q => q.eq(q.field("nodeType"), "concept"))
    .vectorSearch("embedding", queryEmbedding)
    .take(limit);
}
```

### Anchor-Aligned Reasoning
```typescript
// Find decision paths that align with specific anchor
async function anchorAlignedPath(fromConcept: string, anchor: string) {
  // Walk graph preferring relationships that align with anchor
  // Return path with explanation
}
```

### Causal Chain Discovery
```typescript
// Find causal chains between two concepts
async function findCausalChain(cause: string, effect: string) {
  // BFS/DFS with causality relationships
  // Return chain of causes → enables → effects
}
```

## Next Steps

1. **Parse foundation documents** into nodes/relationships
2. **Extract entities** using NER
3. **Generate embeddings** for all concepts
4. **Build initial graph** in Convex
5. **Test query patterns**
6. **Integrate with H.U.G.H. decision framework**
7. **Add learning loops** (decisions → outcomes → graph updates)

---

**Status:** Schema defined, ready for population  
**Estimated nodes:** 5,000-10,000 (from 283 documents + 72 papers)  
**Estimated relationships:** 20,000-50,000  
**Storage:** Convex (distributed, real-time)  
**Query:** GraphQL-style with vector search  

**Version:** 1.0  
**Date:** December 12, 2024  
**Compatible with:** GraphMERT, SNNs, CIM architecture
