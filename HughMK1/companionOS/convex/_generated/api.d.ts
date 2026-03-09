/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as chats from "../chats.js";
import type * as gate from "../gate.js";
import type * as logs from "../logs.js";
import type * as notes from "../notes.js";
import type * as psyche from "../psyche.js";
import type * as queue from "../queue.js";
import type * as sessions from "../sessions.js";
import type * as settings from "../settings.js";
import type * as skills from "../skills.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  chats: typeof chats;
  gate: typeof gate;
  logs: typeof logs;
  notes: typeof notes;
  psyche: typeof psyche;
  queue: typeof queue;
  sessions: typeof sessions;
  settings: typeof settings;
  skills: typeof skills;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
