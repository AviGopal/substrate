#!/usr/bin/env bun
/**
 * runtime-drift-tick.ts — liveness watchdog for the runtime-vs-committed source invariant.
 *
 * THE INVARIANT. `/vessels/<v>/src` is a MIRROR of the committed source in
 * `/workspace/git/vessels/<v>/src`. A mitosis cutover writes the commit, mirrors it to
 * live, and restarts the unit. Between those steps `feature_compose` legitimately edits
 * the live tree in place and rolls back on an unfavourable verdict — so transient
 * divergence WHILE A COMPOSE HOLDS A SLOT is normal and must not be touched.
 *
 * Divergence with NO compose in flight is not normal: it means an edit was applied and
 * never reverted. `feature_compose` declines to roll back when it finds the file already
 * changed ("SKIPPING ROLLBACK — file content has changed (likely by another concurrent
 * compose)"), which is safe only if some other holder will revert it. When the other
 * holder has already exited, nobody does, and the un-reverted edit persists.
 *
 * WHY THIS IS A WATCHDOG AND NOT AN ACTIVITY. Observed twice on 2026-09-13: the live copy
 * of `development-vessel/src/resolvers/gap-to-feature.ts` was left syntactically invalid
 * (a duplicated `const`, then an inline-duplicated array literal) while the COMMIT was
 * clean. The unit stayed `active` and `/health` returned ok because the module was already
 * loaded — the damage only detonates on the next restart, taking the gap->spec pipeline
 * with it. A check that must survive a broken `gap-to-feature` cannot be scheduled by the
 * mechanism it exists to recover, which is the liveness-watchdog exemption in CLAUDE.md's
 * script-retention rule. It is the same reason the other two ticks are exempt.
 *
 * WHAT IT DOES. Read-only except (a) a substrateGap per drifted vessel and (b) the
 * repair below. Silent and trace-free when nothing has drifted.
 *
 * REPAIR. `mirror-to-live <vessel>` is the canonical src->/vessels mirror and is already
 * the remedy named by patch_with_tools' poisoned-baseline refusal
 * ("restore it with mirror-to-live"); pull-cutover.ts drives it the same way. This tick
 * only invokes it when the evidence is unambiguous:
 *
 *   drift  AND  no compose slot held  AND  the clone's git tree is clean
 *
 * The clean-clone condition matters: if the clone itself has uncommitted work, the commit
 * is not authoritative and mirroring would destroy it. Repair is skipped — and the gap
 * still fires — whenever any condition is unmet, so the failure mode is "reports and
 * leaves it alone", never "overwrites something it did not understand".
 *
 * Env (bootstrap tier only — paths and identity, no behavioural gating):
 *   RUNTIME_DRIFT_RUNTIME_ROOT  live vessel trees      (default /vessels)
 *   RUNTIME_DRIFT_CLONE_ROOT    staging clones         (default /workspace/git/vessels)
 *   RUNTIME_DRIFT_SLOT_DIR      compose slot directory (default /workspace/compose-slots)
 *   RUNTIME_DRIFT_REPAIR        "0" disables the mirror-to-live repair (default enabled)
 *   DEV_VESSEL_ENDPOINT         gap sink (default http://127.0.0.1:8090)
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RUNTIME_ROOT = process.env.RUNTIME_DRIFT_RUNTIME_ROOT ?? "/vessels";
const CLONE_ROOT = process.env.RUNTIME_DRIFT_CLONE_ROOT ?? "/workspace/git/vessels";
const SLOT_DIR = process.env.RUNTIME_DRIFT_SLOT_DIR ?? "/workspace/compose-slots";
const REPAIR_ENABLED = (process.env.RUNTIME_DRIFT_REPAIR ?? "1") !== "0";
const DEV_VESSEL = process.env.DEV_VESSEL_ENDPOINT ?? "http://127.0.0.1:8090";

type Drift = { vessel: string; files: string[]; runtimeOnly: string[]; cloneOnly: string[] };

/** Every file under `dir`, as paths relative to `dir`. Missing dir yields []. */
function walk(dir: string, base = dir): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, base));
    else if (e.isFile()) out.push(relative(base, p));
  }
  return out;
}

function sameBytes(a: string, b: string): boolean {
  try {
    // Compare size first: a cheap reject for the common large-file case.
    if (statSync(a).size !== statSync(b).size) return false;
    return readFileSync(a).equals(readFileSync(b));
  } catch {
    return false;
  }
}

