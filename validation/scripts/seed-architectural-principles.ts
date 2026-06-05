#!/usr/bin/env bun
/**
 * seed-architectural-principles — Stage 0 of openspec change
 *   2026-06-03-pre-lift-bootstrap-and-architecture-aware-loop
 *
 * Mints architectural principle concepts into concept-db with
 * source_type="architectural_pattern_principle". Each principle carries a
 * `severity` field in metadata: "structural" (violations emit substrateGap),
 * "guidance" (advisory), "advisory" (informational only).
 *
 * Source mix:
 *   1. Foundation-doc sections (IMPULSE_ACTIVITY_FOUNDATION.md) — H2/H3 split
 *      via the markdown_split_sections resolver. Each section's summary +
 *      capped body becomes one principle concept with severity="guidance"
 *      (foundation-doc states intent; not all sections are check-targets).
 *   2. Session-articulated insights — hand-listed below, severity="structural"
 *      for the load-bearing architectural rules the four detectors enforce.
 *
 * After this script runs, the four horizon detectors in
 * repos/development-vessel/src/resolvers/ can query
 *   /concepts/search?source_type=architectural_pattern_principle
 * and derive check predicates from the returned set.
 *
 * Usage:
 *   bun validation/scripts/seed-architectural-principles.ts
 *
 * Idempotency: each concept carries metadata.signature; pre-mint search by
 * signature skips matches.
 */

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const CONCEPT_DB_URL = process.env.CONCEPT_DB_URL || "http://127.0.0.1:18260";

interface PrincipleEntry {
  name: string;
  shape: string;
  severity: "structural" | "guidance" | "advisory";
  summary: string;
  content: string;
  signature: string;
  // Detector hints — which horizon detectors should consult this principle.
  applies_to: string[];
  // Optional structural-check predicate hints: regex source strings paired
  // with a vessel name. Used by vessel_responsibility_audit to decide which
  // vessels to scan for which patterns.
  check_hints?: Array<{
    target_vessel?: string;
    forbidden_pattern_regex?: string;
    detail: string;
  }>;
}

