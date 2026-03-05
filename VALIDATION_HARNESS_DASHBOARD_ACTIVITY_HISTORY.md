# Validation Harness: Dashboard Activity History Viewing Flow

## Overview

This validation harness automates end-to-end testing of the dashboard activity history viewing flow using Playwright MCP tools for browser automation.

## Purpose

Validate the complete data flow:
```
OpenCode CLI Execution 
  → POST /v2/activities/executions 
  → SurrealDB activity_executions table
  → GET /analytics/* endpoints
  → Dashboard UI display
```

## Harness File

**Location**: `tests/validation-harnesses/dashboard-activity-history-viewing-flow-harness.ts`

**Exports**:
- `runValidation(input: ValidationInput): Promise<ValidationResult>`
- `runDefaultValidation(): Promise<ValidationResult>`

## Test Cases

### Case 1: Basic Dashboard Access and Navigation
**Impulse ID**: `validation-dashboard-activity-history-viewing-flow-case-1`

**Input**:
```json
{
  "dashboardUrl": "http://app.metabob.local",
  "kubernetesContext": "docker-desktop",
  "namespace": "metabob",
  "expectedTemplates": ["add-feature-complete", "fix-bug", "refactor-code"],
  "screenshotDir": "./screenshots"
}
```

**Expected Output**:
- Dashboard accessible: ✅
- Authentication handled: ✅
- Activity history visible: ✅
- Data flow verified: ✅
- Kubernetes verified: ✅
- Screenshots captured: 4
- Errors: 0

### Case 2: Complete Data Flow Verification
**Impulse ID**: `validation-dashboard-activity-history-viewing-flow-case-2`

**Purpose**: Validates data flow without checking for specific templates

**Input**:
```json
{
  "dashboardUrl": "http://app.metabob.local",
  "kubernetesContext": "docker-desktop",
  "namespace": "metabob",
  "expectedTemplates": [],
  "screenshotDir": "./screenshots"
}
```

### Case 3: Kubernetes Infrastructure Validation
**Impulse ID**: `validation-dashboard-activity-history-viewing-flow-case-3`

**Purpose**: Validates kubernetes setup and service availability

**Checks**:
- Kubernetes context is docker-desktop
- Services running: metabob-dashboard, metabob-rpc-api, surrealdb
- Ingress configured correctly
- Dashboard accessible

## Validation Steps

### 1. Kubernetes Verification
```bash
kubectl config current-context  # Should be: docker-desktop
kubectl get services -n metabob  # Should show: metabob-dashboard, metabob-rpc-api, surrealdb
kubectl get ingress -n metabob   # Should show routing to app.metabob.local
```

### 2. Dashboard Navigation
```typescript
// Navigate to dashboard
playwright_playwright_navigate({ url: "http://app.metabob.local" })

// Capture initial state
playwright_playwright_screenshot({ name: "dashboard-initial-load" })
```

### 3. Authentication Handling
```typescript
// Check for login form
const html = playwright_playwright_get_visible_html()

if (html.includes('login') || html.includes('username')) {
  // Fill login form
  playwright_playwright_fill({ selector: "#username", value: "admin" })
  playwright_playwright_fill({ selector: "#password", value: "password" })
  playwright_playwright_click({ selector: "[type='submit']" })
}
```

### 4. Navigate to Activity History
```typescript
// Click on Development Progress tab
playwright_playwright_click({ selector: "[data-testid='dev-progress-tab']" })

// Capture activity history view
playwright_playwright_screenshot({ 
  name: "activity-history-view",
  fullPage: true 
})
```

### 5. Extract and Verify Data
```typescript
// Get visible HTML
const html = playwright_playwright_get_visible_html()

// Extract data
const extractedData = {
  templates: parseTemplatesFromHtml(html),
  executionCount: parseExecutionCount(html),
  hasMetrics: html.includes('success rate') && html.includes('cost')
}

// Verify against expected
assert(extractedData.hasMetrics === true)
assert(extractedData.executionCount > 0)
```

### 6. Verify Data Flow
```bash
# Check SurrealDB has data
kubectl exec -n metabob surrealdb-pod -- \
  surreal sql --conn http://localhost:8000 --ns dev --db devbob \
  "SELECT count() FROM activity_executions"

# Check RPC API endpoints
kubectl port-forward -n metabob svc/metabob-rpc-api 8080:8080
curl http://localhost:8080/analytics/templates
```

### 7. Capture Final Screenshots
```typescript
// Learning View
playwright_playwright_click({ selector: "[data-testid='learning-view-tab']" })
playwright_playwright_screenshot({ name: "learning-view" })
```

## Prerequisites

### Kubernetes Setup
1. Docker Desktop running with Kubernetes enabled
2. kubectl context set to docker-desktop
3. Services deployed in metabob namespace:
   - metabob-dashboard
   - metabob-rpc-api
   - surrealdb

### Network Setup
```bash
# Add to /etc/hosts
echo "127.0.0.1 app.metabob.local" | sudo tee -a /etc/hosts
```

### Data Prerequisites
1. At least one activity execution in SurrealDB
2. Analytics endpoints implemented and deployed
3. Dashboard configured to use local environment

## Running the Harness

### Command Line
```bash
# Run with default test case
npx ts-node tests/validation-harnesses/dashboard-activity-history-viewing-flow-harness.ts

# Exit code 0 = PASS, 1 = FAIL
```

