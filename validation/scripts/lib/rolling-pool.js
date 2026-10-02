"use strict";
/**
 * rolling-pool.ts — G7.3.1 held-out → rolling-pool promotion.
 *
 * After a held-out suite runs, its prompts are folded into
 * `validation/generated/rolling-pool.json` keyed by ISO week, making them
 * eligible for re-use in subsequent rolling-pool runs (design §"Promotion
 * logic": the rolling pool grows by N entries per week, N = held-out count).
 *
 * Idempotent: promoting the same ISO week twice is a no-op (added = 0), so
 * re-running the harness within a week does not duplicate entries.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLLING_POOL_VERSION = void 0;
exports.isoWeekKey = isoWeekKey;
exports.emptyRollingPool = emptyRollingPool;
exports.promoteHeldOutToRollingPool = promoteHeldOutToRollingPool;
exports.rollingPoolSize = rollingPoolSize;
exports.ROLLING_POOL_VERSION = "25.G7";
/** ISO-8601 week key, e.g. "2026-W27". Same Thursday-of-Jan-4 algorithm as
 *  goal-generator.ts weeklyHeldOutSeed so promotion keys line up with the
 *  held-out seed weeks. */
function isoWeekKey(date) {
    // ISO week-numbering year: shift to the Thursday of this date's week.
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayOfWeek = (d.getUTCDay() + 6) % 7; // Mon=0
    d.setUTCDate(d.getUTCDate() - dayOfWeek + 3); // Thursday of this week
    const isoYear = d.getUTCFullYear();
    const jan4 = new Date(Date.UTC(isoYear, 0, 4));
    const jan4DayOfWeek = (jan4.getUTCDay() + 6) % 7;
    const week1Start = new Date(jan4.getTime() - jan4DayOfWeek * 86400000);
    const isoWeek = Math.floor((d.getTime() - week1Start.getTime()) / (7 * 86400000)) + 1;
    return `${isoYear}-W${String(isoWeek).padStart(2, "0")}`;
}
function emptyRollingPool() {
    return { version: exports.ROLLING_POOL_VERSION, updated_at: new Date(0).toISOString(), weeks: {} };
}
/**
 * Pure promotion step. Returns the (possibly unchanged) pool plus the number
 * of goals actually appended. Callers own file IO.
 */
function promoteHeldOutToRollingPool(pool, weekKey, goals, sourceFile, now = new Date()) {
    const base = pool ?? emptyRollingPool();
    if (base.weeks[weekKey]) {
        return { pool: base, added: 0, week_key: weekKey };
    }
    const next = {
        version: base.version || exports.ROLLING_POOL_VERSION,
        updated_at: now.toISOString(),
        weeks: {
            ...base.weeks,
            [weekKey]: {
                promoted_at: now.toISOString(),
                source_file: sourceFile,
                goal_count: goals.length,
                goals,
            },
        },
    };
    return { pool: next, added: goals.length, week_key: weekKey };
}
/** Total goals across all promoted weeks (acceptance-criterion probe). */
function rollingPoolSize(pool) {
    if (!pool)
        return 0;
    return Object.values(pool.weeks).reduce((s, w) => s + w.goal_count, 0);
}
//# sourceMappingURL=rolling-pool.js.map