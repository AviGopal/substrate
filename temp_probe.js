"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vessel_mitosis_evaluate_js_1 = require("./repos/development-vessel/src/resolvers/vessel-mitosis-evaluate.js");
const sql_probe = "ALTER TABLE impulse_resolution_metrics ADD COLUMN source_vessel STRING NOT NULL;";
const result = (0, vessel_mitosis_evaluate_js_1.surqlBreakingFieldRefusal)([{ path: "sql/migrations/probe.surql", sql: sql_probe }]);
console.log(result);
//# sourceMappingURL=temp_probe.js.map