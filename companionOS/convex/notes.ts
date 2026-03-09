import { v } from "convex/values";

import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export const list = query({
  args: { userId: v.string() },
  handler: (ctx: QueryCtx, { userId }: { userId: string }) =>
    ctx.db
      .query("notes")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .collect(),
});

export const add = mutation({
  args: {
    userId: v.string(),
    text: v.string(),
    tags: v.optional(v.array(v.string())),
  },
  handler: (
    ctx: MutationCtx,
    {
      userId,
      text,
      tags,
    }: { userId: string; text: string; tags?: string[] }
  ) =>
    ctx.db.insert("notes", {
      userId,
      text,
      tags,
      createdAt: Date.now(),
    }),
});

export const remove = mutation({
  args: { userId: v.string(), id: v.id("notes") },
  handler: async (
    ctx: MutationCtx,
    { userId, id }: { userId: string; id: Id<"notes"> }
  ) => {
    const note = await ctx.db.get(id);
    if (!note || note.userId !== userId) {
      return null;
    }
    await ctx.db.delete(id);
    return id;
  },
});
