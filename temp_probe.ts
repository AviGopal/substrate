import { surqlBreakingFieldRefusal } from "./repos/development-vessel/src/resolvers/vessel-mitosis-evaluate.js";

const sql_probe = "ALTER TABLE impulse_resolution_metrics ADD COLUMN source_vessel STRING NOT NULL;";
const result = surqlBreakingFieldRefusal([{ path: "sql/migrations/probe.surql", sql: sql_probe }]);
console.log(result);
