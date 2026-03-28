# E2E Tests Contract

**Contract ID:** `e2e-tests`
**Version:** 1.0.0
**Owner:** Contract Agent (E2E Testing)
**Status:** Draft

---

## Purpose

Defines end-to-end test scenarios that validate the full stack integration across all repos. These tests use **live data** with **provable provenance** to ensure the system works in realistic conditions.

## What Are We Testing?

**Not Just APIs (Functional State):**
- We're not just verifying HTTP endpoints return 200 OK
- We're not just checking database tables have correct schemas
- Testing static functional state is necessary but insufficient

**The BECOMING Itself (Transformation Quality):**
- **Vessel → Execution → Instance flows**: Does activity template produce expected results?
- **State transformations**: Does code actually change as intended?
- **Learning quality**: Do metrics improve over time?
- **Continuous transformation**: Does the system keep evolving correctly?

**What We're Really Validating:**
- **Template → Execution → Result**: Full transformation cycle
- **Learning Loops**: Does Thompson Sampling converge to better choices?
- **Ribosome Pattern**: Can successful improvisation be extracted as templates?
- **Pattern Recognition**: Do co-change predictions improve with data?
- **Impulse Resolution**: Does context injection work across execution modes?
- **Domain Integration**: Do all domains (dev, analysis, deployment) work together?

**Examples of Transformation Testing:**
- Not: "Does `/recommend` return JSON?"
- But: "Does recommendation lead to successful execution AND does that execution improve future recommendations?"
- Not: "Is problem data stored?"
- But: "Does problem detection → fix → annotation create a learning loop that prevents similar issues?"

**Key Insight:** We test the PROCESS-OF-BECOMING, not just the before/after states. The transformation quality matters more than static correctness.

## Test Coverage by Domain

Tests organized by system domain to ensure comprehensive coverage:

**Software Development Domain:**
- E2E-4: Developer Journey (problem → fix → resolution)
- Validates: Activity execution, git operations, file modifications
- Example: Template creates code change → commits → stores trace

**Analysis & Understanding Domain:**
- E2E-1: Full Analysis Flow (code → CPG → issues)
- E2E-5: Impact Analysis (CPG traversal)
- Validates: Tree-sitter parsing, graph construction, embeddings
- Example: TypeScript code → components → problems → dashboard

**Learning & Optimization Domain:**
- E2E-2: Co-Change Prediction (pattern recognition)
- Validates: Thompson Sampling, online learning, feedback loops
- Example: Historical changes → predictions → accuracy improvement

**Meta-work & Validation Domain:**
- E2E-6: Annotation Workflow (documentation creation)
- Validates: Context preservation, impulse creation
- Example: Manual annotation → searchable knowledge → future context

**Deployment & Infrastructure Domain:**
- (Future) Helm deployment E2E
- Validates: Kubernetes orchestration, service mesh
- Example: Template deployment → health checks → observability

**Cross-Domain Integration:**
- E2E-3: Dashboard Integration (all tabs)
- Validates: Data flows across domains, UI shows correct domain-specific data
- Example: Analysis domain data → dashboard → developer domain actions

**Key Insight:** Each domain has specific transformation patterns. Tests must validate domain-appropriate becoming.

## Test Philosophy

**NO MOCK DATA**
- All tests use real code from actual repos
- Data is tagged with test run IDs for traceability
- Tests prove data flows through the full stack
- Playwright validates UI displays correct data

**PROVENANCE REQUIRED**
- Every test generates unique markers (timestamps, UUIDs)
- Data tagged with `testRunId` for cleanup
- Screenshots capture visual evidence
- Test reports include data lineage

---

## Test Data Sources

All tests MUST use code from these repos:
- `repos/minibob/src/**/*.ts`
- `repos/metabob-analysis-api/src/**/*.ts`
- `repos/metabob-activity-api/src/**/*.ts`
- `repos/metabob-cloud-dashboard/src/**/*.tsx`
- `repos/metabob-mcp/src/**/*.ts`

**Rationale:** This is the stack we're developing. Tests should validate our actual code.

---

## Test Manifest Pattern

Every E2E test MUST generate a manifest for provenance tracking:

```typescript
interface TestManifest {
  testRunId: string;              // "test-run-1711228800000-abc123"
  marker: string;                 // "🔬 LIVE TEST 2026-03-23T22:30:00Z"

  entities: {
    sessionId: string;
    problemIds: string[];
    annotationIds: string[];
    componentIds: string[];
  };

  expectedInUI: {
    sessionName: string;
    problemCount: number;
    severities: string[];
    filePaths: string[];
    annotationTexts: string[];
  };

  cleanup: () => Promise<void>;
}
```

