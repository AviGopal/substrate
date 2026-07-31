// self-operational-health.ts — READ-ONLY detector for the substrate's own
// DEPLOYMENT-BOUNDARY invariants.
//
// WHY: The substrate's existing self-detectors (model-reality-audit,
// composition-edge-reconcile, the dual-arm drift check) all watch issues INSIDE
// the MDP — its learning content. They are blind to the class of fault that
// lives at the substrate↔environment boundary: a measurement/self-correction
// timer that died on a container recreate, a measurement stream that went dark,
// a git push credential that expired, an autonomous-cutover loop that stalled.
// Those faults never become impulse shapes, so they never enter the state space
// S, never make a corrective activity applicable, and never touch a posterior —
// which is exactly why an OPERATOR has had to notice and hand-fix them (the S1
// load-bearing role on the operational axis).
//
// This detector lifts those invariants into the SAME gap ontology the
// model-reality loop already uses: each violation is emitted as a
// `substrateGap_write` impulse (category "operational_health") to
// development-vessel, so the fault shows up in the tracked `model-reality gaps`
// series and can gate a corrective activity — making operational self-repair
// something the substrate can SEE in S rather than something the operator
// notices hours later. (Detection only; closing the gap is the substrate's
// frontier — observe, don't nudge.)
//
// Strictly read-only: systemctl is-active, git log/ls-remote, file mtime, GETs.
// No writes except the gap emission (gated by EMIT_GAPS=1; dry-run otherwise).
//
// Run (in-container, where /workspace is the live volume and systemd is PID1):
//   EMIT_GAPS=1 bun "${SUBSTRATE_ROOT}/scripts/substrate/self-operational-health.ts"
// Smoke test:
//   docker exec substrate-live systemctl start self-operational-health.service
//   docker exec substrate-live journalctl -u self-operational-health.service -n 30 --no-pager

import { statSync, readdirSync, existsSync, readFileSync, accessSync, constants as fsConstants } from "node:fs";
import { join } from "node:path";

const KEY = process.env.METABOB_API_KEY ?? "";
const DEV = (process.env.DEV_VESSEL_ENDPOINT || "http://127.0.0.1:8090").replace(/\/$/, "") + "/v2/impulses/resolve";
const EMIT = process.env.EMIT_GAPS === "1";

// Thresholds (env-overridable).
const FRESH_MAX_MIN = Number(process.env.FRESH_MAX_MIN ?? 60);   // a measurement stream older than this = dark
const COMMIT_MAX_HR = Number(process.env.COMMIT_MAX_HR ?? 48);   // no autonomous cutover landed in this long = stalled
// Git repos to inspect for autonomous-commit recency. NOTE: /workspace/git/vessels
// is a PARENT dir of per-vessel clones (development-vessel, etc.), not a repo
// itself — each subdir is a separate git repo where the substrate's cutover
// actually lands. Enumerate them, plus the super-repo. (An earlier version
// checked /workspace/git/vessels directly, which `git -C` rejected, producing a
// false self_commit_stale even right after a real landing.)
function gitRepos(): string[] {
  const out: string[] = [];
  const superRepo = "/workspace/git/super-repo";
  if (existsSync(join(superRepo, ".git"))) out.push(superRepo);
  const vesselsParent = "/workspace/git/vessels";
  try {
    for (const name of readdirSync(vesselsParent)) {
      const dir = join(vesselsParent, name);
      if (existsSync(join(dir, ".git"))) out.push(dir);
    }
  } catch { /* parent absent -> just super-repo */ }
  return out;
}
const CLONES = gitRepos();

// Measurement streams that MUST keep ticking for autonomy to be observable.
// Only genuinely TIMER-BACKED collectors belong here — `criterion-coverage.ts`
// is deliberately excluded: it is an on-demand operator view (no timer, writes
// via import.meta.dir to the :ro repo path), so its file mtime is not a
// liveness signal and flagging it would be a false positive.
const METRIC_FILES = [
  "/workspace/metrics/autonomy-metrics.jsonl",   // autonomy-metrics.timer, 20m
  "/workspace/metrics/spectral-gap.jsonl",       // spectral-gap.timer
];

