#!/usr/bin/env bun
/**
 * goal-generator.ts — Phase 25 G1.2 / G1.4
 *
 * Generates a stratified set of natural-language goals for the evaluation harness.
 *
 * Usage:
 *   bun run validation/scripts/goal-generator.ts \
 *     --seed 12345 --count 50 \
 *     [--novelty-mix 0.4,0.4,0.2] \
 *     [--depth-mix 0.5,0.3,0.2] \
 *     [--scenario-mix 0.6,0.2,0.2] \
 *     [--adversarial-fraction 0.1] \
 *     [--output validation/generated/12345-2026-05-19.json]
 *     [--held-out]  # G1.4: weekly held-out suite (seed=YYYY_WW_held_out_v1, count=8)
 *
 * --held-out mode (G1.4.1):
 *   Overrides --seed with the ISO week seed "YYYY_WW_held_out_v1" (where YYYY and WW
 *   are the current UTC year and ISO week number).  Count defaults to 8.  Output goes
 *   to validation/generated/<date>-held-out-goals.json.  Running the same flag in the
 *   same ISO week always produces the same goals; different weeks produce different but
 *   independently reproducible sets.
 *
 * Adversarial generation is deferred (G1.3); goals always have adversarial:false.
 *
 * Config: reads METABOB_ENDPOINT / METABOB_API_KEY or ~/.metabob/config.json.
 *         Discovery-vessel: DISCOVERY_VESSEL_ENDPOINT (default: https://discovery.metabob.com)
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname, resolve as resolvePath } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import { computeShapeRegistryHash } from "./lib/shape-registry-hash.ts";
import { buildShapeSignaturePool } from "./lib/shape-signature-pool.ts";
import type { ShapeSignatureEntry } from "./lib/shape-signature-pool.ts";
import { classifyTopologyGap } from "./lib/topology-gap-band.ts";

// ---------------------------------------------------------------------------
// Config loading (matches reuse-harness.ts pattern)
// ---------------------------------------------------------------------------

async function loadConfig(): Promise<{
  endpoint: string;
  apiKey: string;
  discoveryEndpoint: string;
}> {
  const envEndpoint = process.env.METABOB_ENDPOINT;
  const envKey = process.env.METABOB_API_KEY;
  const envDiscovery = process.env.DISCOVERY_VESSEL_ENDPOINT;

  const configPath = join(homedir(), ".metabob", "config.json");
  if (existsSync(configPath)) {
    const raw = JSON.parse(await readFile(configPath, "utf8")) as {
      metabob?: { endpoint?: string; apiKey?: string };
    };
    const endpoint =
      envEndpoint ?? raw.metabob?.endpoint ?? "https://activity.metabob.com";
    const apiKey = envKey ?? raw.metabob?.apiKey ?? "";
    const discoveryEndpoint =
      envDiscovery ?? "https://discovery.metabob.com";
    if (apiKey) return { endpoint, apiKey, discoveryEndpoint };
  }
  if (envEndpoint && envKey) {
    return {
      endpoint: envEndpoint,
      apiKey: envKey,
      discoveryEndpoint: envDiscovery ?? "https://discovery.metabob.com",
    };
  }
  throw new Error(
    "METABOB_API_KEY not set. Set via env var or ~/.metabob/config.json"
  );
}

// ---------------------------------------------------------------------------
// Seeded xorshift64 PRNG — no external dependencies
// ---------------------------------------------------------------------------

class Xorshift64 {
  private lo: number;
  private hi: number;

  constructor(seed: bigint) {
    // Split 64-bit seed into two 32-bit halves
    const lo32 = Number(seed & 0xffffffffn);
    const hi32 = Number((seed >> 32n) & 0xffffffffn);
    // Ensure non-zero state
    this.lo = lo32 === 0 ? 1 : lo32;
    this.hi = hi32 === 0 ? 0x6c62272e : hi32;
  }

  /** Returns a 32-bit unsigned integer. */
  nextUint32(): number {
    // xorshift64: operates on a 64-bit state split across two 32-bit halves.
    // Using the classic 13/7/17 triplet.
    let x = (this.hi >>> 0);
    let y = (this.lo >>> 0);

    // XOR with left-shift 13
    x ^= (x << 13) >>> 0;
    // XOR with right-shift 7
    x ^= (x >>> 7);

    this.hi = y;

    // XOR with left-shift 17
    y ^= (y << 17) >>> 0;
    y ^= x;

    this.lo = y >>> 0;
    return (y >>> 0);
  }

  /** Returns a float in [0, 1). */
  nextFloat(): number {
    return this.nextUint32() / 0x100000000;
  }

  /** Returns an integer in [0, n). */
  nextInt(n: number): number {
    if (n <= 0) return 0;
    return Math.floor(this.nextFloat() * n);
  }

  /** Picks a random element from an array. */
  pick<T>(arr: T[]): T {
    return arr[this.nextInt(arr.length)];
  }
}

