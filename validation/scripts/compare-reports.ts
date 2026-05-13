#!/usr/bin/env bun
/**
 * compare-reports.ts — diff two reuse-harness JSON reports.
 *
 * Usage:
 *   bun run validation/scripts/compare-reports.ts <before.json> <after.json>
 *
 * Emits a markdown table diff showing:
 *   - MRR, hit@1/3/5, improvise_rate deltas
 *   - Top-5 movers by EV change in the Thompson snapshot
 *   - Entries that changed rank between reports
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

// ---------------------------------------------------------------------------
// Types (mirrors reuse-harness.ts output schema)
// ---------------------------------------------------------------------------

interface EntryResult {
  id: string;
  category: string;
  rank: number;
  rr: number;
  found: boolean;
  goal_text?: string;
  expected_activity_id?: string;
}

interface ThompsonEntry {
  activity_id: string;
  name: string;
  alpha: number;
  beta: number;
  ev: number;
  total_executions: number;
  ci_width: number;
}

interface TraceStats {
  sample_size: number;
  improvise_count: number;
  improvise_rate: number;
  window_days: number;
}

interface ReuseReport {
  run_at: string;
  label: string;
  mrr: number;
  hit_at_1: number;
  hit_at_3: number;
  hit_at_5: number;
  entries: EntryResult[];
  thompson_snapshot: ThompsonEntry[];
  trace_stats: TraceStats;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function fmt4(n: number): string {
  return n.toFixed(4);
}

function deltaStr(before: number, after: number, isPct = false): string {
  const diff = after - before;
  const sign = diff >= 0 ? "+" : "";
  if (isPct) {
    return `${sign}${(diff * 100).toFixed(1)}pp`;
  }
  return `${sign}${diff.toFixed(4)}`;
}

function arrow(before: number, after: number): string {
  if (after > before) return "▲";
  if (after < before) return "▼";
  return "─";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: bun run validation/scripts/compare-reports.ts <before.json> <after.json>");
    process.exit(1);
  }

  const [beforePath, afterPath] = args;

  if (!existsSync(beforePath)) {
    console.error(`Before report not found: ${beforePath}`);
    process.exit(1);
  }
  if (!existsSync(afterPath)) {
    console.error(`After report not found: ${afterPath}`);
    process.exit(1);
  }

  const before = JSON.parse(await readFile(beforePath, "utf8")) as ReuseReport;
  const after = JSON.parse(await readFile(afterPath, "utf8")) as ReuseReport;

  const beforeLabel = before.label || before.run_at.slice(0, 10);
  const afterLabel = after.label || after.run_at.slice(0, 10);

  // ---------------------------------------------------------------------------
  // Section 1: Summary metrics
  // ---------------------------------------------------------------------------

  console.log(`\n# Activity Reuse Benchmark — Comparison Report\n`);
  console.log(`| Metric | Before (${beforeLabel}) | After (${afterLabel}) | Delta | Dir |`);
  console.log(`|--------|---------|-------|-------|-----|`);

  const metrics: Array<{ name: string; key: keyof ReuseReport; isPct?: boolean }> = [
    { name: "MRR", key: "mrr" },
    { name: "Hit@1", key: "hit_at_1", isPct: true },
    { name: "Hit@3", key: "hit_at_3", isPct: true },
    { name: "Hit@5", key: "hit_at_5", isPct: true },
  ];

  for (const m of metrics) {
    const bVal = before[m.key] as number;
    const aVal = after[m.key] as number;
    const display = m.isPct
      ? `${pct(bVal)} | ${pct(aVal)}`
      : `${fmt4(bVal)} | ${fmt4(aVal)}`;
    console.log(
      `| ${m.name} | ${m.isPct ? pct(bVal) : fmt4(bVal)} | ${m.isPct ? pct(aVal) : fmt4(aVal)} | ${deltaStr(bVal, aVal, m.isPct)} | ${arrow(bVal, aVal)} |`
    );
  }

  // Improvise rate
  const bImprov = before.trace_stats?.improvise_rate ?? 0;
  const aImprov = after.trace_stats?.improvise_rate ?? 0;
  console.log(
    `| Improvise rate | ${pct(bImprov)} | ${pct(aImprov)} | ${deltaStr(bImprov, aImprov, true)} | ${arrow(bImprov, aImprov)} |`
  );

  console.log();

  // ---------------------------------------------------------------------------
  // Section 2: Entry rank changes
  // ---------------------------------------------------------------------------

  const beforeById = new Map(before.entries.map((e) => [e.id, e]));
  const afterById = new Map(after.entries.map((e) => [e.id, e]));

  const changed: Array<{
    id: string;
    category: string;
    goalText: string;
    beforeRank: number;
    afterRank: number;
    rrDelta: number;
  }> = [];

  for (const [id, aEntry] of afterById) {
    const bEntry = beforeById.get(id);
    if (!bEntry) continue;
    if (bEntry.rank !== aEntry.rank) {
      changed.push({
        id,
        category: aEntry.category,
        goalText: (aEntry.goal_text ?? id).slice(0, 50),
        beforeRank: bEntry.rank,
        afterRank: aEntry.rank,
        rrDelta: aEntry.rr - bEntry.rr,
      });
    }
  }

  if (changed.length > 0) {
    console.log(`## Entries with rank changes (${changed.length})\n`);
    console.log(`| ID | Category | Goal | Before rank | After rank | RR delta | Dir |`);
    console.log(`|----|----------|------|-------------|------------|----------|-----|`);
    for (const c of changed.sort((a, b) => Math.abs(b.rrDelta) - Math.abs(a.rrDelta))) {
      const bRankStr = c.beforeRank === 0 ? "NF" : String(c.beforeRank);
      const aRankStr = c.afterRank === 0 ? "NF" : String(c.afterRank);
      const rrDeltaStr = `${c.rrDelta >= 0 ? "+" : ""}${c.rrDelta.toFixed(3)}`;
      console.log(
        `| ${c.id} | ${c.category} | ${c.goalText} | ${bRankStr} | ${aRankStr} | ${rrDeltaStr} | ${arrow(c.beforeRank === 0 ? 999 : c.beforeRank, c.afterRank === 0 ? 999 : c.afterRank)} |`
      );
    }
    console.log();
  } else {
    console.log(`## Entry rank changes\n\n_No rank changes between reports._\n`);
  }

  // ---------------------------------------------------------------------------
  // Section 3: Top-5 Thompson movers
  // ---------------------------------------------------------------------------

  const beforeThompson = new Map(
    (before.thompson_snapshot ?? []).map((t) => [t.activity_id, t])
  );
  const afterThompson = new Map(
    (after.thompson_snapshot ?? []).map((t) => [t.activity_id, t])
  );

  const evMovers: Array<{
    activity_id: string;
    name: string;
    beforeEv: number;
    afterEv: number;
    evDelta: number;
    beforeAlpha: number;
    afterAlpha: number;
  }> = [];

  for (const [id, aEntry] of afterThompson) {
    const bEntry = beforeThompson.get(id);
    if (!bEntry) continue;
    const evDelta = aEntry.ev - bEntry.ev;
    if (Math.abs(evDelta) > 0.0001) {
      evMovers.push({
        activity_id: id,
        name: aEntry.name.slice(0, 40),
        beforeEv: bEntry.ev,
        afterEv: aEntry.ev,
        evDelta,
        beforeAlpha: bEntry.alpha,
        afterAlpha: aEntry.alpha,
      });
    }
  }

  const top5Movers = evMovers
    .sort((a, b) => Math.abs(b.evDelta) - Math.abs(a.evDelta))
    .slice(0, 5);

  if (top5Movers.length > 0) {
    console.log(`## Top-5 Thompson movers (by |EV delta|)\n`);
    console.log(`| Activity | Before EV | After EV | EV delta | Dir |`);
    console.log(`|----------|-----------|----------|----------|-----|`);
    for (const m of top5Movers) {
      console.log(
        `| ${m.name} | ${fmt4(m.beforeEv)} | ${fmt4(m.afterEv)} | ${deltaStr(m.beforeEv, m.afterEv)} | ${arrow(m.beforeEv, m.afterEv)} |`
      );
    }
    console.log();
  } else {
    console.log(`## Top-5 Thompson movers\n\n_No significant EV changes detected._\n`);
  }

  // ---------------------------------------------------------------------------
  // Section 4: Unchanged summary
  // ---------------------------------------------------------------------------

  const unchangedCount = after.entries.filter((e) => {
    const b = beforeById.get(e.id);
    return b && b.rank === e.rank;
  }).length;
  const notFoundBefore = before.entries.filter((e) => !e.found).length;
  const notFoundAfter = after.entries.filter((e) => !e.found).length;

  console.log(`## Summary\n`);
  console.log(`- **${unchangedCount}** entries unchanged rank`);
  console.log(`- **${changed.length}** entries changed rank`);
  console.log(`- Not found before: **${notFoundBefore}**, after: **${notFoundAfter}**`);
  console.log(
    `- API calls: before=${before.trace_stats?.sample_size ?? "?"} traces, after=${after.trace_stats?.sample_size ?? "?"} traces`
  );
  console.log();
}

main().catch((e) => {
  console.error("ERROR:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
