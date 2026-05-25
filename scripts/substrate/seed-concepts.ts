#!/usr/bin/env bun
/**
 * seed-concepts.ts — POST the 24 Phase-22.S2 seed concepts to concept-db.
 *
 * Idempotent: skips if concepts are already seeded (checks count by source_type).
 *
 * Usage: bun /vessels/seed-concepts.ts
 *   (called by concept-db-seeder.service after concept-db is healthy)
 */

const CONCEPT_DB_URL = process.env.CONCEPT_DB_URL ?? "http://127.0.0.1:8260";
const API_KEY = process.env.METABOB_API_KEY ?? process.env.CONCEPT_DB_API_KEY ?? "";

const log = {
  info: (...a: unknown[]) => console.log("[seed-concepts]", ...a),
  warn: (...a: unknown[]) => console.warn("[seed-concepts] WARN", ...a),
  error: (...a: unknown[]) => console.error("[seed-concepts] ERROR", ...a),
};

interface SeedConcept {
  source_type: "vessel_construction_pattern" | "impulse_activity_pattern";
  shape: string;
  content: string;
  metadata?: Record<string, unknown>;
}

const VESSEL_CONSTRUCTION_CONCEPTS: SeedConcept[] = [
  {
    source_type: "vessel_construction_pattern",
    shape: "vessel_discovery_registration",
    content: "Vessels register with discovery-vessel on startup using DiscoveryRegistrationLoop. Required fields: vesselId, vesselName, discoveryEndpoint, apiKey, port, resolveEndpoint, shapes. Set systemVessel:true for substrate vessels without orgId. Heartbeat every 60s; deregister on SIGTERM.",
    metadata: { tag: "vessel-construction.discovery", source_doc: "TYPESCRIPT_VESSEL_TEMPLATE.md" },
  },
  {
    source_type: "vessel_construction_pattern",
    shape: "vessel_auth_apikey",
    content: "Vessels authenticate with Authorization: ApiKey <key> headers. Keys are issued by identity-vessel /v1/keys/issue. Validate by calling identity-vessel /v1/auth/resolve, not by checking keys locally. All mutation endpoints require auth; health endpoints are public.",
    metadata: { tag: "vessel-construction.auth", source_doc: "TYPESCRIPT_VESSEL_TEMPLATE.md" },
  },
  {
    source_type: "vessel_construction_pattern",
    shape: "vessel_health_endpoint",
    content: "Every vessel exposes GET /health returning { status: 'healthy', service: '<name>', version: '<semver>' }. The endpoint is public (no auth). Health checks are used by systemd, Kubernetes, and the substrate status target.",
    metadata: { tag: "vessel-construction.health", source_doc: "TYPESCRIPT_VESSEL_TEMPLATE.md" },
  },
  {
    source_type: "vessel_construction_pattern",
    shape: "vessel_bun_serve",
    content: "Substrate vessels use Bun.serve({ port, fetch }) for their HTTP server. The fetch handler routes by pathname. PORT and HOST come from environment variables. Server starts after discovery registration.",
    metadata: { tag: "vessel-construction.runtime", source_doc: "TYPESCRIPT_VESSEL_TEMPLATE.md" },
  },
  {
    source_type: "vessel_construction_pattern",
    shape: "vessel_resolver_server",
    content: "Vessels expose POST /resolve (the discovery resolver contract). Request body: { impulse: { pointer: { type: '<shape>', ...fields } } }. Response: { success: boolean, loaded: boolean, content: string }. ResolverServer from ias-executor-ts handles routing by pointer.type.",
    metadata: { tag: "vessel-construction.resolver", source_doc: "TYPESCRIPT_VESSEL_TEMPLATE.md" },
  },
  {
    source_type: "vessel_construction_pattern",
    shape: "vessel_graceful_shutdown",
    content: "Handle SIGTERM and SIGINT: call discovery.stop() to deregister, stop the HTTP server, exit 0. Use async handlers. Avoid process.exit(1) on normal shutdown. Ensure in-flight requests drain before stop.",
    metadata: { tag: "vessel-construction.lifecycle", source_doc: "TYPESCRIPT_VESSEL_TEMPLATE.md" },
  },
  {
    source_type: "vessel_construction_pattern",
    shape: "vessel_systemd_unit",
    content: "Each substrate vessel has a systemd unit under scripts/substrate/units/. Pattern: After=activity-api.service discovery-vessel.service identity-vessel.service; Requires=activity-api.service; EnvironmentFile=/etc/substrate/env; EnvironmentFile=-/etc/substrate/<vessel>.env; Restart=on-failure; RestartSec=5.",
    metadata: { tag: "vessel-construction.systemd", source_doc: "TYPESCRIPT_VESSEL_TEMPLATE.md" },
  },
  {
    source_type: "vessel_construction_pattern",
    shape: "vessel_env_config",
    content: "Config comes from environment variables with defaults. Required vars: VESSEL_ID, PORT, DISCOVERY_VESSEL_ENDPOINT, METABOB_API_KEY, ACTIVITY_API_ENDPOINT. Optional per-vessel keys fall back to METABOB_API_KEY. Never hardcode endpoints.",
    metadata: { tag: "vessel-construction.config", source_doc: "TYPESCRIPT_VESSEL_TEMPLATE.md" },
  },
  {
    source_type: "vessel_construction_pattern",
    shape: "vessel_execution_observer",
    content: "Vessels that react to execution events subscribe to activity-api WebSocket at <ACTIVITY_API_ENDPOINT>/ws. Handshake: { type: 'authenticate', token: apiKey }. Catchup on reconnect: { type: 'catchup', lastSeenSequence: n }. Use exponential backoff 1s→30s for reconnect.",
    metadata: { tag: "vessel-construction.observation", source_doc: "TYPESCRIPT_VESSEL_TEMPLATE.md" },
  },
  {
    source_type: "vessel_construction_pattern",
    shape: "vessel_daemon_scaffold",
    content: "For new substrate vessels, use VesselDaemon from @avigopal/ias-executor-ts. Composes ActivityExecutor + DiscoveryRegistrationLoop + ResolverServer. Pass shapes and resolver functions in config. Call daemon.start() after configuring resolvers.",
    metadata: { tag: "vessel-construction.scaffold", source_doc: "TYPESCRIPT_VESSEL_TEMPLATE.md" },
  },
  {
    source_type: "vessel_construction_pattern",
    shape: "vessel_shape_contract",
    content: "Vessels declare shape ownership in discovery registration (shapes: string[]). The shapes list must match the cases handled in POST /resolve. Vessels may own zero shapes (pure consumers like ribosome-vessel). Shape names use snake_case and describe the data type, not the operation.",
    metadata: { tag: "vessel-construction.shapes", source_doc: "TYPESCRIPT_VESSEL_TEMPLATE.md" },
  },
  {
    source_type: "vessel_construction_pattern",
    shape: "vessel_multi_tenant_isolation",
    content: "Vessels with user data scope by org_id. Queries use SurrealDB PERMISSIONS or application-level filtering via $token.org_id. System vessels (systemVessel:true) skip tenant scoping. Never query across org boundaries. Use identity-vessel /v1/auth/resolve to get org context from API keys.",
    metadata: { tag: "vessel-construction.auth", source_doc: "TYPESCRIPT_VESSEL_TEMPLATE.md" },
  },
];

