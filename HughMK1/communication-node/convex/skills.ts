import { v } from "convex/values";

import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export const list = query({
  args: { userId: v.string() },
  handler: (ctx: QueryCtx, { userId }: { userId: string }) =>
    ctx.db
      .query("skills")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect(),
});

export const upsert = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    kind: v.string(),
    spec: v.string(),
  },
  handler: async (
    ctx: MutationCtx,
    args: { userId: string; name: string; kind: string; spec: string }
  ) => {
    const rows = await ctx.db
      .query("skills")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const match = rows.find((row) => row.name === args.name);
    if (!match) {
      return ctx.db.insert("skills", { ...args, createdAt: Date.now() });
    }
    await ctx.db.patch(match._id, { ...args });
    return match._id;
  },
});

export const remove = mutation({
  args: { userId: v.string(), id: v.id("skills") },
  handler: async (
    ctx: MutationCtx,
    { userId, id }: { userId: string; id: Id<"skills"> }
  ) => {
    const skill = await ctx.db.get(id);
    if (!skill || skill.userId !== userId) {
      return null;
    }
    await ctx.db.delete(id);
    return id;
  },
});
