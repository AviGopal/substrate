/**
 * _forge-via-ias-executor.ts
 *
 * Option C step 1 wrapper: drive the forge end-to-end via VesselForgeHost
 * (repos/ias-executor-ts) instead of shelling out to `minibob --single`.
 *
 * The first concrete demonstration that ias-executor-ts can drive the forge
 * pipeline without minibob — pivoting away from minibob-as-god-object toward
 * ias-executor-ts as the canonical executor (vessels = pure TS, activities =
 * structured middle ground, LLMs = used only where reasoning is unavoidable).
 *
 * Spec: openspec/changes/2026-04-26-impulse-activity-loop/design.md §Phase 22
 *
 * Output contract: the wrapper bookends a single JSON block with sentinel
 * markers so the parent runner (test-forge-goal-completion.ts) can grep it
 * out of stdout without parsing arbitrary forge logs.
 *
 *   ===== IAS_FORGE_RESULT =====
 *   {"ok": true, "traceId": "...", "vesselDeployed": {...}, ...}
 *   ===== END_IAS_FORGE_RESULT =====
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... \
 *   METABOB_API_KEY=mb_... \
 *   TARGET_SHAPE=csv_dialect_detector \
 *   bun run validation/scripts/_forge-via-ias-executor.ts
 */

import { readFileSync } from "node:fs";
import { resolve as pathResolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { VesselForgeHost } from "../../repos/ias-executor-ts/src/examples/vessel-forge-host";
import {
  ConsoleEventSink,
  HttpTraceSink,
} from "../../repos/ias-executor-ts/src/examples/bun-host";
import type { LLMPort } from "../../repos/ias-executor-ts/src/ports";
import type {
  ActivityTemplate,
  ExecutionTrace,
  Impulse,
} from "../../repos/ias-executor-ts/src/ontology";

// ---------------------------------------------------------------------------
// Environment / configuration
// ---------------------------------------------------------------------------

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const METABOB_API_KEY = process.env.METABOB_API_KEY ?? "";
const ACTIVITY_API_URL = process.env.ACTIVITY_API_URL ?? "https://activity.metabob.com";
const DISCOVERY_URL = process.env.DISCOVERY_URL ?? "https://discovery.metabob.com";
// CONCEPT_DB_URL: forge resolvers query this for vessel-construction concepts.
// Default to canary concept-db; CONCEPT_DB_KEY is optional (best-effort).
const CONCEPT_DB_URL = process.env.CONCEPT_DB_URL ?? "https://concept.metabob.com";
const CONCEPT_DB_KEY = process.env.CONCEPT_DB_KEY ?? "";

const TARGET_SHAPE = process.env.TARGET_SHAPE ?? "csv_dialect_detector";
const VESSEL_GOAL =
  process.env.VESSEL_GOAL
  ?? `A vessel that produces impulses of shape '${TARGET_SHAPE}' on demand, with structured input/output schemas and authentication via identity-vessel JWT.`;

const DEPLOYMENT_WORKDIR = process.env.DEPLOYMENT_WORKDIR
  ?? "/home/avi/documents/work/exp-repo/metabob-devbob";

const PARENT_EXECUTION_ID = process.env.PARENT_EXECUTION_ID ?? "";
const PARENT_DEPTH = Number(process.env.PARENT_DEPTH ?? "0");

// ---------------------------------------------------------------------------
// Anthropic LLMPort (mirrors validation/scripts/test-22-forge-and-paths.ts:41-79)
// ---------------------------------------------------------------------------

class AnthropicLLMPort implements LLMPort {
  // claude-haiku for cost; forge resolvers don't need top-tier reasoning per
  // §Phase 22 — LLMs are scoped to spec composition + scaffold, not control flow.
  private readonly model = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";

  async generate(input: {
    prompt: string;
    systemPrompt?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: 4096,
      messages: [{ role: "user", content: input.prompt }],
    };
    if (input.systemPrompt) body.system = input.systemPrompt;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API ${res.status}: ${err.slice(0, 400)}`);
    }

    const data = (await res.json()) as { content: Array<{ type: string; text: string }> };
    return data.content.find((c) => c.type === "text")?.text ?? "";
  }
}

// ---------------------------------------------------------------------------
// Forge template loader (canonical path: deployment-synced minibob templates)
// ---------------------------------------------------------------------------

function loadForgeTemplate(): ActivityTemplate {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // Forge template lives only in the deployment-synced minibob tree (not in
  // repos/minibob); the super-repo's repos/minibob submodule predates it.
  const templatePath = pathResolve(
    __dirname,
    "..",
    "..",
    "repos",
    "deployment",
    "vessels",
    "minibob",
    "src",
    "embedded-templates",
    "forge-vessel-for-shape.json",
  );
  const raw = readFileSync(templatePath, "utf8");
  return JSON.parse(raw) as ActivityTemplate;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findImpulseByShape(
  trace: ExecutionTrace,
  host: VesselForgeHost,
  shape: string,
): Impulse | undefined {
  for (const task of trace.tasks) {
    for (const id of task.outputImpulseIds) {
      const impulse = host.runtime.store.get(id);
      if (impulse && (impulse.metadata.shape ?? impulse.pointer.type) === shape) {
        return impulse;
      }
    }
  }
  for (const id of trace.outputImpulseIds) {
    const impulse = host.runtime.store.get(id);
    if (impulse && (impulse.metadata.shape ?? impulse.pointer.type) === shape) {
      return impulse;
    }
  }
  return undefined;
}

function emitResult(payload: Record<string, unknown>): void {
  // Sentinel bookends — parent runner greps between them. Keep on their own lines.
  console.log("===== IAS_FORGE_RESULT =====");
  console.log(JSON.stringify(payload));
  console.log("===== END_IAS_FORGE_RESULT =====");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<number> {
  if (!ANTHROPIC_API_KEY) {
    emitResult({ ok: false, error: "ANTHROPIC_API_KEY not set", runtime: "ias-executor" });
    return 2;
  }
  if (!METABOB_API_KEY) {
    emitResult({ ok: false, error: "METABOB_API_KEY not set", runtime: "ias-executor" });
    return 2;
  }

  console.log(`[ias-forge] target_shape    = ${TARGET_SHAPE}`);
  console.log(`[ias-forge] vessel_goal     = ${VESSEL_GOAL.slice(0, 120)}${VESSEL_GOAL.length > 120 ? "..." : ""}`);
  console.log(`[ias-forge] activity_api    = ${ACTIVITY_API_URL}`);
  console.log(`[ias-forge] discovery_url   = ${DISCOVERY_URL}`);
  console.log(`[ias-forge] concept_db_url  = ${CONCEPT_DB_URL}`);
  console.log(`[ias-forge] parent_depth    = ${PARENT_DEPTH}`);

  const llm = new AnthropicLLMPort();
  const traceSink = new HttpTraceSink(ACTIVITY_API_URL, METABOB_API_KEY);
  const eventSink = new ConsoleEventSink();

  const host = new VesselForgeHost({
    llm,
    discoveryEndpoint: DISCOVERY_URL,
    eventSink,
    traceSink,
  });

  const template = loadForgeTemplate();
  console.log(`[ias-forge] template        = ${template.id} v${(template as any).version ?? "?"}`);

  // conceptDbEndpoint mirrors test-22-forge-and-paths.ts:169 — concept-db
  // authentication is currently passed as a ?apiKey= query string by the forge
  // resolvers.
  const conceptDbEndpoint = CONCEPT_DB_KEY
    ? `${CONCEPT_DB_URL}?apiKey=${CONCEPT_DB_KEY}`
    : CONCEPT_DB_URL;

  const t0 = Date.now();
  let trace: ExecutionTrace;
  try {
    trace = await host.execute(template, {
      variables: {
        vesselGoal: VESSEL_GOAL,
        missingShape: TARGET_SHAPE,
        parentExecutionId: PARENT_EXECUTION_ID,
        parentDepth: PARENT_DEPTH,
        conceptDbEndpoint,
        deploymentWorkdir: DEPLOYMENT_WORKDIR,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[ias-forge] EXCEPTION: ${msg}`);
    emitResult({
      ok: false,
      runtime: "ias-executor",
      error: msg,
      durationMs: Date.now() - t0,
    });
    return 1;
  }

  const durationMs = Date.now() - t0;
  const vesselVerified = findImpulseByShape(trace, host, "vesselVerified");
  const vesselDeployed = findImpulseByShape(trace, host, "vesselDeployedToCanary");
  const success = trace.status === "completed" && vesselVerified != null;

  const verifiedContent = (vesselVerified?.content ?? null) as any;
  const deployedContent = (vesselDeployed?.content ?? null) as any;

  emitResult({
    ok: success,
    runtime: "ias-executor",
    traceId: trace.id,
    templateId: trace.templateId,
    status: trace.status,
    durationMs,
    failureMode: trace.failureMode ?? null,
    vesselVerified: verifiedContent
      ? {
          vesselId: verifiedContent.vessel_id ?? verifiedContent.vesselId ?? null,
          endpoint: verifiedContent.endpoint ?? null,
          discovery: verifiedContent.discovery ?? null,
          observation: verifiedContent.observation ?? null,
          auth: verifiedContent.auth ?? null,
        }
      : null,
    vesselDeployed: deployedContent
      ? {
          imageTag: deployedContent.imageTag ?? deployedContent.image_tag ?? null,
          endpoint: deployedContent.endpoint ?? null,
        }
      : null,
    tasks: trace.tasks.map((t) => ({
      taskId: t.taskId,
      success: t.success,
      resolverId: t.resolverId,
      durationMs: t.durationMs,
      outputs: t.outputImpulseIds.length,
    })),
  });

  return success ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("[ias-forge] FATAL:", err);
    emitResult({
      ok: false,
      runtime: "ias-executor",
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  });
