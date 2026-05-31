#!/usr/bin/env bun
/**
 * prime-concept-db.ts — seed the local substrate-live concept-db with
 * foundational concepts + session learnings, mirroring what was minted to
 * canary via MCP. Idempotent: skips concepts whose shape already exists.
 *
 * The 6 anchors below mirror canary concepts that the 6 session concepts
 * link to — without them the graph edges have no targets locally.
 *
 * Usage: bun scripts/substrate/prime-concept-db.ts
 */

const CONCEPT_DB = process.env.CONCEPT_DB_ENDPOINT ?? "http://127.0.0.1:18260";

interface ConceptDef {
  key: string; // local symbolic id used to wire edges below
  shape: string;
  source_type: string;
  summary: string;
  content: string;
  priority?: number;
}

interface EdgeDef {
  from_key: string;
  to_key: string;
  edge_type: "related_to" | "derived_from" | "resolves_to" | "sequence_next" | "sequence_prev" | "description_of" | "example_of" | "contradicts";
  weight: number;
  description: string;
}

// ── 7 anchor concepts (mirror canary's foundational set) ──────────────────
const ANCHORS: ConceptDef[] = [
  {
    key: "failure_mode_taxonomy",
    shape: "failure_mode_taxonomy",
    source_type: "memo",
    summary: "F13 silent-success in goal-host proxy-catch caused variant-α pollution; fixed via re-throw; recovery requires posterior repair for pre-fix corruption.",
    content: "Failure mode taxonomy entry for F13: the goal-host-vessel proxy-catch (repos/goal-host-vessel/src/index.ts:359-367) used to swallow exceptions and return a degraded impulse with metadata.degraded=true, while the engine recorded success=true. Thompson α inflated on ghost successes; recovery required substrate restart + offline F24 posterior repair script for templates polluted pre-fix. Related families: F19 (extras-bag output_impulse_shapes), F24 (variant_performance_metrics direct UPDATE), F25 (artifact verification).",
    priority: 0.6,
  },
  {
    key: "thompson_posterior",
    shape: "thompson_posterior",
    source_type: "impulse_activity_pattern",
    summary: "Thompson Sampling selects activity variants by sampling Beta(α, β) posteriors. α = success_count + 1; β = failure_count + 1. Scope ordering: org/account-scoped rows take precedence over global.",
    content: "Thompson Sampling drives activity selection across variant families. Posterior lives in variant_performance_metrics (org-scoped) and falls back to global aggregates. α = successful_executions + 1; β = failed_executions + 1; variants are sampled probabilistically and the highest-sampled wins. Template records expose thompson_alpha at top level (static prior=1) and metrics.thompson_alpha (learned posterior) — readers must consult the metrics path. Stratified updates: verifier_negative → full β, budget_exhausted → 0.5β, safety_breach → full β, user_abort → 0.",
    priority: 0.7,
  },
  {
    key: "the_informational_state",
    shape: "the_informational_state",
    source_type: "impulse_activity_pattern",
    summary: "Unbounded backdrop containing all possible and impossible impulses — every piece of data that could ever be known, computed, or produced. The substrate maps a subset by execution.",
    content: "The informational state is the unbounded space of all possible impulses — every file, every query result, every concept the substrate could ever observe, plus all those it cannot. Vessels expose capabilities (resolver contracts) that map a subset of this space. The substrate's job is to traverse the reachable portion via execution traces, label what it finds with shapes, and accumulate Thompson posteriors over which traversal paths are productive. The coverage-tick measures the boundary between reachable+learned, reachable+unlearned, and unknown territory.",
    priority: 0.7,
  },
  {
    key: "vessels_contribute_learning_parameters_arbitrarily",
    shape: "vessels_contribute_learning_parameters_arbitrarily",
    source_type: "impulse_activity_pattern",
    summary: "The model is open. Different vessels own different parts of the learned topology and update them independently. No central learning service.",
    content: "Decentralized learning: each vessel owns and updates its own posterior surface. activity-api owns trace patterns and Thompson posteriors; concept-db owns co-occurrence edges and concept usage stats; identity-vessel owns no learning state. A new vessel joining the network contributes learning signal without coordination provided it advertises its shapes through discovery and emits its updates as impulses. This is the architectural foundation that allows the substrate to scale spatiotemporally without central bottleneck.",
    priority: 0.6,
  },
  {
    key: "autonomous_concept_minting_pattern",
    shape: "autonomous_concept_minting_pattern",
    source_type: "vessel_construction_pattern",
    summary: "Autonomous-authoring templates MUST mint side-effect concepts; palette grants without minting tasks let knowledge die at execution boundaries.",
    content: "An activity that is granted concept_create_write in its resolver palette but has no task that actually calls it produces no concept-db side effects — the LLM's reasoning dies when the resolver process exits. The pattern: every autonomous-authoring template (draft-gap-closing-activity, draft-spec-from-gap) must include a structured-learning side-effect task chain (llm_completion_dispatch → json_path_extract → http_fetch to concept_create_write) so the next drafter run inherits the prior reasoning rather than re-deriving it.",
    priority: 0.6,
  },
  {
    key: "discovery_integration",
    shape: "discovery_integration",
    source_type: "vessel_construction_pattern",
    summary: "Vessels register with discovery-vessel on startup and heartbeat every 60s. Registration is non-blocking; vessel is functional even if discovery is down.",
    content: "Discovery-vessel is a singleton at a fixed substrate endpoint that maintains a TTL-based registry of currently-running vessels and the shapes they advertise. Each vessel POSTs /register on startup with its resolver contract (resolve_endpoint, resolve_request_format, auth_scheme, resolve_timeout_ms) and heartbeats every 60s. Failure to register is non-fatal — the vessel continues to function locally; only cross-vessel routing degrades. This is the fixed point that lets all inter-vessel routing be dynamic.",
    priority: 0.5,
  },
  {
    key: "three_state_ontology",
    shape: "impulse_activity_pattern_three_state",
    source_type: "memo",
    summary: "Three states: instructional (vessel), transient (process-of-becoming), functional (instance). The transient state is where the work happens and is irreducible.",
    content: "The substrate's core ontology has three states. Instructional (vessel) = the capacity to execute; the blueprint, the spec — static, reusable, versionable. Transient (process-of-becoming) = active transformation; the execution in flight, the state transition. Ephemeral, irreducible, where learning accumulates. Functional (instance) = the realized outcome; the artifact, the trace, the file written. Each instance immediately becomes the vessel for the next transformation — a continuous loop, not a linear progression.",
    priority: 0.7,
  },
];

