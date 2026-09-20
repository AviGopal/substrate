"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const impulses_ts_1 = require("./src/routes/impulses.ts");
async function runTest() {
    const result = await (0, impulses_ts_1.impulses)({ shape: 'learning-loop-selftest_output' });
    console.log(JSON.stringify(result, null, 2));
}
runTest();
//# sourceMappingURL=test-selftest.js.map