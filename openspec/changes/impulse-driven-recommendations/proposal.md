# Proposal: Impulse-Driven Activity Recommendations

## Problem Statement

MiniBob currently treats `activity-api` as a special service, bypassing the impulse/vessel paradigm with direct MCP method calls. This violates the core architectural principle: **"We should not treat the activity-api any differently than any other vessel."**

**Current violations:**
1. Direct `mcp.recommendActivities()` calls instead of impulse resolution
2. No 'goal' impulse type that triggers activity recommendations automatically
3. activity-api not registered in vessel discovery
4. Breaks the principle: "resolvers live where data lives"

## Proposed Solution

Implement proper impulse-driven architecture where:
1. **Goal impulses** are created when user provides goals
2. **Impulse resolver** automatically detects goal-shaped impulses
3. **Vessel discovery** routes to activity-api (or any vessel that can resolve goals)
4. **Activity-api** resolves goal impulses by returning activity recommendations
5. **MiniBob** selects and executes recommended activities

This aligns with the foundational principle from `IMPULSE_ACTIVITY_FOUNDATION.md`:
- Impulses are universal data with metadata
- Resolvers live where data lives (activity-api has template/trace data)
- Don't treat any vessel specially

## Additional Fixes

While implementing, we'll also fix:
- **Schema inconsistency**: Mixed `TYPE record<organizations>` vs `TYPE string` for org_id
- **SurrealDB 3.0.5+ compliance**: Ensure all schemas follow latest patterns
- **Vessel discovery**: Register activity-api as a vessel with capabilities

## Success Criteria

- [ ] MiniBob has zero direct calls to `mcp.recommendActivities()`
- [ ] Goal impulses automatically trigger activity recommendations via impulse resolver
- [ ] activity-api responds to `POST /v2/impulses/resolve` for type='goal'
- [ ] Vessel discovery can route goal impulses to any capable vessel
- [ ] Schema uses consistent org_id typing across all tables
- [ ] All schemas follow SurrealDB 3.0.5+ patterns
- [ ] Zero regression in existing goal-driven execution

## Scope

**In Scope:**
- Add 'goal' pointer type resolver to activity-api
- Update MiniBob goal-processor to use impulse resolution
- Register activity-api in vessel discovery
- Fix org_id schema inconsistencies
- Audit SurrealDB 3.0.5+ compliance

**Out of Scope:**
- Changing Thompson Sampling algorithm
- Modifying activity template structure
- Changing MiniBob's activity executor
- Performance optimization (separate effort)

## Timeline

Estimated: 4-6 hours of implementation + testing

## Dependencies

- Existing impulse resolution system in MiniBob (repos/minibob/src/impulse.ts)
- Existing vessel discovery system (repos/minibob/src/vessel-discovery.ts)
- Activity recommendation endpoint (repos/metabob-activity-api/src/routes/activities.ts)
- SurrealDB 3.0.5+ running in deployment

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing goal processing | Keep MCP method as fallback during transition |
| Vessel discovery not available | Fall back to direct MCP call with warning |
| Schema migration failures | Use IF NOT EXISTS, test on fresh database |
| Regression in Thompson Sampling | Extensive testing with existing traces |
