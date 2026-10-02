#!/usr/bin/env bun
"use strict";
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
 *   - Behavioral health delta (improvise, resolver coverage, reuse trajectory)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("node:fs/promises");
const node_fs_1 = require("node:fs");
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function pct(n) {
    return `${(n * 100).toFixed(1)}%`;
}
function fmt4(n) {
    return n.toFixed(4);
}
function deltaStr(before, after, isPct = false) {
    const diff = after - before;
    const sign = diff >= 0 ? "+" : "";
    if (isPct) {
        return `${sign}${(diff * 100).toFixed(1)}pp`;
    }
    return `${sign}${diff.toFixed(4)}`;
}
function arrow(before, after) {
    if (after > before)
        return "▲";
    if (after < before)
        return "▼";
    return "─";
}
// Render a nullable rate as "X.X%" or "null"
function nullablePct(v) {
    if (v === null || v === undefined)
        return "null";
    return pct(v);
}
// Delta between two nullable rates; returns "—" when either side is absent
function nullableDelta(before, after, lowerIsGood = false) {
    if (before === null || before === undefined || after === null || after === undefined)
        return "—";
    const diff = after - before;
    const sign = diff >= 0 ? "+" : "";
    return `${sign}${(diff * 100).toFixed(1)}pp`;
}
function nullableArrow(before, after, lowerIsGood = false) {
    if (before === null || before === undefined || after === null || after === undefined)
        return "─";
    if (after > before)
        return lowerIsGood ? "▼" : "▲";
    if (after < before)
        return lowerIsGood ? "▲" : "▼";
    return "─";
}
/**
 * Render a nullable number as a fixed-decimal string or "—".
 */
