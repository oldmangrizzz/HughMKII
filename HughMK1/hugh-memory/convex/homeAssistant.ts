import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Log an inbound HA state-change event from H.U.G.H. runtime */
export const logHAEvent = mutation({
  args: {
    entityId: v.string(),
    state: v.string(),
    attributes: v.string(),   // JSON-stringified
    description: v.string(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("ha_events", {
      entityId: args.entityId,
      state: args.state,
      attributes: args.attributes,
      description: args.description,
      timestamp: args.timestamp,
    });
  },
});

/** Return the N most recent HA events */
export const getRecentHAEvents = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("ha_events")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);
  },
});

/** Return recent events for a specific entity */
export const getEntityHistory = query({
  args: {
    entityId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    return await ctx.db
      .query("ha_events")
      .withIndex("by_entityId", (q) => q.eq("entityId", args.entityId))
      .order("desc")
      .take(limit);
  },
});
