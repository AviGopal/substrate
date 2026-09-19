"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@dev-vessel/core");
const goal_summary_1 = require("../resolvers/goal-summary");
const kernel = new core_1.Kernel();
(0, core_1.impulse)(kernel, "goal_summary", async (pointer) => {
    return await (0, goal_summary_1.resolveGoalSummary)();
});
//# sourceMappingURL=impulses.js.map