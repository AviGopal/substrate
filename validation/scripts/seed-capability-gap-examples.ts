#!/usr/bin/env bun
/**
 * seed-capability-gap-examples — Mints the LLM's starting prior for the
 * capability-gap-audit → resolver-author loop (Part D of the meta-cognition
 * bootstrap, 2026-06-05).
 *
 * Mints three concepts:
 *   1. example_capability_gap_pattern (source_type=capability_gap_example) —
 *      one concrete reference of what a capability gap looks like + how
 *      resolver-author should respond.
 *   2. substrate_extends_its_own_capability_surface_when_gaps_exist —
 *      architectural principle (source_type=architectural_pattern_principle).
 *   3. every_failure_with_no_handler_is_a_capability_gap — architectural
 *      principle, severity=structural.
 *
 * Idempotency: concept-db's content-signature dedup catches re-runs.
 */

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const CONCEPT_DB_URL = process.env.CONCEPT_DB_URL || "http://127.0.0.1:18260";

interface Entry {
  name: string;
  shape: string;
  source_type: string;
  summary: string;
  content: string;
  signature: string;
}

const ENTRIES: Entry[] = [
  {
    name: "example_capability_gap_pattern",
    shape: "capability_gap_example",
    source_type: "capability_gap_example",
    summary: "Concrete reference: 'unknown shape' error in a chain attempt indicates a capability gap; author the missing resolver.",
    content:
      "Pattern: trace shows 'unknown shape: git_status_with_dirty_files' error " +
      "from a task that tried to dispatch that shape. The substrate needed a " +
      "resolver that returns git working-tree state with per-file dirty status. " +
      "None existed. Resolver-authoring chain authored " +
      "repos/development-vessel/src/resolvers/git-status-with-dirty-files.ts " +
      "following the three-place rule, registered the shape, passed typecheck, " +
      "committed via host-sync. Generalization: any 'unknown shape' error in " +
      "a successful chain attempt indicates a capability gap; the gap's name " +
      "should be the missing shape; the resolver to author should produce " +
      "that shape. This is what capability_gap_audit detects and what " +
      "resolver-author closes.",
    signature: "capability_gap_example__git_status_with_dirty_files_v1",
  },
  {
    name: "substrate_extends_its_own_capability_surface_when_gaps_exist",
    shape: "architectural_pattern_principle",
    source_type: "architectural_pattern_principle",
    summary: "Substrate must author missing resolvers when it observes its own capability gaps; capability surface is not fixed by operator.",
    content:
      "[principle__substrate_extends_its_own_capability_surface] When the " +
      "substrate observes traces where tasks failed due to missing capability " +
      "(unknown shape, no handler, unsupported feature), it must author the " +
      "missing resolver via the resolver-author chain. The capability surface " +
      "is not fixed by operator; it grows by substrate observation of its own " +
      "needs. Every layer before this (orthogonality detector, validation " +
      "activities, template-mitosis, vessel-mitosis) operated WITHIN the " +
      "existing capability surface. This principle directs the substrate to " +
      "EXTEND that surface in response to its own failure traces. " +
      "Detection: capability_gap_audit emits substrateGap with " +
      "category=missing_capability. Closure: resolver-author seed template " +
      "consumes the gap and produces a 4-file proposal that " +
      "apply_proposal_as_patch's multifile branch stages for cutover.",
    signature: "principle__substrate_extends_capability_surface_v1",
  },
  {
    name: "every_failure_with_no_handler_is_a_capability_gap",
    shape: "architectural_pattern_principle",
    source_type: "architectural_pattern_principle",
    summary: "Any 'unknown shape: X' or 'no resolver for type Y' failure is a capability gap, not a bug to remove the calling task.",
    content:
      "[principle__every_no_handler_is_capability_gap] Any task failure with " +
      "error pattern 'unknown shape: X' or 'no resolver for type Y' or " +
      "endpoint-404 on substrate-internal paths is a capability gap, not a " +
      "bug. The correct fix is to author the missing resolver, not to remove " +
      "or rewrite the calling task. Removing the call hides the gap; the " +
      "substrate's capability surface stays small. Authoring the resolver " +
      "grows the surface and lets future LLM-authored chains use the new " +
      "capability without re-deriving it. capability_gap_audit operationalizes " +
      "this principle by aggregating failure signatures and emitting " +
      "substrateGap rows that the resolver-author chain consumes.",
    signature: "principle__no_handler_is_capability_gap_v1",
  },
];

async function loadApiKey(): Promise<string> {
  const env = process.env.METABOB_API_KEY;
  if (env) return env;
  try {
    const raw = await readFile(join(homedir(), ".metabob", "config.json"), "utf-8");
    const cfg = JSON.parse(raw);
    if (typeof cfg?.metabob?.apiKey === "string") return cfg.metabob.apiKey;
  } catch { /* fall through */ }
  return "";
}

async function exists(apiKey: string, signature: string, sourceType: string): Promise<boolean> {
  const url = `${CONCEPT_DB_URL}/concepts/search?source_type=${encodeURIComponent(sourceType)}&limit=100`;
  const headers: Record<string, string> = {};
  if (apiKey) headers["Authorization"] = `ApiKey ${apiKey}`;
  try {
    const r = await fetch(url, { headers });
    if (!r.ok) return false;
    const j = await r.json() as { concepts?: Array<{ summary?: string; content?: string }> };
    return (j.concepts ?? []).some((c) =>
      (typeof c.summary === "string" && c.summary.includes(signature)) ||
      (typeof c.content === "string" && c.content.includes(signature)));
  } catch { return false; }
}

async function mint(apiKey: string, entry: Entry): Promise<void> {
  const body = {
    source_type: entry.source_type,
    shape: entry.shape,
    summary: entry.summary,
    content: `[${entry.signature}] ${entry.content}`,
    priority: 0.7,
    budget: 2000,
    pointer: { type: "memo", path: "validation/scripts/seed-capability-gap-examples.ts", section: entry.name },
    metadata: { signature: entry.signature, principle_name: entry.name, seed_source: "seed-capability-gap-examples" },
  };
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `ApiKey ${apiKey}`;
  const r = await fetch(`${CONCEPT_DB_URL}/concepts`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`mint failed ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json() as { id?: string };
  console.log(`  minted ${entry.name} → ${j.id ?? "<no id>"}`);
}

async function main(): Promise<void> {
  const apiKey = await loadApiKey();
  if (!apiKey) console.warn("warning: no METABOB_API_KEY — proceeding unauthenticated");
  console.log(`seeding ${ENTRIES.length} capability-gap concepts to ${CONCEPT_DB_URL}`);
  let minted = 0, skipped = 0, failed = 0;
  for (const e of ENTRIES) {
    try {
      if (await exists(apiKey, e.signature, e.source_type)) { console.log(`  skip ${e.name} (already present)`); skipped++; continue; }
      await mint(apiKey, e); minted++;
    } catch (err) { console.error(`  FAIL ${e.name}: ${(err as Error).message}`); failed++; }
  }
  console.log(`done: minted=${minted} skipped=${skipped} failed=${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });
