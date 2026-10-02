"use strict";
/**
 * Unit tests for rolling-pool promotion — G7.3.1 acceptance criteria.
 *
 * The rolling pool must grow by N entries per ISO week (N = held-out count)
 * and re-promoting the same week must be a no-op.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const rolling_pool_1 = require("./rolling-pool");
const GOALS_W1 = [{ id: "g1" }, { id: "g2" }, { id: "g3" }];
const GOALS_W2 = [{ id: "h1" }, { id: "h2" }];
(0, bun_test_1.describe)("isoWeekKey", () => {
    (0, bun_test_1.test)("mid-year date maps to expected ISO week", () => {
        (0, bun_test_1.expect)((0, rolling_pool_1.isoWeekKey)(new Date("2026-07-01T12:00:00Z"))).toBe("2026-W27");
    });
    (0, bun_test_1.test)("early January belongs to the prior ISO year when applicable", () => {
        // 2027-01-01 is a Friday → ISO week 53 of 2026.
        (0, bun_test_1.expect)((0, rolling_pool_1.isoWeekKey)(new Date("2027-01-01T00:00:00Z"))).toBe("2026-W53");
    });
    (0, bun_test_1.test)("same week different days share a key", () => {
        (0, bun_test_1.expect)((0, rolling_pool_1.isoWeekKey)(new Date("2026-06-29T00:00:00Z"))) // Monday
            .toBe((0, rolling_pool_1.isoWeekKey)(new Date("2026-07-05T23:59:59Z"))); // Sunday
    });
});
(0, bun_test_1.describe)("promoteHeldOutToRollingPool", () => {
    (0, bun_test_1.test)("first promotion appends N goals", () => {
        const { pool, added } = (0, rolling_pool_1.promoteHeldOutToRollingPool)(null, "2026-W27", GOALS_W1, "2026-07-01-held-out-goals.json");
        (0, bun_test_1.expect)(added).toBe(3);
        (0, bun_test_1.expect)((0, rolling_pool_1.rollingPoolSize)(pool)).toBe(3);
        (0, bun_test_1.expect)(pool.weeks["2026-W27"].goal_count).toBe(3);
        (0, bun_test_1.expect)(pool.weeks["2026-W27"].source_file).toBe("2026-07-01-held-out-goals.json");
    });
    (0, bun_test_1.test)("re-promoting the same week is idempotent (added = 0)", () => {
        const first = (0, rolling_pool_1.promoteHeldOutToRollingPool)(null, "2026-W27", GOALS_W1, "a.json");
        const second = (0, rolling_pool_1.promoteHeldOutToRollingPool)(first.pool, "2026-W27", GOALS_W1, "a.json");
        (0, bun_test_1.expect)(second.added).toBe(0);
        (0, bun_test_1.expect)((0, rolling_pool_1.rollingPoolSize)(second.pool)).toBe(3);
        (0, bun_test_1.expect)(second.pool).toBe(first.pool); // unchanged reference, no rewrite needed
    });
    (0, bun_test_1.test)("a new week grows the pool by its held-out count", () => {
        const w1 = (0, rolling_pool_1.promoteHeldOutToRollingPool)(null, "2026-W27", GOALS_W1, "a.json");
        const w2 = (0, rolling_pool_1.promoteHeldOutToRollingPool)(w1.pool, "2026-W28", GOALS_W2, "b.json");
        (0, bun_test_1.expect)(w2.added).toBe(2);
        (0, bun_test_1.expect)((0, rolling_pool_1.rollingPoolSize)(w2.pool)).toBe(5);
        (0, bun_test_1.expect)(Object.keys(w2.pool.weeks).sort()).toEqual(["2026-W27", "2026-W28"]);
    });
    (0, bun_test_1.test)("empty pool helper starts at zero", () => {
        (0, bun_test_1.expect)((0, rolling_pool_1.rollingPoolSize)((0, rolling_pool_1.emptyRollingPool)())).toBe(0);
        (0, bun_test_1.expect)((0, rolling_pool_1.rollingPoolSize)(null)).toBe(0);
    });
});
//# sourceMappingURL=rolling-pool.test.js.map