const IMPULSE_ACTIVITY_CONCEPTS: SeedConcept[] = [
  {
    source_type: "impulse_activity_pattern",
    shape: "impulse_pointer_type",
    content: "Impulses have a pointer.type field that determines which vessel/resolver handles them. Local types (memo, file, directoryTree, gitDiff) are resolved in-process. All other types route through discovery-vessel to the vessel advertising that shape.",
    metadata: { tag: "impulse-activity.routing", source_doc: "IMPULSE_ACTIVITY_FOUNDATION.md" },
  },
  {
    source_type: "impulse_activity_pattern",
    shape: "impulse_shape_ownership",
    content: "Each impulse shape is owned by exactly one vessel. The owner resolves the shape's content. Shapes are discovered dynamically — no static registry. Vessels advertise owned shapes to discovery-vessel at registration. The impulse-activity loop routes based on this advertisement.",
    metadata: { tag: "impulse-activity.ownership", source_doc: "IMPULSE_ACTIVITY_FOUNDATION.md" },
  },
  {
    source_type: "impulse_activity_pattern",
    shape: "thompson_posterior",
    content: "Thompson Sampling selects activity variants by sampling Beta(alpha, beta) posteriors. alpha = success_count + 1, beta = failure_count + 1. Scope ordering: org/account-scoped rows take precedence over global baseline rows (org_id IS NONE). Resolve via POST /v2/impulses/resolve { pointer: { type: 'thompson_posterior', activity_variant_id } }.",
    metadata: { tag: "impulse-activity.learning", source_doc: "IMPULSE_ACTIVITY_FOUNDATION.md" },
  },
  {
    source_type: "impulse_activity_pattern",
    shape: "activity_task_resolver",
    content: "Activity tasks dispatch to resolvers by id (resolver field in task config). Resolver tiers: deterministic (bash, git, file — zero cost), pattern (PreValidationResolver — from history), llm (LLMResolver — uses LLM with tool calling). The resolver tier is recorded on each task in execution traces.",
    metadata: { tag: "impulse-activity.resolver", source_doc: "IMPULSE_ACTIVITY_FOUNDATION.md" },
  },
  {
    source_type: "impulse_activity_pattern",
    shape: "lifecycle_task_events",
    content: "Activities emit lifecycle events: lifecycle:task:preBinding (before resolver dispatch, includes presentShapesPre and missingShapesPre), lifecycle:task:completed (after, includes outcomes, resolver id, cost, input_impulse_ids, output_impulse_ids). Subscribers receive these via activity-api WebSocket.",
    metadata: { tag: "impulse-activity.lifecycle", source_doc: "IMPULSE_ACTIVITY_FOUNDATION.md" },
  },
  {
    source_type: "impulse_activity_pattern",
    shape: "impulse_relevance_feedback",
    content: "The learning loop writes impulse relevance via POST /v2/activities/impulse-relevance (or impulseRelevance_write shape). Fields: activity_variant_id, impulse_id, feedback (positive/negative), verifier_result. Negative feedback on verifier_negative failure mode increments times_failed.",
    metadata: { tag: "impulse-activity.learning", source_doc: "IMPULSE_ACTIVITY_FOUNDATION.md" },
  },
  {
    source_type: "impulse_activity_pattern",
    shape: "composition_chain",
    content: "Nested activity executions track parent_execution_id and composition_chain (denormalized ancestor chain, root-first). Chain credit propagation writes α/β deltas to ancestors when a composed execution succeeds/fails. Cross-vessel composition is possible — vessels carry chain context in HTTP request bodies.",
    metadata: { tag: "impulse-activity.composition", source_doc: "IMPULSE_ACTIVITY_FOUNDATION.md" },
  },
  {
    source_type: "impulse_activity_pattern",
    shape: "activity_shape_contract",
    content: "Activities declare input_shapes (optional, any input accepted if absent) and output_shapes (required). The shape contract is used for backward chaining (find activities producing required shapes), validation (check produced shapes match declared), and composition graph building.",
    metadata: { tag: "impulse-activity.shapes", source_doc: "IMPULSE_ACTIVITY_FOUNDATION.md" },
  },
  {
    source_type: "impulse_activity_pattern",
    shape: "execution_trace_storage",
    content: "All activity executions are stored as traces in activity-api. Trace fields include: vessel_id, tasks (with per-task input/output impulse_ids, resolver_id, resolver_tier), failure_mode, parent_execution_id, composition_chain. Traces are the raw material for Thompson Sampling and template extraction.",
    metadata: { tag: "impulse-activity.storage", source_doc: "IMPULSE_ACTIVITY_FOUNDATION.md" },
  },
  {
    source_type: "impulse_activity_pattern",
    shape: "discovery_dynamic_routing",
    content: "Discovery-vessel is the fixed point — all vessel-to-vessel routing goes through it. POST /resolve { shape, orgId } returns the vessel endpoint advertising that shape. Vessels call discovery at runtime; no hardcoded vessel lists. callVesselResolve() in ias-executor-ts handles the routing contract.",
    metadata: { tag: "impulse-activity.routing", source_doc: "IMPULSE_ACTIVITY_FOUNDATION.md" },
  },
  {
    source_type: "impulse_activity_pattern",
    shape: "resolver_tier_hierarchy",
    content: "Resolver tiers in ascending cost order: deterministic (bash, git, file operations — zero LLM cost), pattern (history-based PreValidationResolver — fast lookup), llm (full LLM reasoning with tool calling — expensive). Always prefer lower tiers. Record tier on execution traces for cost analysis.",
    metadata: { tag: "impulse-activity.resolver", source_doc: "IMPULSE_ACTIVITY_FOUNDATION.md" },
  },
  {
    source_type: "impulse_activity_pattern",
    shape: "impulse_write_shapes",
    content: "Write operations use *_write impulse shapes routed through POST /v2/impulses/resolve. This decouples writers from REST endpoints. Examples: activityExecutionTrace_write, activityFeedback_write, impulseRelevance_write, activityTemplate_update. Each delegates to the equivalent REST endpoint server-side.",
    metadata: { tag: "impulse-activity.write", source_doc: "IMPULSE_ACTIVITY_FOUNDATION.md" },
  },
];

