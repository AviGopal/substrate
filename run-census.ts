
import { capabilityCensusTick } from './repos/development-vessel/src/resolvers/capability-census-tick';

async function runCensus() {
  const report = await capabilityCensusTick();
  console.log(JSON.stringify(report, null, 2));
}

runCensus();
