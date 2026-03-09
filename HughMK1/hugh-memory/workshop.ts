import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ── Mutations ─────────────────────────────────────────────────────────────────

/** Insert or update a Workshop 3D entity by entityId. */
export const upsertWorkshopEntity = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("workshop_entities")
      .filter((q) => q.eq(q.field("entityId"), args.entityId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }
    return ctx.db.insert("workshop_entities", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Remove a Workshop entity by its entityId string. */
export const deleteWorkshopEntity = mutation({
  args: { entityId: v.string() },
  handler: async (ctx, { entityId }) => {
    const entity = await ctx.db
      .query("workshop_entities")
      .filter((q) => q.eq(q.field("entityId"), entityId))
      .first();
    if (entity) {
      await ctx.db.delete(entity._id);
      return { deleted: true };
    }
    return { deleted: false };
  },
});

/**
 * Upsert the ambient environment state for a session.
 * Pass workshopLightColor to override ambientColor directly from server health.
 */
export const updateEnvironmentHealth = mutation({
  args: {
    sessionId: v.string(),
    healthStatus: v.union(
      v.literal("nominal"),
      v.literal("warning"),
      v.literal("critical"),
    ),
    ambientColor: v.optional(v.string()),
    ambientIntensity: v.optional(v.number()),
    activeUsers: v.optional(v.array(v.string())),
    workshopLightColor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("workshop_environment")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    const resolvedColor = args.workshopLightColor ?? args.ambientColor ?? "#ffffff";

    if (existing) {
      await ctx.db.patch(existing._id, {
        healthStatus: args.healthStatus,
        ambientColor: resolvedColor,
        ...(args.ambientIntensity !== undefined && { ambientIntensity: args.ambientIntensity }),
        ...(args.activeUsers !== undefined && { activeUsers: args.activeUsers }),
        updatedAt: now,
      });
      return existing._id;
    }
    return ctx.db.insert("workshop_environment", {
      sessionId: args.sessionId,
      healthStatus: args.healthStatus,
      ambientColor: resolvedColor,
      ambientIntensity: args.ambientIntensity ?? 1.0,
      activeUsers: args.activeUsers ?? [],
      updatedAt: now,
    });
  },
});

/** Record a somatic telemetry event triggered by a system metric. */
export const logSomaticEvent = mutation({
  args: {
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
    metadata: v.optional(v.object({})),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("somatic_telemetry", {
      ...args,
      timestamp: Date.now(),
      resolved: false,
    });
  },
});

/** Append an immutable entry to the HOTL audit log. */
export const logHOTLAction = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("hotl_audit_log", {
      ...args,
      operatorAcknowledged: false,
      timestamp: Date.now(),
    });
  },
});

/** Enqueue an inter-agent message (Roger Roger Protocol). */
export const queueAgentComm = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("agent_comms", {
      ...args,
      status: "queued",
      operatorVisible: true, // Roger Roger Protocol — always visible
      timestamp: Date.now(),
    });
  },
});

/** Insert or replace the latest health snapshot for a node. */
export const updateServerHealth = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("server_health", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

// ── Queries ───────────────────────────────────────────────────────────────────

/** Return all visible Workshop entities. */
export const getWorkshopEntities = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("workshop_entities")
      .filter((q) => q.eq(q.field("visible"), true))
      .collect();
  },
});

/** Return the current environment state for a session. */
export const getEnvironmentState = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    return ctx.db
      .query("workshop_environment")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .first();
  },
});

/** Return queued messages destined for a specific agent. */
export const getPendingAgentComms = query({
  args: { toAgent: v.string() },
  handler: async (ctx, { toAgent }) => {
    return ctx.db
      .query("agent_comms")
      .withIndex("by_toAgent", (q) => q.eq("toAgent", toAgent))
      .filter((q) => q.eq(q.field("status"), "queued"))
      .collect();
  },
});

/** Return the N most recent somatic telemetry events (default 20). */
export const getRecentSomaticEvents = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    return ctx.db
      .query("somatic_telemetry")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit ?? 20);
  },
});

/** Return HOTL audit entries that require operator review and are unacknowledged. */
export const getUnacknowledgedHOTLActions = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("hotl_audit_log")
      .withIndex("by_requiresReview", (q) => q.eq("requiresReview", true))
      .filter((q) => q.eq(q.field("operatorAcknowledged"), false))
      .collect();
  },
});

/** Return the latest health snapshot per node (most recent timestamp per nodeId). */
export const getServerHealthStatus = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("server_health")
      .withIndex("by_timestamp")
      .order("desc")
      .take(50);
  },
});

// ── AR / Mixed-Reality ────────────────────────────────────────────────────────

/** Log a H.U.G.H. vision observation from an AR session frame. */
export const logARObservation = mutation({
  args: {
    sessionId: v.string(),
    frameDescription: v.string(),
    detectedObjects: v.array(v.string()),
    detectedPlanes: v.array(v.string()),
    operatorQuery: v.optional(v.string()),
    confidence: v.float64(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("ar_observations", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

/** Return the 10 most recent AR observations, newest first. */
export const getRecentObservations = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("ar_observations")
      .withIndex("by_timestamp")
      .order("desc")
      .take(10);
  },
});
