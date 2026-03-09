import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ── Existing tables ────────────────────────────────────────────────────────

  conversations: defineTable({
    userId: v.string(),
    sessionId: v.optional(v.string()),
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
    .index("by_timestamp", ["timestamp"])
    .index("by_session", ["sessionId"])
    .index("by_user_timestamp", ["userId", "timestamp"]),

  knowledge: defineTable({
    userId: v.string(),
    category: v.string(),
    key: v.string(),
    value: v.string(),
    confidence: v.number(),
    source: v.optional(v.string()),
    lastAccessed: v.number(),
    lastModified: v.number(),
    accessCount: v.number(),
    verified: v.boolean(),
  })
    .index("by_user_category", ["userId", "category"])
    .index("by_key", ["key"])
    .index("by_user_key", ["userId", "key"]),

  // ── Prism Protocol Workshop tables ─────────────────────────────────────────

  // 3D scene object state
  workshop_entities: defineTable({
    entityId: v.string(),
    type: v.union(
      v.literal("table"),
      v.literal("chair"),
      v.literal("screen"),
      v.literal("light"),
      v.literal("custom"),
    ),
    label: v.string(),
    positionX: v.number(),
    positionY: v.number(),
    positionZ: v.number(),
    rotationX: v.number(),
    rotationY: v.number(),
    rotationZ: v.number(),
    scaleX: v.number(),
    scaleY: v.number(),
    scaleZ: v.number(),
    color: v.string(),
    visible: v.boolean(),
    metadata: v.optional(v.object({
      description: v.optional(v.string()),
      createdBy: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
    })),
    // AR/MR anchor fields
    anchorId: v.optional(v.string()),           // WebXR persistent anchor UUID
    arPlaneId: v.optional(v.string()),          // detected surface plane ID
    realWorldPosition: v.optional(v.array(v.float64())), // position relative to physical room origin
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_type", ["type"])
    .index("by_createdAt", ["createdAt"]),

  // H.U.G.H. AR vision observation log
  ar_observations: defineTable({
    sessionId: v.string(),
    timestamp: v.float64(),
    frameDescription: v.string(),              // H.U.G.H.'s vision reasoning output
    detectedObjects: v.array(v.string()),      // objects H.U.G.H. identified in frame
    detectedPlanes: v.array(v.string()),       // plane types: floor, wall, table, ceiling
    operatorQuery: v.optional(v.string()),     // what the operator asked about the scene
    confidence: v.float64(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_timestamp", ["timestamp"]),

  // Ambient / global scene state — one record per session
  workshop_environment: defineTable({
    sessionId: v.string(),
    ambientColor: v.string(),
    ambientIntensity: v.number(),
    healthStatus: v.union(
      v.literal("nominal"),
      v.literal("warning"),
      v.literal("critical"),
    ),
    activeUsers: v.array(v.string()),
    voiceCommandHistory: v.optional(v.array(v.object({
      command: v.string(),
      result: v.string(),
      timestamp: v.number(),
    }))),
    updatedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"]),

  // Bio-digital feedback events
  somatic_telemetry: defineTable({
    eventType: v.union(
      v.literal("latency"),
      v.literal("data_corruption"),
      v.literal("context_pressure"),
      v.literal("high_cpu"),
      v.literal("crash_recovery"),
    ),
    systemMetric: v.string(),
    somaticState: v.string(),
    severity: v.union(
      v.literal("low"),
      v.literal("moderate"),
      v.literal("high"),
      v.literal("critical"),
    ),
    operationalConsequence: v.string(),
    timestamp: v.number(),
    resolved: v.boolean(),
    metadata: v.optional(v.object({})),
  })
    .index("by_eventType", ["eventType"])
    .index("by_timestamp", ["timestamp"])
    .index("by_severity", ["severity"]),

  // Immutable operator oversight log (HOTL — Human On The Loop)
  hotl_audit_log: defineTable({
    agentId: v.string(),
    actionType: v.union(
      v.literal("tool_call"),
      v.literal("mcp_execution"),
      v.literal("database_mutation"),
      v.literal("inter_agent_comm"),
      v.literal("decision"),
      v.literal("veto"),
    ),
    actionDescription: v.string(),
    toolName: v.optional(v.string()),
    payload: v.optional(v.string()),
    result: v.optional(v.string()),
    dialecticalReasoning: v.optional(v.string()),
    riskZone: v.union(
      v.literal("green"),
      v.literal("yellow"),
      v.literal("red"),
      v.literal("black"),
    ),
    requiresReview: v.boolean(),
    operatorAcknowledged: v.boolean(),
    timestamp: v.number(),
  })
    .index("by_agentId", ["agentId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_actionType", ["actionType"])
    .index("by_requiresReview", ["requiresReview"]),

  // Roger Roger inter-agent communication queue
  agent_comms: defineTable({
    fromAgent: v.string(),
    toAgent: v.string(),
    messageType: v.union(
      v.literal("request"),
      v.literal("response"),
      v.literal("broadcast"),
      v.literal("alert"),
    ),
    subject: v.string(),
    content: v.string(),
    routingProtocol: v.union(
      v.literal("matrix_synapse"),
      v.literal("postfix"),
      v.literal("livekit"),
      v.literal("helicarrier"),
    ),
    status: v.union(
      v.literal("queued"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("failed"),
    ),
    operatorVisible: v.boolean(),
    timestamp: v.number(),
    deliveredAt: v.optional(v.number()),
  })
    .index("by_fromAgent", ["fromAgent"])
    .index("by_toAgent", ["toAgent"])
    .index("by_timestamp", ["timestamp"])
    .index("by_status", ["status"]),

  // Infrastructure monitoring → Workshop ambient lighting
  server_health: defineTable({
    nodeId: v.string(),
    nodeName: v.string(),
    nodeType: v.union(
      v.literal("proxmox_vm"),
      v.literal("proxmox_lxc"),
      v.literal("hostinger_vps"),
      v.literal("convex"),
    ),
    cpuPercent: v.number(),
    memoryPercent: v.number(),
    latencyMs: v.number(),
    status: v.union(
      v.literal("healthy"),
      v.literal("warning"),
      v.literal("critical"),
      v.literal("down"),
    ),
    somaticTrigger: v.optional(v.string()),
    workshopLightColor: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_nodeId", ["nodeId"])
    .index("by_status", ["status"])
    .index("by_timestamp", ["timestamp"]),

  // Home Assistant state change events — physical world → Workshop ambient
  ha_events: defineTable({
    entityId: v.string(),                    // e.g. "light.living_room", "sensor.front_door"
    state: v.string(),                       // new state value
    attributes: v.optional(v.string()),      // JSON-stringified HA attributes
    description: v.optional(v.string()),     // H.U.G.H.-generated event summary
    domain: v.string(),                      // e.g. "light", "switch", "sensor", "binary_sensor"
    processed: v.boolean(),                  // has H.U.G.H. acted on this event
    timestamp: v.number(),
  })
    .index("by_entityId", ["entityId"])
    .index("by_domain", ["domain"])
    .index("by_timestamp", ["timestamp"])
    .index("by_processed", ["processed"]),
});