// Self-correction + measurement timers that MUST be active. A recreate that
// drops runtime-only enablement silently disables these (the fault this whole
// detector exists to surface).
const REQUIRED_TIMERS = [
  "autonomy-metrics.timer",
  "model-reality-audit.timer",
  "composition-edge-reconcile.timer",
  "funnel-drain.timer",
  "spectral-gap.timer",
  "observe-orthogonal-refresh.timer",
  // The immune system's OWN timers. Every check above watches the substrate's
  // loops, but nothing watched the watchers: if self-recovery, self-repair, or
  // pull-sync convergence dies on a recreate, every repair capability dies
  // silently with it (the exact recreate-drop fault this detector exists for).
  "self-recovery.timer",
  "self-repair-operational.timer",
  "self-operational-health.timer",
  "substrate-pull-sync.timer",
];

const now = Date.now();
const findings: Array<{ check: string; severity: string; detail: string }> = [];

async function emitGap(gap: Record<string, unknown>) {
  if (!EMIT) return;
  try {
    await fetch(DEV, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(KEY ? { Authorization: `ApiKey ${KEY}` } : {}) },
      body: JSON.stringify({ impulse: { pointer: { type: "substrateGap_write", gap } } }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) { console.warn("[self-op-health] emit failed:", (e as Error).message); }
}

// Record a finding and (when EMIT) lift it into the gap ontology. Stable id per
// check so re-emission upserts instead of piling duplicates.
function flag(check: string, severity: string, detail: string, signature: string, extra: Record<string, unknown> = {}) {
  findings.push({ check, severity, detail });
  void emitGap({
    id: `self-op-health:${check}`,
    category: "operational_health",
    source: "substrate_detected",
    summary: detail,
    detected_at: new Date(now).toISOString(),
    status: "open",
    classification_metadata: { detector: "self_operational_health", signature, severity, ...extra },
  });
}

function sh(cmd: string[], timeoutMs = 10000): { ok: boolean; out: string } {
  try {
    const p = Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe", timeout: timeoutMs });
    return { ok: p.exitCode === 0, out: new TextDecoder().decode(p.stdout).trim() };
  } catch (e) { return { ok: false, out: (e as Error).message }; }
}

// ── Check 1: measurement freshness ─────────────────────────────────────────
// A dark metrics stream means autonomy is unobservable — the S3 evidence
// channel (push-away, drift, bottleneck-stability) goes blind.
for (const f of METRIC_FILES) {
  try {
    const ageMin = (now - statSync(f).mtimeMs) / 60000;
    if (ageMin > FRESH_MAX_MIN) {
      flag("measurement_dark", "HIGH",
        `Measurement stream ${f.split("/").pop()} is ${ageMin.toFixed(0)}m stale (>${FRESH_MAX_MIN}m) → its collector timer is likely dead; autonomy is unobservable on this axis until restored.`,
        `dark:${f.split("/").pop()}`, { file: f, age_min: Math.round(ageMin) });
    }
  } catch {
    flag("measurement_missing", "HIGH",
      `Measurement stream ${f} does not exist → collector never ran in this deployment; KPI series cannot be built.`,
      `missing:${f.split("/").pop()}`, { file: f });
  }
}

// ── Check 2: self-correction / measurement timers active ───────────────────
// Catches the recreate-drop: a unit enabled only at runtime in a prior
// container is silently inactive in a fresh one. Role-aware: a unit
// apply-inventory.sh masked for the active role (/etc symlink → /dev/null,
// surfaced by systemctl as "masked") is intentionally down — a fleet decision,
// not drift — so it is skipped rather than false-flagged.
const inactive = REQUIRED_TIMERS.filter((t) => {
  if (sh(["systemctl", "is-enabled", t]).out === "masked") return false;
  return sh(["systemctl", "is-active", t]).out !== "active";
});
if (inactive.length) {
  flag("self_correction_timer_inactive", "HIGH",
    `${inactive.length} required self-correction/measurement timer(s) inactive: ${inactive.join(", ")} → that self-correction loop is dead and the capability is silently lost until re-enabled (typical cause: runtime-only enablement not surviving a container recreate).`,
    `timers:${inactive.sort().join("+")}`, { inactive });
}

// ── Check 2b: built repair mechanisms that are loaded but DORMANT ──────────
// Repair units can exist in the image (unit file present, e.g. db-maintenance,
// coherence-recover, trace-store-health-check, gap-compose timers) while being
// absent from the fleet inventory — so nothing enables them, nothing watches
// them, and the capability is silently missing. Do NOT force-enable here:
// absence from the inventory may be a deliberate fleet decision. Instead lift
// the dormancy into the gap ontology so the gap loop must DISPOSITION each
// unit (add it to the inventory/role selection, or retire the unit file)
// rather than let it drift. Masked units are skipped (role decision already
// made); units missing from the image are skipped (nothing to run).
const REPAIR_UNIT_CANDIDATES = [
  "db-maintenance.timer",
  "coherence-recover.timer",
  "trace-store-health-check.timer",
  "gap-compose.timer",
];
function inventoryUnits(): Set<string> {
  for (const f of ["/workspace/substrate/fleet/vessels.inventory.json", "/usr/local/share/substrate/vessels.inventory.json"]) {
    try {
      const j = JSON.parse(readFileSync(f, "utf8")) as { vessels?: Array<{ unit?: string }> };
      return new Set((j.vessels ?? []).map((v) => v.unit).filter((u): u is string => !!u));
    } catch { /* absent/unreadable → try next */ }
  }
  return new Set();
}
const invUnits = inventoryUnits();
const dormant = REPAIR_UNIT_CANDIDATES.filter((t) => {
  const enabledState = sh(["systemctl", "is-enabled", t]).out;
  if (enabledState === "" || enabledState === "not-found" || enabledState === "masked") return false;
  return sh(["systemctl", "is-active", t]).out !== "active";
});
if (dormant.length) {
  const declared = dormant.filter((t) => invUnits.has(t));
  flag("repair_unit_dormant", "MEDIUM",
    `${dormant.length} built repair unit(s) loaded but disabled/inactive: ${dormant.join(", ")}${declared.length ? ` (inventory-declared: ${declared.join(", ")})` : " (none declared in the fleet inventory)"} → each is a repair mechanism that exists in the image yet never runs, with nothing else noticing. Not auto-enabled — dormancy needs a DISPOSITION: enable it (declare it in the fleet inventory / role selection) or retire the unit file; until then this repair capability is silently absent.`,
    `repair_dormant:${[...dormant].sort().join("+")}`, { dormant, inventory_declared: declared });
}

// ── Landed-truth freshness: refresh the super-repo mirror before reading ───
// The super-repo clone is refreshed only at container start (git-push-setup
// oneshot), so every landed-truth read below goes stale over container uptime
// — a 3-day-old mirror produced false progress_stall/self_commit_stale gaps on
// 2026-07-09. This is the one deliberate exception to "strictly read-only":
// a bounded, best-effort ff-only refresh of our OWN mirror so the reads that
// follow reflect reality. Never merges divergence; failure is non-fatal.
{
  const superRepo = "/workspace/git/super-repo";
  if (CLONES.includes(superRepo)) {
    const f = sh(["git", "-C", superRepo, "fetch", "origin", "dev", "--quiet"], 30000);
    if (f.ok) sh(["git", "-C", superRepo, "merge", "--ff-only", "origin/dev", "--quiet"], 10000);
  }
}

// ── Check 3: autonomous-cutover recency ────────────────────────────────────
// The outer self-development loop: author → land → push. If no substrate-
// authored commit landed recently, the loop is stalled (or its credential is
// dead — see check 4), regardless of how many proposals were drafted.
let newestSubstrateCommit = 0; // unix seconds
for (const dir of CLONES) {
  const r = sh(["git", "-C", dir, "log", "-1", "--format=%ct", "--perl-regexp", "--author=(?i)substrate"]);
  const ct = r.ok ? parseInt(r.out, 10) : 0;
  if (Number.isFinite(ct) && ct > newestSubstrateCommit) newestSubstrateCommit = ct;
}
if (newestSubstrateCommit === 0) {
  flag("self_commit_absent", "MEDIUM",
    `No substrate-authored commit found in any push clone (${CLONES.join(", ")}) → the self-development loop has never landed code from this deployment, or the clones are unwired.`,
    "self_commit:absent");
} else {
  const ageHr = (now / 1000 - newestSubstrateCommit) / 3600;
  if (ageHr > COMMIT_MAX_HR) {
    flag("self_commit_stale", "MEDIUM",
      `Last substrate-authored commit was ${ageHr.toFixed(0)}h ago (>${COMMIT_MAX_HR}h) → the author→land→push loop is stalled; proposals may be drafting but not landing (check the cutover/funnel stage or the push credential).`,
      "self_commit:stale", { age_hr: Math.round(ageHr) });
  }
}

// ── Check 4: push-credential validity ──────────────────────────────────────
// Direct-push depends on a token-embedded remote. An expired/ephemeral token
// (gho_ OAuth vs a fine-grained PAT) silently breaks landing — the loop authors
// but cannot push, which presents as check-3 staleness with this as root cause.
{
  const dir = CLONES[0];
  // Fine-grained PATs flake intermittently against GitHub ("Invalid username
  // or token." on an otherwise-valid token) — push-health-observer learned to
  // retry 3× before classifying. A single un-retried probe here produced false
  // push_credential_invalid gaps while cutovers were in fact landing. Only
  // flag after repeated failure.
  let r = { ok: false, out: "" };
  for (let attempt = 0; attempt < 3 && !r.ok; attempt++) {
    if (attempt > 0) Bun.sleepSync(2000);
    r = sh(["git", "-C", dir, "ls-remote", "--exit-code", "origin", "HEAD"], 20000);
  }
  if (!r.ok) {
    flag("push_credential_invalid", "HIGH",
      `git ls-remote origin failed in ${dir} → the push credential is invalid/expired or origin is unreachable; the substrate can author but cannot land changes. (Distinguish network vs credential at triage.)`,
      "push_cred:fail", { clone: dir });
  }
}

// ── Check 5: efficacy / progress (alive != advancing) ──────────────────────
// Checks 1-4 verify the substrate is ALIVE (timers firing, streams fresh, push
// works, a commit landed within 48h). They all stay green even if the substrate
// makes ZERO forward progress for a full day — liveness != efficacy. "Alive but
// not advancing" (boredom/gap-compose timers fire, but the reach gate rejects
// every attempt as hollow → nothing reached → ribosome mints nothing → no new
// composition observed → no cutover lands) is exactly the stall the operator can
// see but the substrate currently cannot. Lift the EFFICACY expectation into the
// same gap ontology, measured from the substrate's OWN canonical KPI series
// (autonomy-metrics.jsonl, already freshness-checked above) — NOT an FTS query,
// which ranks by relevance and silently misses recent mints. This is a
// deliberately CONSERVATIVE frozen-engine backstop: it fires only when there is
// zero forward delta over PROGRESS_STALL_HR on BOTH a self-development axis
// (self_alteration.landed = code cutovers landed — the "manage its internal
// code" axis) AND an execution-throughput axis (topology.nested = nested
// executions produced). Either one advancing = the substrate is doing something,
// so no flag. Both flat = timers fire but produce NOTHING (a wedged engine /
// all-erroring dispatch) — a boundary fault distinct from Check 2 (timer active
// can still produce nothing). GENUINE-connectivity quality (λ₁, genuine edges)
// is already watched by the dedicated spectral-gap + composition-edge-reconcile
// detectors; this check is the coarse "is anything advancing at all" expectation.
// (Observe, don't nudge — closing it is the substrate's authoring frontier.)
const PROGRESS_STALL_HR = Number(process.env.PROGRESS_STALL_HR ?? 24);
const AUTONOMY_METRICS = "/workspace/metrics/autonomy-metrics.jsonl";
try {
  const lines = readFileSync(AUTONOMY_METRICS, "utf8").trim().split("\n").filter(Boolean);
  type Rec = { atMs: number; landed: number; nested: number };
  const recs: Rec[] = [];
  for (const ln of lines) {
    try {
      const j = JSON.parse(ln) as { at?: string; self_alteration?: { landed?: number }; topology?: { nested?: number } };
      const atMs = Date.parse(j.at ?? "");
      if (!Number.isFinite(atMs)) continue;
      recs.push({ atMs, landed: j.self_alteration?.landed ?? 0, nested: j.topology?.nested ?? 0 });
    } catch { /* skip malformed line */ }
  }
  if (recs.length >= 2) {
    const latest = recs[recs.length - 1]!;
    const windowStart = now - PROGRESS_STALL_HR * 3600_000;
    // Baseline = newest record at/just-before the window start; else the oldest
    // record (file younger than the window) so we still measure the full span.
    const before = recs.filter((r) => r.atMs <= windowStart);
    const baseline = before.length ? before[before.length - 1]! : recs[0]!;
    const dLanded = latest.landed - baseline.landed;
    const dNested = latest.nested - baseline.nested;
    if (dLanded <= 0 && dNested <= 0) {
      flag("progress_stall", "MEDIUM",
        `0 forward progress over ${PROGRESS_STALL_HR}h on BOTH axes — code-landing (self_alteration.landed Δ=${dLanded}) and topology (topology.nested Δ=${dNested}) — though measurement timers are live. Continuous operation is ALIVE but not ADVANCING: goals dispatch + the reach gate rejects them as hollow, so nothing reaches → nothing mints → no cutover lands → topology stays flat. Liveness checks 1-4 stay green through this; this makes the EFFICACY axis visible in S (the authoring-ceiling frontier).`,
        "progress:stall", { d_landed: dLanded, d_nested: dNested, window_hr: PROGRESS_STALL_HR, baseline_age_hr: Math.round((now - baseline.atMs) / 3600_000) });
    }
  }
  // <2 records → series too young to judge progress; Check 1 already flags a
  // dark/missing stream, so stay silent here rather than false-flag.
} catch (e) {
  console.warn(`[self-operational-health] progress check skipped: ${(e as Error).message}`);
}

// ── Check 6: workspace reachability ────────────────────────────────────────
// The /workspace volume is the substrate's live working root (WORKSPACE_ROOT):
// local-tools fs_* resolvers resolve here, and goal-host writes proposals,
// patterns, validation scenarios, metrics, and the cutover git clones under it.
// If the volume is unmounted (container-recreate race), read-only, or a required
// subdir is missing, goals that touch it fail with ENOENT/EACCES — a fault the
// operator reported but that was INVISIBLE to the substrate (no detector watched
// it; only downstream symptoms — a dark metric stream, stale commits — tripped).
// Lift workspace reachability into the gap ontology so the fault itself is seen
// in S. DETECTION ONLY — repairing a mount/permission is explicitly operator-
// boundary (self-repair-operational.ts never touches the filesystem); this gap
// escalates, it does not self-act.
const WORKSPACE_ROOT = (process.env.WORKSPACE_ROOT || "/workspace").replace(/\/$/, "");
// Subdirs goal-host hardcodes fs_writes to (see goal-host index.ts) + the metric
// + cutover-clone roots. Missing/RO any of these makes a class of goals fail.
const REQUIRED_WORKSPACE_DIRS = [
  "proposals", "patterns", "validation/failure-modes/scenarios",
  "observations", "metrics", "git/vessels", "git/super-repo",
].map((d) => join(WORKSPACE_ROOT, d));
function writable(p: string): boolean {
  try { accessSync(p, fsConstants.W_OK); return true; } catch { return false; }
}
if (!existsSync(WORKSPACE_ROOT)) {
  flag("workspace_unreachable", "HIGH",
    `Workspace root ${WORKSPACE_ROOT} does not exist → the live volume is unmounted (typical: container-recreate race before the volume attaches). Effectively ALL goals that read/write the workspace (fs_* resolvers, proposals, patterns, cutover clones, metrics) fail with ENOENT until it is mounted. Operator-boundary: remounting is not something the substrate can safely self-repair.`,
    "workspace:root_missing", { root: WORKSPACE_ROOT });
} else if (!writable(WORKSPACE_ROOT)) {
  flag("workspace_readonly", "HIGH",
    `Workspace root ${WORKSPACE_ROOT} exists but is NOT writable → fs_write goals, proposal/pattern emission, and cutover landing all fail with EACCES. Operator-boundary: a permission/remount fix is not in the self-repair allowlist.`,
    "workspace:root_ro", { root: WORKSPACE_ROOT });
} else {
  const missing = REQUIRED_WORKSPACE_DIRS.filter((d) => !existsSync(d));
  const readonly = REQUIRED_WORKSPACE_DIRS.filter((d) => existsSync(d) && !writable(d));
  if (missing.length || readonly.length) {
    flag("workspace_subdir_unavailable", "MEDIUM",
      `${missing.length} required workspace subdir(s) missing${missing.length ? ` (${missing.map((d) => d.replace(WORKSPACE_ROOT + "/", "")).join(", ")})` : ""}` +
      `${readonly.length ? ` and ${readonly.length} not writable (${readonly.map((d) => d.replace(WORKSPACE_ROOT + "/", "")).join(", ")})` : ""} → goals that fs_write to them fail with ENOENT/EACCES until created (an fs_write that does not mkdir -p its parent is the usual trigger). Lower-severity than a root fault: only that class of goal fails.`,
      `workspace:subdirs:${[...missing, ...readonly].map((d) => d.replace(WORKSPACE_ROOT + "/", "")).sort().join("+")}`,
      { missing, readonly });
  }
}

// ── Check 7: trace-spool drainage ──────────────────────────────────────────
// goal-host's TranslatingTraceSink spools traces that failed live delivery to
// /workspace/trace-spool and replays them every 60s (delete on 2xx, delete on
// deterministic 4xx, keep on 5xx/transport). A spool file older than a few
// replay cycles therefore means delivery is PERMANENTLY failing for that trace
// — the observed instance (2026-07-07): the hub store 500'd duplicate
// execution_ids ("already contains" on idx_activity_executions_execution_id),
// the sink classified 5xx as retryable, and 43 already-delivered traces
// replayed 4,200+ times/day with no detector aware. Stale spool = either a
// dead/misbehaving trace store or a permanent rejection misclassified as
// transient; both mean the at-least-once delivery contract is silently broken.
// DETECTION ONLY — the gap escalates; draining/fixing is a corrective activity.
const SPOOL_MAX_MIN = Number(process.env.SPOOL_MAX_MIN ?? 30);
const SPOOL_DIR = process.env.IAS_TRACE_SPOOL_DIR || join(WORKSPACE_ROOT, "trace-spool");
try {
  const spoolFiles = readdirSync(SPOOL_DIR).filter((f) => f.endsWith(".json"));
  let oldestAgeMin = 0;
  let staleCount = 0;
  const staleSamples: string[] = [];
  let sampleEndpoint = "";
  for (const name of spoolFiles) {
    const file = join(SPOOL_DIR, name);
    try {
      const ageMin = (now - statSync(file).mtimeMs) / 60000;
      if (ageMin <= SPOOL_MAX_MIN) continue;
      staleCount++;
      if (ageMin > oldestAgeMin) oldestAgeMin = ageMin;
      if (staleSamples.length < 5) {
        try {
          const rec = JSON.parse(readFileSync(file, "utf8")) as { trace_id?: string; endpoint?: string };
          staleSamples.push(rec.trace_id ?? name);
          if (!sampleEndpoint && rec.endpoint) sampleEndpoint = rec.endpoint;
        } catch { staleSamples.push(name); }
      }
    } catch { /* file drained between readdir and stat — fine */ }
  }
  if (staleCount > 0) {
    flag("trace_spool_stale", "HIGH",
      `${staleCount} trace-spool file(s) older than ${SPOOL_MAX_MIN}m (oldest ${oldestAgeMin.toFixed(0)}m) in ${SPOOL_DIR}${sampleEndpoint ? `, target store ${sampleEndpoint}` : ""} → the 60s replay loop cannot deliver them, so trace forwarding is permanently failing for these executions (dead store, schema rejection, or a permanent 5xx like a duplicate-key rejection misclassified as retryable). Sample execution_ids: ${staleSamples.join(", ")}. Every replay cycle re-POSTs doomed requests against the store until root-caused.`,
      "trace_spool:stale", { spool_dir: SPOOL_DIR, stale_count: staleCount, oldest_age_min: Math.round(oldestAgeMin), sample_trace_ids: staleSamples, endpoint: sampleEndpoint || undefined });
  }
} catch { /* spool dir absent = nothing ever spooled = healthy */ }

// ── Report ─────────────────────────────────────────────────────────────────
const high = findings.filter((f) => f.severity === "HIGH").length;
console.log(`[self-operational-health] DONE — ${findings.length} finding(s) (${high} HIGH). emit_gaps=${EMIT}`);
console.log(JSON.stringify({ findings, emit_gaps: EMIT, thresholds: { FRESH_MAX_MIN, COMMIT_MAX_HR, PROGRESS_STALL_HR } }, null, 2));