async function countConcepts(sourceType: string): Promise<number> {
  const res = await fetch(`${CONCEPT_DB_URL}/concepts/search?source_type=${sourceType}&limit=1`, {
    headers: { Authorization: `ApiKey ${API_KEY}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return 0;
  const body = await res.json() as { total?: number; concepts?: unknown[] };
  return body.total ?? body.concepts?.length ?? 0;
}

async function seedConcept(concept: SeedConcept): Promise<boolean> {
  const res = await fetch(`${CONCEPT_DB_URL}/concepts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `ApiKey ${API_KEY}`,
    },
    body: JSON.stringify(concept),
    signal: AbortSignal.timeout(10_000),
  });
  return res.ok || res.status === 409;
}

async function main() {
  log.info(`seeding concepts to ${CONCEPT_DB_URL}`);

  // Check if already seeded
  const vcpCount = await countConcepts("vessel_construction_pattern");
  const iapCount = await countConcepts("impulse_activity_pattern");

  if (vcpCount >= 12 && iapCount >= 12) {
    log.info(`already seeded (vcp=${vcpCount}, iap=${iapCount}) — skipping`);
    return;
  }

  log.info(`seeding ${VESSEL_CONSTRUCTION_CONCEPTS.length} vessel-construction-pattern concepts`);
  let ok = 0;
  let fail = 0;
  for (const c of VESSEL_CONSTRUCTION_CONCEPTS) {
    const success = await seedConcept(c);
    if (success) { ok++; } else { fail++; log.warn(`failed to seed ${c.shape}`); }
  }

  log.info(`seeding ${IMPULSE_ACTIVITY_CONCEPTS.length} impulse-activity-pattern concepts`);
  for (const c of IMPULSE_ACTIVITY_CONCEPTS) {
    const success = await seedConcept(c);
    if (success) { ok++; } else { fail++; log.warn(`failed to seed ${c.shape}`); }
  }

  log.info(`done: ${ok} seeded, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((err: unknown) => {
  log.error((err as Error)?.message ?? err);
  process.exit(1);
});
