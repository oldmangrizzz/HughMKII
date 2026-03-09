import { v } from "convex/values";

import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx: QueryCtx, { userId }: { userId: string }) =>
    ctx.db
      .query("queueItems")
      .withIndex("by_user_added", (q) => q.eq("userId", userId))
      .order("asc")
      .collect(),
});

export const add = mutation({
  args: {
    userId: v.string(),
    source: v.string(),
    originalURL: v.string(),
    normalizedURL: v.string(),
    videoId: v.optional(v.string()),
    title: v.string(),
    thumbnailURL: v.optional(v.string()),
    duration: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx: MutationCtx, args) =>
    ctx.db.insert("queueItems", { ...args, addedAt: Date.now() }),
});

export const remove = mutation({
  args: { userId: v.string(), id: v.id("queueItems") },
  handler: async (
    ctx: MutationCtx,
    { userId, id }: { userId: string; id: Id<"queueItems"> }
  ) => {
    const doc = await ctx.db.get(id);
    if (!doc || doc.userId !== userId) {
      return null;
    }
    await ctx.db.delete(id);
    return id;
  },
});

export const move = mutation({
  args: { userId: v.string(), orderedIds: v.array(v.id("queueItems")) },
  handler: async (
    ctx: MutationCtx,
    { userId, orderedIds }: {
      userId: string;
      orderedIds: Id<"queueItems">[];
    }
  ) => {
    const base = Date.now();
    for (let i = 0; i < orderedIds.length; i += 1) {
      const id = orderedIds[i];
      const row = await ctx.db.get(id);
      if (row && row.userId === userId) {
        await ctx.db.patch(id, { addedAt: base + i });
      }
    }
    return true;
  },
});
