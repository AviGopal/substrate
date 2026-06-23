// self-repair-operational.ts — the CORRECTIVE half of the operational-health
// loop. `self-operational-health.ts` DETECTS deployment-boundary faults and
// lifts them into the substrateGap ontology (visible in S). This script CLOSES
// exactly one safe, bounded class of them autonomously: a required
// measurement/self-correction TIMER that has gone inactive at runtime (crash,
// drift, or a container recreate that dropped runtime-only enablement).
//
// WHY this is the right autonomy increment (and why it is safe):
//   - It makes the substrate self-heal a fault the OPERATOR has had to hand-fix
//     — moving the operational axis from S1 (operator load-bearing) toward S2
//     (substrate repairs, operator supervises). Detect→repair is a closed loop.
//   - Blast radius is deliberately tiny: it acts on a HARDCODED ALLOWLIST of
//     known-good measurement/self-correction timers ONLY. It NEVER touches an
//     arbitrary unit, a vessel, the database, credentials, or source code; it
//     only `systemctl enable --now`s allowlisted timers (idempotent, reversible)
//     and never DISABLES anything. Anything outside the allowlist is left as an
//     open gap for the operator (escalation, not silent action).
//
// Strictly bounded writes: enable allowlisted timers + emit an audit record and
// resolve the corresponding substrateGap. Gated by REPAIR=1 (dry-run otherwise).
//
// Run (in-container; needs systemd PID1 + root):
//   REPAIR=1 bun /home/avi/.../scripts/substrate/self-repair-operational.ts

const KEY = process.env.METABOB_API_KEY ?? "";
const DEV = (process.env.DEV_VESSEL_ENDPOINT || "http://127.0.0.1:8090").replace(/\/$/, "") + "/v2/impulses/resolve";
const REPAIR = process.env.REPAIR === "1";

// The ONLY units this script will ever act on. Must mirror the detector's
// REQUIRED_TIMERS. Re-enabling any of these is safe (read-only collectors /
// self-correction loops) and idempotent. Editing this list is the sole lever
// for what the substrate may self-repair — keep it conservative.
const ALLOWLIST = [
  "autonomy-metrics.timer",
  "model-reality-audit.timer",
  "composition-edge-reconcile.timer",
  "funnel-drain.timer",
  "spectral-gap.timer",
  "observe-orthogonal-refresh.timer",
  "self-operational-health.timer",
];

function sh(cmd: string[], timeoutMs = 10000): { ok: boolean; out: string } {
  try {
    const p = Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe", timeout: timeoutMs });
    return { ok: p.exitCode === 0, out: new TextDecoder().decode(p.stdout).trim() };
  } catch (e) { return { ok: false, out: (e as Error).message }; }
}

async function emitGap(gap: Record<string, unknown>) {
  try {
    await fetch(DEV, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(KEY ? { Authorization: `ApiKey ${KEY}` } : {}) },
      body: JSON.stringify({ impulse: { pointer: { type: "substrateGap_write", gap } } }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) { console.warn("[self-repair] emit failed:", (e as Error).message); }
}

const now = new Date().toISOString();
const inactive = ALLOWLIST.filter((t) => sh(["systemctl", "is-active", t]).out !== "active");

const repaired: string[] = [];
const failed: string[] = [];

for (const t of inactive) {
  if (!REPAIR) { console.log(`[self-repair] DRY-RUN would enable --now ${t}`); continue; }
  const r = sh(["systemctl", "enable", "--now", t], 15000);
  // Confirm it actually came up.
  const active = sh(["systemctl", "is-active", t]).out === "active";
  if (r.ok && active) { repaired.push(t); console.log(`[self-repair] re-enabled ${t}`); }
  else { failed.push(t); console.warn(`[self-repair] FAILED to re-enable ${t}: ${r.out}`); }
}

if (REPAIR && repaired.length) {
  // Audit trail: a resolved gap recording the autonomous repair (the S2 signal —
  // the substrate fixed what the operator would have).
  await emitGap({
    id: `self-repair:timers:${now}`,
    category: "operational_health",
    source: "substrate_self_repair",
    summary: `Autonomously re-enabled ${repaired.length} inactive allowlisted timer(s): ${repaired.join(", ")} — closed without operator intervention.`,
    detected_at: now,
    status: "resolved",
    classification_metadata: { detector: "self_repair_operational", repaired, action: "systemctl enable --now" },
  });
  // Resolve the standing detector gap for this class now that it's fixed.
  await emitGap({
    id: "self-op-health:self_correction_timer_inactive",
    category: "operational_health",
    source: "substrate_self_repair",
    summary: `Resolved: inactive self-correction/measurement timers re-enabled (${repaired.join(", ")}).`,
    detected_at: now,
    status: "resolved",
    classification_metadata: { detector: "self_repair_operational", repaired },
  });
}

console.log(JSON.stringify({
  repair_enabled: REPAIR,
  inactive_at_start: inactive,
  repaired,
  failed,
  // Anything inactive that is NOT allowlisted would be left for the operator —
  // but by construction we only inspect the allowlist, so escalation = empty here.
}, null, 2));
console.log(`[self-repair-operational] DONE — ${repaired.length} repaired, ${failed.length} failed, repair=${REPAIR}`);
