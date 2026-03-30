## Context

The metabob-cloud-dashboard currently proxies user management requests to a non-existent `metabob-analysis-api` service, causing 500 errors. The system architecture mandates that vessels own their domain data with RBAC enforcement via SurrealDB PERMISSIONS. The user-vessel will follow the established pattern demonstrated by concept-db: Bun/Hono HTTP server, MCP tool exposure, SurrealDB storage, internal-only deployment.

**Current State:**
- identity-vessel handles JWT auth and token generation
- activity-api stores learning traces and Thompson Sampling data
- concept-db manages knowledge graph with org/project scoping
- cloud-dashboard is a traditional React UI calling vessel APIs

**Constraints:**
- MUST use SurrealDB PERMISSIONS for RBAC (no application-level filtering)
- MUST NOT expose publicly (ClusterIP service only)
- MUST record all operations as traces for learning
- MUST follow multi-tenant isolation patterns ($auth.org_id filtering)
- MUST use identity-vessel JWT for authentication

## Goals / Non-Goals

**Goals:**
- Create aligned vessel following impulse/activity/resolver foundation
- Enable cloud-dashboard user management features (org/member/API key management)
- Provide MCP tools for vessel-to-vessel communication
- Enforce RBAC via SurrealDB PERMISSIONS without application-level checks
- Support seat quota distribution across API keys
- Record operations as execution traces

**Non-Goals:**
- Email sending (log to console for MVP, integrate email service later)
- OAuth/SSO integration (future work)
- Payment/billing integration (future work)
- Public API exposure (internal only)
- Code analysis features (separate concern)

## Decisions

### Decision 1: Follow concept-db vessel pattern exactly
**Rationale:** concept-db demonstrates the correct vessel architecture with ~1500 LOC. Reusing this pattern ensures consistency and reduces risk.

**Alternatives Considered:**
- Custom architecture: Rejected as reinventing the wheel
- Expand identity-vessel: Rejected as mixing IDENTITY and USER_MANAGEMENT domains
- Expand activity-api: Rejected as mixing LEARNING and BUSINESS domains

**Implementation:**
```
repos/user-vessel/
├── src/
│   ├── index.ts              (Bun.serve HTTP + MCP server)
│   ├── routes/               (HTTP endpoints for dashboard)
│   ├── tools/definitions.ts  (MCP tool schemas)
│   └── db/client.ts          (SurrealDB connection)
├── sql/schema/               (SurrealDB tables with PERMISSIONS)
└── package.json

helm/charts/user-vessel/
└── templates/                (Deployment, Service, ConfigMap)
```

### Decision 2: Dual interface (HTTP + MCP)
**Rationale:** Dashboard needs traditional REST API. Vessels need MCP tools. Both interfaces query same SurrealDB data.

**Alternatives Considered:**
- HTTP only: Rejected as vessels can't communicate
- MCP only: Rejected as dashboard needs synchronous HTTP
- GraphQL: Rejected as unnecessary complexity

**Implementation:**
- HTTP routes in `src/routes/*.ts` for dashboard integration
- MCP tools in `src/tools/definitions.ts` for vessel integration
- Shared SurrealDB queries via `db/client.ts`

### Decision 3: RBAC via SurrealDB PERMISSIONS exclusively
**Rationale:** Application-level RBAC leads to bypass vulnerabilities. SurrealDB PERMISSIONS enforce at DB layer, impossible to bypass.

**Alternatives Considered:**
- Application-level role checks: Rejected as security risk
- Middleware RBAC: Rejected as duplicating DB-level enforcement

**Implementation:**
```surql
DEFINE TABLE organizations SCHEMAFULL
  PERMISSIONS
    FOR select WHERE org_id = $auth.org_id
    FOR create, update WHERE org_id = $auth.org_id
    FOR delete WHERE $auth.role = 'admin' AND org_id = $auth.org_id;
```

All queries rely on `$auth` context populated from JWT. No `WHERE org_id = ...` in application code.

### Decision 4: Seat quota as connection slot pool
**Rationale:** Organizations have finite connection slots. Admins distribute slots to API keys. This models real resource limitation.

**Alternatives Considered:**
- Rate limiting (requests/sec): Rejected as doesn't limit concurrent resources
- Per-user limits: Rejected as users share org quota

**Implementation:**
- `organization.seat_limit` = total slots available
- `seat_allocations` table tracks distribution
- `api_keys.max_connections` = slots allocated to this key
- Connection attempt checks `current_connections < max_connections`

### Decision 5: Connection tracking in activity-api
**Rationale:** Connections are execution context, belong in learning domain. activity-api already tracks execution state.

**Alternatives Considered:**
- User-vessel stores connections: Rejected as mixing concerns (connections are execution state, not user data)
- Redis for connection state: Rejected as SurrealDB handles this fine with connection table

**Implementation:**
- user-vessel MCP tool `user_record_connection` calls activity-api `/v2/connections` endpoint
- activity-api creates `connection` record with heartbeat tracking
- activity-api cleans up stale connections (>30s no heartbeat)
- user-vessel queries connection count via activity-api when checking quota