const HAND_LISTED_PRINCIPLES: PrincipleEntry[] = [
  {
    name: "backend_is_trace_store_not_universal_resolver",
    shape: "architectural_pattern_principle",
    severity: "structural",
    summary:
      "Backend = trace store + pattern learner, NOT a universal resolver. " +
      "Activity-API owns traces, templates, Thompson metrics; everything else routes through discovery.",
    content:
      "From docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md: the activity-api " +
      "is bounded to trace storage, template catalogue, Thompson learning, and " +
      "impulse-relevance feedback. Vessels that perform template-search-and-rank, " +
      "LLM-reuse decisions, or selection logic INSIDE their own source are " +
      "duplicating responsibility that belongs to activity-api. The goal-host-vessel " +
      "currently does template catalogue search + LLM-reuse + state-signature " +
      "compute per dispatch; per IAL alignment-checklist red flag #2, this " +
      "treats backend-adjacent logic as if it lived locally. A responsibility-misallocation.",
    signature: "principle__backend_is_trace_store_not_universal_resolver_v2",
    applies_to: ["vessel_responsibility_audit", "vessel_architecture_pattern_scan", "resolver_distribution_audit"],
    check_hints: [
      {
        target_vessel: "goal-host-vessel",
        forbidden_pattern_regex:
          "v2/activities/templates\\?|reuseList|reuse_template|LLM[-_]?reuse|selectBestTemplate",
        detail:
          "goal-host fetches template catalogue + does LLM-reuse — both should " +
          "live behind a select-activity-for-goal endpoint on activity-api.",
      },
    ],
  },
  {
    name: "single_llm_dispatcher_is_spof_for_autonomous_self_modification",
    shape: "architectural_pattern_principle",
    severity: "structural",
    summary:
      "Single LLM-capable dispatcher = single point of failure for autonomous self-modification.",
    content:
      "With only goal-host-vessel as the LLM-capable execution path, any " +
      "goal-host bug blocks the substrate from authoring its own fix. The " +
      "autonomous loop CANNOT close on multi-task chains when the authoring " +
      "path IS the leak being fixed. Architectural anti-pattern: catalogued " +
      "as Risk #C in openspec/changes/2026-06-03-pre-lift-bootstrap-... . " +
      "The corrective is to ship a second, architecturally-different dispatcher " +
      "(light-dispatch-vessel) + capability-based routing in boredom-vessel so " +
      "both paths stay exercised.",
    signature: "principle__single_llm_dispatcher_is_spof",
    applies_to: ["vessel_architecture_pattern_scan", "resolver_distribution_audit"],
  },
  {
    name: "per_dispatch_full_state_capture_is_o_n_memory",
    shape: "architectural_pattern_principle",
    severity: "structural",
    summary:
      "Per-dispatch full-state capture (state_signature + ProxyImpulseBus + recommend pre-check) = O(N) memory in N dispatches.",
    content:
      "Goal-host-vessel currently performs compute_state_signature, deep-clones " +
      "the ProxyImpulseBus snapshot, fetches +77 shapes from discovery, and " +
      "runs activity_recommend pre-check on EVERY dispatch — even when " +
      "targetTemplateId is explicit. Empirically this leaks ~2 GB of VmRSS per " +
      "dispatch. The architectural rule: state-capture work should be lazy " +
      "(cache + invalidate on env-event) or conditional (only run pre-check " +
      "when needed). Per-dispatch unconditional state-capture is a cost-output " +
      "mismatch — high resource cost for outputs (template_id selection) that " +
      "are already determined.",
    signature: "principle__per_dispatch_full_state_capture_is_o_n",
    applies_to: ["vessel_architecture_pattern_scan", "vessel_responsibility_audit"],
    check_hints: [
      {
        target_vessel: "goal-host-vessel",
        forbidden_pattern_regex:
          "compute_state_signature.*per[-_]?dispatch|snapshotProxyBus|deep[-_]?clone.*bus",
        detail:
          "Look for unconditional state-capture in the dispatch hot path; " +
          "should be lazy or cached.",
      },
    ],
  },
  {
    name: "activities_should_be_dispatchable_not_baked_in_vessel_code",
    shape: "architectural_pattern_principle",
    severity: "structural",
    summary:
      "Activities should be dispatchable; selection logic baked into vessel code violates the activity-as-primitive principle.",
    content:
      "Per IAL: 'Activities Constrain Search' applies recursively — the " +
      "selection of an activity is itself an activity. When a vessel embeds " +
      "selection logic (template-search, LLM-reuse, recommend-pre-check) " +
      "inside its own TS surface, it removes that decision from the substrate's " +
      "improvement loop. The substrate cannot mitose-improve selection if " +
      "selection is hardcoded. Corrective: extract selection into a " +
      "select-activity-for-goal dispatchable template + activity-api endpoint.",
    signature: "principle__activities_should_be_dispatchable",
    applies_to: ["vessel_responsibility_audit", "activity_lifecycle_audit"],
    check_hints: [
      {
        forbidden_pattern_regex:
          "selectBestTemplate|chooseTemplate|recommendTemplate\\(|rankTemplates",
        detail:
          "In-vessel template selection functions should be dispatched as " +
          "activities, not baked into source.",
      },
    ],
  },
  {
    name: "architectural_insights_should_be_queryable_concepts",
    shape: "architectural_pattern_principle",
    severity: "guidance",
    summary:
      "Architectural insights should be queryable as concepts, not encoded as runtime checks.",
    content:
      "Encoding architectural rules as if-statements inside resolver source " +
      "means the substrate cannot extend its own detection coverage. Storing " +
      "architectural rules as concepts (source_type=architectural_pattern_principle) " +
      "lets new insights be added via concept_write; the four horizon detectors " +
      "consult the concept-db at runtime so adding a principle = extending " +
      "detection coverage. This change ships the four detectors that embody " +
      "this meta-pattern.",
    signature: "principle__architectural_insights_as_concepts",
    applies_to: [
      "vessel_responsibility_audit",
      "vessel_architecture_pattern_scan",
      "activity_lifecycle_audit",
      "resolver_distribution_audit",
    ],
  },
  {
    name: "resolvers_live_where_data_lives",
    shape: "architectural_pattern_principle",
    severity: "structural",
    summary:
      "Resolvers live where data lives. Vessels own resolution for their own shapes; backend only stores traces.",
    content:
      "From IMPULSE_ACTIVITY_FOUNDATION.md design principle #3. Anti-pattern: " +
      "a vessel acting as universal resolver for shapes another vessel owns " +
      "(centralized dispatch). resolver_distribution_audit should flag any " +
      "case where one vessel advertises shapes that semantically belong to " +
      "another vessel's domain.",
    signature: "principle__resolvers_live_where_data_lives",
    applies_to: ["resolver_distribution_audit", "vessel_responsibility_audit"],
  },
  {
    name: "every_execution_traces_for_learning",
    shape: "architectural_pattern_principle",
    severity: "guidance",
    summary:
      "Every execution is traced. Activities that don't record traces violate the learning-loop foundation.",
    content:
      "IAL principle: trace storage is the raw material for Thompson Sampling " +
      "and pattern learning. Activities that bypass trace-writes silently " +
      "starve the learning loop; activity_lifecycle_audit should flag any " +
      "registered template that has zero trace history despite recent " +
      "boredom dispatches — either it's not firing OR it's failing trace-write.",
    signature: "principle__every_execution_traces_for_learning",
    applies_to: ["activity_lifecycle_audit", "vessel_architecture_pattern_scan"],
  },
  {
    name: "no_silent_failures",
    shape: "architectural_pattern_principle",
    severity: "structural",
    summary:
      "No silent failures. Component failures must emit substrate-observable signals " +
      "(substrateGap, structured error, or shape-typed impulse) — not be dropped silently.",
    content:
      "[principle__no_silent_failures] Component failures must emit substrate-observable " +
      "signals (substrateGap, structured error, or shape-typed impulse). Silent drops " +
      "(BoundedBusSink queue overflow), failures-in-finally-blocks, fire-and-forget " +
      "Promises whose rejections aren't caught — all violate this principle. " +
      "Detection mechanism: scan logs/metrics for failure indicators that don't " +
      "correspond to substrate-observable impulses. Architectural rule: every failure " +
      "path must produce a trace, an impulse, or an explicit refuse. Reference: " +
      "BoundedBusSink dropped 22,172 dispatches silently in a 2-hour window with no " +
      "substrateGap emission until operator-seeded.",
    signature: "principle__no_silent_failures",
    applies_to: [
      "vessel_responsibility_audit",
      "vessel_architecture_pattern_scan",
      "resolver_distribution_audit",
      "vector_space_orthogonality_audit",
    ],
  },
  {
    name: "novel_failure_modes_must_be_detectable_via_vector_orthogonality",
    shape: "architectural_pattern_principle",
    severity: "structural",
    summary:
      "Substrate detection coverage must grow by detecting failure traces orthogonal " +
      "to all current architectural_pattern_principle concepts and authoring new ones.",
    content:
      "[principle__novel_failure_modes_via_orthogonality] The substrate's detector " +
      "inventory is bounded by operator-seeded principles. To extend detection " +
      "coverage autonomously, the substrate must scan failure traces for those whose " +
      "embedding has max cosine similarity < threshold (default 0.45) against all " +
      "existing architectural_pattern_principle concepts. Such traces are orthogonal " +
      "to current understanding — novel failure modes. Cluster them, propose a new " +
      "principle for each cluster, ingest via concept_create_write. The new principle " +
      "becomes detection coverage for that vector subspace. This closes the " +
      "meta-recursion: substrate detects what it wasn't taught to detect, then teaches " +
      "itself. Reference: vector_space_orthogonality_audit resolver in development-vessel.",
    signature: "principle__novel_failure_modes_via_orthogonality",
    applies_to: [
      "vector_space_orthogonality_audit",
      "vessel_architecture_pattern_scan",
    ],
  },
];

