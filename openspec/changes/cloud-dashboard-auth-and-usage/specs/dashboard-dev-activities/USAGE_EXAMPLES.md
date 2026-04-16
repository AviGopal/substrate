# Dashboard Development Activity Templates - Usage Examples

This document provides examples of how to use the three MiniBob activity templates for dashboard development.

## Overview

Three activity templates have been created for dashboard development:

1. **add-react-dashboard-page.json** - Creates a new React page with routing and navigation
2. **add-dashboard-api-integration.json** - Adds API client functions with TypeScript types
3. **dashboard-feature-complete.json** - Full end-to-end feature implementation

## Template 1: Add React Dashboard Page

**Purpose**: Create a new page component, add it to App.tsx routing, and update Sidebar navigation.

**Location**: `repos/metabob-proto/activities/development/add-react-dashboard-page.json`

**Example Usage**:

```bash
# Example 1: Add Members page
minibob --single "add Members page to dashboard"

# MiniBob will use variables:
# - pageName: "Members"
# - pageId: "members"
# - pageDescription: "Manage organization members"
# - iconName: "👥"

# Example 2: Add Usage Analytics page
minibob --single "add Usage Analytics page showing cost metrics"

# MiniBob will use variables:
# - pageName: "UsageAnalytics"
# - pageId: "usage-analytics"
# - pageDescription: "View token consumption and cost analytics"
# - iconName: "📊"

# Example 3: Add Activity Traces page
minibob --single "add Activity Traces viewer page"

# MiniBob will use variables:
# - pageName: "ExecutionTraces"
# - pageId: "execution-traces"
# - pageDescription: "View and filter activity execution traces"
# - iconName: "📋"
```

**What it does**:

1. Analyzes existing page patterns (APIKeys.tsx, Settings.tsx)
2. Creates new page component at `src/pages/{PageName}.tsx`
3. Adds route to `src/App.tsx` (Page type and renderPage function)
4. Updates `src/components/Sidebar.tsx` (navItems array)
5. Verifies TypeScript compilation

**Output**:
- New page component with shadcn/ui components
- Route configured in App.tsx
- Navigation item in Sidebar

## Template 2: Add Dashboard API Integration

**Purpose**: Create API client functions with TypeScript types and test connectivity.

**Location**: `repos/metabob-proto/activities/development/add-dashboard-api-integration.json`

**Example Usage**:

```bash
# Example 1: Add members list API
minibob --single "add API call to fetch members list"

# MiniBob will use variables:
# - apiFunction: "getMembers"
# - apiFile: "users"
# - endpoint: "/v2/users"
# - httpMethod: "GET"
# - responseType: "Member"
# - typeDescription: "User member with email, name, role, created date"

# Example 2: Add costs API
minibob --single "add API function to get cost data"

# MiniBob will use variables:
# - apiFunction: "getCosts"
# - apiFile: "costs"
# - endpoint: "/v2/costs"
# - httpMethod: "GET"
# - responseType: "CostData"
# - typeDescription: "Cost data with tokens, USD amount, model, timestamp"

# Example 3: Add execution traces API (already exists in activity-api.ts)
minibob --single "verify execution traces API function exists"
```

**What it does**:

1. Analyzes existing API client patterns (client.ts, activity-api.ts)
2. Adds TypeScript types to `src/types/api.ts`
3. Creates API function in `src/lib/api/{apiFile}.ts`
4. Tests endpoint connectivity with curl or test script
5. Verifies TypeScript compilation

**Output**:
- TypeScript interface/type in api.ts
- API client function using apiRequest helper
- Test summary showing connectivity

## Template 3: Dashboard Feature Complete

**Purpose**: Implement a complete dashboard feature from end to end.

**Location**: `repos/metabob-proto/activities/development/dashboard-feature-complete.json`

**Example Usage**:

```bash
# Example 1: Complete Members page implementation
minibob --single "implement member management feature"

# MiniBob will use variables:
# - featureName: "Member Management"
# - featureDescription: "Display organization members with roles, invite new members, remove members"
# - pageName: "Members"
# - pageId: "members"
# - iconName: "👥"
# - apiEndpoints: "/v2/users, /v2/users/invite, /v2/users/{id}"

# Example 2: Complete Usage Analytics implementation
minibob --single "implement usage analytics dashboard"

# MiniBob will use variables:
# - featureName: "Usage Analytics"
# - featureDescription: "Show token consumption, costs, usage by member, usage by API key"
# - pageName: "UsageAnalytics"
# - pageId: "usage-analytics"
# - iconName: "📊"
# - apiEndpoints: "/v2/costs, /v2/activities/metrics-summary"

# Example 3: Complete Trace Viewer implementation
minibob --single "implement activity trace viewer with filtering"

# MiniBob will use variables:
# - featureName: "Activity Trace Viewer"
# - featureDescription: "List and filter execution traces, view detailed trace information"
# - pageName: "ExecutionTraces"
# - pageId: "execution-traces"
# - iconName: "📋"
# - apiEndpoints: "/v2/activities/execution-traces, /v2/activities/execution-traces/{id}"
```

**What it does**:

1. Plans the complete feature (types, API, components, UI)
2. Implements TypeScript types and API functions
3. Creates page component with data fetching and UI
4. Adds routing and navigation
5. Tests end-to-end (compilation, build, manual testing)

**Output**:
- Complete feature with all files created/modified
- Full test summary
- Implementation documentation

## Activity Template Structure

All templates follow the standard MiniBob activity structure:

```json
{
  "id": "development:<name>:v1",
  "name": "Activity Name",
  "description": "What the activity does",
  "tags": ["development.category"],
  "category": "development",
  "variables": [
    {
      "name": "variableName",
      "description": "What this variable is",
      "required": true,
      "type": "string"
    }
  ],
  "input_shapes": ["file_exists"],
  "output_shapes": ["typescript_compiles"],
  "tasks": [
    {
      "id": "task-id",
      "description": "What this task does",
      "prompt": {
        "template": "Instructions for MiniBob...",
        "variables": ["variableName"]
      },
      "validation": {
        "requiredFiles": ["path/to/file"],
        "requiredPatterns": ["pattern to check"]
      }
    }
  ]
}
```

## Key Patterns Encoded

The templates encode several dashboard-specific patterns:

### React 19 Patterns
- Functional components with hooks
- TypeScript types for all props and state
- Import from `@/components/ui` for shadcn components
- Use `cn` from `@/lib/utils` for className utilities

### Bun Patterns
- Use native `fetch` (not axios)
- Use `apiRequest` helper from client.ts
- Avoid Node.js-specific APIs
- Use Bun's built-in features

### Code Style
- 2-space indentation
- PascalCase for components
- camelCase for functions
- kebab-case for route IDs

### File Structure
- Pages: `src/pages/{ComponentName}.tsx`
- Types: `src/types/api.ts`
- API: `src/lib/api/{category}.ts`
- Components: `src/components/{ComponentName}.tsx`

## Thompson Sampling Learning

Each successful execution improves template selection:

1. **Success**: Template gets higher probability for similar goals
2. **Failure**: Trace captured for analysis and variant creation
3. **Over time**: Better templates win, poor ones fade out

## Next Steps

The templates are ready to use. To register them with the backend:

```bash
# Register templates (task 6.10)
# This makes them available for Thompson Sampling
minibob --single "register dashboard activity templates with activity-api"
```

Once registered, MiniBob will automatically recommend these templates for dashboard development goals.