### Decision 6: Internal-only deployment (ClusterIP)
**Rationale:** User management is internal concern. Only cloud-dashboard and vessels should access it.

**Alternatives Considered:**
- Public ingress with auth: Rejected as unnecessary attack surface
- Istio VirtualService: Rejected as service not needed outside cluster

**Implementation:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: user-vessel
spec:
  type: ClusterIP  # No external exposure
  ports:
    - name: http
      port: 8080
```

Dashboard backend proxies: `/api/v2/*` → `http://user-vessel.activity-system.svc.cluster.local:8080/v1/*`

### Decision 7: Dashboard page simplification
**Rationale:** Remove non-working pages (Projects, Issues, Events, Analysis, Value). Focus on working features: Settings, API Keys, Organization, Members.

**Alternatives Considered:**
- Fix all pages: Rejected as out of scope (requires analysis-api which isn't aligned)
- Stub all pages: Rejected as misleading users

**Implementation:**
- Remove pages: Projects, Issues, DevelopmentEvents, Analysis, ValueImpact
- Remove sidebar nav items for removed pages
- Keep pages: Settings, APIKeys, Organization (new), Members (new)
- Update Overview to show org summary instead of analysis metrics

## Risks / Trade-offs

**[Risk]** SurrealDB PERMISSIONS complexity may slow development
→ **Mitigation:** Use existing patterns from activity-api and concept-db. Test permissions with curl before writing UI.

**[Risk]** Connection tracking in activity-api creates cross-vessel dependency
→ **Mitigation:** Define clear MCP contract. activity-api already designed for this (connection table exists).

**[Risk]** Seat quota enforcement has race conditions (concurrent connections)
→ **Mitigation:** Use SurrealDB transactions. Check quota in single atomic query. Accept eventual consistency for connection cleanup.

**[Trade-off]** Dual interface (HTTP + MCP) means maintaining two API surfaces
→ **Accepted:** Necessary for dashboard integration (HTTP) and vessel communication (MCP). Shared data layer minimizes duplication.

**[Trade-off]** No email sending for invitations
→ **Accepted:** Log invitation tokens to console for MVP. Email integration is future work.

**[Risk]** Organization owner cannot be removed
→ **Mitigation:** Ownership transfer workflow required before owner can leave. Enforce in PERMISSIONS and application logic.

## Migration Plan

**Phase 1: Vessel Creation (Day 1)**
1. Create `repos/user-vessel` using concept-db as template
2. Implement SurrealDB schema with PERMISSIONS
3. Deploy to local cluster via Helm chart
4. Verify service accessible at `user-vessel.activity-system.svc.cluster.local:8080`

**Phase 2: HTTP API (Day 1-2)**
1. Implement routes: organizations, members, api-keys, seats
2. Test endpoints with curl from within cluster
3. Verify RBAC enforcement (attempt unauthorized operations)
4. Document API in OpenAPI spec

**Phase 3: MCP Tools (Day 2)**
1. Implement MCP tool definitions
2. Test with MCP client (standalone script)
3. Verify tools callable from MiniBob
4. Document tools in MCP registry

**Phase 4: Dashboard Integration (Day 2)**
1. Update dashboard backend proxy: `/api/v2/*` → user-vessel
2. Remove broken pages (Projects, Issues, etc.)
3. Create Organization page (org details + seat summary)
4. Create Members page (invite/list/remove with roles)
5. Verify API Keys page works with real backend
6. Test full user workflows end-to-end

**Phase 5: Connection Tracking Integration (Day 2)**
1. Implement connection recording in activity-api
2. User-vessel MCP tools call activity-api connection endpoints
3. Test MiniBob connection flow with quota enforcement
4. Verify connection cleanup on disconnect/timeout

**Rollback Strategy:**
- Vessel is additive (no breaking changes to existing services)
- If user-vessel fails: revert dashboard to show empty states
- If connection tracking fails: disable quota enforcement, allow all connections
- If RBAC fails: revert to previous schema version

**Verification Steps:**
1. Create test organization via SurrealDB
2. Create test user and assign to org
3. Login to dashboard as test user
4. Create API key via dashboard
5. Invite member via dashboard
6. Verify RBAC (attempt cross-org access, should fail)
7. Test MiniBob connection with API key
8. Verify connection quota enforcement

## Open Questions

**Q1:** Should we backfill existing users/orgs from identity-vessel to user-vessel?
→ **Proposed:** Yes, one-time migration script. Identity-vessel owns auth, user-vessel owns org membership. User record may exist in both.

**Q2:** How to handle organization creation on signup?
→ **Proposed:** identity-vessel creates user, user-vessel creates organization. Both happen in signup transaction. If either fails, rollback both.

**Q3:** Should connection heartbeat be automatic or manual?
→ **Proposed:** Automatic. MiniBob sends heartbeat every 10 seconds. Activity-api marks stale if >30 seconds. Graceful degradation if heartbeat fails (connection stays active until explicit disconnect).

**Q4:** What happens to API keys when user is removed from org?
→ **Proposed:** Soft delete API keys (status = 'revoked') when user removed. Preserve audit trail. Keys become unusable immediately.
