#!/usr/bin/env tsx
/**
 * Create trace impulse for dynamic-activity-creation-with-trailblazing-pass4
 * 
 * This impulse documents the complete implementation trace for Pass 4,
 * identifying all components involved and the gaps that need to be closed.
 */

import { SessionMemory } from "./repos/metabob-opencode/packages/opencode/src/session/session-memory"
import fs from "fs/promises"

const traceAnalysis = JSON.parse(
  await fs.readFile("./TRACE_ANALYSIS_pass4.json", "utf-8")
)

const impulseContent = `# Dynamic Activity Creation with Trailblazing - Pass 4 Trace Analysis

## Specification
${traceAnalysis.specificationName}

## Gap from Previous Passes
${traceAnalysis.gapFromPreviousPasses}

## Components Involved

${traceAnalysis.components.map((comp: any, idx: number) => `
### ${idx + 1}. ${comp.component}

**File**: \`${comp.file}\`

**Current Behavior**: ${comp.currentBehavior}

**Desired Behavior**: ${comp.desiredBehavior}

**Gap**: ${comp.gap}
`).join('\n')}

## Data Flow

\`\`\`
${traceAnalysis.dataFlow}
\`\`\`

## Current State

${Object.entries(traceAnalysis.currentState).map(([key, value]) => `- **${key}**: ${value}`).join('\n')}

## Desired State

${Object.entries(traceAnalysis.desiredState).map(([key, value]) => `- **${key}**: ${value}`).join('\n')}

## Remaining Gaps

${traceAnalysis.remainingGaps.map((gap: any, idx: number) => `
### Gap ${idx + 1}: ${gap.gap}

**Impact**: ${gap.impact}

**Solution**: ${gap.solution}
`).join('\n')}

## Next Steps

${traceAnalysis.nextSteps.map((step: string, idx: number) => `${idx + 1}. ${step}`).join('\n')}

## Key Files to Monitor

1. \`repos/metabob-opencode/packages/opencode/src/tool/activity.ts\` (lines 976-1070)
   - Auto-trailblazing detection and enablement
   - Context injection via searchSimilarActivities

2. \`repos/metabob-opencode/packages/opencode/src/session/activity-template.ts\` (lines 1852-1860)
   - isMetaTemplate() function definition

3. \`repos/metabob-opencode/packages/opencode/src/server/template-service-client.ts\` (lines 528-551)
   - searchSimilarActivities() implementation (currently stub)

4. \`repos/metabob-opencode/packages/opencode/src/session/turn-lifecycle-hooks.ts\` (lines 61-208)
   - memory-management hook execution

5. \`repos/metabob-opencode/packages/opencode/src/api/activity-client.ts\`
   - Database tracking: storeActivityContent, recordTaskStart, updateTaskExecution

6. \`templates/bootstrap/create-activity-self-contained.json\`
   - Meta-template definition with trailblazing enabled

7. \`templates/bootstrap/evolve-activity-self-contained.json\`
   - Meta-template with context_requirements

8. \`templates/bootstrap/debug-activity-self-contained.json\`
   - Meta-template with context_requirements

9. \`tests/validation-harnesses/dynamic-activity-creation-with-trailblazing-pass4-harness.ts\`
   - Validation harness for Pass 4

## Verification Commands

### Check K8s Pod Status
\`\`\`bash
kubectl get pods -n metabob -l app=devbob
kubectl logs -n metabob <devbob-pod> --tail=100
\`\`\`

### Execute Meta-Template in K8s
\`\`\`bash
kubectl exec -n metabob <devbob-pod> -- opencode activity create-activity-self-contained \\
  --variables '{"templateName":"Test","templateDescription":"Test template","category":"feature"}' \\
  --reason "Pass 4 validation"
\`\`\`

### Check Logs for Trailblazing
\`\`\`bash
kubectl logs -n metabob <devbob-pod> | grep -i "auto-enabling trailblazing\\|meta-template\\|context injection"
\`\`\`

### Query SurrealDB
\`\`\`bash
kubectl exec -n metabob <surrealdb-pod> -- surreal sql \\
  --conn http://localhost:8000 \\
  --user root --pass root \\
  --ns metabob --db metabob \\
  "SELECT * FROM activity_executions WHERE template_id = 'create-activity-self-contained' ORDER BY created_at DESC LIMIT 5;"
\`\`\`

## Success Criteria

- ✅ Meta-template detection logs visible in kubectl logs
- ✅ Trailblazing auto-enabled with correct parameters
- ✅ Context injection attempts logged (even if returns empty)
- ✅ Memory-management hook executes before turns
- ✅ Activity execution tracked in SurrealDB
- ✅ Templates execute without filesystem errors
- ✅ All validation harness tests pass (10/10)

## Implementation Priority

1. **HIGH**: Fix filesystem dependencies in templates
2. **HIGH**: Verify K8s deployment has latest code
3. **MEDIUM**: Implement searchSimilarActivities stub
4. **MEDIUM**: Extend validation harness for end-to-end tests
5. **LOW**: Optimize template registration timeout
`

console.log("Creating trace impulse for Pass 4...")

// Create impulse with trace analysis
const impulse = {
  id: "trace-dynamic-activity-creation-with-trailblazing-pass4",
  type: "templateDefinition" as const,
  pointer: {
    type: "memo" as const,
    content: impulseContent,
  },
  budget: 5000,
  priority: "high" as const,
  loaded: true,
}

console.log("\n✅ Trace impulse created successfully!")
console.log(`📝 Impulse ID: ${impulse.id}`)
console.log(`📊 Budget: ${impulse.budget} tokens`)
console.log(`🔍 Components analyzed: ${traceAnalysis.components.length}`)
console.log(`⚠️  Remaining gaps: ${traceAnalysis.remainingGaps.length}`)
console.log(`📋 Next steps: ${traceAnalysis.nextSteps.length}`)
console.log("\n📄 Impulse content preview:")
console.log(impulseContent.substring(0, 500) + "...")

// Write impulse to file for reference
await fs.writeFile(
  "./impulses/trace-dynamic-activity-creation-with-trailblazing-pass4.json",
  JSON.stringify(impulse, null, 2)
)

console.log("\n💾 Impulse saved to: impulses/trace-dynamic-activity-creation-with-trailblazing-pass4.json")
console.log("\nThis impulse is ready for use by downstream validation and enforcement tasks.")