/** Files that differ, plus files present on only one side. */
export function compareTrees(cloneSrc: string, runtimeSrc: string): Omit<Drift, "vessel"> {
  const cloneFiles = new Set(walk(cloneSrc));
  const runtimeFiles = new Set(walk(runtimeSrc));
  const files: string[] = [];
  const runtimeOnly: string[] = [];
  const cloneOnly: string[] = [];
  for (const f of cloneFiles) {
    if (!runtimeFiles.has(f)) cloneOnly.push(f);
    else if (!sameBytes(join(cloneSrc, f), join(runtimeSrc, f))) files.push(f);
  }
  for (const f of runtimeFiles) if (!cloneFiles.has(f)) runtimeOnly.push(f);
  return { files: files.sort(), runtimeOnly: runtimeOnly.sort(), cloneOnly: cloneOnly.sort() };
}

/**
 * True when a compose currently holds a slot. A held slot means divergence is expected
 * (a compose edits the live tree in place), so nothing may be repaired.
 *
 * ABSENT SLOT DIRECTORY MEANS "NO SLOT HELD", NOT "UNKNOWN". The directory is created by
 * the first slot acquisition; treating its absence as "a compose might be running" would
 * disable the repair permanently on any substrate that has not composed since boot.
 */
export function composeSlotHeld(slotDir: string): boolean {
  if (!existsSync(slotDir)) return false;
  try {
    return readdirSync(slotDir).some((n) => !n.startsWith("."));
  } catch {
    return false;
  }
}

