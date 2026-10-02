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

export const ROLLING_POOL_VERSION = "25.G7";

/** ISO-8601 week key, e.g. "2026-W27". Same Thursday-of-Jan-4 algorithm as
 *  goal-generator.ts weeklyHeldOutSeed so promotion keys line up with the
 *  held-out seed weeks. */
export function isoWeekKey(date: Date): string {
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

export function emptyRollingPool(): RollingPool {
  return { version: ROLLING_POOL_VERSION, updated_at: new Date(0).toISOString(), weeks: {} };
}

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
export function promoteHeldOutToRollingPool(
  pool: RollingPool | null,
  weekKey: string,
  goals: unknown[],
  sourceFile: string,
  now: Date = new Date()
): PromotionResult {
  const base: RollingPool = pool ?? emptyRollingPool();
  if (base.weeks[weekKey]) {
    return { pool: base, added: 0, week_key: weekKey };
  }
  const next: RollingPool = {
    version: base.version || ROLLING_POOL_VERSION,
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
export function rollingPoolSize(pool: RollingPool | null): number {
  if (!pool) return 0;
  return Object.values(pool.weeks).reduce((s, w) => s + w.goal_count, 0);
}
