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
const VESSEL_ID = process.env.VESSEL_ID ?? "llm-resolver-vessel";
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

  const model = body.model ?? DEFAULT_MODEL;
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
  shapes: ["llmCompletion"],
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
