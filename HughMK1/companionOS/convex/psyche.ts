import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const updateState = mutation({
  args: {
    dopamine: v.number(),
    serotonin: v.number(),
    cortisol: v.number(),
    flags: v.object({
      defensive_posture: v.boolean(),
      high_motivation: v.boolean(),
      emotional_instability: v.boolean(),
      balanced_state: v.boolean(),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("psyche", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

export const getState = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("psyche").order("desc").first();
  },
});
