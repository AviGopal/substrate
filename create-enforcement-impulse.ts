#!/usr/bin/env bun
import fs from 'fs';

const enforcementData = JSON.parse(fs.readFileSync('./enforcement-activity-template-mcp-flow.json', 'utf-8'));

const impulseContent = `# Enforcement: Activity Template Flow via MCP Backend

## Status: ${enforcementData.enforcementStatus}
**Date:** ${enforcementData.enforcementDate}

${enforcementData.summary}

## Components Verified (${enforcementData.componentsVerified.length} total)

${enforcementData.componentsVerified.map((comp: any) => `
### ${comp.component}
**File:** \`${comp.file}\` (Lines ${comp.lines})
**Status:** ✅ ${comp.status}
**Verification Method:** ${comp.verificationMethod}
**Evidence:** ${comp.evidence}
`).join('\n')}

## Validation Checks Performed

${enforcementData.validationChecksPerformed.map((check: any) => `
### ${check.check}
- **Method:** ${check.method}
- **Result:** ${check.result}
- **Evidence:** ${check.evidence}
`).join('\n')}

## Data Flow Verification

${Object.entries(enforcementData.dataFlowVerified).map(([key, value]) => `- **${key}:** ${value}`).join('\n')}

## Architectural Principles

${Object.entries(enforcementData.architecturalPrinciples).map(([key, data]: [string, any]) => `
### ${key}
- **Principle:** ${data.principle}
- **Status:** ✅ ${data.status}
- **Evidence:** ${data.evidence}
`).join('\n')}

## Changes Applied

${enforcementData.changesApplied.length === 0 ? '**NONE** - Specification was already fully enforced' : enforcementData.changesApplied.map((change: any) => `
- **File:** \`${change.file}\`
- **Component:** ${change.component}
- **Change:** ${change.changeMade}
- **Reason:** ${change.reason}
- **Impact:** ${change.impactAnalysis}
`).join('\n')}

## Conclusion

${enforcementData.conclusion}

## Recommendations

${enforcementData.recommendations.map((rec: string) => `- ${rec}`).join('\n')}

---

**Enforcement Complete:** ${enforcementData.enforcementDate}
**Impulse ID:** ${enforcementData.enforcementImpulseId}
`;

const impulse = {
  id: enforcementData.enforcementImpulseId,
  type: 'memo',
  pointer: {
    type: 'memo',
    content: impulseContent,
    source: 'enforcement-verification'
  },
  budget: 3000,
  priority: 'high',
  metadata: {
    specification: enforcementData.specificationName,
    status: enforcementData.enforcementStatus,
    componentsVerified: enforcementData.componentsVerified.length,
    validationChecks: enforcementData.validationChecksPerformed.length,
    changesApplied: enforcementData.changesApplied.length,
    enforcementDate: enforcementData.enforcementDate
  }
};

// Write impulse to file
fs.writeFileSync(
  `./impulses/${impulse.id}.json`,
  JSON.stringify(impulse, null, 2)
);

console.log(`✅ Created enforcement impulse: ${impulse.id}`);
console.log(`📊 Components verified: ${enforcementData.componentsVerified.length}`);
console.log(`✅ Validation checks: ${enforcementData.validationChecksPerformed.length}`);
console.log(`🔧 Changes applied: ${enforcementData.changesApplied.length}`);
console.log(`📁 Saved to: ./impulses/${impulse.id}.json`);
console.log(`\n🎯 Status: ${enforcementData.enforcementStatus}`);