// ── 6 session-derived concepts (mirror what was minted to canary) ────────
const SESSION_CONCEPTS: ConceptDef[] = [
  {
    key: "convergent_validity_three_signals",
    shape: "convergent_validity_three_signals",
    source_type: "vessel_construction_pattern",
    summary: "Trace-write-time success determination must converge across at least three independent signals — single-source reports corrupt Thompson posteriors silently.",
    content: "When a task records success=true, three independent signals should agree before the trace closes: (1) degraded-impulse detection — reject if ALL output impulses carry metadata.degraded=true (catches the F13 swallow-and-return-degraded pattern at the engine level); (2) artifact verification — for filesystem-touching resolvers like fs_write, verify the file actually exists at the written path (catches ghost writes that report success but leave nothing behind); (3) co-occurrence consistency — query concept-db for high-weight edges involving the produced shapes; if learned-prior partners are absent, that's a divergence signal. The first two live in engine.ts; the third is a development-vessel resolver (convergent_validity_check) that can be inserted as an explicit task. Signal 3 sharpens automatically as concept-db accumulates edges. Without these, a single corrupted evidence source (like the F13 proxy-catch returning a degraded impulse with success=true) drives Thompson α to inflate without bound while β never increments. The principle generalizes beyond trace writes: any high-confidence claim should require convergent independent signals; disagreement is the most informative state.",
    priority: 0.7,
  },
  {
    key: "picker_static_prior_bug",
    shape: "picker_static_prior_vs_learned_posterior_bug",
    source_type: "vessel_construction_pattern",
    summary: "Activity-api template records expose thompson_alpha at top level (static prior=1) and metrics.thompson_alpha (learned posterior). Reading the wrong field silently picks the first candidate.",
    content: "Recurring anti-pattern observed in boredom-vessel's pickTopProposedGapClosingTemplate (commit ebfb1075). The activity-api template list response carries thompson_alpha at TWO levels: top-level is the static Beta(1,1) prior baked into the template record on creation; the learned posterior lives at metrics.thompson_alpha. Code reading t.thompson_alpha always sees 1 for every candidate, so argmax returns the first — even if its learned posterior is α=1 β=9 and another candidate has α=15 β=1. Fix: prefer metrics.thompson_alpha with top-level as fallback only. General lesson: when an API exposes both a default-valued field and a metrics-nested authoritative version, the metrics path is canonical. Audit other callers that read template metrics for the same pattern.",
    priority: 0.6,
  },
  {
    key: "self_stability_only_constraint",
    shape: "self_stability_is_the_only_hard_constraint",
    source_type: "impulse_activity_pattern",
    summary: "S3 refusal surface is narrow: refuse only what corrupts the substrate's ability to keep exploring (map, instruments, history); attempt everything else.",
    content: "S3 push-away is not 'refuse things outside declared capability' — that would block exploration, which is the primary purpose. The correct refusal surface: (a) accepting traces from unverified peers that would corrupt posteriors; (b) executing instructions that erase the accumulated map (trace store, concept-db, posteriors); (c) allowing vessel registrations that impersonate existing identities; (d) actions that would compromise the integrity of the observation/learning loop itself. Everything else — even goals with no known resolver, even tasks likely to fail, even novel shapes — should be attempted, traced, and learned from. Failure is a data point about topology, not a defect to suppress. The H1-H4 hardening primitives (two-sided traces, vessel pubkey identity, signed attestations, vessel ratification) protect exactly this — the trustworthiness of the mapping apparatus, not the scope of allowed exploration.",
    priority: 0.8,
  },
  {
    key: "vessel_as_manifold",
    shape: "vessel_as_manifold_boundary",
    source_type: "impulse_activity_pattern",
    summary: "A vessel's shape contract (input_shapes → output_shapes) defines a morphism in informational space; composition graph is the discovered product manifold.",
    content: "The three-state ontology maps precisely to manifold structure. Instructional state (vessel) = the specification of a morphism: input_shapes → output_shapes, declaring what transformation is possible. Transient state = the morphism in flight. Functional state = a point on the output manifold. The shape contract IS the manifold boundary. POST /v2/activities/validate-composition is literally boundary composition-checking — asking whether two manifolds can be composed at their shape interfaces without gaps. The composition graph is the *discovered* product manifold: not designed in advance, it emerges from which shapes have actually been produced and consumed in traces. The substrate cannot traverse the manifold boundary without emitting an observable artifact — the informational state is only reachable through execution.",
    priority: 0.7,
  },
  {
    key: "capability_inventory",
    shape: "capability_inventory_vs_declared_capability",
    source_type: "vessel_construction_pattern",
    summary: "Discovery-vessel registration captures declared capability at registration time; actual current capability requires periodic exercising — the delta is itself a signal.",
    content: "A resolver being registered means it was working when it registered. It doesn't mean it works now — external dependencies may have changed, credentials may have expired, paths may have been removed. The discovery-vessel registry is a snapshot of declared capability, not a measurement of current capability. What's needed is periodic exercising — attempt minimal invocations of each registered resolver and record whether it produced expected output. The delta between declared and actual capability is itself an observable signal about the substrate's environment. Without this, the substrate believes its capability inventory and routes work to broken resolvers, accumulating ghost failures.",
    priority: 0.5,
  },
  {
    key: "horizontal_conditioning",
    shape: "horizontal_conditioning_via_lifecycle_bus",
    source_type: "impulse_activity_pattern",
    summary: "Learning spreads horizontally across execution families through four mechanisms — bus subscribers, concept-db co-occurrence, ribosome extraction, impulse relevance penalties.",
    content: "Vertical conditioning is learning within an execution chain. Horizontal conditioning is learning spreading across execution families without explicit coupling. Four active mechanisms: (1) WebSocket broadcaster in-process subscriber registry — broadcaster.subscribe() lets any component react to any execution event. (2) Concept-db ExecutionObserver — WebSocket client to activity-api /ws, calls recordUsage when concept-referencing impulse_resolutions appear in any vessel's trace; cross-vessel passive learning. (3) Ribosome on lifecycle:execution:succeeded — assembleTemplateFromExecution turns successful traces into new templates that any future execution can use. (4) Impulse relevance penalties — verifier_negative on one execution increments per-impulse failure counters that affect every template using that impulse shape. Horizontal channels condition collective behavior without designing explicit cross-family wiring.",
    priority: 0.6,
  },
];

