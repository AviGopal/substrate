#!/usr/bin/env bun
/**
 * bootstrap-seeder.ts — seed shared activity templates into activity-api.
 *
 * Reads SHARED_TEMPLATES from @avigopal/ias-executor-ts (built at
 * /vessels/ias-executor-ts) and UPSERTs each template via
 * POST /v2/activities/templates. The endpoint is idempotent (UPSERT
 * semantics in SurrealDB), so re-running on every substrate restart is safe.
 *
 * Environment variables (from /etc/substrate/env):
 *   METABOB_API_KEY      — API key for activity-api auth
 *   METABOB_ENDPOINT     — activity-api base URL (default: http://127.0.0.1:8080)
 *
 * Exits 0 on success, non-zero on fatal error.
 *
 * Spec: openspec/changes/2026-05-23-substrate-explicit-vessels tasks.md §Phase 3
 *
 * `--pool-policy [--scope-file=<path>]` (development-vessel.service ExecStartPre):
 * seed the first autonomyScope and spendEnvelope records into a FRESH pool, from
 * the committed scripts/substrate/autonomy-scope.json, before the vessel serves.
 * See seedPoolPolicyIfFresh below. That mode reads no template and no key.
 */

import { constants as fsc } from "node:fs";
import { access, link, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

// FIRST-BOOT POLICY RECORDS. The autonomy scope and the spend envelope are read CLOSED when absent
// (development-vessel gap-to-feature: an own-substrate read that finds no record excludes every
// autonomous path and refuses autonomous spend). "No containment" and "no cap" exist only as explicit
// records ({unrestricted: true}, {uncapped: true}). So a fresh substrate would start with its autonomous
// lane, its undirected composes and its rhythm selection all refusing until an operator wrote both
// records with an admin key. This writes them once, on a FRESH pool only.
//
// FRESH = the pool file does not exist. A pool that exists but holds no record is exactly the absent
// case the readers refuse loudly; re-seeding it here would hide that (an operator retiring the scope, a
// node that lost its copy), so it is left alone.
//
// ONE SOURCE: the record bodies are the committed scripts/substrate/autonomy-scope.json, verbatim (its
// `autonomyScope` and `spendEnvelope` objects), never a list held here. The planned push-time containment
// check reads the same file. The first readable of: the super-repo clone at WORKSPACE_ROOT (the committed
// file at the clone's commit), then the copy baked into the image. A file that is missing or does not
// describe containment seeds NOTHING (the reads then refuse as absent): a bad file must not become policy.
//
// WHY A DIRECT FILE WRITE. Both shapes are trust roots: the pool store's one writer refuses them
// without an admin credential, and an in-process or fleet-key caller is refused. This runs as the
// vessel unit's ExecStartPre, before the vessel (the store's only writer) serves and before any admin
// key need exist: the bootstrap tier, by construction outside the gate rather than a bypass of it. It
// inherits the unit's environment, so WORKSPACE_ROOT resolves exactly as the vessel's does. The write
// is create-only (link, never rename over): a pool another writer created first is never clobbered.
//
// BOUNDED: every read and write is asynchronous and the whole mode races POOL_POLICY_TIMEOUT_MS; a hung
// read (a stuck mount, a FIFO where a file should be) exits non-zero inside the bound. The unit also
// wraps this in timeout(1), for a hang the event loop cannot see, and marks it '-', so the vessel starts.
//
// THE DEFAULT IS CONTAINED, NOT OPEN: the committed file holds the stage-1 lane core
// (contained-self-development), a class2 falsifier requirement and a 2 USD/h cap, not paused (a pause
// would also stop rhythm selection, which is not what a first boot should do). An unrestricted or
// uncapped substrate is an operator decision, written with an admin key.
const POOL_POLICY_TIMEOUT_MS = 20_000;
const IMAGE_SCOPE_FILE = "/usr/local/share/substrate/super-repo/scripts/substrate/autonomy-scope.json";
type ScopeFile = { autonomyScope: Record<string, unknown>; spendEnvelope: Record<string, unknown> };
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((e) => typeof e === "string" && e.trim().length > 0);
/** The committed containment, or why it cannot be used. Mirrors what the readers accept as a record. */
function validScopeFile(raw: unknown): ScopeFile | string {
  const d = raw as Partial<ScopeFile> | null;
  const sc = d?.autonomyScope, env = d?.spendEnvelope;
  if (!sc || typeof sc !== "object" || !env || typeof env !== "object") return "autonomyScope and spendEnvelope objects required";
  const paths = sc["excluded_paths"];
  if (sc["unrestricted"] === true ? paths !== undefined && !(Array.isArray(paths) && paths.length === 0) : !(strings(paths) && paths.length > 0)) return "autonomyScope needs a non-empty excluded_paths, or unrestricted:true alone";
  if (sc["require_falsifier_classes"] !== undefined && !strings(sc["require_falsifier_classes"])) return "require_falsifier_classes must be a string array";
  const cap = env["usd_cap_per_hour"];
  const capped = typeof cap === "number" && Number.isFinite(cap);
  if (capped === (env["uncapped"] === true)) return "spendEnvelope needs exactly one of a finite usd_cap_per_hour or uncapped:true";
  if (typeof env["paused"] !== "boolean") return "spendEnvelope.paused must be a boolean";
  return { autonomyScope: sc, spendEnvelope: env };
}
const exists = (p: string) => access(p, fsc.F_OK).then(() => true, () => false);
async function seedPoolPolicyIfFresh(workspaceRoot: string | undefined, scopeFiles: string[], now = new Date()): Promise<{ ok: boolean; line: string }> {
  const root = (workspaceRoot ?? "").trim();
  if (!root) return { ok: false, line: "WORKSPACE_ROOT unset: nothing seeded (the policy reads will refuse as absent)" };
  // The workspace root is the super-repo clone git-push-setup creates; creating it here would make that clone fail.
  if (!(await exists(root))) return { ok: false, line: `WORKSPACE_ROOT ${root} does not exist yet: nothing seeded (the policy reads will refuse as absent)` };
  const dir = join(root, "pool");
  const file = join(dir, "standing.json");
  if (await exists(file)) return { ok: true, line: `pool ${file} exists: not a fresh pool, nothing seeded` };
  let source = "";
  let scope: ScopeFile | null = null;
  for (const f of scopeFiles) {
    if (!(await exists(f))) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(await readFile(f, "utf8")); } catch (err) { return { ok: false, line: `scope file ${f} unreadable (${String(err)}): nothing seeded` }; }
    const v = validScopeFile(parsed);
    if (typeof v === "string") return { ok: false, line: `scope file ${f} does not describe containment (${v}): nothing seeded` };
    source = f; scope = v; break;
  }
  if (!scope) return { ok: false, line: `no scope file (${scopeFiles.join(", ")}): nothing seeded (the policy reads will refuse as absent)` };
  const at = now.toISOString();
  const why = `bootstrap default written by bootstrap-seeder --pool-policy on a fresh pool from ${source}. Change it only with an operator (admin) key through poolImpulse_write.`;
  const records = [
    { id: "autonomy-scope", shape: "autonomyScope", source: "bootstrap-seeder", status: "open", injected_at: at, updated_at: at, body: { ...scope.autonomyScope, reason: `contained-self-development stage 1: autonomous work may not land on what lands, verifies, grades or constrains autonomy. ${why}` } },
    { id: "spend-envelope", shape: "spendEnvelope", source: "bootstrap-seeder", status: "open", injected_at: at, updated_at: at, body: { ...scope.spendEnvelope, reason: `the committed spend envelope. ${why}` } },
  ];
  await mkdir(dir, { recursive: true });
  const tmp = `${file}.seed.${process.pid}.${Date.now()}`;
  await writeFile(tmp, JSON.stringify(records, null, 2), "utf8");
  try {
    await link(tmp, file); // create-only: EEXIST if a writer got there first
  } catch (err) {
    return { ok: true, line: `pool ${file} appeared while seeding (${(err as NodeJS.ErrnoException).code ?? String(err)}): nothing seeded` };
  } finally {
    await rm(tmp, { force: true });
  }
  const paths = scope.autonomyScope["excluded_paths"];
  return { ok: true, line: `seeded a fresh pool ${file} from ${source}: autonomyScope (${Array.isArray(paths) ? paths.length : 0} excluded paths) and spendEnvelope (${JSON.stringify(scope.spendEnvelope)})` };
}

