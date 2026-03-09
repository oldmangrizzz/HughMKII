import { v } from "convex/values";

import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";

type DefaultSettings = {
  userId: string;
  skipForwardSec: number;
  skipBackwardSec: number;
  autoNext: boolean;
  defaultThreads: Record<string, string>;
};

const DEFAULT_SETTINGS: Omit<DefaultSettings, "userId"> = {
  skipForwardSec: 15,
  skipBackwardSec: 15,
  autoNext: true,
  defaultThreads: {},
};

export const get = query({
  args: { userId: v.string() },
  handler: async (ctx: QueryCtx, { userId }: { userId: string }) => {
    const [row] = await ctx.db
      .query("settings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return (
      row ?? {
        userId,
        ...DEFAULT_SETTINGS,
      }
    );
  },
});

export const upsert = mutation({
  args: {
    userId: v.string(),
    skipForwardSec: v.number(),
    skipBackwardSec: v.number(),
    autoNext: v.boolean(),
  },
  handler: async (
    ctx: MutationCtx,
    args: {
      userId: string;
      skipForwardSec: number;
      skipBackwardSec: number;
      autoNext: boolean;
    }
  ) => {
    const [row] = await ctx.db
      .query("settings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    if (!row) {
      return ctx.db.insert("settings", { ...DEFAULT_SETTINGS, ...args });
    }
    await ctx.db.patch(row._id, args);
    return true;
  },
});

export const setDefaultThread = mutation({
  args: {
    userId: v.string(),
    router: v.string(),
    threadId: v.string(),
  },
  handler: async (
    ctx: MutationCtx,
    {
      userId,
      router,
      threadId,
    }: { userId: string; router: string; threadId: string }
  ) => {
    const [row] = await ctx.db
      .query("settings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (!row) {
      return ctx.db.insert("settings", {
        userId,
        ...DEFAULT_SETTINGS,
        defaultThreads: { [router]: threadId },
      });
    }
    const defaults = { ...(row.defaultThreads ?? {}) };
    defaults[router] = threadId;
    await ctx.db.patch(row._id, { defaultThreads: defaults });
    return defaults;
  },
});