// ── 10 edges (mirror what was wired in canary) ───────────────────────────
const EDGES: EdgeDef[] = [
  { from_key: "convergent_validity_three_signals", to_key: "failure_mode_taxonomy", edge_type: "resolves_to", weight: 0.8, description: "Convergent validity is the structural fix for the F13 silent-success pattern." },
  { from_key: "convergent_validity_three_signals", to_key: "thompson_posterior", edge_type: "derived_from", weight: 0.6, description: "Protects Thompson posteriors from single-source corruption." },
  { from_key: "picker_static_prior_bug", to_key: "thompson_posterior", edge_type: "example_of", weight: 0.7, description: "Concrete instance of misreading the posterior — top-level field is the static prior, not the learned alpha." },
  { from_key: "self_stability_only_constraint", to_key: "the_informational_state", edge_type: "related_to", weight: 0.7, description: "Self-stability framing: exploration is the prime directive; refuse only what corrupts the mapping apparatus." },
  { from_key: "vessel_as_manifold", to_key: "the_informational_state", edge_type: "description_of", weight: 0.8, description: "Vessel-as-manifold-boundary is the geometric framing of how vessels traverse and observe the informational state." },
  { from_key: "vessel_as_manifold", to_key: "three_state_ontology", edge_type: "derived_from", weight: 0.7, description: "Vessel-as-manifold-boundary extends the three-state ontology with manifold-theoretic geometry." },
  { from_key: "horizontal_conditioning", to_key: "vessels_contribute_learning_parameters_arbitrarily", edge_type: "example_of", weight: 0.8, description: "Concrete mechanisms for the decentralized-learning principle." },
  { from_key: "horizontal_conditioning", to_key: "autonomous_concept_minting_pattern", edge_type: "related_to", weight: 0.6, description: "Autonomous concept minting is the write-side of horizontal conditioning." },
  { from_key: "capability_inventory", to_key: "discovery_integration", edge_type: "related_to", weight: 0.6, description: "Discovery registration captures declared capability; exercise loop measures actual capability." },
  { from_key: "convergent_validity_three_signals", to_key: "self_stability_only_constraint", edge_type: "related_to", weight: 0.7, description: "Convergent validity protects the mapping apparatus's integrity — the surface self-stability says is worth refusing for." },
];

