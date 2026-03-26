# End-to-End Validation Plan: CLI → Dashboard

## Objective
Validate complete data flow with actual dashboard UI:
1. CLI sends data via API key authentication
2. RPC API writes to SurrealDB (with org_id from API key)
3. Dashboard queries RPC API (with JWT token, org_id filtering)
4. UI displays CLI-generated data in all panels

## Test Flow

### Phase 1: Setup (API Key Authentication)
- Use existing user: demo2@metabob.com
- Create API key for CLI usage
- API key maps to org_id for data isolation

### Phase 2: CLI Data Generation (via API Key)
- POST /api/activity-execution (with API key header)
- POST /api/activity-template (with API key header)
- POST /api/optimization (with API key header)

### Phase 3: Dashboard Login (JWT Authentication)
- Login via UI: demo2@metabob.com
- Browser receives JWT token with org_id claim
- Navigate to dashboard panels

### Phase 4: UI Validation
Check each panel displays CLI-generated data:
- Activity History panel
- Template Usage panel
- Optimization Metrics panel
- Success Rates panel
- Token Usage panel

### Phase 5: Data Isolation Test
- Create second user/org
- Generate data for org 2
- Verify org 1 dashboard doesn't show org 2 data

## Success Criteria
✅ All dashboard panels show data from CLI commands
✅ No data visible until CLI generates it
✅ Multi-tenancy enforced (org isolation)
✅ No direct database writes from CLI