const INDEX_CONCEPT: PrincipleEntry = {
  name: "architectural_principles_index",
  shape: "architectural_principles_index",
  severity: "advisory",
  summary:
    "Index of architectural principles by detector — self-documenting catalogue for the four horizon detectors.",
  content: JSON.stringify(
    {
      vessel_responsibility_audit: [
        "backend_is_trace_store_not_universal_resolver",
        "per_dispatch_full_state_capture_is_o_n_memory",
        "activities_should_be_dispatchable_not_baked_in_vessel_code",
        "resolvers_live_where_data_lives",
        "architectural_insights_should_be_queryable_concepts",
      ],
      vessel_architecture_pattern_scan: [
        "backend_is_trace_store_not_universal_resolver",
        "single_llm_dispatcher_is_spof_for_autonomous_self_modification",
        "per_dispatch_full_state_capture_is_o_n_memory",
        "every_execution_traces_for_learning",
        "architectural_insights_should_be_queryable_concepts",
      ],
      activity_lifecycle_audit: [
        "activities_should_be_dispatchable_not_baked_in_vessel_code",
        "every_execution_traces_for_learning",
        "architectural_insights_should_be_queryable_concepts",
      ],
      resolver_distribution_audit: [
        "backend_is_trace_store_not_universal_resolver",
        "single_llm_dispatcher_is_spof_for_autonomous_self_modification",
        "resolvers_live_where_data_lives",
        "architectural_insights_should_be_queryable_concepts",
      ],
    },
    null,
    2,
  ),
  signature: "principle__architectural_principles_index",
  applies_to: ["meta"],
};