if (process.argv.includes("--pool-policy")) {
  const arg = process.argv.find((a) => a.startsWith("--scope-file="));
  const root = (process.env.WORKSPACE_ROOT ?? "").trim();
  const files = arg ? [arg.slice("--scope-file=".length)] : [...(root ? [join(root, "scripts", "substrate", "autonomy-scope.json")] : []), IMAGE_SCOPE_FILE];
  const timer = setTimeout(() => {
    console.error(`[bootstrap-seeder] pool policy: TIMED OUT after ${POOL_POLICY_TIMEOUT_MS} ms (a pool or scope-file read hung): nothing seeded, the policy reads will refuse as absent`);
    process.exit(2);
  }, POOL_POLICY_TIMEOUT_MS);
  const r = await seedPoolPolicyIfFresh(root, files).catch((err) => ({ ok: false, line: "failed: " + String(err) }));
  clearTimeout(timer);
  (r.ok ? console.log : console.error)("[bootstrap-seeder] pool policy:", r.line);
  process.exit(r.ok ? 0 : 1);
}

const ENDPOINT = process.env.METABOB_ENDPOINT ?? "http://127.0.0.1:8080";
const API_KEY = process.env.METABOB_API_KEY ?? "";

const TEMPLATES_URL = `${ENDPOINT}/v2/activities/templates`;
const HEALTH_URL = `${ENDPOINT}/health`;

