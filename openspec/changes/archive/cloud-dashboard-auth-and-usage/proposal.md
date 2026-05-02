## Why

The cloud dashboard at app.metabob.com currently lacks critical authentication endpoints and usage visibility features. Users cannot sign up or log in, making the dashboard unusable. Additionally, there's no way to track member activity, view execution traces, or monitor usage/costs - preventing organizations from understanding how MiniBob is being used and what value it's delivering.

## What Changes

- **Implement authentication endpoints** in user-vessel (`/v2/auth/signup`, `/v2/auth/login`)
- **Add Members management page** to dashboard for viewing and managing organization members
- **Add Usage Analytics page** showing token consumption, costs, and execution metrics over time
- **Add Activity Execution Trace viewer** for detailed visibility into MiniBob executions
- **Remove unused/incomplete pages** from dashboard (cleanup Settings if unused)
- **Create MiniBob activity templates** for future dashboard development work

## Capabilities

### New Capabilities
- `user-auth`: User signup and login endpoints with JWT token generation
- `member-management`: UI and API for managing organization members and roles
- `usage-analytics`: Dashboard pages and backend queries for usage tracking and cost visibility
- `execution-trace-viewer`: UI for viewing detailed activity execution traces with filtering
- `dashboard-dev-activities`: MiniBob activity templates for developing React/TypeScript dashboard features

### Modified Capabilities
<!-- No existing capabilities are being modified at the requirement level -->

## Impact

**Backend Services:**
- `repos/user-vessel/src/routes/auth.ts` - Add signup and login endpoints
- `repos/user-vessel/src/routes/users.ts` - May need member listing enhancements
- `repos/metabob-activity-api` - No changes needed, already has trace APIs

**Frontend:**
- `repos/metabob-cloud-dashboard/src/App.tsx` - Authentication flow already ready
- `repos/metabob-cloud-dashboard/src/pages/` - Add 3 new pages (Members, Usage, Traces)
- `repos/metabob-cloud-dashboard/src/lib/api/` - Add API client functions
- `repos/metabob-cloud-dashboard/src/components/Sidebar.tsx` - Add navigation items

**Activities:**
- `repos/metabob-proto/activities/development/` - Store new MiniBob activity templates

**Dependencies:**
- No new external dependencies
- Uses existing authentication infrastructure (identity-vessel, JWT utilities)
- Uses existing activity-api trace endpoints