async function sh(args: string[], cwd?: string): Promise<{ ok: boolean; out: string }> {
  try {
    const p = Bun.spawn(args, { cwd, stdout: "pipe", stderr: "pipe" });
    const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
    const code = await p.exited;
    return { ok: code === 0, out: (out + err).trim() };
  } catch (e) {
    return { ok: false, out: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * A clone with uncommitted work is not authoritative — mirroring over it would destroy it.
 * Distinguishes "dirty" from "git could not answer": both block repair, but reporting the
 * wrong one sends a reader looking for uncommitted edits that do not exist.
 */
async function cloneCleanliness(cloneDir: string): Promise<{ clean: boolean; why: string }> {
  const r = await sh(["git", "-C", cloneDir, "status", "--porcelain"]);
  if (!r.ok) return { clean: false, why: `git could not report status for the clone (${r.out.slice(0, 120)})` };
  if (r.out.length > 0) {
    const n = r.out.split("\n").length;
    return { clean: false, why: `the clone has ${n} uncommitted change(s), so the commit is not authoritative` };
  }
  return { clean: true, why: "" };
}

/**
 * Classify a drifted TS file as syntactically broken. Advisory only — it sharpens the gap
 * text so a reader can tell "un-reverted but valid edit" from "the next restart dies here".
 * It is NOT a repair precondition: a *valid* un-reverted edit is still a violation of the
 * mirror invariant, and gating repair on brokenness would leave those in place forever.
 */
function syntacticallyBroken(path: string): boolean {
  if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(path)) return false;
  try {
    const src = readFileSync(path, "utf8");
    new Bun.Transpiler({ loader: path.endsWith("x") ? "tsx" : "ts" }).transformSync(src);
    return false;
  } catch {
    return true;
  }
}

async function emitGap(vessel: string, d: Omit<Drift, "vessel">, broken: string[], repaired: boolean, why: string) {
  const id = `runtime-drift-${vessel.replace(/[^a-zA-Z0-9]+/g, "-")}`;
  const summary =
    `The live runtime tree of ${vessel} diverges from its committed source. ` +
    `${d.files.length} file(s) differ` +
    (d.runtimeOnly.length ? `, ${d.runtimeOnly.length} exist only in the runtime tree` : "") +
    (d.cloneOnly.length ? `, ${d.cloneOnly.length} exist only in the clone` : "") +
    `: ${[...d.files, ...d.runtimeOnly].slice(0, 8).join(", ")}. ` +
    (broken.length
      ? `${broken.length} of them do NOT PARSE (${broken.slice(0, 4).join(", ")}), so the unit will fail to load them on its next restart even though it is healthy now — the module is already in memory. `
      : `They parse, so this is an un-reverted edit rather than imminent breakage. `) +
    (repaired
      ? `REPAIRED: mirror-to-live restored the runtime tree from the committed source. `
      : `NOT repaired (${why}). `) +
    `/vessels is a mirror of committed source; divergence with no compose holding a slot means an edit was applied and never rolled back.`;
  try {
    await fetch(`${DEV_VESSEL}/v2/impulses/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        impulse: {
          type: "substrateGap_write",
          gap: {
            id,
            category: "systematic_failure",
            source: "substrate_detected",
            summary,
            detected_at: new Date().toISOString(),
            status: "open",
          },
        },
      }),
    });
  } catch {
    /* gap emission is advisory; the log line below is the durable record */
  }
}

async function main() {
  if (!existsSync(RUNTIME_ROOT) || !existsSync(CLONE_ROOT)) {
    console.log(`[runtime-drift] roots absent (runtime=${RUNTIME_ROOT} clone=${CLONE_ROOT}) — nothing to check`);
    return;
  }
  const slotHeld = composeSlotHeld(SLOT_DIR);
  const runtimeDirs = readdirSync(RUNTIME_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    // Mitosis staging dirs live alongside the real ones and have no clone counterpart by
    // design; they are not runtime trees and are not drift. Two naming forms are in use —
    // `<vessel>-mitosis-<iso>` and `<vessel>-mitosis-fc-<iso>` — so match on `-mitosis-`
    // rather than on the timestamp that follows it. Anchoring on the timestamp matched only
    // the first form and buried the one real blind spot under 52 staging dirs; a warning
    // that lists 53 non-problems teaches its reader to skip it.
    // `vessel-id-placeholder` is a template scaffold, not a deployed vessel.
    .filter(
      (v) => existsSync(join(RUNTIME_ROOT, v, "src")) && !v.includes("-mitosis-") && v !== "vessel-id-placeholder",
    );
  const vessels = runtimeDirs.filter((v) => existsSync(join(CLONE_ROOT, v, "src")));

  // SAY WHAT IS NOT COVERED. A live vessel with no clone has nothing authoritative to be
  // compared against, so it can be neither verified nor repaired — and skipping it silently
  // is how a blind spot reads as a pass. Naming it is the whole difference between "17
  // vessels are clean" and "17 of 18 are clean and one cannot be checked at all".
  const unmonitored = runtimeDirs.filter((v) => !existsSync(join(CLONE_ROOT, v, "src")));
  if (unmonitored.length > 0) {
    console.warn(
      `[runtime-drift] NOT COVERED (${unmonitored.length}): ${unmonitored.join(", ")} — ` +
        `a live src tree with no clone under ${CLONE_ROOT} cannot be verified or repaired by this tick`,
    );
  }

  // META-GUARD (same as joint-liveness): a check that silently examines nothing is
  // indistinguishable from a check that passes. Say so loudly rather than exiting 0.
  if (vessels.length === 0) {
    console.warn(`[runtime-drift] CHECKED NOTHING: no vessel has both ${CLONE_ROOT}/<v>/src and ${RUNTIME_ROOT}/<v>/src`);
    return;
  }

  let drifted = 0;
  for (const v of vessels) {
    const cloneSrc = join(CLONE_ROOT, v, "src");
    const runtimeSrc = join(RUNTIME_ROOT, v, "src");
    const d = compareTrees(cloneSrc, runtimeSrc);
    if (d.files.length === 0 && d.runtimeOnly.length === 0 && d.cloneOnly.length === 0) continue;
    drifted += 1;

    const broken = [...d.files, ...d.runtimeOnly].filter((f) => syntacticallyBroken(join(runtimeSrc, f)));
    let repaired = false;
    let why = "";
    if (!REPAIR_ENABLED) {
      why = "repair disabled by RUNTIME_DRIFT_REPAIR=0";
    } else if (slotHeld) {
      why = "a compose holds a slot — in-place edits are expected right now";
    } else {
      const clone = await cloneCleanliness(join(CLONE_ROOT, v));
      if (!clone.clean) {
        why = clone.why;
      } else {
        // Pass the clone's HEAD as the expected SHA. mirror-to-live then re-reads HEAD
        // after the copy and fails loudly if the clone moved mid-mirror — without it, its
        // success line is a report rather than a check, and a clone that shifted under us
        // would be mirrored and called verified. "runtime == clone HEAD" is exactly this
        // watchdog's premise, so it is the one caller that always knows the SHA it means.
        const head = await sh(["git", "-C", join(CLONE_ROOT, v), "rev-parse", "HEAD"]);
        const r = head.ok
          ? await sh(["mirror-to-live", v, CLONE_ROOT, head.out.trim()])
          : { ok: false, out: `could not read clone HEAD: ${head.out.slice(0, 120)}` };
        repaired = r.ok;
        if (!repaired) why = `mirror-to-live failed: ${r.out.slice(0, 200)}`;
      }
    }

    console.warn(
      `[runtime-drift] ${v}: ${d.files.length} differ, ${d.runtimeOnly.length} runtime-only, ` +
        `${d.cloneOnly.length} clone-only, ${broken.length} DO NOT PARSE` +
        (repaired ? " — REPAIRED via mirror-to-live" : ` — not repaired (${why})`) +
        ` :: ${[...d.files, ...d.runtimeOnly].slice(0, 6).join(", ")}`,
    );
    await emitGap(v, d, broken, repaired, why);
  }

  if (drifted === 0) {
    console.log(
      `[runtime-drift] ${vessels.length} vessels checked, runtime matches committed source` +
        (unmonitored.length > 0 ? ` (${unmonitored.length} not coverable — see above)` : ""),
    );
  }
}

// Importable for tests without running the tick.
if (import.meta.main) await main();
