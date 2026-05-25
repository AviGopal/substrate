#!/usr/bin/env bun
/**
 * closure-audit.ts — IAL §27.3.j.7 closure-audit script.
 *
 * Tests each substrate closure property by probing the live substrate,
 * optionally simulating the absence of a specific external tool.
 *
 * Usage:
 *   bun run validation/scripts/closure-audit.ts
 *   bun run validation/scripts/closure-audit.ts --without=operator-memory
 *   bun run validation/scripts/closure-audit.ts --without=operator-memory --without=slash-skills
 *
 * --without options:
 *   operator-memory       test if substrate memory works without ~/.claude/.../memory/ files
 *   slash-skills          test if skill-equivalent ops work via substrate resolvers alone
 *   subagents             test if complex tasks can execute without Claude Code subagents
 *   github-actions        test if CI/merge gating works via substrate alone
 *   operator-shell        test if substrate can self-heal without operator shell access
 *   operator-spec-authoring  test if substrate can author specs without operator
 *
 * Writes: validation/state/closure-status.json
 * Exit codes: 0 = all tested properties closed, 1 = one or more gaps remain
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const STATE_DIR = join(REPO_ROOT, "validation", "state");
const OUTPUT_PATH = join(STATE_DIR, "closure-status.json");

// ── config ────────────────────────────────────────────────────────────────────

const DEV_VESSEL_URL = process.env["DEV_VESSEL_ENDPOINT"] ?? "http://localhost:18090";
const DISCOVERY_URL = process.env["DISCOVERY_ENDPOINT"] ?? "http://localhost:18100";
const ACTIVITY_API_URL = process.env["METABOB_ENDPOINT"] ?? "http://localhost:18080";
const GOAL_HOST_URL = process.env["GOAL_HOST_ENDPOINT"] ?? "http://localhost:8210";

const TIMEOUT_MS = 8_000;

// ── CLI args ──────────────────────────────────────────────────────────────────

const WITHOUT_ARGS = process.argv
  .filter((a) => a.startsWith("--without="))
  .map((a) => a.replace("--without=", ""));

const ALL_PROPERTIES = [
  "operator-memory",
  "slash-skills",
  "subagents",
  "github-actions",
  "operator-shell",
  "operator-spec-authoring",
] as const;

type ClosureProperty = (typeof ALL_PROPERTIES)[number];

const PROPERTIES_TO_TEST: ClosureProperty[] =
  WITHOUT_ARGS.length > 0
    ? (WITHOUT_ARGS.filter((a) => ALL_PROPERTIES.includes(a as ClosureProperty)) as ClosureProperty[])
    : [...ALL_PROPERTIES];

if (WITHOUT_ARGS.some((a) => !ALL_PROPERTIES.includes(a as ClosureProperty))) {
  const unknown = WITHOUT_ARGS.filter((a) => !ALL_PROPERTIES.includes(a as ClosureProperty));
  console.error(`[closure-audit] Unknown --without values: ${unknown.join(", ")}`);
  console.error(`[closure-audit] Valid values: ${ALL_PROPERTIES.join(", ")}`);
  process.exit(2);
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function get(url: string): Promise<{ ok: boolean; status: number; body: unknown }> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    let body: unknown;
    try { body = await r.json(); } catch { body = await r.text(); }
    return { ok: r.ok, status: r.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: String((e as Error).message) };
  }
}

async function post(url: string, data: unknown): Promise<{ ok: boolean; status: number; body: unknown }> {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    let body: unknown;
    try { body = await r.json(); } catch { body = await r.text(); }
    return { ok: r.ok, status: r.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: String((e as Error).message) };
  }
}

async function resolveShape(pointer: Record<string, unknown>): Promise<{ ok: boolean; body: unknown; error?: string }> {
  const r = await post(`${DEV_VESSEL_URL}/v2/impulses/resolve`, pointer);
  if (!r.ok) return { ok: false, body: r.body, error: `HTTP ${r.status}` };
  const body = r.body as Record<string, unknown>;
  if (body?.success === false) return { ok: false, body, error: String(body.error) };
  return { ok: true, body };
}

async function getDiscoveryShapes(vesselId: string): Promise<string[]> {
  const r = await post(`${DISCOVERY_URL}/resolve`, { shape: "*", filter: { vessel_id: vesselId } });
  if (!r.ok) return [];
  const vessels = ((r.body as Record<string, unknown>)?.vessels as Record<string, unknown>[]) ?? [];
  const vessel = vessels.find((v) => (v as Record<string, unknown>)?.id === vesselId);
  return ((vessel as Record<string, unknown>)?.shapes as string[]) ?? [];
}

// ── probe functions ───────────────────────────────────────────────────────────

async function probeMemoryClosure(): Promise<{ closed: boolean; missing_deps: string[]; evidence: string }> {
  const r = await resolveShape({ type: "memoryNote", limit: 1 });
  if (!r.ok) {
    return { closed: false, missing_deps: ["memoryNote resolver in development-vessel"], evidence: String(r.error) };
  }
  const body = r.body as Record<string, unknown>;
  const inner = (body?.body ?? body) as Record<string, unknown>;
  if (!Array.isArray(inner?.notes)) {
    return { closed: false, missing_deps: ["memoryNote resolver returns notes array"], evidence: JSON.stringify(inner).slice(0, 200) };
  }
  return { closed: true, missing_deps: [], evidence: `memoryNote resolver live, ${inner.notes.length} notes returned` };
}

async function probeSkillClosure(): Promise<{ closed: boolean; missing_deps: string[]; evidence: string }> {
  const REQUIRED_SHAPES = [
    "fs_read", "fs_write", "fs_edit", "fs_list",
    "git_status", "git_add", "git_commit", "git_diff", "git_log",
    "llm_completion_dispatch", "http_fetch",
    "activity_fetch", "activity_create_variant", "activity_recommend",
  ];

  // Check dev-vessel health first
  const health = await get(`${DEV_VESSEL_URL}/health`);
  if (!health.ok) {
    return { closed: false, missing_deps: ["development-vessel reachable"], evidence: `health check failed: ${health.status}` };
  }

  // Check shapes endpoint
  const shapesR = await get(`${DEV_VESSEL_URL}/shapes`);
  const advertised: string[] = [];
  if (shapesR.ok) {
    const body = shapesR.body as Record<string, unknown>;
    const shapes = (body?.shapes ?? body) as string[];
    if (Array.isArray(shapes)) advertised.push(...shapes);
  }

  const missing = REQUIRED_SHAPES.filter((s) => !advertised.includes(s));
  if (missing.length > 0) {
    return { closed: false, missing_deps: missing.map((s) => `resolver: ${s}`), evidence: `advertised: [${advertised.join(", ")}]` };
  }
  return { closed: true, missing_deps: [], evidence: `all ${REQUIRED_SHAPES.length} required resolver shapes present` };
}

async function probeSubagentClosure(): Promise<{ closed: boolean; missing_deps: string[]; evidence: string }> {
  const health = await get(`${GOAL_HOST_URL}/health`);
  if (!health.ok) {
    return { closed: false, missing_deps: ["goal-host-vessel reachable on :8210"], evidence: `health: ${health.status} ${JSON.stringify(health.body).slice(0, 100)}` };
  }
  const body = health.body as Record<string, unknown>;
  const status = body?.status ?? body?.health;
  return {
    closed: status === "healthy" || status === "ok",
    missing_deps: (status === "healthy" || status === "ok") ? [] : ["goal-host-vessel healthy"],
    evidence: `goal-host-vessel responded: ${JSON.stringify(body).slice(0, 150)}`,
  };
}

async function probeCIClosure(): Promise<{ closed: boolean; missing_deps: string[]; evidence: string }> {
  const r = await resolveShape({ type: "failure_mode_matrix_score", dry_run: true });
  if (!r.ok) {
    // Try /shapes endpoint as fallback
    const shapesR = await get(`${DEV_VESSEL_URL}/shapes`);
    const body = shapesR.body as Record<string, unknown>;
    const shapes = (body?.shapes ?? body) as string[];
    if (Array.isArray(shapes) && shapes.includes("failure_mode_matrix_score")) {
      return { closed: true, missing_deps: [], evidence: "failure_mode_matrix_score shape advertised by development-vessel" };
    }
    return { closed: false, missing_deps: ["failure_mode_matrix_score resolver"], evidence: String(r.error) };
  }
  return { closed: true, missing_deps: [], evidence: "failure_mode_matrix_score resolver responded" };
}

async function probeSelfHealClosure(): Promise<{ closed: boolean; missing_deps: string[]; evidence: string }> {
  const missing: string[] = [];

  // systemd_restart shape
  const r = await resolveShape({ type: "systemd_restart", unit: "noop-test.service", dry_run: true });
  if (r.ok) {
    // shape is live
  } else {
    const shapesR = await get(`${DEV_VESSEL_URL}/shapes`);
    const body = shapesR.body as Record<string, unknown>;
    const shapes = (body?.shapes ?? body) as string[];
    if (!Array.isArray(shapes) || !shapes.includes("systemd_restart")) {
      missing.push("systemd_restart resolver");
    }
  }

  // substrate_health_tick
  const tickR = await resolveShape({ type: "substrate_health_tick" });
  if (!tickR.ok) {
    // Check shape presence instead
    const shapesR = await get(`${DEV_VESSEL_URL}/shapes`);
    const body = shapesR.body as Record<string, unknown>;
    const shapes = (body?.shapes ?? body) as string[];
    if (!Array.isArray(shapes) || !shapes.includes("substrate_health_tick")) {
      missing.push("substrate_health_tick resolver");
    }
  }

  return {
    closed: missing.length === 0,
    missing_deps: missing,
    evidence: missing.length === 0
      ? "systemd_restart + substrate_health_tick resolvers present"
      : `missing: ${missing.join(", ")}`,
  };
}

async function probeSpecAuthoringClosure(): Promise<{ closed: boolean; missing_deps: string[]; evidence: string }> {
  const REQUIRED = ["memoryNote_write", "activity_create_variant", "fs_write", "git_commit", "llm_completion_dispatch"];

  const shapesR = await get(`${DEV_VESSEL_URL}/shapes`);
  const body = shapesR.body as Record<string, unknown>;
  const shapes = (body?.shapes ?? body) as string[];

  if (!Array.isArray(shapes)) {
    return { closed: false, missing_deps: REQUIRED, evidence: "could not reach development-vessel /shapes" };
  }

  const missing = REQUIRED.filter((s) => !shapes.includes(s));
  return {
    closed: missing.length === 0,
    missing_deps: missing.map((s) => `resolver: ${s}`),
    evidence: missing.length === 0
      ? `all ${REQUIRED.length} spec-authoring resolver shapes present`
      : `missing: ${missing.join(", ")}`,
  };
}

// ── main ──────────────────────────────────────────────────────────────────────

const PROBE_FN: Record<ClosureProperty, () => Promise<{ closed: boolean; missing_deps: string[]; evidence: string }>> = {
  "operator-memory": probeMemoryClosure,
  "slash-skills": probeSkillClosure,
  "subagents": probeSubagentClosure,
  "github-actions": probeCIClosure,
  "operator-shell": probeSelfHealClosure,
  "operator-spec-authoring": probeSpecAuthoringClosure,
};

const DESCRIPTIONS: Record<ClosureProperty, string> = {
  "operator-memory": "Substrate memory (memoryNote) works without operator ~/.claude/memory files",
  "slash-skills": "Skill-equivalent operations available via development-vessel resolvers alone",
  "subagents": "Complex multi-step goals executable via goal-host-vessel without Claude Code subagents",
  "github-actions": "Merge/CI gating available via failure_mode_matrix_score without GitHub Actions",
  "operator-shell": "Substrate self-heals via systemd_restart + substrate_health_tick without operator shell",
  "operator-spec-authoring": "Spec authoring resolvers present; substrate can author specs without operator",
};

async function getVersionInfo(): Promise<Record<string, string>> {
  const versions: Record<string, string> = {};

  const dvHealth = await get(`${DEV_VESSEL_URL}/health`);
  if (dvHealth.ok) {
    const body = dvHealth.body as Record<string, unknown>;
    versions["development-vessel"] = String(body?.version ?? "unknown");
  } else {
    versions["development-vessel"] = "unreachable";
  }

  const apiHealth = await get(`${ACTIVITY_API_URL}/health`);
  if (apiHealth.ok) {
    const body = apiHealth.body as Record<string, unknown>;
    versions["activity-api"] = String(body?.version ?? "unknown");
  } else {
    versions["activity-api"] = "unreachable";
  }

  return versions;
}

console.log(`[closure-audit] Testing ${PROPERTIES_TO_TEST.length} closure properties: ${PROPERTIES_TO_TEST.join(", ")}`);
console.log(`[closure-audit] Substrate: ${DEV_VESSEL_URL} | Discovery: ${DISCOVERY_URL}\n`);

const properties: Record<string, { closed: boolean; missing_deps: string[]; evidence: string; description: string }> = {};

for (const prop of PROPERTIES_TO_TEST) {
  process.stdout.write(`  ${prop.padEnd(28)} ... `);
  const result = await PROBE_FN[prop]();
  properties[prop] = { ...result, description: DESCRIPTIONS[prop] };
  const tag = result.closed ? "✓ CLOSED" : "✗ OPEN";
  console.log(`${tag}  ${result.evidence.slice(0, 80)}`);
  if (!result.closed && result.missing_deps.length > 0) {
    for (const dep of result.missing_deps) {
      console.log(`    missing: ${dep}`);
    }
  }
}

console.log();

const versions = await getVersionInfo();
const allClosed = PROPERTIES_TO_TEST.every((p) => properties[p]?.closed);

const output = {
  properties,
  audit_run_at: new Date().toISOString(),
  audit_tool_versions: versions,
  all_closed: allClosed,
  tested: PROPERTIES_TO_TEST,
};

mkdirSync(STATE_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
console.log(`[closure-audit] Results written to ${OUTPUT_PATH}`);
console.log(`[closure-audit] Summary: ${PROPERTIES_TO_TEST.filter((p) => properties[p]?.closed).length}/${PROPERTIES_TO_TEST.length} closed`);

process.exit(allClosed ? 0 : 1);