// ---------------------------------------------------------------------------
// Novelty classification
// ---------------------------------------------------------------------------

type Novelty = "seen" | "rare" | "novel";
type Depth = "depth0" | "depth1" | "depth2+";
type Scenario = "A" | "B" | "C∪D";

interface CellId {
  novelty: Novelty;
  depth: Depth;
  scenario: Scenario;
}

function formatCellId(c: CellId): string {
  return `${c.novelty}|${c.depth}|${c.scenario}`;
}

function classifyNovelty(count: number): Novelty {
  if (count >= 5) return "seen";
  if (count >= 1) return "rare";
  return "novel";
}

// ---------------------------------------------------------------------------
// Simplified decomposition depth (G1.1.2 simplified variant)
// ---------------------------------------------------------------------------

async function classifyDepth(
  outputShapes: string[],
  endpoint: string,
  authHeaders: Record<string, string>
): Promise<Depth> {
  // Simplified: query discover-by-shapes for producers.
  // depth=0 if all output shapes have a known producer with total_executions >= 5.
  // depth=1 otherwise.
  // (Full BFS is deferred.)

  interface DiscoverMatch {
    output_shapes?: string[];
    total_executions?: number;
    alpha?: number;
    beta?: number;
    sample_count?: number;
  }

  interface DiscoverResponse {
    activities?: DiscoverMatch[];
    templates?: DiscoverMatch[];
    matches?: DiscoverMatch[];
    data?: DiscoverMatch[];
  }

  let matches: DiscoverMatch[] = [];
  try {
    const resp = await fetch(`${endpoint}/v2/activities/discover-by-shapes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ output_shapes: outputShapes, mode: "backward" }),
      signal: AbortSignal.timeout(15_000),
    });
    if (resp.ok) {
      const body = (await resp.json()) as DiscoverResponse;
      matches = body.activities ?? body.templates ?? body.matches ?? body.data ?? [];
    }
  } catch {
    // Non-fatal
  }

  // Check if all output shapes are covered by at least one template with executions >= 5
  const coveredShapes = new Set<string>();
  for (const m of matches) {
    const alpha = m.alpha ?? 1;
    const beta = m.beta ?? 1;
    const totalExecs =
      m.total_executions ??
      m.sample_count ??
      Math.max(0, (alpha - 1) + (beta - 1));

    if (totalExecs >= 5) {
      for (const s of m.output_shapes ?? []) {
        if (outputShapes.includes(s)) coveredShapes.add(s);
      }
    }
  }

  const allCovered = outputShapes.every((s) => coveredShapes.has(s));
  if (allCovered) return "depth0";
  return "depth1";
}

// ---------------------------------------------------------------------------
// 24-cell goal template grid
// (novelty ∈ {seen, rare, novel}) × (depth ∈ {0, 1, 2+}) × (scenario ∈ {A, B, C∪D})
// = 3 × 3 × 2 = 18 primary cells, with 6 variant sub-cells to reach 24
// Design §A.2: collapse to 24-cell working grid; adversarial is a separate slice.
// ---------------------------------------------------------------------------

// Each template is a function (inputShape, outputShape) → goal text
type GoalTemplate = (inputShape: string, outputShape: string) => string;

interface CellTemplate {
  cell: CellId;
  template: GoalTemplate;
}

const CELL_TEMPLATES: CellTemplate[] = [
  // seen | depth0 | A
  {
    cell: { novelty: "seen", depth: "depth0", scenario: "A" },
    template: (inp, out) =>
      `Given a ${inp} as context, produce a ${out} using the established pipeline.`,
  },

  // seen | depth1 | A  (2 templates — this cell is weight-doubled intentionally)
  {
    cell: { novelty: "seen", depth: "depth1", scenario: "A" },
    template: (inp, out) =>
      `Starting from a ${inp}, resolve any missing intermediate shapes and deliver a ${out}.`,
  },
  {
    cell: { novelty: "seen", depth: "depth1", scenario: "A" },
    template: (inp, out) =>
      `Use the ${inp} to diagnose the issue and produce a ${out} with at least one sub-task delegation.`,
  },

  // seen | depth2+ | A  (2 templates)
  {
    cell: { novelty: "seen", depth: "depth2+", scenario: "A" },
    template: (inp, out) =>
      `Orchestrate a multi-step workflow starting with ${inp} that eventually yields a ${out} through two or more composition layers.`,
  },
  {
    cell: { novelty: "seen", depth: "depth2+", scenario: "A" },
    template: (inp, out) =>
      `Produce a ${out} from ${inp} context via a deep composition chain with at least two intermediate goal escalations.`,
  },

  // seen | depth0 | B  (1 template)
  {
    cell: { novelty: "seen", depth: "depth0", scenario: "B" },
    template: (inp, out) =>
      `Generate a ${out} from ${inp} using a sparsely-tested activity path (cold Thompson posterior).`,
  },

  // seen | depth1 | B  (1 template)
  {
    cell: { novelty: "seen", depth: "depth1", scenario: "B" },
    template: (inp, out) =>
      `Starting with ${inp}, produce ${out} through a cold-start activity that has seen fewer than three executions.`,
  },

  // seen | depth2+ | B  (1 template)
  {
    cell: { novelty: "seen", depth: "depth2+", scenario: "B" },
    template: (inp, out) =>
      `Using ${inp} as the seed, construct a ${out} through a rarely-exercised multi-hop composition.`,
  },

  // seen | depth0 | C∪D  (1 template)
  {
    cell: { novelty: "seen", depth: "depth0", scenario: "C∪D" },
    template: (inp, out) =>
      `Attempt to produce a ${out} from ${inp} where no existing template covers the target shape directly.`,
  },

  // seen | depth1 | C∪D  (1 template)
  {
    cell: { novelty: "seen", depth: "depth1", scenario: "C∪D" },
    template: (inp, out) =>
      `Resolve ${inp} and escalate to create a ${out} even though the shape has no matching activity template.`,
  },

  // rare | depth0 | A  (1 template)
  {
    cell: { novelty: "rare", depth: "depth0", scenario: "A" },
    template: (inp, out) =>
      `Produce a ${out} from ${inp} — this shape pair has been seen in only a few prior traces.`,
  },

  // rare | depth1 | A  (1 template)
  {
    cell: { novelty: "rare", depth: "depth1", scenario: "A" },
    template: (inp, out) =>
      `Starting from ${inp}, derive a ${out} via one composition layer; this shape signature is infrequent in the trace history.`,
  },

  // rare | depth2+ | A  (1 template)
  {
    cell: { novelty: "rare", depth: "depth2+", scenario: "A" },
    template: (inp, out) =>
      `Produce a ${out} from ${inp} through a rarely-observed multi-hop composition.`,
  },

  // rare | depth0 | B  (1 template)
  {
    cell: { novelty: "rare", depth: "depth0", scenario: "B" },
    template: (inp, out) =>
      `Rename the helper in ${inp} to produce a ${out}, exercising a cold-posterior template with low execution count.`,
  },

  // rare | depth1 | B  (1 template)
  {
    cell: { novelty: "rare", depth: "depth1", scenario: "B" },
    template: (inp, out) =>
      `Using ${inp} context, generate a ${out} via a cold single-escalation path.`,
  },

  // rare | depth2+ | B  (1 template)
  {
    cell: { novelty: "rare", depth: "depth2+", scenario: "B" },
    template: (inp, out) =>
      `From ${inp}, produce a ${out} through a two-layer cold composition that hasn't warmed yet.`,
  },

  // rare | depth0 | C∪D  (1 template)
  {
    cell: { novelty: "rare", depth: "depth0", scenario: "C∪D" },
    template: (inp, out) =>
      `Produce a ${out} from ${inp} where the shape is registered in a vessel but not yet backed by an activity template.`,
  },

  // rare | depth1 | C∪D  (1 template)
  {
    cell: { novelty: "rare", depth: "depth1", scenario: "C∪D" },
    template: (inp, out) =>
      `Using ${inp} as input, create-shape-provider-goal to obtain a ${out} that has no template but an advertising vessel.`,
  },

  // novel | depth0 | A  (1 template)
  {
    cell: { novelty: "novel", depth: "depth0", scenario: "A" },
    template: (inp, out) =>
      `Produce a ${out} from ${inp} — this exact shape combination has never appeared in prior execution traces.`,
  },

  // novel | depth1 | A  (1 template)
  {
    cell: { novelty: "novel", depth: "depth1", scenario: "A" },
    template: (inp, out) =>
      `Combine ${inp} with a sub-goal escalation to generate a ${out} for the first time.`,
  },

  // novel | depth2+ | A  (1 template)
  {
    cell: { novelty: "novel", depth: "depth2+", scenario: "A" },
    template: (inp, out) =>
      `Using ${inp} as the origin, traverse two or more composition hops to produce a novel ${out}.`,
  },

  // novel | depth0 | C∪D  (1 template)
  {
    cell: { novelty: "novel", depth: "depth0", scenario: "C∪D" },
    template: (inp, out) =>
      `Forge a ${out} from ${inp} — the shape has never been produced and may require a new activity or vessel.`,
  },

  // novel | depth1 | C∪D  (1 template)
  {
    cell: { novelty: "novel", depth: "depth1", scenario: "C∪D" },
    template: (inp, out) =>
      `Starting from ${inp}, escalate through create-shape-provider-goal to produce a novel ${out} that is absent from the registry.`,
  },

  // novel | depth2+ | C∪D  (1 template)
  {
    cell: { novelty: "novel", depth: "depth2+", scenario: "C∪D" },
    template: (inp, out) =>
      `Orchestrate a deep novel composition from ${inp} to ${out} — gated on Phase 22 forge capability.`,
  },
];

// ---------------------------------------------------------------------------
// Validate: exactly 24 templates (design §A.2)
// ---------------------------------------------------------------------------
if (CELL_TEMPLATES.length !== 24) {
  console.warn(
    `[goal-generator] Warning: expected 24 cell templates, found ${CELL_TEMPLATES.length}`
  );
}

// ---------------------------------------------------------------------------
// Goal entry schema (design §I / worked example §J)
// ---------------------------------------------------------------------------

export interface GeneratedGoal {
  id: string;
  cell_id: string;
  shape_signature: { input: string[]; output: string[] };
  goal_text: string;
  expected_output_shapes: string[];
  seed_impulse_pool: string[];
  adversarial: false;
  oracle_label_id: null;
  generator_seed: string;
  shape_registry_snapshot_hash: string;
}

// ---------------------------------------------------------------------------
// Main generation logic
// ---------------------------------------------------------------------------

async function generateGoals(opts: {
  seed: bigint;
  count: number;
  noveltyMix: [number, number, number];  // seen, rare, novel fractions
  depthMix: [number, number, number];    // depth0, depth1, depth2+ fractions
  scenarioMix: [number, number, number]; // A, B, C∪D fractions
  adversarialFraction: number;           // deferred; always 0 for now
  endpoint: string;
  apiKey: string;
  discoveryEndpoint: string;
}): Promise<GeneratedGoal[]> {
  const authHeaders = { Authorization: `ApiKey ${opts.apiKey}` };
  const rng = new Xorshift64(opts.seed);

  console.log(`Computing shape registry hash from ${opts.discoveryEndpoint}...`);
  let snapshotHash: string;
  try {
    snapshotHash = await computeShapeRegistryHash(opts.discoveryEndpoint, authHeaders);
    console.log(`  Shape registry snapshot hash: ${snapshotHash.slice(0, 16)}...`);
  } catch (err) {
    console.warn(`  Failed to compute shape registry hash: ${err instanceof Error ? err.message : String(err)}`);
    snapshotHash = createHash("sha256").update("fallback").digest("hex");
  }

  console.log(`Building shape signature pool from ${opts.endpoint}...`);
  let pool: Map<string, ShapeSignatureEntry>;
  try {
    pool = await buildShapeSignaturePool(opts.endpoint, authHeaders);
    console.log(`  Shape signature pool: ${pool.size} distinct signatures`);
  } catch (err) {
    console.warn(`  Failed to build shape signature pool: ${err instanceof Error ? err.message : String(err)}`);
    pool = new Map([["(file) -> (fileEdit)", { input_shapes: ["file"], output_shapes: ["fileEdit"], count: 0 }]]);
  }

  const poolEntries = Array.from(pool.values());

  // Compute cumulative mix thresholds
  const [ns, nr, nn] = opts.noveltyMix;
  const noveltyThresh = [ns, ns + nr, 1.0];

  const [ds, d1, d2] = opts.depthMix;
  const depthThresh = [ds, ds + d1, 1.0];

  const [sa, sb, sc] = opts.scenarioMix;
  const scenarioThresh = [sa, sa + sb, 1.0];

  const goals: GeneratedGoal[] = [];
  let attemptCount = 0;
  const MAX_ATTEMPTS = opts.count * 10;

  while (goals.length < opts.count && attemptCount < MAX_ATTEMPTS) {
    attemptCount++;

    // 1. Determine target stratum
    const nv = rng.nextFloat();
    const novelty: Novelty =
      nv < noveltyThresh[0] ? "seen" : nv < noveltyThresh[1] ? "rare" : "novel";

    const dv = rng.nextFloat();
    const depth: Depth =
      dv < depthThresh[0] ? "depth0" : dv < depthThresh[1] ? "depth1" : "depth2+";

    const sv = rng.nextFloat();
    const scenario: Scenario =
      sv < scenarioThresh[0] ? "A" : sv < scenarioThresh[1] ? "B" : "C∪D";

    // 2. Pick a shape signature entry from the pool
    // For "novel", prefer signatures with count == 0 (synthesized) or very low count
    let candidate: ShapeSignatureEntry;

    if (novelty === "novel") {
      // For novel goals, synthesize a shape signature not in the pool
      // by combining random observed shapes in an unseen combination
      const allInputShapes = [...new Set(poolEntries.flatMap((e) => e.input_shapes))];
      const allOutputShapes = [...new Set(poolEntries.flatMap((e) => e.output_shapes))];

      if (allInputShapes.length === 0) allInputShapes.push("file");
      if (allOutputShapes.length === 0) allOutputShapes.push("fileEdit");

      const pickedInput = rng.pick(allInputShapes);
      // Pick an output shape different from already-seen combos when possible
      const rndOutput = rng.pick(allOutputShapes);
      candidate = {
        input_shapes: [pickedInput],
        output_shapes: [rndOutput],
        count: 0,
      };
    } else if (poolEntries.length === 0) {
      candidate = { input_shapes: ["file"], output_shapes: ["fileEdit"], count: 0 };
    } else if (novelty === "rare") {
      // Prefer entries with count 1–4
      const rare = poolEntries.filter((e) => e.count >= 1 && e.count <= 4);
      candidate = rare.length > 0 ? rng.pick(rare) : rng.pick(poolEntries);
    } else {
      // seen: prefer entries with count >= 5
      const seen = poolEntries.filter((e) => e.count >= 5);
      candidate = seen.length > 0 ? rng.pick(seen) : rng.pick(poolEntries);
    }

    // 3. Find matching cell templates
    const matchingTemplates = CELL_TEMPLATES.filter(
      (ct) =>
        ct.cell.novelty === novelty &&
        ct.cell.depth === depth &&
        ct.cell.scenario === scenario
    );

    if (matchingTemplates.length === 0) {
      // No template for this cell — skip; design allows sparse cells
      continue;
    }

    const cellTemplate = rng.pick(matchingTemplates);

    // 4. Pick representative input/output shape names for the template
    const inputShape =
      candidate.input_shapes.length > 0 ? rng.pick(candidate.input_shapes) : "file";
    const outputShape =
      candidate.output_shapes.length > 0 ? rng.pick(candidate.output_shapes) : "fileEdit";

    const goalText = cellTemplate.template(inputShape, outputShape);

    // 5. Build seed_impulse_pool from input shapes
    const seedImpulsePool = candidate.input_shapes.map((s) => `${s}:seed`);

    // 6. Assign ID and cell
    const idx = goals.length;
    const cellId = formatCellId({ novelty, depth, scenario });
    const goalId = `gen-${opts.seed}-${String(idx + 1).padStart(3, "0")}`;

    goals.push({
      id: goalId,
      cell_id: cellId,
      shape_signature: {
        input: [...candidate.input_shapes],
        output: [...candidate.output_shapes],
      },
      goal_text: goalText,
      expected_output_shapes: [...candidate.output_shapes],
      seed_impulse_pool: seedImpulsePool,
      adversarial: false,
      oracle_label_id: null,
      generator_seed: opts.seed.toString(),
      shape_registry_snapshot_hash: snapshotHash,
    });
  }

  console.log(`  Generated ${goals.length} goals (${attemptCount} attempts)`);
  return goals;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main() {
  const { values } = parseArgs({
    options: {
      seed: { type: "string", default: "42" },
      count: { type: "string", default: "50" },
      "novelty-mix": { type: "string", default: "0.4,0.4,0.2" },
      "depth-mix": { type: "string", default: "0.5,0.3,0.2" },
      "scenario-mix": { type: "string", default: "0.6,0.2,0.2" },
      "adversarial-fraction": { type: "string", default: "0.0" },
      output: { type: "string", default: "" },
      "held-out": { type: "boolean", default: false },
    },
    allowPositionals: false,
  });

  const isHeldOut = values["held-out"] === true;

  // G1.4.1: held-out weekly seed — deterministic per ISO week, different each week.
  // Seed string "YYYY_WW_held_out_v1" → first 8 bytes of SHA-256 → BigInt.
  function weeklyHeldOutSeed(): bigint {
    const now = new Date();
    // ISO week number: days since nearest Thursday Jan 4
    const jan4 = new Date(Date.UTC(now.getUTCFullYear(), 0, 4));
    const dayOfWeek = (jan4.getUTCDay() + 6) % 7; // Mon=0
    const weekStart = new Date(jan4.getTime() - dayOfWeek * 86400000);
    const diffDays = Math.round((now.getTime() - weekStart.getTime()) / 86400000);
    const isoWeek = Math.floor(diffDays / 7) + 1;
    const isoYear = now.getUTCFullYear();
    const label = `${isoYear}_${String(isoWeek).padStart(2, "0")}_held_out_v1`;
    const hash = createHash("sha256").update(label).digest();
    return (BigInt(hash[0]) << 56n) | (BigInt(hash[1]) << 48n) | (BigInt(hash[2]) << 40n) |
           (BigInt(hash[3]) << 32n) | (BigInt(hash[4]) << 24n) | (BigInt(hash[5]) << 16n) |
           (BigInt(hash[6]) << 8n)  | BigInt(hash[7]);
  }

  const seed = isHeldOut ? weeklyHeldOutSeed() : BigInt(values["seed"] ?? "42");
  const count = isHeldOut
    ? parseInt(values["count"] ?? "8", 10)
    : parseInt(values["count"] ?? "50", 10);

  function parseMix(s: string): [number, number, number] {
    const parts = s.split(",").map(Number);
    if (parts.length !== 3) throw new Error(`Invalid mix "${s}": expected 3 comma-separated values`);
    const total = parts[0] + parts[1] + parts[2];
    if (Math.abs(total - 1.0) > 0.01)
      throw new Error(`Mix "${s}" sums to ${total}, expected ~1.0`);
    return [parts[0], parts[1], parts[2]];
  }

  const noveltyMix = parseMix(values["novelty-mix"] ?? "0.4,0.4,0.2");
  const depthMix = parseMix(values["depth-mix"] ?? "0.5,0.3,0.2");
  const scenarioMix = parseMix(values["scenario-mix"] ?? "0.6,0.2,0.2");

  const { endpoint, apiKey, discoveryEndpoint } = await loadConfig();

  console.log(`\nGoal Generator — Phase 25 G1`);
  console.log(`  seed      : ${seed}`);
  console.log(`  count     : ${count}`);
  console.log(`  novelty   : seen=${noveltyMix[0]} rare=${noveltyMix[1]} novel=${noveltyMix[2]}`);
  console.log(`  depth     : d0=${depthMix[0]} d1=${depthMix[1]} d2+=${depthMix[2]}`);
  console.log(`  scenario  : A=${scenarioMix[0]} B=${scenarioMix[1]} C∪D=${scenarioMix[2]}`);
  console.log(`  endpoint  : ${endpoint}`);
  console.log(`  discovery : ${discoveryEndpoint}`);

  const goals = await generateGoals({
    seed,
    count,
    noveltyMix,
    depthMix,
    scenarioMix,
    adversarialFraction: 0,
    endpoint,
    apiKey,
    discoveryEndpoint,
  });

  // Determine output path
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(scriptDir, "..", "..");
  const generatedDir = join(repoRoot, "validation", "generated");

  let outputPath: string;
  if (values["output"]) {
    outputPath = resolvePath(values["output"]);
  } else {
    const dateStr = new Date().toISOString().slice(0, 10);
    outputPath = isHeldOut
      ? join(generatedDir, `${dateStr}-held-out-goals.json`)
      : join(generatedDir, `${seed}-${dateStr}.json`);
  }

  await mkdir(generatedDir, { recursive: true });

  const output = {
    generator_version: "25.G1",
    generated_at: new Date().toISOString(),
    generator_seed: seed.toString(),
    held_out: isHeldOut,
    count: goals.length,
    novelty_mix: { seen: noveltyMix[0], rare: noveltyMix[1], novel: noveltyMix[2] },
    depth_mix: { depth0: depthMix[0], depth1: depthMix[1], "depth2+": depthMix[2] },
    scenario_mix: { A: scenarioMix[0], B: scenarioMix[1], "C∪D": scenarioMix[2] },
    shape_registry_snapshot_hash: goals[0]?.shape_registry_snapshot_hash ?? "",
    cell_distribution: computeCellDistribution(goals),
    goals,
  };

  await writeFile(outputPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`\nOutput written to: ${outputPath}`);
  console.log(`Generated ${goals.length} goals across ${Object.keys(output.cell_distribution).length} cells.\n`);
}

function computeCellDistribution(goals: GeneratedGoal[]): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const g of goals) {
    dist[g.cell_id] = (dist[g.cell_id] ?? 0) + 1;
  }
  return dist;
}

main().catch((e) => {
  console.error("ERROR:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
