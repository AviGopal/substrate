#!/usr/bin/env bun

import { Impulse } from "./repos/metabob-opencode/packages/opencode/src/memory/impulse"
import { Storage } from "./repos/metabob-opencode/packages/opencode/src/utils/storage"

const impulseContent = `# Bootstrap Template Filepath Compliance - Complete Trace

## Specification
Bootstrap templates in metabob-opencode must only reference filepaths that are either:
1. Built into the Docker image at build time
2. Provided via metabob-cli's MCP server
3. Embedded in the metabob-opencode binary/distribution

**Current Violation:** \`bootstrap-templates.ts:17\` uses hardcoded path \`'../../../../../metabob-proto/activities/bootstrap'\` which only exists in development monorepo.

## Root Cause
Hardcoded relative path assumes monorepo directory structure. Works in development but breaks completely in:
- Docker containers (path doesn't resolve)
- Standalone binary distributions (metabob-proto not distributed)
- Client devices (metabob-proto doesn't exist)

## Data Flow Analysis

### Entry Point
**File:** \`repos/metabob-opencode/packages/opencode/src/project/bootstrap.ts:15\`
**Component:** \`InstanceBootstrap()\`

Every application start (CLI, HTTP server, Docker) triggers this initialization path. Calls \`TemplateLibrary.initialize()\` which cascades to the filepath issue.

### Critical Component (Root Cause)
**File:** \`repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts:17\`
**Component:** \`BOOTSTRAP_DIR\` constant

\`\`\`typescript
const BOOTSTRAP_DIR = "../../../../../metabob-proto/activities/bootstrap"
\`\`\`

This hardcoded path is computed at module load time and fails in production environments.

**Environment Behavior:**
- Development: ✅ Works (metabob-proto exists as sibling repo)
- Docker: ❌ Fails (workaround: COPY proto files to /metabob-proto/)
- Standalone binary: ❌ Fails (proto files not distributed)

### Component Flow
1. **InstanceBootstrap** → Triggers initialization
2. **TemplateLibrary.initialize** → Orchestrates loading
3. **BootstrapTemplates.loadAll** → 🔴 Filepath resolution fails here
4. **convertProtoToSchema** → Converts proto to OpenCode schema
5. **ActivityTemplate.save** → Persists to local storage
6. **TemplateServiceClient.registerTemplate** → Optional MCP sync

## Components Requiring Changes

### Priority 0 (Blocking)
**File:** \`bootstrap-templates.ts:17\`
- **Current:** Hardcoded relative path
- **Required:** Environment-aware path OR embedded templates
- **Impact:** Complete production blocker

### Priority 1 (High)
**File:** \`bootstrap-templates.ts:193-207\`
- **Current:** No file existence validation
- **Required:** Proactive validation, partial loading support
- **Impact:** Poor error messages, brittle initialization

### Priority 2 (Technical Debt)
- \`bootstrap-templates.ts:47\` - Add proto schema validation
- \`activity-template.ts:690\` - Fix unsafe input mutation
- \`template-service-client.ts:293\` - Add MCP timeout

## Recommended Solution

### Option B: Embed Templates in Binary (RECOMMENDED)
**Effort:** 1-2 days
**Approach:** Use Bun asset bundling to embed JSON at build time

\`\`\`typescript
// Import templates directly (embedded at build time)
import createActivity from "./templates/create-activity-self-contained.json"
import debugActivity from "./templates/debug-activity-self-contained.json"
import evolveActivity from "./templates/evolve-activity-self-contained.json"
import manageMemory from "./templates/manage-session-memory.json"
import traceDataFlow from "./templates/trace-data-flow-single-feature.json"
import traceEnforceValidate from "./templates/trace-enforce-validate-loop.json"

const TEMPLATES = {
  "create-activity": createActivity,
  "debug-activity-self-contained": debugActivity,
  "evolve-activity-self-contained": evolveActivity,
  "manage-session-memory": manageMemory,
  "trace-data-flow-single-feature": traceDataFlow,
  "trace-enforce-validate-loop": traceEnforceValidate,
}

async function loadAll(): Promise<any[]> {
  // No filesystem access needed - templates embedded in binary
  return Object.values(TEMPLATES)
}
\`\`\`

**Benefits:**
- ✅ Eliminates filepath dependency entirely
- ✅ Works in all environments (dev, Docker, standalone)
- ✅ Faster loading (no I/O)
- ✅ Simpler deployment (single binary)
- ✅ No configuration needed

**Tradeoffs:**
- Templates baked into binary (requires rebuild to update)
- Slightly larger binary size (~60KB)

### Option A: Environment Variable (Quick Fix)
**Effort:** 2-4 hours
**Approach:** Add environment detection

\`\`\`typescript
const BOOTSTRAP_DIR = 
  process.env.BOOTSTRAP_TEMPLATES_DIR ?? 
  (process.env.CONTAINER_ENV === "true" 
    ? "/metabob-proto/activities/bootstrap"
    : "../../../../../metabob-proto/activities/bootstrap")
\`\`\`

**Benefits:**
- Quick to implement
- Minimal code changes

**Tradeoffs:**
- Still requires deploying proto files
- Adds configuration complexity
- Doesn't solve standalone binary distribution

## Validation Points

### Files Traced
- \`repos/metabob-opencode/packages/opencode/src/project/bootstrap.ts\`
- \`repos/metabob-opencode/packages/opencode/src/session/template-library.ts\`
- \`repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts\` (CRITICAL)
- \`repos/metabob-opencode/packages/opencode/src/session/activity-template.ts\`
- \`repos/metabob-opencode/packages/opencode/src/server/template-service-client.ts\`

### Components Annotated
6 components documented with design rationale and issues

### Documentation Generated
- Data flow diagram (Mermaid)
- Component annotations with design decisions
- Critical issues summary
- Fix recommendations with code samples

## Related Files
- Full analysis: \`docs/data-flows/bootstrap-template-filepath-compliance-flow.md\`
- Component annotations: \`COMPONENT_ANNOTATIONS_bootstrap-template-filepath-compliance.md\`
- Summary: \`COMPONENT_ANNOTATION_SUMMARY_bootstrap-template-filepath-compliance.md\`

## Next Steps for Enforcement/Validation Tasks

1. Implement Option B (embed templates) in \`bootstrap-templates.ts\`
2. Copy proto JSON files to \`repos/metabob-opencode/packages/opencode/src/session/templates/\`
3. Update imports to use embedded templates
4. Remove BOOTSTRAP_DIR constant
5. Test in all environments (dev, Docker, standalone)
6. Add validation for template completeness at build time
`;

async function createTraceImpulse() {
  console.log("Creating trace impulse: trace-bootstrap-template-filepath-compliance");
  
  const impulse = await Impulse.create({
    id: "trace-bootstrap-template-filepath-compliance",
    type: "memo",
    pointer: {
      type: "memo",
      content: impulseContent,
      source: "trace-activity"
    },
    budget: 5000,
    metadata: {
      specification: "bootstrap-template-filepath-compliance",
      traceDate: new Date().toISOString(),
      priority: "P0",
      blocksProduction: true
    }
  });
  
  console.log("✅ Impulse created successfully");
  console.log(`   ID: ${impulse.id}`);
  console.log(`   Type: ${impulse.type}`);
  console.log(`   Budget: ${impulse.budget} tokens`);
  console.log(`   Content length: ${impulseContent.length} bytes`);
  
  return impulse;
}

try {
  await createTraceImpulse();
  process.exit(0);
} catch (error) {
  console.error("Failed to create impulse:", error);
  process.exit(1);
}
