#!/usr/bin/env node
/**
 * substrate-cycle-resync — can a container substrate be stopped and started
 * freely and put ITSELF back in sync, while running a different vessel
 * inventory from its peers?
 *
 * WHAT IS BEING MEASURED, and what deliberately is not.
 *
 * Not "did the container come back up". A container that boots, answers
 * /health, and never re-registers with the hub looks identical to a healthy one
 * from the outside — that is the shape of most failures here, and /health is
 * the probe that lies about it. What is measured is whether the FLEET sees the
 * substrate again: its shapes resolvable through the hub registry, over the
 * federation transport, without an operator touching anything.
 *
 * The clock starts when `docker start` returns and stops when every shape the
 * container owned before the cycle resolves again from the HUB's vantage. No
 * command is issued in between. If a step needs a nudge, that is a failure of
 * the property being demonstrated, and it is reported as one.
 *
 * ROSTER DIVERGENCE is asserted, not assumed: the two containers must run
 * DIFFERENT unit sets, or "they stayed in sync" is a statement about one
 * configuration duplicated twice and proves nothing about a fleet.
 *
 * Usage:
 *   node validation/scripts/substrate-cycle-resync.mjs [--cycles 2] [--only substrate-ui]
 */

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const CYCLES = Number(arg("--cycles", "2"));
const ONLY = arg("--only", null);
const OUT = arg("--out", "/tmp/substrate-cycle-resync.json");
const HUB = arg("--hub", "http://syzygy.host:18100");
const RESYNC_TIMEOUT_MS = 8 * 60 * 1000;

const CONTAINERS = [
  { name: "substrate-live", note: "compute spoke" },
  { name: "substrate-ui", note: "surface spoke" },
].filter((c) => !ONLY || c.name === ONLY);

const sh = (cmd, args, opts = {}) => {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", timeout: 120_000, ...opts }).trim();
  } catch (e) {
    return opts.tolerant ? "" : `ERR:${e?.message?.split("\n")[0] ?? e}`;
  }
};

const dexec = (c, script, tolerant = true) =>
  sh("docker", ["exec", c, "sh", "-lc", script], { tolerant });

/** Units actually running — the roster, not what config claims. */
function runningUnits(c) {
  const out = dexec(
    c,
    "systemctl list-units --type=service --state=running --no-legend --no-pager 2>/dev/null | awk '{print $1}'",
  );
  return out
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s && !/^(systemd|dbus|getty)/.test(s))
    .sort();
}

function apiKey() {
  return dexec(
    "substrate-live",
    `grep -h '^METABOB_API_KEY=' /etc/substrate/env | cut -d= -f2- | tr -d '"' | head -1`,
  );
}

/**
 * Producers the HUB lists for a shape, WITH their lastSeen.
 *
 * lastSeen is load-bearing, not decoration. The registry TTL is five minutes, so
 * a record outlives the process that wrote it by minutes — "the hub still lists
 * this shape" is true of a substrate that is powered off. The first version of
 * this harness checked presence alone and reported a container that had FAILED
 * TO BOOT (`Exited (1)`) as having resynced in 1 second. Presence is a claim
 * about the registry; freshness is a claim about the vessel.
 */
