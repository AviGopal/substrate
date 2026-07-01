/**
 * Unit tests for rolling-pool promotion — G7.3.1 acceptance criteria.
 *
 * The rolling pool must grow by N entries per ISO week (N = held-out count)
 * and re-promoting the same week must be a no-op.
 */

import { describe, test, expect } from "bun:test";
import {
  isoWeekKey,
  emptyRollingPool,
  promoteHeldOutToRollingPool,
  rollingPoolSize,
} from "./rolling-pool";

const GOALS_W1 = [{ id: "g1" }, { id: "g2" }, { id: "g3" }];
const GOALS_W2 = [{ id: "h1" }, { id: "h2" }];

describe("isoWeekKey", () => {
  test("mid-year date maps to expected ISO week", () => {
    expect(isoWeekKey(new Date("2026-07-01T12:00:00Z"))).toBe("2026-W27");
  });

  test("early January belongs to the prior ISO year when applicable", () => {
    // 2027-01-01 is a Friday → ISO week 53 of 2026.
    expect(isoWeekKey(new Date("2027-01-01T00:00:00Z"))).toBe("2026-W53");
  });

  test("same week different days share a key", () => {
    expect(isoWeekKey(new Date("2026-06-29T00:00:00Z"))) // Monday
      .toBe(isoWeekKey(new Date("2026-07-05T23:59:59Z"))); // Sunday
  });
});

describe("promoteHeldOutToRollingPool", () => {
  test("first promotion appends N goals", () => {
    const { pool, added } = promoteHeldOutToRollingPool(
      null, "2026-W27", GOALS_W1, "2026-07-01-held-out-goals.json"
    );
    expect(added).toBe(3);
    expect(rollingPoolSize(pool)).toBe(3);
    expect(pool.weeks["2026-W27"].goal_count).toBe(3);
    expect(pool.weeks["2026-W27"].source_file).toBe("2026-07-01-held-out-goals.json");
  });

  test("re-promoting the same week is idempotent (added = 0)", () => {
    const first = promoteHeldOutToRollingPool(null, "2026-W27", GOALS_W1, "a.json");
    const second = promoteHeldOutToRollingPool(first.pool, "2026-W27", GOALS_W1, "a.json");
    expect(second.added).toBe(0);
    expect(rollingPoolSize(second.pool)).toBe(3);
    expect(second.pool).toBe(first.pool); // unchanged reference, no rewrite needed
  });

  test("a new week grows the pool by its held-out count", () => {
    const w1 = promoteHeldOutToRollingPool(null, "2026-W27", GOALS_W1, "a.json");
    const w2 = promoteHeldOutToRollingPool(w1.pool, "2026-W28", GOALS_W2, "b.json");
    expect(w2.added).toBe(2);
    expect(rollingPoolSize(w2.pool)).toBe(5);
    expect(Object.keys(w2.pool.weeks).sort()).toEqual(["2026-W27", "2026-W28"]);
  });

  test("empty pool helper starts at zero", () => {
    expect(rollingPoolSize(emptyRollingPool())).toBe(0);
    expect(rollingPoolSize(null)).toBe(0);
  });
});
