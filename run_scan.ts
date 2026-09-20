
import { resolveProjectThreadScan } from "./repos/development-vessel/src/resolvers/project-thread-scan.ts";

async function runScan() {
  const result = await resolveProjectThreadScan({ type: "project_thread_scan", execute: true });
  console.log(JSON.stringify(result, null, 2));
}

runScan();