async function loadApiKey(): Promise<string> {
  const env = process.env.METABOB_API_KEY;
  if (env) return env;
  const configPath = join(homedir(), ".metabob", "config.json");
  try {
    const raw = await readFile(configPath, "utf-8");
    const cfg = JSON.parse(raw);
    const key = cfg?.metabob?.apiKey;
    if (typeof key === "string") return key;
  } catch {
    // fallthrough
  }
  return "";
}

async function principleExists(apiKey: string, signature: string): Promise<boolean> {
  const url = `${CONCEPT_DB_URL}/concepts/search?source_type=architectural_pattern_principle&limit=100`;
  const headers: Record<string, string> = {};
  if (apiKey) headers["Authorization"] = `ApiKey ${apiKey}`;
  try {
    const resp = await fetch(url, { headers });
    if (!resp.ok) return false;
    const json = (await resp.json()) as { concepts?: Array<{ summary?: string; content?: string }> };
    const list = json.concepts ?? [];
    for (const c of list) {
      if (
        (typeof c.summary === "string" && c.summary.includes(signature)) ||
        (typeof c.content === "string" && c.content.includes(signature))
      ) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

async function mintPrinciple(apiKey: string, entry: PrincipleEntry): Promise<void> {
  // Embed signature into content so existence check above can match it via the
  // GET /concepts/search content field (concept-db does not surface metadata
  // in the search response uniformly).
  const contentWithSig = `[${entry.signature}] ${entry.content}`;
  const body = {
    source_type: "architectural_pattern_principle" as const,
    shape: entry.shape,
    summary: entry.summary,
    content: contentWithSig,
    priority: 0.7,
    budget: 2000,
    pointer: {
      type: "memo",
      path: "openspec/changes/2026-06-03-pre-lift-bootstrap-and-architecture-aware-loop/",
      section: entry.name,
    },
    metadata: {
      signature: entry.signature,
      severity: entry.severity,
      applies_to: entry.applies_to,
      check_hints: entry.check_hints ?? [],
      principle_name: entry.name,
      seed_source: "seed-architectural-principles",
    },
  };
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `ApiKey ${apiKey}`;
  const resp = await fetch(`${CONCEPT_DB_URL}/concepts`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = (await resp.text()).slice(0, 400);
    throw new Error(`mint failed ${resp.status}: ${text}`);
  }
  const json = (await resp.json()) as { id?: string };
  console.log(`  minted ${entry.name} → ${json.id ?? "<no id>"}`);
}

async function main(): Promise<void> {
  const apiKey = await loadApiKey();
  if (!apiKey) {
    console.warn("warning: no METABOB_API_KEY — proceeding unauthenticated (may fail).");
  }

  const all: PrincipleEntry[] = [...HAND_LISTED_PRINCIPLES, INDEX_CONCEPT];
  console.log(`seeding ${all.length} architectural principles to ${CONCEPT_DB_URL}`);

  let minted = 0;
  let skipped = 0;
  let failed = 0;
  for (const entry of all) {
    try {
      const exists = await principleExists(apiKey, entry.signature);
      if (exists) {
        console.log(`  skip ${entry.name} (already present)`);
        skipped++;
        continue;
      }
      await mintPrinciple(apiKey, entry);
      minted++;
    } catch (err) {
      console.error(`  FAIL ${entry.name}: ${(err as Error).message}`);
      failed++;
    }
  }
  console.log(`\nsummary: minted=${minted} skipped=${skipped} failed=${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
