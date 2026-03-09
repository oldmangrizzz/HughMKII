import {
  defineSchema,
  defineTable,
  type DataModelFromSchemaDefinition,
} from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
  queueItems: defineTable({
    userId: v.string(),
    source: v.string(),
    originalURL: v.string(),
    normalizedURL: v.string(),
    videoId: v.optional(v.string()),
    title: v.string(),
    thumbnailURL: v.optional(v.string()),
    duration: v.optional(v.number()),
    addedAt: v.number(),
    tags: v.optional(v.array(v.string())),
  }).index("by_user_added", ["userId", "addedAt"]),
  settings: defineTable({
    userId: v.string(),
    skipForwardSec: v.number(),
    skipBackwardSec: v.number(),
    autoNext: v.boolean(),
    defaultThreads: v.optional(v.record(v.string(), v.string())),
  }).index("by_user", ["userId"]),
  sessions: defineTable({
    userId: v.string(),
    currentItemId: v.optional(v.id("queueItems")),
    armedNextId: v.optional(v.id("queueItems")),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
  chats: defineTable({
    userId: v.string(),
    threadId: v.string(),
    modelRouter: v.string(),
    messages: v.array(
      v.object({
        role: v.union(
          v.literal("user"),
          v.literal("assistant"),
          v.literal("tool"),
        ),
        text: v.string(),
        ts: v.number(),
      }),
    ),
    name: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_user_updated", ["userId", "updatedAt"]),
  notes: defineTable({
    userId: v.string(),
    text: v.string(),
    createdAt: v.number(),
    tags: v.optional(v.array(v.string())),
  }).index("by_user_created", ["userId", "createdAt"]),
  skills: defineTable({
    userId: v.string(),
    name: v.string(),
    kind: v.string(),
    spec: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),
  logs: defineTable({
    source: v.string(),
    level: v.string(),
    message: v.string(),
    context: v.optional(v.any()),
    timestamp: v.number(),
  }).index("by_source_timestamp", ["source", "timestamp"]),
  psyche: defineTable({
    dopamine: v.number(),
    serotonin: v.number(),
    cortisol: v.number(),
    flags: v.object({
      defensive_posture: v.boolean(),
      high_motivation: v.boolean(),
      emotional_instability: v.boolean(),
      balanced_state: v.boolean(),
    }),
    timestamp: v.number(),
  }).index("by_timestamp", ["timestamp"]),
  gate: defineTable({
    state: v.string(), // EMERGENT, TALK_ONLY, SHUTDOWN, LOCKED
    reason: v.optional(v.string()),
    signature: v.optional(v.string()),
    timestamp: v.number(),
  }).index("by_timestamp", ["timestamp"]),
});

export default schema;

export type CompanionDataModel = DataModelFromSchemaDefinition<typeof schema>;