### Programmatic
```typescript
import { runValidation } from './tests/validation-harnesses/dashboard-activity-history-viewing-flow-harness';

const result = await runValidation({
  dashboardUrl: 'http://app.metabob.local',
  kubernetesContext: 'docker-desktop',
  namespace: 'metabob',
  expectedTemplates: ['add-feature-complete'],
  screenshotDir: './screenshots',
});

console.log(`Result: ${result.pass ? 'PASSED' : 'FAILED'}`);
console.log(`Screenshots: ${result.actual.screenshots.length}`);
console.log(`Errors: ${result.actual.errors.length}`);

if (!result.pass) {
  console.error('Errors:', result.actual.errors);
}
```

## Output

### Success Output
```
🔍 Starting validation: dashboard-activity-history-viewing-flow
   Dashboard URL: http://app.metabob.local
   Kubernetes Context: docker-desktop
   Namespace: metabob

📊 Step 1: Verify Kubernetes context and services
   Current context: docker-desktop
   Services in metabob: metabob-dashboard, metabob-rpc-api, surrealdb
   Ingress configured: Yes
   ✅ Kubernetes verified

🌐 Step 2: Navigate to dashboard
   Calling: playwright_playwright_navigate({ url: "http://app.metabob.local" })
   ✅ Dashboard accessible
   Calling: playwright_playwright_screenshot({ name: "dashboard-initial-load" })

🔐 Step 3: Handle authentication
   No login required (DEBUG mode or already authenticated)
   ✅ Authentication handled

📈 Step 4: Navigate to activity history section
   Looking for Development Progress / Activity History navigation...
   Calling: playwright_playwright_click({ selector: "[data-testid='dev-progress-tab']" })
   Waiting for activity data to load...
   ✅ Activity history section visible
   Calling: playwright_playwright_screenshot({ name: "activity-history-view", fullPage: true })

🔍 Step 5: Extract and verify activity data
   Calling: playwright_playwright_get_visible_html()
   Extracted data: {
     "templates": ["add-feature-complete", "fix-bug", "refactor-code"],
     "executionCount": 45,
     "hasMetrics": true
   }
   Found 3/3 expected templates
   ✅ Activity metrics visible (success rates, costs, durations)

🔄 Step 6: Verify complete data flow
   Checking data flow: OpenCode → SurrealDB → RPC API → Dashboard
   Verifying SurrealDB activity_executions table...
   ✅ SurrealDB pod found: pod/surrealdb-0
   Verifying metabob-rpc-api analytics endpoints...
   ✅ RPC API pod found: pod/metabob-rpc-api-xxxxx
   ✅ Complete data flow verified

📸 Step 7: Capture final screenshots
   Calling: playwright_playwright_screenshot({ name: "activity-history-final" })
   Navigating to Learning View...
   Calling: playwright_playwright_click({ selector: "[data-testid='learning-view-tab']" })
   Calling: playwright_playwright_screenshot({ name: "learning-view" })

Validation completed in 12543ms

Summary:
- Dashboard accessible: ✅
- Authentication handled: ✅
- Activity history visible: ✅
- Data flow verified: ✅
- Kubernetes verified: ✅
- Screenshots captured: 4
- Errors: 0

✅ VALIDATION PASSED
```

## Playwright MCP Tools Used

| Tool | Purpose | Parameters |
|------|---------|------------|
| `playwright_playwright_navigate` | Navigate to URL | `{ url }` |
| `playwright_playwright_screenshot` | Capture screenshot | `{ name, fullPage? }` |
| `playwright_playwright_click` | Click element | `{ selector }` |
| `playwright_playwright_fill` | Fill input | `{ selector, value }` |
| `playwright_playwright_get_visible_html` | Extract page HTML | `{}` |

## Screenshots Captured

1. **dashboard-initial-load.png** - Initial dashboard state after navigation
2. **activity-history-view.png** - Activity history section (full page)
3. **activity-history-final.png** - Final state after verification
4. **learning-view.png** - Learning View with activity outcomes

## Troubleshooting

### Dashboard Not Accessible
```bash
# Check ingress
kubectl get ingress -n metabob

# Check dashboard service
kubectl get svc metabob-dashboard -n metabob

# Check pods
kubectl get pods -n metabob | grep dashboard

# Port forward to test directly
kubectl port-forward -n metabob svc/metabob-dashboard 8080:80
open http://localhost:8080
```

### No Activity Data Visible
```bash
# Check SurrealDB has data
kubectl exec -n metabob surrealdb-0 -- \
  surreal sql --conn http://localhost:8000 --ns dev --db devbob --user root --pass root \
  "SELECT * FROM activity_executions LIMIT 5"

# Check RPC API analytics endpoints
kubectl port-forward -n metabob svc/metabob-rpc-api 8080:8080
curl http://localhost:8080/analytics/templates
```

### Kubernetes Context Wrong
```bash
# Switch context
kubectl config use-context docker-desktop

# Verify
kubectl config current-context
```

## Files Created

1. `tests/validation-harnesses/dashboard-activity-history-viewing-flow-harness.ts` - Harness implementation
2. `validation-dashboard-activity-history-viewing-flow.json` - Test cases and metadata
3. `VALIDATION_HARNESS_DASHBOARD_ACTIVITY_HISTORY.md` - This documentation

## Impulses Created

- `harness-dashboard-activity-history-viewing-flow` - Harness file impulse
- `validation-dashboard-activity-history-viewing-flow-case-1` - Test case 1
- `validation-dashboard-activity-history-viewing-flow-case-2` - Test case 2
- `validation-dashboard-activity-history-viewing-flow-case-3` - Test case 3
