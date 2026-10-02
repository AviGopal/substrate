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
export interface RollingPoolWeek {
    promoted_at: string;
    source_file: string;
    goal_count: number;
    goals: unknown[];
}
export interface RollingPool {
    version: string;
    updated_at: string;
    weeks: Record<string, RollingPoolWeek>;
}
export declare const ROLLING_POOL_VERSION = "25.G7";
/** ISO-8601 week key, e.g. "2026-W27". Same Thursday-of-Jan-4 algorithm as
 *  goal-generator.ts weeklyHeldOutSeed so promotion keys line up with the
 *  held-out seed weeks. */
export declare function isoWeekKey(date: Date): string;
export declare function emptyRollingPool(): RollingPool;
export interface PromotionResult {
    pool: RollingPool;
    /** Number of goals appended by this call (0 when the week already exists). */
    added: number;
    week_key: string;
}
/**
 * Pure promotion step. Returns the (possibly unchanged) pool plus the number
 * of goals actually appended. Callers own file IO.
 */
export declare function promoteHeldOutToRollingPool(pool: RollingPool | null, weekKey: string, goals: unknown[], sourceFile: string, now?: Date): PromotionResult;
/** Total goals across all promoted weeks (acceptance-criterion probe). */
export declare function rollingPoolSize(pool: RollingPool | null): number;
//# sourceMappingURL=rolling-pool.d.ts.map