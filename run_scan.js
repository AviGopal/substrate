"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const project_thread_scan_ts_1 = require("./repos/development-vessel/src/resolvers/project-thread-scan.ts");
async function runScan() {
    const result = await (0, project_thread_scan_ts_1.resolveProjectThreadScan)({ type: "project_thread_scan", execute: true });
    console.log(JSON.stringify(result, null, 2));
}
runScan();
//# sourceMappingURL=run_scan.js.map