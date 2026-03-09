import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const log = mutation({
  args: {
    source: v.string(),
    level: v.string(),
    message: v.string(),
    context: v.optional(v.any()),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("logs", args);
  },
});

export const getLogs = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    return await ctx.db
      .query("logs")
      .withIndex("by_source_timestamp")
      .order("desc")
      .take(limit);
  },
});