interface ExistingConcept { id: string; shape: string }

// Strip SurrealDB record syntax (`concept:⟨...⟩`) → bare id.
// IDs with hyphens or underscores get wrapped in unicode angle brackets in
// SurrealDB record refs; the brackets break downstream MCP id lookups.
function normalizeId(raw: string): string {
  return raw.replace(/^concept:/, "").replace(/^⟨/, "").replace(/⟩$/, "");
}

async function searchByShape(shape: string): Promise<ExistingConcept | null> {
  const res = await fetch(`${CONCEPT_DB}/concepts/search?q=${encodeURIComponent(shape)}&limit=10&min_relevance=0`);
  if (!res.ok) return null;
  const data = await res.json() as { concepts?: Array<{ id?: string; shape?: string }> };
  for (const c of data.concepts ?? []) {
    if (c.shape === shape && typeof c.id === "string") {
      return { id: normalizeId(c.id), shape };
    }
  }
  return null;
}

async function mintConcept(def: ConceptDef): Promise<string> {
  const res = await fetch(`${CONCEPT_DB}/v2/impulses/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pointer: {
        type: "concept_create_write",
        conceptData: {
          shape: def.shape,
          source_type: def.source_type,
          summary: def.summary,
          content: def.content,
          priority: def.priority ?? 0.5,
          budget: 2000,
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`mint failed [${def.shape}]: ${res.status} ${await res.text()}`);
  const body = await res.json() as { success?: boolean; content?: string };
  if (!body.success) throw new Error(`mint failed [${def.shape}]: ${JSON.stringify(body)}`);
  const inner = JSON.parse(body.content ?? "{}") as { id?: string };
  if (!inner.id) throw new Error(`mint returned no id for ${def.shape}`);
  return normalizeId(inner.id);
}

async function createEdge(from_id: string, to_id: string, edge_type: string, weight: number, description: string): Promise<void> {
  const res = await fetch(`${CONCEPT_DB}/mcp/tools/call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tool: "concept_link",
      arguments: {
        from_concept_id: from_id,
        to_concept_id: to_id,
        edge_type,
        weight,
        description,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`edge ${from_id} → ${to_id} failed: ${res.status} ${text.slice(0, 200)}`);
  }
}

async function main(): Promise<void> {
  console.log(`priming concept-db at ${CONCEPT_DB}`);
  const idMap: Record<string, string> = {};

  for (const def of [...ANCHORS, ...SESSION_CONCEPTS]) {
    const existing = await searchByShape(def.shape);
    if (existing) {
      idMap[def.key] = existing.id;
      console.log(`  ✓ exists: ${def.shape} → ${existing.id}`);
      continue;
    }
    const id = await mintConcept(def);
    idMap[def.key] = id;
    console.log(`  + minted: ${def.shape} → ${id}`);
  }

  console.log(`\nwiring ${EDGES.length} edges...`);
  for (const edge of EDGES) {
    const from = idMap[edge.from_key];
    const to = idMap[edge.to_key];
    if (!from || !to) {
      console.warn(`  ✗ skip: ${edge.from_key} → ${edge.to_key} (missing id)`);
      continue;
    }
    try {
      await createEdge(from, to, edge.edge_type, edge.weight, edge.description);
      console.log(`  → ${edge.from_key} -[${edge.edge_type}]→ ${edge.to_key}`);
    } catch (err) {
      console.warn(`  ✗ ${edge.from_key} → ${edge.to_key}: ${(err as Error).message}`);
    }
  }

  console.log(`\ndone. ${Object.keys(idMap).length} concepts present; ${EDGES.length} edges attempted.`);
}

main().catch((err) => {
  console.error("priming failed:", err);
  process.exit(1);
});