const log = {
  info: (...args: unknown[]) => console.log("[bootstrap-seeder]", ...args),
  warn: (...args: unknown[]) => console.warn("[bootstrap-seeder]", ...args),
  error: (...args: unknown[]) => console.error("[bootstrap-seeder]", ...args),
};

if (!API_KEY) {
  log.error("METABOB_API_KEY must be set");
  process.exit(1);
}

/** Wait for activity-api /health to return 200 (max 60s). */
async function waitForApi(maxMs = 60_000): Promise<void> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(5_000) });
      if (r.ok) return;
    } catch {
      // not ready yet
    }
    await Bun.sleep(2_000);
  }
  throw new Error(`activity-api not ready after ${maxMs}ms at ${HEALTH_URL}`);
}

/**
 * POST one template to activity-api.
 * Uses POST /v2/activities/templates which performs an UPSERT — idempotent
 * across substrate restarts.
 */
async function seedTemplate(template: { id: string }): Promise<void> {
  const response = await fetch(TEMPLATES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `ApiKey ${API_KEY}`,
    },
    body: JSON.stringify(template),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "(no body)");
    // A LAW-3 REUSE REFUSAL IS NOT A SEEDING FAILURE.
    //
    // activity-api refuses a template whose output shape already has a producer
    // ("refused duplicate mint: N existing producer(s) — route to … instead of
    // minting a new Beta(1,1) cell"). That refusal is the learning loop working
    // as designed, and the post-condition seeding actually cares about — a
    // producer for this shape exists — is SATISFIED. Counting it as a failure
    // made every clean first boot end with the unit `failed` and
    // substrate-doctor red, on a substrate that was behaving correctly.
    //
    // Match on the refusal's own words rather than the status code, because the
    // same code carries genuine validation errors that must still fail.
    if (/duplicate mint|existing producer|already[ _-]?exists/i.test(body)) {
      throw new AlreadyServedError(
        `existing producer already serves '${template.id}' — reuse, not a failure`,
      );
    }
    throw new Error(
      `POST /v2/activities/templates returned ${response.status} for template '${template.id}': ${body}`,
    );
  }
}

/** Refusal that means the capability is already present. Not a seeding failure. */
class AlreadyServedError extends Error {}

async function main(): Promise<void> {
  // Loaded here, not at module top, so --pool-policy never depends on the ias tree.
  const { SHARED_TEMPLATES } = await import("/vessels/ias-executor-ts/src/templates/index");
  log.info(`Waiting for activity-api at ${ENDPOINT}…`);
  await waitForApi();
  log.info(`activity-api ready. Seeding ${SHARED_TEMPLATES.length} shared templates…`);

  let seeded = 0;
  let alreadyServed = 0;
  let failed = 0;

  for (const template of SHARED_TEMPLATES) {
    try {
      await seedTemplate(template);
      seeded++;
      log.info(`  ✓ ${template.id}`);
    } catch (err) {
      if (err instanceof AlreadyServedError) {
        alreadyServed++;
        log.info(`  = ${template.id}: ${err.message}`);
        continue;
      }
      failed++;
      log.warn(`  ✗ ${template.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const present = seeded + alreadyServed;
  if (failed > 0) {
    log.warn(
      `Seeding complete: ${seeded} seeded, ${alreadyServed} already served, ${failed} FAILED.`,
    );
    // Non-zero exit so systemd marks the unit as failed and journald captures it.
    process.exit(1);
  }

  // Report reuse separately rather than folding it into either bucket: an
  // operator reading this line needs to distinguish "nothing was there and I
  // seeded it" from "it was already served", and neither is a failure.
  log.info(
    `Seeding complete: ${present}/${SHARED_TEMPLATES.length} templates present` +
      (alreadyServed > 0 ? ` (${seeded} seeded, ${alreadyServed} already served)` : ""),
  );
  process.exit(0);
}

main().catch((err) => {
  log.error("Fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
