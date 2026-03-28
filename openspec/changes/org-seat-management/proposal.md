# Organization Seat Management - OpenSpec Proposal

**Status:** Draft
**Created:** 2026-03-25
**Author:** System (via Claude Code)
**Type:** Full-Stack Feature
**Repos:** `repos/metabob-cloud-dashboard`, `repos/metabob-analysis-api`, `repos/metabob-proto`

---

## Problem Statement

Organizations using Metabob need visibility and control over their subscription seat usage:

1. **No Seat Visibility**: Users cannot see how many seats they have vs. how many are used
2. **No Seat Management**: Admins cannot allocate/deallocate seats to specific members
3. **No Billing Hooks**: No infrastructure for future Stripe integration for seat changes
4. **Implicit Enforcement**: Seat limits exist in schema but aren't enforced or displayed

The current schema already has `seat_limit` and `seat_usage` fields on `organizations` and `seat_limit` on `subscriptions`, but:
- No UI to display this information
- No API endpoints to manage seat allocation
- No tracking of which user occupies which seat
- No enforcement when inviting new members

## Proposed Solution

Build a complete seat management feature across all layers:

**Scope:** ~1,500-2,000 LOC total
**Components:**
- Database schema enhancements (seat_allocations table, triggers)
- API endpoints (analysis-api)
- Dashboard UI (cloud-dashboard)

### Key Features

**1. Seat Usage Display**
- Visual indicator showing used/available seats (e.g., "4/10 seats used")
- Progress bar with warning at 80%, error at 100%
- Breakdown by member

**2. Seat Allocation Management**
- View which members occupy seats
- Deallocate seats from inactive members
- See seat allocation history

**3. Subscription Tier Awareness**
- Display current plan's seat limit
- Show upgrade path when at limit
- Different tiers: free (1), starter (3), pro (10), enterprise (unlimited)

**4. Invite Flow Integration**
- Check seat availability before inviting
- Block invites when at capacity
- Show upgrade prompt when needed

**5. Billing Integration Hooks**
- Event emission for seat changes
- Webhook payloads for Stripe integration
- Audit trail for billing reconciliation

### Subscription Tiers

| Tier | Seat Limit | Price | Notes |
|------|-----------|-------|-------|
| Free | 1 | $0 | Personal use |
| Starter | 3 | $29/mo | Small teams |
| Pro | 10 | $99/mo | Growing teams |
| Enterprise | Unlimited | Custom | Large organizations |

## Data Model

### New Table: `seat_allocations`

```sql
DEFINE TABLE seat_allocations SCHEMAFULL
  PERMISSIONS
    FOR select WHERE org_id = $auth.org_id
    FOR create, delete WHERE $auth.role = 'admin' AND org_id = $auth.org_id
    FOR update NONE;

DEFINE FIELD org_id ON seat_allocations TYPE record<organizations>;
DEFINE FIELD user_id ON seat_allocations TYPE record<users>;
DEFINE FIELD allocated_at ON seat_allocations TYPE datetime;
DEFINE FIELD allocated_by ON seat_allocations TYPE option<record<users>>;

DEFINE INDEX idx_seat_org ON seat_allocations FIELDS org_id;
DEFINE INDEX idx_seat_user ON seat_allocations FIELDS user_id UNIQUE;
DEFINE INDEX idx_seat_org_user ON seat_allocations FIELDS org_id, user_id;
```

### Schema Modifications

**organizations table:**
- `seat_limit` - already exists (from subscription sync)
- `seat_usage` - already exists (computed from seat_allocations count)

**subscriptions table:**
- `seat_limit` - already exists (from plan)
- Add event-based sync to organizations.seat_limit

## API Endpoints

### Seat Info

```
GET /v2/orgs/:orgId/seats
Response: {
  seat_limit: number,
  seat_usage: number,
  plan: string,
  allocations: [
    { user_id, user_email, user_name, allocated_at, allocated_by }
  ],
  can_add_members: boolean,
  upgrade_available: boolean
}
```

### Allocate Seat

```
POST /v2/orgs/:orgId/seats/allocate
Body: { user_id: string }
Response: {
  allocation: SeatAllocation,
  seat_usage: number
}
```

### Deallocate Seat

```
DELETE /v2/orgs/:orgId/seats/:userId
Response: {
  seat_usage: number
}
```

### Check Availability

```
GET /v2/orgs/:orgId/seats/available
Response: {
  available: boolean,
  remaining: number,
  upgrade_path: string | null
}
```

## Dashboard UI

### Components

**1. SeatUsageCard** - Overview widget showing seat usage
**2. SeatManagementPage** - Full seat management interface
**3. MemberSeatRow** - Table row for each allocated seat
**4. SeatUpgradePrompt** - CTA when at capacity

### Page Structure

```
/settings/seats
├── SeatUsageCard (summary at top)
├── MemberTable (list of allocated seats)
│   └── MemberSeatRow (per member)
├── InviteButton (disabled if at capacity)
└── UpgradeSection (if at >80% usage)
```

## Dependencies

**Blocked By:**
- None (builds on existing infrastructure)

**Required By:**
- User invitation flow (should check seats)
- Billing integration (future)

**External Dependencies:**
- None (Stripe integration is future work)

## Success Criteria

1. **Visibility:** Dashboard displays accurate seat usage
2. **Control:** Admins can allocate/deallocate seats
3. **Enforcement:** System prevents exceeding seat limits
4. **Audit:** All seat changes are logged
5. **Performance:** Seat queries < 50ms

## Non-Goals

- Stripe integration (future phase)
- Self-service tier upgrades (future phase)
- Seat reservation system
- Temporary seat allocation
- Per-project seat allocation

## Risks

1. **Migration Complexity:** Existing users need seat allocations backfilled
2. **Enforcement Edge Cases:** What happens to existing users over limit?
3. **Performance:** Seat count updates on every member change

### Mitigations

1. Migration script that allocates seats to all existing active users
2. Soft enforcement: warn but don't block for existing organizations
3. Use SurrealDB computed fields or periodic sync instead of triggers

## Timeline

**Estimated:** 3-4 days

- Day 1: Schema + API foundation
- Day 2: API endpoints + business logic
- Day 3: Dashboard UI
- Day 4: Testing + edge cases

## References

- Existing schemas: `repos/metabob-proto/surrealdb/core/002-organizations.surql`
- Existing schemas: `repos/metabob-proto/surrealdb/core/004-subscriptions.surql`
- Analysis API routes: `repos/metabob-analysis-api/src/routes/`
- Dashboard pages: `repos/metabob-cloud-dashboard/src/pages/`
- Tasks: [tasks.md](./tasks.md)
- Design: [design.md](./design.md)
