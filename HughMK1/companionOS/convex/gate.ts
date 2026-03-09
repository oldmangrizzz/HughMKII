import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const setGateState = mutation({
  args: {
    state: v.string(),
    reason: v.optional(v.string()),
    signature: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("gate", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

export const getGateState = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("gate").order("desc").first();
  },
});
