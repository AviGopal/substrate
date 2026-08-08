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

/** Which vessel ids the HUB can currently see for a shape. Hub vantage only. */
async function hubProducers(key, shape) {
  try {
    const r = await fetch(`${HUB}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `ApiKey ${key}` },
      body: JSON.stringify({ pointer: { type: "vesselCapability", shape } }),
      signal: AbortSignal.timeout(10_000),
    });
    const j = await r.json();
    return (j?.content?.vessels ?? []).map((v) => v.vesselId);
  } catch {
    return [];
  }
}

/** The substrate id this container federates under — how the hub labels it. */
function fedId(c) {
  return dexec(c, `grep -h '^FED_SUBSTRATE_ID' /etc/substrate/env | cut -d= -f2- | tr -d '"'`);
}

function headSha(c) {
  return dexec(c, "cd /workspace/git/super-repo && git rev-parse --short HEAD");
}

const SHAPES = [
  "goal_execution",
  "uiPanel_write",
  "renderPolicy",
  "memoryNote",
  "light_dispatch_execution",
  "llm_completion",
];

/** Shapes the hub attributes to THIS substrate right now. */
async function fleetView(key, suffix) {
  const seen = [];
  for (const s of SHAPES) {
    const producers = await hubProducers(key, s);
    if (producers.some((p) => p.endsWith(`@${suffix}`))) seen.push(s);
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
    const suffix = fedId(c.name);
    const before = {
      units: runningUnits(c.name),
      head: headSha(c.name),
      shapes: await fleetView(key, suffix),
    };
    console.log(
      `\n── cycle ${cycle} · ${c.name} (${suffix}) ──\n   before: ${before.units.length} units, HEAD ${before.head}, hub sees ${before.shapes.length} shape(s): ${before.shapes.join(", ") || "none"}`,
    );

    sh("docker", ["stop", c.name]);
    const downAt = Date.now();
    const t0 = Date.now();
    sh("docker", ["start", c.name]);
    const startedAt = Date.now();
    console.log(`   stopped+started in ${Math.round((startedAt - downAt) / 1000)}s — no further commands from here`);

    let resyncMs = null;
    let last = [];
    while (Date.now() - startedAt < RESYNC_TIMEOUT_MS) {
      last = await fleetView(key, suffix);
      if (before.shapes.length > 0 && before.shapes.every((s) => last.includes(s))) {
        resyncMs = Date.now() - startedAt;
        break;
      }
      await new Promise((r) => setTimeout(r, 10_000));
    }

    const after = { units: runningUnits(c.name), head: headSha(c.name), shapes: last };
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
    };
    results.push(rec);
    console.log(
      `   after:  ${after.units.length} units, HEAD ${after.head}, hub sees ${after.shapes.length}: ${after.shapes.join(", ") || "none"}`,
    );
    console.log(
      rec.resynced
        ? `   RESYNCED on its own in ${Math.round(resyncMs / 1000)}s · roster preserved: ${rosterSame}`
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
