import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
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
    state: v.string(),
    reason: v.optional(v.string()),
    signature: v.optional(v.string()),
    timestamp: v.number(),
  }).index("by_timestamp", ["timestamp"]),
});