**Usage:**
```typescript
const manifest = await generateLiveData({ marker: '🔬 E2E TEST' });
try {
  await validateDashboard(manifest);
} finally {
  await manifest.cleanup();
}
```

---

## Test Scenarios

### E2E-1: Full Analysis Flow

**Purpose:** Validate code → CPG → analysis → dashboard pipeline

**Steps:**
1. Parse real TypeScript files from all 5 repos
2. Build CPG with tree-sitter
3. Generate real embeddings with ONNX
4. Call MCP tool `get_priority_issues`
5. Navigate dashboard with Playwright
6. Validate problem IDs appear in UI
7. Screenshot for evidence

**Validation Criteria:**
- ✅ CPG contains real components
- ✅ Problem IDs from MCP appear in dashboard
- ✅ Severity badges render correctly
- ✅ File paths link to actual files
- ✅ Impact scores > 0

**Performance:**
- Data generation: <5s
- UI validation: <10s
- Total: <15s

**File:** `tests/e2e/test-full-analysis-flow.ts`

---

### E2E-2: Co-Change Prediction

**Purpose:** Validate learning loop and co-change predictions

**Steps:**
1. Generate CPG from repos
2. Simulate file change in `repos/minibob/src/index.ts`
3. Call MCP tool `suggest_related_changes`
4. Navigate to Co-Changes tab in dashboard
5. Validate suggestions appear with confidence scores
6. Provide feedback (correct predictions)
7. Re-run prediction
8. Verify accuracy improved

**Validation Criteria:**
- ✅ Initial predictions exist
- ✅ Confidence scores 0-1
- ✅ Reasons provided (frequency or embedding)
- ✅ After feedback, accuracy increases
- ✅ Learning loop updates SurrealDB

**Performance:**
- Prediction: <300ms P50
- Learning update: <100ms
- Total: <20s

**File:** `tests/e2e/test-cochange-learning.ts`

---

### E2E-3: Dashboard Integration

**Purpose:** Validate all tabs in cloud dashboard show live data

**Steps:**
1. Generate full dataset (problems, annotations, co-changes)
2. Navigate to `http://cloud.minibob.local`
3. **Analysis Tab:** Verify problems visible
4. Click problem → Verify details expand
5. **Co-Changes Tab:** Verify predictions visible
6. **Activities Tab:** Verify executions visible
7. Screenshot each tab

**Validation Criteria:**
- ✅ All tabs render without errors
- ✅ Data matches test manifest
- ✅ Interactions work (click, expand, filter)
- ✅ Real-time updates (if polling enabled)
- ✅ Screenshots saved with testRunId

**Performance:**
- Page load: <2s
- Tab switch: <500ms
- Total: <30s

**File:** `tests/e2e/test-dashboard-integration.ts`

---

### E2E-4: Developer Journey

**Purpose:** Validate complete user workflow from problem discovery to resolution

**Steps:**
1. Developer sees problem in dashboard (high priority)
2. Clicks "View Details"
3. Reads annotations (context)
4. Checks co-change predictions
5. Creates fix activity (future feature)
6. Marks problem as resolved
7. Verifies resolution appears in dashboard

**Validation Criteria:**
- ✅ Problem details show annotations
- ✅ Co-change suggestions guide fix
- ✅ Resolution creates auto-annotation
- ✅ Problem status updates to "resolved"
- ✅ Learning loop records resolution

**Performance:**
- Full journey: <60s

**File:** `tests/e2e/test-developer-journey.ts`

---

### E2E-5: Impact Analysis

**Purpose:** Validate CPG traversal and impact computation

**Steps:**
1. Build CPG from all repos
2. Select component: `repos/minibob/src/index.ts::startServer`
3. Call MCP tool `analyze_change_impact` with depth=3
4. Validate direct dependencies found
5. Validate indirect dependencies found
6. Navigate dashboard Impact view
7. Verify impact graph renders

**Validation Criteria:**
- ✅ Forward dependencies (what this calls)
- ✅ Backward dependencies (what calls this)
- ✅ Risk levels computed correctly
- ✅ Test files identified
- ✅ Graph visualization works

**Performance:**
- Impact analysis: <400ms P50
- Graph render: <1s
- Total: <15s

