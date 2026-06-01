/**
 * llm-resolver-vessel — standalone LLM resolver vessel (port 8220).
 *
 * Spec: openspec/changes/2026-05-23-substrate-explicit-vessels Phase 2, tasks 2.1–2.3.
 *
 * Advertises shape: llmCompletion
 * Registers with discovery-vessel at http://127.0.0.1:8100
 *
 * Resolver contract:
 *   POST /resolve
 *   { "type": "llm_completion", "prompt": string, "model"?: string,
 *     "max_tokens"?: number, "system"?: string }
 *
 *   Response:
 *   { "resolved": true, "shape": "llmCompletion",
 *     "content": string, "usage": { "input_tokens": number, "output_tokens": number } }
 *
 * ANTHROPIC_API_KEY is read from the environment (supplied via
 * EnvironmentFile=/etc/substrate/env in the systemd unit).
 * The vessel starts even without an API key — it logs a warning and
 * returns an error response on any resolve call.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  ActivityExecutor,
  ExecutionRuntime,
  VesselDaemon,
} from "@avigopal/ias-executor-ts";
import type { ResolverHandler } from "@avigopal/ias-executor-ts";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? "8220", 10);
const VESSEL_ID = process.env.LLM_RESOLVER_VESSEL_ID ?? process.env.VESSEL_ID ?? "llm-resolver-vessel";
const DISCOVERY_ENDPOINT = process.env.DISCOVERY_VESSEL_ENDPOINT ?? "http://127.0.0.1:8100";
const API_KEY = process.env.LLM_RESOLVER_VESSEL_API_KEY ?? process.env.METABOB_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DEFAULT_MODEL = process.env.LLM_DEFAULT_MODEL ?? "claude-sonnet-4-20250514";
const DEFAULT_MAX_TOKENS = 4096;

// ─────────────────────────────────────────────────────────────────────────────
// Anthropic client (lazy — warn at startup if key absent; fail at resolve time)
// ─────────────────────────────────────────────────────────────────────────────

let anthropic: Anthropic | null = null;

if (!ANTHROPIC_API_KEY) {
  console.warn(
    "[llm-resolver-vessel] ANTHROPIC_API_KEY is not set. " +
    "llm_completion resolver will return errors until the key is provided.",
  );
} else {
  anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
}

// ─────────────────────────────────────────────────────────────────────────────
// llm_completion resolver
// ─────────────────────────────────────────────────────────────────────────────

interface LlmCompletionRequest {
  type: "llm_completion";
  prompt: string;
  model?: string;
  max_tokens?: number;
  system?: string;
}

const llmCompletionHandler: ResolverHandler = async (ctx) => {
  if (!anthropic) {
    return {
      resolved: false,
      shape: "llmCompletion",
      error: "ANTHROPIC_API_KEY not configured on llm-resolver-vessel",
    };
  }

  const body = ctx.body as LlmCompletionRequest;

  if (!body.prompt || typeof body.prompt !== "string") {
    return {
      resolved: false,
      shape: "llmCompletion",
      error: "Request body must include a non-empty 'prompt' string field",
    };
  }

  // Normalize model id: callers send "anthropic/claude-..." (provider-prefixed)
  // but the Anthropic SDK expects bare names like "claude-haiku-4-5-20251001".
  // Strip the leading "anthropic/" if present. Defensive — broader provider
  // routing would live in a fleet selector, not here.
  const rawModel = body.model ?? DEFAULT_MODEL;
  const model = rawModel.startsWith("anthropic/") ? rawModel.slice("anthropic/".length) : rawModel;
  const maxTokens = body.max_tokens ?? DEFAULT_MAX_TOKENS;

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      ...(body.system ? { system: body.system } : {}),
      messages: [{ role: "user", content: body.prompt }],
    });

    const content = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { type: "text"; text: string }).text)
      .join("");

    return {
      resolved: true,
      shape: "llmCompletion",
      content,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[llm-resolver-vessel] llm_completion error:", message);
    return {
      resolved: false,
      shape: "llmCompletion",
      error: message,
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ActivityExecutor (minimal — llm-resolver-vessel does not run activities
// itself; the executor is required by VesselDaemon's constructor but the
// /run-goal endpoint is not used by this vessel)
// ─────────────────────────────────────────────────────────────────────────────

const runtime = new ExecutionRuntime({
  attachedVessels: [
    { id: VESSEL_ID, kind: "custom" as never, resolverIds: ["llm_completion"] },
  ],
});

const executor = new ActivityExecutor(runtime);

// ─────────────────────────────────────────────────────────────────────────────
// VesselDaemon
// ─────────────────────────────────────────────────────────────────────────────

const resolvers = new Map<string, ResolverHandler>([
  ["llm_completion", llmCompletionHandler],
]);

const daemon = new VesselDaemon({
  port: PORT,
  vesselId: VESSEL_ID,
  vesselName: "LLM Resolver Vessel",
  // Advertise BOTH names. The handler is registered as `llm_completion`
  // (snake_case, line 145) so that's what discovery clients must POST to
  // /resolve with `pointer.type`. Older callers query discovery for the
  // camelCase `llmCompletion` — keep both advertised so neither shape-name
  // convention breaks. Without this dual advertisement, discovery-routed
  // LLM calls have been silently failing for the entire substrate
  // (53 traces with 0/0 tokens during goal[7]'s exec_x19p0558 confirmed
  // the gap — every llm-touching task across slot-binding,
  // create-shape-provider-goal, validator-dispatch, draft-gap-closing-
  // activity, and try-direct-answer was reaching no LLM).
  shapes: ["llm_completion", "llmCompletion"],
  executor,
  resolvers,
  discoveryEndpoint: DISCOVERY_ENDPOINT,
  apiKey: API_KEY,
  version: "0.1.0",
  enforceCompositionChain: false,
});

await daemon.start();

console.log(
  `[llm-resolver-vessel] started on port ${PORT}` +
  ` | discovery: ${DISCOVERY_ENDPOINT}` +
  ` | anthropic: ${anthropic ? "configured" : "MISSING KEY"}`,
);

// ─────────────────────────────────────────────────────────────────────────────
// Iteration 9 of the cross-vessel OOM hunt — periodic Bun.gc(true) workaround.
// See: concept_T-CTTOEl97IM (description), concept_s9ye5GKLw2L8 (signature),
//      concept_9ldsmRgqSTd5 (iter-6 derivation in goal-host-vessel).
//
// Hypothesis: Bun 1.3.14 retains heap-arena pages after free; affected vessels
// show RSS growth disconnected from heapUsed. goal-host hit OOM first because
// of its event volume; per iter-9 we apply the same workaround substrate-wide.
// A periodic forced full GC bounds RSS without changing semantics.
//
// .unref() so the timer doesn't prevent process exit.
// ─────────────────────────────────────────────────────────────────────────────
const GC_INTERVAL_MS = parseInt(process.env.LLM_RESOLVER_GC_INTERVAL_MS ?? "30000", 10);
interface BunGlobal { Bun?: { gc?: (force: boolean) => number } }
const bunGlobal = globalThis as unknown as BunGlobal;
setInterval(() => {
  const gc = bunGlobal.Bun?.gc;
  if (typeof gc === "function") {
    try {
      const freed = gc(true);
      const rssMB = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
      console.log(`[gc-tick] vessel=llm-resolver-vessel freed=${freed}B rss_after=${rssMB}MB`);
    } catch (err) {
      console.warn(`[gc-tick] Bun.gc failed: ${(err as Error).message}`);
    }
  }
}, GC_INTERVAL_MS).unref();
