import { randomUUID } from "crypto";
import { v } from "convex/values";

import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";

export const listThreads = query({
  args: { userId: v.string(), router: v.optional(v.string()) },
  handler: async (
    ctx: QueryCtx,
    { userId, router }: { userId: string; router?: string }
  ) => {
    const rows = await ctx.db
      .query("chats")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    return router ? rows.filter((row) => row.modelRouter === router) : rows;
  },
});

export const upsertThread = mutation({
  args: {
    userId: v.string(),
    router: v.string(),
    threadId: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (
    ctx: MutationCtx,
    {
      userId,
      router,
      threadId,
      name,
    }: {
      userId: string;
      router: string;
      threadId?: string;
      name?: string;
    }
  ) => {
    const tid = threadId ?? randomUUID();
    const rows = await ctx.db
      .query("chats")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    const match =
      rows.find(
        (row) => row.threadId === tid && row.modelRouter === router,
      ) ?? null;
    if (!match) {
      const insertedId = await ctx.db.insert("chats", {
        userId,
        threadId: tid,
        modelRouter: router,
        messages: [],
        updatedAt: Date.now(),
        name,
      });
      return { id: insertedId, threadId: tid };
    }
    await ctx.db.patch(match._id, { name: name ?? match.name });
    return { id: match._id, threadId: tid };
  },
});

export const append = mutation({
  args: {
    userId: v.string(),
    threadId: v.string(),
    router: v.string(),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("tool"),
    ),
    text: v.string(),
  },
  handler: async (
    ctx: MutationCtx,
    {
      userId,
      threadId,
      router,
      role,
      text,
    }: {
      userId: string;
      threadId: string;
      router: string;
      role: "user" | "assistant" | "tool";
      text: string;
    }
  ) => {
    const rows = await ctx.db
      .query("chats")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    let chat: (typeof rows)[number] | null =
      rows.find(
        (row) => row.threadId === threadId && row.modelRouter === router,
      ) ?? null;
    if (!chat) {
      const insertedId = await ctx.db.insert("chats", {
        userId,
        threadId,
        modelRouter: router,
        messages: [],
        updatedAt: Date.now(),
      });
      chat = await ctx.db.get(insertedId);
      if (!chat) {
        throw new Error("chat:insert_failed");
      }
    }
    const msg = {
      role,
      text,
      ts: Date.now(),
    };
    await ctx.db.patch(chat._id, {
      messages: [...chat.messages, msg],
      updatedAt: Date.now(),
    });
    return msg;
  },
});