function fmtNullable(v, decimals = 3) {
    if (v === null || v === undefined)
        return "—";
    return v.toFixed(decimals);
}
function fmtNullablePct(v) {
    if (v === null || v === undefined)
        return "—";
    return `${(v * 100).toFixed(1)}%`;
}
function cellDelta(b, a) {
    if (b === null || b === undefined || a === null || a === undefined)
        return "—";
    const diff = a - b;
    return `${diff >= 0 ? "+" : ""}${(diff * 100).toFixed(1)}pp`;
}
function cellArrow(b, a, lowerIsGood = false) {
    if (b === null || b === undefined || a === null || a === undefined)
        return "─";
    if (a > b)
        return lowerIsGood ? "▼" : "▲";
    if (a < b)
        return lowerIsGood ? "▲" : "▼";
    return "─";
}
function floorChange(bCell, aCell) {
    if (!bCell && !aCell)
        return "—";
    if (!bCell)
        return aCell.floor_pass ? "new PASS" : "new FAIL";
    if (!aCell)
        return "(removed)";
    if (bCell.floor_pass === aCell.floor_pass)
        return bCell.floor_pass ? "PASS→PASS" : "FAIL→FAIL";
    return bCell.floor_pass ? "**PASS→FAIL**" : "**FAIL→PASS**";
}
async function runStratifiedComparison(beforePath, afterPath) {
    const before = JSON.parse(await (0, promises_1.readFile)(beforePath, "utf8"));
    const after = JSON.parse(await (0, promises_1.readFile)(afterPath, "utf8"));
    const beforeLabel = before.label || before.run_at.slice(0, 10);
    const afterLabel = after.label || after.run_at.slice(0, 10);
    // Registry snapshot hash check
    const hashMatch = before.shape_registry_snapshot_hash &&
        after.shape_registry_snapshot_hash &&
        before.shape_registry_snapshot_hash === after.shape_registry_snapshot_hash;
    const hashWarning = (!hashMatch && before.shape_registry_snapshot_hash && after.shape_registry_snapshot_hash)
        ? " ⚠️  shape registry snapshot differs — cells may not be directly comparable"
        : "";
    console.log(`\n# Stratified Harness — Cell-by-Cell Comparison${hashWarning}\n`);
    console.log(`- Before: **${beforeLabel}** — ${before.run_at}`);
    console.log(`- After:  **${afterLabel}** — ${after.run_at}`);
    console.log(`- Universality: ${before.universality_pass ? "PASS" : "FAIL"} → ${after.universality_pass ? "PASS" : "FAIL"}`);
    console.log();
    // Collect all cell ids across both reports
    const allCellIds = new Set([
        ...Object.keys(before.coverage_matrix),
        ...Object.keys(after.coverage_matrix),
    ]);
    const sortedCells = [...allCellIds].sort();
    // ---------------------------------------------------------------------------
    // Section 1: Cell-by-cell floor status
    // ---------------------------------------------------------------------------
    console.log("## Floor Status per Cell\n");
    console.log(`| Cell | Before floor | After floor | Change |`);
    console.log(`|------|-------------|------------|--------|`);
    const regressions = [];
    const improvements = [];
    for (const cellId of sortedCells) {
        const bCell = before.coverage_matrix[cellId];
        const aCell = after.coverage_matrix[cellId];
        const change = floorChange(bCell, aCell);
        if (change.includes("PASS→FAIL"))
            regressions.push(cellId);
        if (change.includes("FAIL→PASS"))
            improvements.push(cellId);
        const bFloor = bCell ? (bCell.gated_on_phase_22 ? "gated" : bCell.insufficient_sample ? "insuff" : bCell.floor_pass ? "PASS" : "FAIL") : "—";
        const aFloor = aCell ? (aCell.gated_on_phase_22 ? "gated" : aCell.insufficient_sample ? "insuff" : aCell.floor_pass ? "PASS" : "FAIL") : "—";
        console.log(`| \`${cellId}\` | ${bFloor} | ${aFloor} | ${change} |`);
    }
    console.log();
    if (regressions.length > 0) {
        console.log(`> ⚠️  Floor regressions: ${regressions.map((c) => `\`${c}\``).join(", ")}\n`);
    }
    if (improvements.length > 0) {
        console.log(`> ✅ Floor improvements: ${improvements.map((c) => `\`${c}\``).join(", ")}\n`);
    }
    // ---------------------------------------------------------------------------
    // Section 2: Key metric deltas per cell
    // ---------------------------------------------------------------------------
    console.log("## Key Metric Deltas per Cell\n");
    console.log(`| Cell | Metric | Before | After | Δ | Dir |`);
    console.log(`|------|--------|--------|-------|---|-----|`);
    for (const cellId of sortedCells) {
        const bCell = before.coverage_matrix[cellId];
        const aCell = after.coverage_matrix[cellId];
        if (!bCell || !aCell)
            continue;
        const rows = [
            ["success_rate (↑)", bCell.success_rate, aCell.success_rate, false],
            ["reuse_efficiency (↑)", bCell.reuse_efficiency, aCell.reuse_efficiency, false],
            ["improvise_share (↓)", bCell.improvise_share, aCell.improvise_share, true],
            ["cost_p50_usd (↓)", bCell.cost_p50_usd, aCell.cost_p50_usd, true],
        ];
        for (const [metric, b, a, lowerIsGood] of rows) {
            const delta = cellDelta(b, a);
            const dir = cellArrow(b, a, lowerIsGood);
            if (delta === "—")
                continue;
            console.log(`| \`${cellId}\` | ${metric} | ${fmtNullablePct(b)} | ${fmtNullablePct(a)} | ${delta} | ${dir} |`);
        }
    }
    console.log();
    // ---------------------------------------------------------------------------
    // Section 3: Sample count changes
    // ---------------------------------------------------------------------------
    console.log("## Sample Count Changes\n");
    console.log(`| Cell | Before n | After n | Δn |`);
    console.log(`|------|----------|---------|-----|`);
    for (const cellId of sortedCells) {
        const bCell = before.coverage_matrix[cellId];
        const aCell = after.coverage_matrix[cellId];
        const bN = bCell?.sample_count ?? 0;
        const aN = aCell?.sample_count ?? 0;
        const delta = aN - bN;
        console.log(`| \`${cellId}\` | ${bN} | ${aN} | ${delta >= 0 ? "+" : ""}${delta} |`);
    }
    console.log();
    // ---------------------------------------------------------------------------
    // Section 4: Optimality ratio changes (if present)
    // ---------------------------------------------------------------------------
    if (before.optimality_ratios && after.optimality_ratios) {
        console.log("## Optimality Ratio Changes\n");
        console.log(`| Cell | Before ratio | After ratio | Trend (after) |`);
        console.log(`|------|-------------|------------|---------------|`);
        const allOptCells = new Set([
            ...Object.keys(before.optimality_ratios ?? {}),
            ...Object.keys(after.optimality_ratios ?? {}),
        ]);
        for (const cellId of [...allOptCells].sort()) {
            const bOpt = before.optimality_ratios?.[cellId]?.optimality_ratio;
            const aOpt = after.optimality_ratios?.[cellId];
            console.log(`| \`${cellId}\` | ${fmtNullable(bOpt)} | ${fmtNullable(aOpt?.optimality_ratio)} | ${aOpt?.trend ?? "—"} |`);
        }
        console.log();
    }
    // ---------------------------------------------------------------------------
    // Section 5: Summary
    // ---------------------------------------------------------------------------
    console.log("## Summary\n");
    console.log(`- Cells compared: ${sortedCells.length}`);
    console.log(`- Floor regressions: **${regressions.length}**`);
    console.log(`- Floor improvements: **${improvements.length}**`);
    console.log(`- Universality: ${before.universality_pass ? "PASS" : "FAIL"} → ${after.universality_pass ? "PASS" : "FAIL"}`);
    console.log();
}
async function main() {
    const rawArgs = process.argv.slice(2);
    const stratified = rawArgs.includes("--stratified");
    const args = rawArgs.filter((a) => a !== "--stratified");
    if (args.length < 2) {
        console.error("Usage: bun run validation/scripts/compare-reports.ts [--stratified] <before.json> <after.json>");
        process.exit(1);
    }
    if (stratified) {
        await runStratifiedComparison(args[0], args[1]);
        return;
    }
    const [beforePath, afterPath] = args;
    if (!(0, node_fs_1.existsSync)(beforePath)) {
        console.error(`Before report not found: ${beforePath}`);
        process.exit(1);
    }
    if (!(0, node_fs_1.existsSync)(afterPath)) {
        console.error(`After report not found: ${afterPath}`);
        process.exit(1);
    }
    const before = JSON.parse(await (0, promises_1.readFile)(beforePath, "utf8"));
    const after = JSON.parse(await (0, promises_1.readFile)(afterPath, "utf8"));
    const beforeLabel = before.label || before.run_at.slice(0, 10);
    const afterLabel = after.label || after.run_at.slice(0, 10);
    // ---------------------------------------------------------------------------
    // Section 1: Summary metrics
    // ---------------------------------------------------------------------------
    console.log(`\n# Activity Reuse Benchmark — Comparison Report\n`);
    console.log(`| Metric | Before (${beforeLabel}) | After (${afterLabel}) | Delta | Dir |`);
    console.log(`|--------|---------|-------|-------|-----|`);
    const metrics = [
        { name: "MRR", key: "mrr" },
        { name: "Hit@1", key: "hit_at_1", isPct: true },
        { name: "Hit@3", key: "hit_at_3", isPct: true },
        { name: "Hit@5", key: "hit_at_5", isPct: true },
    ];
    for (const m of metrics) {
        const bVal = before[m.key];
        const aVal = after[m.key];
        console.log(`| ${m.name} | ${m.isPct ? pct(bVal) : fmt4(bVal)} | ${m.isPct ? pct(aVal) : fmt4(aVal)} | ${deltaStr(bVal, aVal, m.isPct)} | ${arrow(bVal, aVal)} |`);
    }
    // Improvise rate
    const bImprov = before.trace_stats?.improvise_rate ?? 0;
    const aImprov = after.trace_stats?.improvise_rate ?? 0;
    console.log(`| Improvise rate | ${pct(bImprov)} | ${pct(aImprov)} | ${deltaStr(bImprov, aImprov, true)} | ${arrow(bImprov, aImprov)} |`);
    console.log();
    // ---------------------------------------------------------------------------
    // Section 2: Entry rank changes
    // ---------------------------------------------------------------------------
    const beforeById = new Map(before.entries.map((e) => [e.id, e]));
    const afterById = new Map(after.entries.map((e) => [e.id, e]));
    const changed = [];
    for (const [id, aEntry] of afterById) {
        const bEntry = beforeById.get(id);
        if (!bEntry)
            continue;
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
            console.log(`| ${c.id} | ${c.category} | ${c.goalText} | ${bRankStr} | ${aRankStr} | ${rrDeltaStr} | ${arrow(c.beforeRank === 0 ? 999 : c.beforeRank, c.afterRank === 0 ? 999 : c.afterRank)} |`);
        }
        console.log();
    }
    else {
        console.log(`## Entry rank changes\n\n_No rank changes between reports._\n`);
    }
    // ---------------------------------------------------------------------------
    // Section 3: Top-5 Thompson movers
    // ---------------------------------------------------------------------------
    const beforeThompson = new Map((before.thompson_snapshot ?? []).map((t) => [t.activity_id, t]));
    const afterThompson = new Map((after.thompson_snapshot ?? []).map((t) => [t.activity_id, t]));
    const evMovers = [];
    for (const [id, aEntry] of afterThompson) {
        const bEntry = beforeThompson.get(id);
        if (!bEntry)
            continue;
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
            console.log(`| ${m.name} | ${fmt4(m.beforeEv)} | ${fmt4(m.afterEv)} | ${deltaStr(m.beforeEv, m.afterEv)} | ${arrow(m.beforeEv, m.afterEv)} |`);
        }
        console.log();
    }
    else {
        console.log(`## Top-5 Thompson movers\n\n_No significant EV changes detected._\n`);
    }
    // ---------------------------------------------------------------------------
    // Section 4: Search MRR vs Recommend MRR delta (v2 reports only)
    // ---------------------------------------------------------------------------
    const bSearchMrr = before.search_mrr;
    const aSearchMrr = after.search_mrr;
    const bRecommendMrr = before.recommend_mrr ?? before.mrr;
    const aRecommendMrr = after.recommend_mrr ?? after.mrr;
    if (aSearchMrr !== undefined || bSearchMrr !== undefined) {
        console.log(`## Search MRR vs Recommend MRR\n`);
        console.log(`| Metric | Before | After | Delta | Dir |`);
        console.log(`|--------|--------|-------|-------|-----|`);
        if (bRecommendMrr !== undefined && aRecommendMrr !== undefined) {
            console.log(`| recommend_mrr | ${fmt4(bRecommendMrr)} | ${fmt4(aRecommendMrr)} | ${deltaStr(bRecommendMrr, aRecommendMrr)} | ${arrow(bRecommendMrr, aRecommendMrr)} |`);
        }
        if (bSearchMrr !== undefined && aSearchMrr !== undefined) {
            console.log(`| search_mrr    | ${fmt4(bSearchMrr)} | ${fmt4(aSearchMrr)} | ${deltaStr(bSearchMrr, aSearchMrr)} | ${arrow(bSearchMrr, aSearchMrr)} |`);
            if (aSearchMrr - (bSearchMrr ?? 0) < -0.05) {
                console.log(`\n⚠  **search_mrr regression**: dropped ${((aSearchMrr - bSearchMrr) * 100).toFixed(1)}pp (threshold: −5pp). Investigate FTS index health.`);
            }
        }
        else if (aSearchMrr !== undefined) {
            console.log(`| search_mrr    | — | ${fmt4(aSearchMrr)} | new | ▲ |`);
        }
        // Quadrant counts delta
        if (before.quadrant_counts && after.quadrant_counts) {
            const bq = before.quadrant_counts;
            const aq = after.quadrant_counts;
            console.log(`\nQuadrant shift:`);
            console.log(`  A (search✓ recommend✓): ${bq.A} → ${aq.A}  (${aq.A >= bq.A ? "+" : ""}${aq.A - bq.A})`);
            console.log(`  B (search✓ recommend✗): ${bq.B} → ${aq.B}  (${aq.B >= bq.B ? "+" : ""}${aq.B - bq.B})  ← Thompson burial`);
            console.log(`  C (search✗ recommend✓): ${bq.C} → ${aq.C}  (${aq.C >= bq.C ? "+" : ""}${aq.C - bq.C})  ← Thompson recovery`);
            console.log(`  D (search✗ recommend✗): ${bq.D} → ${aq.D}  (${aq.D >= bq.D ? "+" : ""}${aq.D - bq.D})  ← retrieval miss`);
        }
        console.log();
    }
    // ---------------------------------------------------------------------------
    // Section 5: Behavioral Health Delta
    // ---------------------------------------------------------------------------
    const bih = before.improvise_health;
    const aih = after.improvise_health;
    const brc = before.resolver_coverage;
    const arc = after.resolver_coverage;
    const brt = before.reuse_trajectory;
    const art = after.reuse_trajectory;
    const hasBehavioral = (bih !== undefined || aih !== undefined) ||
        (brc !== undefined || arc !== undefined) ||
        (brt !== undefined || art !== undefined);
    if (hasBehavioral) {
        console.log(`## Behavioral Health Delta\n`);
        console.log(`| Metric | Before | After | Delta | Dir |`);
        console.log(`|--------|--------|-------|-------|-----|`);
        // improvise_success_rate (↑ good)
        const bImpSucc = bih?.success_rate ?? null;
        const aImpSucc = aih?.success_rate ?? null;
        console.log(`| improvise_success_rate (↑) | ${nullablePct(bImpSucc)} | ${nullablePct(aImpSucc)} | ${nullableDelta(bImpSucc, aImpSucc)} | ${nullableArrow(bImpSucc, aImpSucc)} |`);
        // ribosome_activation_rate (↑ good)
        const bRibo = bih?.ribosome_activation_rate ?? null;
        const aRibo = aih?.ribosome_activation_rate ?? null;
        console.log(`| ribosome_activation_rate (↑) | ${nullablePct(bRibo)} | ${nullablePct(aRibo)} | ${nullableDelta(bRibo, aRibo)} | ${nullableArrow(bRibo, aRibo)} |`);
        // llm_tier_rate (↓ good — lower means more deterministic resolvers)
        const bLlm = brc?.llm_tier_rate ?? null;
        const aLlm = arc?.llm_tier_rate ?? null;
        console.log(`| llm_tier_rate (↓ good) | ${nullablePct(bLlm)} | ${nullablePct(aLlm)} | ${nullableDelta(bLlm, aLlm, true)} | ${nullableArrow(bLlm, aLlm, true)} |`);
        // reuse_rate (↑ good)
        const bReuse = brt?.reuse_rate ?? null;
        const aReuse = art?.reuse_rate ?? null;
        console.log(`| reuse_rate (↑ good) | ${nullablePct(bReuse)} | ${nullablePct(aReuse)} | ${nullableDelta(bReuse, aReuse)} | ${nullableArrow(bReuse, aReuse)} |`);
        // mean_composition_depth (informational — deeper = more chaining)
        const bDepth = brt?.mean_composition_depth ?? null;
        const aDepth = art?.mean_composition_depth ?? null;
        const depthBefore = bDepth !== null ? bDepth.toFixed(2) : "null";
        const depthAfter = aDepth !== null ? aDepth.toFixed(2) : "null";
        const depthDelta = (bDepth !== null && aDepth !== null)
            ? `${aDepth - bDepth >= 0 ? "+" : ""}${(aDepth - bDepth).toFixed(2)}`
            : "—";
        console.log(`| mean_composition_depth | ${depthBefore} | ${depthAfter} | ${depthDelta} | ${nullableArrow(bDepth, aDepth)} |`);
        console.log();
    }
    // ---------------------------------------------------------------------------
    // Section 6: Summary counts
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
    console.log(`- API calls: before=${before.trace_stats?.sample_size ?? "?"} traces, after=${after.trace_stats?.sample_size ?? "?"} traces`);
    console.log();
}
main().catch((e) => {
    console.error("ERROR:", e instanceof Error ? e.message : String(e));
    process.exit(1);
});
//# sourceMappingURL=compare-reports.js.map