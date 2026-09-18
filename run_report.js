import { resolveCapabilityCensusReport } from "/workspace/git/super-repo/repos/development-vessel/dist/resolvers/capability-census-report.js";
const report = await resolveCapabilityCensusReport();
console.log(JSON.stringify(report));
