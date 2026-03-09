import { v } from "convex/values";

import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export const get = query({
  args: { userId: v.string() },
  handler: async (ctx: QueryCtx, { userId }: { userId: string }) => {
    const [row] = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return (
      row ?? {
        userId,
        currentItemId: undefined,
        armedNextId: undefined,
        updatedAt: Date.now(),
      }
    );
  },
});

export const setCurrent = mutation({
  args: {
    userId: v.string(),
    currentItemId: v.optional(v.id("queueItems")),
  },
  handler: async (
    ctx: MutationCtx,
    {
      userId,
      currentItemId,
    }: { userId: string; currentItemId?: Id<"queueItems"> }
  ) => {
    const [row] = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (!row) {
      return ctx.db.insert("sessions", {
        userId,
        currentItemId,
        armedNextId: undefined,
        updatedAt: Date.now(),
      });
    }
    await ctx.db.patch(row._id, { currentItemId, updatedAt: Date.now() });
    return true;
  },
});

export const armNext = mutation({
  args: {
    userId: v.string(),
    armedNextId: v.optional(v.id("queueItems")),
  },
  handler: async (
    ctx: MutationCtx,
    {
      userId,
      armedNextId,
    }: { userId: string; armedNextId?: Id<"queueItems"> }
  ) => {
    const [row] = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (!row) {
      return ctx.db.insert("sessions", {
        userId,
        currentItemId: undefined,
        armedNextId,
        updatedAt: Date.now(),
      });
    }
    await ctx.db.patch(row._id, { armedNextId, updatedAt: Date.now() });
    return true;
  },
});
