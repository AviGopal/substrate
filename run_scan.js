import { resolveProjectThreadScan } from "/workspace/git/super-repo/repos/development-vessel/dist/resolvers/project-thread-scan.js";

async function main() {
  const result = await resolveProjectThreadScan({ folder: "Substrate/Projects", execute: true });
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