async function hubProducers(key, shape) {
  try {
    const r = await fetch(`${HUB}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `ApiKey ${key}` },
      body: JSON.stringify({ pointer: { type: "vesselCapability", shape } }),
      signal: AbortSignal.timeout(10_000),
    });
    const j = await r.json();
    return (j?.content?.vessels ?? []).map((v) => ({
      vesselId: v.vesselId,
      lastSeen: v.lastSeen ? Date.parse(v.lastSeen) : 0,
    }));
  } catch {
    return [];
  }
}

/** Is the container process actually up? A resync claim over a dead box is a lie. */
function isRunning(c) {
  return sh("docker", ["inspect", "-f", "{{.State.Running}}", c], { tolerant: true }) === "true";
}

/** The substrate id this container federates under — how the hub labels it. */
function fedId(c) {
  return dexec(c, `grep -h '^FED_SUBSTRATE_ID' /etc/substrate/env | cut -d= -f2- | tr -d '"'`);
}

function headSha(c) {
  return dexec(c, "cd /workspace/git/super-repo && git rev-parse --short HEAD");
}

/**
 * Shapes whose reappearance means the substrate is back in the fleet.
 *
 * `llm_completion` is deliberately NOT here. Its advertisement is quota-gated:
 * when every provider lane is cooling, the resolver DROPS the shape from the
 * registry so callers route to a producer that still works. That is the vessel
 * obeying "never advertise a shape you cannot serve" — correct behaviour that
 * this test would otherwise score as a failed resync. It cost a real FAIL:
 * substrate-live came back with five of six shapes and was marked DID NOT
 * RESYNC because the sixth was quota-gated, not missing.
 *
 * It is still polled, and reported alongside, as information about the LLM
 * plane — just not as evidence about restart.
 */
const CORE_SHAPES = [
  "goal_execution",
  "uiPanel_write",
  "renderPolicy",
  "memoryNote",
  "light_dispatch_execution",
];
const CONDITIONAL_SHAPES = ["llm_completion"];
const SHAPES = [...CORE_SHAPES, ...CONDITIONAL_SHAPES];

/**
 * Shapes the hub attributes to THIS substrate, optionally requiring the record
 * to have been refreshed since `freshAfter` — i.e. re-registered by a process
 * that is alive now, not left behind by the one that died.
 */
async function fleetView(key, suffix, freshAfter = 0) {
  const seen = [];
  for (const s of SHAPES) {
    const producers = await hubProducers(key, s);
    if (producers.some((p) => p.vesselId.endsWith(`@${suffix}`) && p.lastSeen > freshAfter))
      seen.push(s);
  }
  return seen.sort();
}

const results = [];
const key = apiKey();
if (!key || key.startsWith("ERR:")) {
  console.error("could not read an API key; is substrate-live up?");
  process.exit(1);
}

// ── roster divergence, asserted before anything is cycled ──────────────────
const rosters = Object.fromEntries(CONTAINERS.map((c) => [c.name, runningUnits(c.name)]));
for (const [n, u] of Object.entries(rosters)) console.log(`${n}: ${u.length} running units`);
let divergence = null;
if (CONTAINERS.length === 2) {
  const [a, b] = CONTAINERS.map((c) => c.name);
  const onlyA = rosters[a].filter((u) => !rosters[b].includes(u));
  const onlyB = rosters[b].filter((u) => !rosters[a].includes(u));
  divergence = { onlyA, onlyB, shared: rosters[a].filter((u) => rosters[b].includes(u)).length };
  console.log(`\nroster divergence: ${onlyA.length} only on ${a}, ${onlyB.length} only on ${b}, ${divergence.shared} shared`);
  console.log(`  only ${a}: ${onlyA.join(", ") || "(none)"}`);
  console.log(`  only ${b}: ${onlyB.join(", ") || "(none)"}`);
  if (onlyA.length === 0 && onlyB.length === 0) {
    console.log("  !! identical rosters — a resync result here says nothing about differing inventories");
  }
}

// ── cycle ─────────────────────────────────────────────────────────────────
for (let cycle = 1; cycle <= CYCLES; cycle++) {
  for (const c of CONTAINERS) {
    // A container that is already DOWN has no readable federation id, and an
    // empty suffix silently matches nothing — the whole cycle then measures a
    // question no producer can answer. Bring it up and let it settle FIRST, and
    // say so, rather than reporting the artefact as a failed resync.
    if (!isRunning(c.name)) {
      console.log(`\n   ${c.name} was not running at cycle start — starting it and settling before measuring`);
      sh("docker", ["start", c.name]);
      for (let i = 0; i < 30 && !fedId(c.name); i++) await new Promise((r) => setTimeout(r, 5_000));
      await new Promise((r) => setTimeout(r, 20_000));
    }
    const suffix = fedId(c.name);
    if (!suffix) {
      console.log(`\n   !! ${c.name}: no FED_SUBSTRATE_ID readable — skipping, this cycle would measure nothing`);
      continue;
    }
    const before = {
      units: runningUnits(c.name),
      head: headSha(c.name),
      shapes: await fleetView(key, suffix),
      core: (await fleetView(key, suffix)).filter((s) => CORE_SHAPES.includes(s)),
      running: isRunning(c.name),
    };
    console.log(
      `\n── cycle ${cycle} · ${c.name} (${suffix}) ──\n   before: ${before.units.length} units, HEAD ${before.head}, hub sees ${before.shapes.length} shape(s): ${before.shapes.join(", ") || "none"}`,
    );

    // Errors here are NOT tolerated: a failed `docker start` that is swallowed
    // turns the whole measurement into a statement about a stopped container.
    const downAt = Date.now();
    const stopOut = sh("docker", ["stop", c.name]);
    const stoppedAt = Date.now();
    const startOut = sh("docker", ["start", c.name]);
    const startedAt = Date.now();
    if (stopOut.startsWith("ERR:") || startOut.startsWith("ERR:")) {
      console.log(`   !! docker stop/start FAILED — stop=${stopOut} start=${startOut}`);
    }
    console.log(
      `   stop took ${Math.round((stoppedAt - downAt) / 1000)}s, start returned in ${Math.round((startedAt - stoppedAt) / 1000)}s — no further commands from here`,
    );

    let resyncMs = null;
    let last = [];
    let running = false;
    let rec_rule = null;
    while (Date.now() - startedAt < RESYNC_TIMEOUT_MS) {
      running = isRunning(c.name);
      // Freshness gate: only records re-written AFTER the restart count. A stale
      // record from the dead process satisfies presence and proves nothing.
      last = running ? await fleetView(key, suffix, startedAt) : [];
      // `before.shapes` empty means the hub could not attribute ANY shape to
      // this substrate before the cycle — usually because its federation id had
      // just churned. Requiring a non-empty before made resync unreachable: the
      // container came back, the hub saw six shapes, and it still scored FAIL
      // after 480s. Fall back to "the hub sees anything fresh from it", and say
      // which rule was used so the number is not read as stronger than it is.
      const beforeCore = before.shapes.filter((s) => CORE_SHAPES.includes(s));
      const target = beforeCore.length > 0 ? beforeCore : null;
      const met = target ? target.every((s) => last.includes(s)) : last.length > 0;
      if (running && met) {
        rec_rule = target ? "matched pre-cycle shape set" : "no pre-cycle baseline; any fresh shape";
        resyncMs = Date.now() - startedAt;
        break;
      }
      await new Promise((r) => setTimeout(r, 10_000));
    }
    if (!running) console.log(`   !! container is NOT RUNNING — ${sh("docker", ["inspect", "-f", "{{.State.Status}} exit={{.State.ExitCode}}", c.name], { tolerant: true })}`);

    // Sample the roster only once systemd has FINISHED booting. Resync happens
    // at ~130s but substrate-ready.service deliberately gates the boot target
    // for up to 240s, so a roster read at resync time catches units that are
    // still starting and reports them as lost. That is how development-vessel
    // and stateful-ui showed up in a "lost:" line while they were mid-start.
    //
    // `offline` and `initializing` are transient early-boot states — only
    // `running` and `degraded` mean finished. An earlier version of this check
    // treated any non-"starting" value as done and returned instantly against a
    // container that had not started a single unit.
    const bootWaitStart = Date.now();
    let bootState = "unreachable";
    while (Date.now() - bootWaitStart < 420_000) {
      bootState = dexec(c.name, "systemctl is-system-running 2>/dev/null") || "unreachable";
      if (bootState === "running" || bootState === "degraded") break;
      await new Promise((r) => setTimeout(r, 5000));
    }
    const bootMs = Date.now() - startedAt;
    console.log(
      `   systemd reached '${bootState}' ${Math.round(bootMs / 1000)}s after start` +
        (bootState === "running" || bootState === "degraded" ? "" : " (did not finish booting)"),
    );

    const after = { units: runningUnits(c.name), head: headSha(c.name), shapes: last, bootState, bootMs };
    const rosterSame =
      before.units.length === after.units.length &&
      before.units.every((u) => after.units.includes(u));

    const rec = {
      cycle,
      container: c.name,
      fedId: suffix,
      before,
      after,
      rosterPreserved: rosterSame,
      resyncMs,
      resynced: resyncMs !== null,
      operatorActionsDuringResync: 0,
      resyncRule: rec_rule,
    };
    results.push(rec);
    console.log(
      `   after:  ${after.units.length} units, HEAD ${after.head}, hub sees ${after.shapes.length}: ${after.shapes.join(", ") || "none"}`,
    );
    console.log(
      rec.resynced
        ? `   RESYNCED on its own in ${Math.round(resyncMs / 1000)}s · roster preserved: ${rosterSame} · rule: ${rec_rule}`
        : `   DID NOT RESYNC within ${RESYNC_TIMEOUT_MS / 1000}s · roster preserved: ${rosterSame}`,
    );
    if (!rosterSame) {
      const lost = before.units.filter((u) => !after.units.includes(u));
      const gained = after.units.filter((u) => !before.units.includes(u));
      if (lost.length) console.log(`     lost: ${lost.join(", ")}`);
      if (gained.length) console.log(`     gained: ${gained.join(", ")}`);
    }
  }
}

const ok = results.filter((r) => r.resynced).length;
console.log(`\n── summary ──\nself-resynced: ${ok}/${results.length}`);
for (const r of results) {
  console.log(
    `  cycle ${r.cycle} ${r.container.padEnd(15)} ${r.resynced ? `${Math.round(r.resyncMs / 1000)}s`.padStart(6) : "  FAIL"} · roster ${r.rosterPreserved ? "preserved" : "CHANGED"}`,
  );
}
writeFileSync(OUT, JSON.stringify({ hub: HUB, divergence, rosters, results }, null, 2));
console.log(`\nwritten: ${OUT}`);