**File:** `tests/e2e/test-impact-analysis.ts`

---

### E2E-6: Annotation Workflow

**Purpose:** Validate annotation creation and retrieval

**Steps:**
1. Create CPG from repos
2. Call MCP tool `annotate_component` with design decision
3. Navigate dashboard to component view
4. Verify annotation appears
5. Create second annotation (resolved challenge)
6. Verify both annotations visible
7. Link annotation to problem
8. Verify link in database

**Validation Criteria:**
- ✅ Annotation stored in SurrealDB
- ✅ Annotation appears in dashboard
- ✅ Markdown formatted correctly
- ✅ Tags searchable
- ✅ Problem link bidirectional

**Performance:**
- Annotation create: <50ms P50
- Dashboard update: <2s
- Total: <10s

**File:** `tests/e2e/test-annotation-workflow.ts`

---

## Playwright Tools Integration

All E2E tests MUST use Playwright MCP tools available in this session:

**Required Tools:**
- `mcp__playwright__browser_navigate` - Navigate to dashboard
- `mcp__playwright__browser_snapshot` - Capture page state
- `mcp__playwright__browser_click` - Interact with UI
- `mcp__playwright__browser_wait_for` - Wait for elements
- `mcp__playwright__browser_take_screenshot` - Visual evidence

**Pattern:**
```typescript
await browser.navigate('http://cloud.minibob.local');
await browser.wait_for({ text: manifest.marker });
const snapshot = await browser.snapshot();
expect(snapshot).toContain(manifest.entities.problemIds[0]);
await browser.take_screenshot({
  filename: `e2e-${manifest.testRunId}.png`
});
```

---

## Cleanup Strategy

**CRITICAL:** All E2E tests MUST clean up data after execution.

**Cleanup Includes:**
- Delete session from SurrealDB
- Delete all analysis_problems with testRunId tag
- Delete all component_annotations with testRunId tag
- Delete all cochange_patterns from test session
- Verify cleanup with query

**Implementation:**
```typescript
async cleanup(): Promise<void> {
  // Delete session cascades to related data
  await db.query(
    'DELETE sessions WHERE id = $sessionId',
    { sessionId: manifest.sessionId }
  );

  // Verify no test data remains
  const remaining = await db.query(
    'SELECT * FROM analysis_problems WHERE session_id = $sessionId',
    { sessionId: manifest.sessionId }
  );

  if (remaining.length > 0) {
    throw new Error('Cleanup failed: test data still in DB');
  }
}
```

---

## Screenshot Storage

**Location:** `.playwright-mcp/`

**Naming Convention:**
```
{test-name}-{testRunId}.png
```

**Examples:**
- `analysis-flow-test-run-1711228800000-abc123.png`
- `cochange-learning-test-run-1711228900000-def456.png`

**Retention:** Keep screenshots for 7 days, then delete.

---

## Test Execution

**Run All E2E Tests:**
```bash
cd tests/e2e
bun test --timeout 60000

# Expected: All tests pass with live data
```

**Run Single Test:**
```bash
bun test test-full-analysis-flow.ts

# Generates:
# - Test manifest with testRunId
# - Screenshots in .playwright-mcp/
# - Test report
```

**CI Integration:**
```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on: [push, pull_request]
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test tests/e2e/
```

---

## Dependents

This contract affects:

- **All repos** - Must support E2E testing
- **metabob-cloud-dashboard** - UI must be testable with Playwright
- **metabob-analysis-api** - API must accept test data
- **metabob-mcp** - Tools must work with test sessions

**Change Notification Required:** YES (when adding new test scenarios)

---

## Reporting

**Test Report Format:**
```typescript
interface E2EReport {
  testRunId: string;
  testName: string;
  timestamp: string;

  phases: {
    dataGeneration: { duration: number, success: boolean },
    apiCalls: { duration: number, success: boolean },
    uiValidation: { duration: number, success: boolean },
    cleanup: { duration: number, success: boolean }
  };

  validations: {
    [key: string]: boolean
  };

  screenshots: string[];

  passed: boolean;

  evidence: {
    sessionCreated: string;
    problemsAnalyzed: number;
    annotationsCreated: number;
    dashboardVerified: boolean;
  };
}
```

---

## Contact

**Contract Owner:** E2E Testing Contract Agent
**Repo:** N/A (cross-repo)
**Updates:** openspec/contracts/e2e-tests.md
