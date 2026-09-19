"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const capability_census_tick_1 = require("./repos/development-vessel/src/resolvers/capability-census-tick");
async function runCensus() {
    const report = await (0, capability_census_tick_1.capabilityCensusTick)();
    console.log(JSON.stringify(report, null, 2));
}
runCensus();
//# sourceMappingURL=run-census.js.map