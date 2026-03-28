#!/usr/bin/env ts-node
/**
 * Runner for activity-template-scope-assignment validation harness
 * 
 * Usage:
 *   # Local environment
 *   ./run-activity-template-scope-assignment-validation.ts
 * 
 *   # Kubernetes environment
 *   K8S_ENV=true ./run-activity-template-scope-assignment-validation.ts
 */

import { runValidation } from './activity-template-scope-assignment-harness';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('Starting activity-template-scope-assignment validation...\n');
  
  const result = await runValidation();
  
  // Write results to file
  const outputFile = path.join(__dirname, 'validation-results-activity-template-scope-assignment.json');
  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
  console.log(`\nResults written to: ${outputFile}`);
  
  // Exit with appropriate code
  process.exit(result.overallPass ? 0 : 1);
}

main().catch(error => {
  console.error('Runner failed:', error);
  process.exit(1);
});
