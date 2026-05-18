## 1. Repository Setup

- [ ] 1.1 Create repos/user-vessel directory structure (src/, sql/, package.json)
- [ ] 1.2 Copy package.json from concept-db and update name/description
- [ ] 1.3 Create tsconfig.json with Bun configuration
- [ ] 1.4 Create .gitignore (node_modules, dist, .env)
- [ ] 1.5 Install dependencies: bun install

## 2. SurrealDB Schema

- [ ] 2.1 Create sql/schema/001-organizations.surql with PERMISSIONS
- [ ] 2.2 Create sql/schema/002-organization-members.surql with RBAC enforcement
- [ ] 2.3 Create sql/schema/003-organization-invitations.surql with token and expiration
- [ ] 2.4 Create sql/schema/004-api-keys.surql with tier-based limits
- [ ] 2.5 Create sql/schema/005-seat-allocations.surql for quota distribution
- [ ] 2.6 Add indices on org_id, user_id, api_key_id for performance
- [ ] 2.7 Test schema locally via kubectl exec into SurrealDB pod

## 3. Database Client

- [ ] 3.1 Create src/db/client.ts with SurrealDB connection setup
- [ ] 3.2 Implement queryWithAuth() helper that populates $auth from JWT
- [ ] 3.3 Add JWT validation using identity-vessel public key
- [ ] 3.4 Create health check query function
- [ ] 3.5 Test connection to SurrealDB from vessel code

## 4. HTTP Routes - Organizations

- [ ] 4.1 Create src/routes/organizations.ts with Hono router
- [ ] 4.2 Implement GET /v1/organizations (list user's orgs)
- [ ] 4.3 Implement GET /v1/organizations/current (get current org details)
- [ ] 4.4 Implement GET /v1/organizations/:id (get org by ID with RBAC)
- [ ] 4.5 Implement PATCH /v1/organizations/:id (update org settings, admin only)
- [ ] 4.6 Add error handling for RBAC violations (403 Forbidden)
- [ ] 4.7 Test all organization endpoints with curl

## 5. HTTP Routes - Members

- [ ] 5.1 Create src/routes/members.ts with Hono router
- [ ] 5.2 Implement GET /v1/organizations/:id/members (list members with RBAC)
- [ ] 5.3 Implement POST /v1/organizations/:id/members/invite (create invitation, admin only)
- [ ] 5.4 Implement POST /v1/invitations/:token/accept (accept invitation)
- [ ] 5.5 Implement POST /v1/invitations/:token/decline (decline invitation)
- [ ] 5.6 Implement DELETE /v1/organizations/:id/members/:userId (remove member, soft delete)
- [ ] 5.7 Implement PATCH /v1/organizations/:id/members/:userId/role (update role, admin only)
- [ ] 5.8 Add seat_usage increment on accept, decrement on remove
- [ ] 5.9 Test member management endpoints with curl

## 6. HTTP Routes - API Keys

- [ ] 6.1 Create src/routes/api-keys.ts with Hono router
- [ ] 6.2 Implement GET /v1/api-keys (list user's keys, mask secrets)
- [ ] 6.3 Implement GET /v1/api-keys?org_scope=true (admin view all org keys)
- [ ] 6.4 Implement POST /v1/api-keys (create key with tier-based defaults)
- [ ] 6.5 Implement DELETE /v1/api-keys/:id (revoke key, close connections)
- [ ] 6.6 Implement PATCH /v1/api-keys/:id (update limits, admin only)
- [ ] 6.7 Generate secure API key with crypto.randomBytes and hash with argon2
- [ ] 6.8 Return plaintext secret only on creation (never stored)
- [ ] 6.9 Test API key endpoints with curl

## 7. HTTP Routes - Seat Allocation

- [ ] 7.1 Create src/routes/seats.ts with Hono router
- [ ] 7.2 Implement GET /v1/organizations/:id/seats (summary with allocations)
- [ ] 7.3 Implement POST /v1/organizations/:id/seats/allocate (allocate slots to API key)
- [ ] 7.4 Implement DELETE /v1/organizations/:id/seats/:apiKeyId (deallocate slots)
- [ ] 7.5 Implement GET /v1/organizations/:id/seats/history (audit trail)
- [ ] 7.6 Add validation to prevent over-allocation (total slots <= seat_limit)
- [ ] 7.7 Test seat allocation endpoints with curl

## 8. MCP Tools Definitions

- [ ] 8.1 Create src/tools/definitions.ts with MCP tool schemas
- [ ] 8.2 Define user_get_context tool (returns user/org context from JWT)
- [ ] 8.3 Define user_check_quota tool (check connection allowance)
- [ ] 8.4 Define user_record_connection tool (record active connection)
- [ ] 8.5 Define user_update_heartbeat tool (update connection heartbeat)
- [ ] 8.6 Define user_close_connection tool (close connection, decrement count)
- [ ] 8.7 Define user_get_members tool (list org members)
- [ ] 8.8 Define user_create_api_key tool (programmatic key creation)
- [ ] 8.9 Add JSON schemas for all tool inputs and outputs

## 9. MCP Tools Implementation

- [ ] 9.1 Create src/tools/handlers.ts with tool handler functions
- [ ] 9.2 Implement user_get_context handler (decode JWT, query org)
- [ ] 9.3 Implement user_check_quota handler (query API key, check limits)
- [ ] 9.4 Implement user_record_connection handler (call activity-api /v2/connections)
- [ ] 9.5 Implement user_update_heartbeat handler (call activity-api)
- [ ] 9.6 Implement user_close_connection handler (call activity-api)
- [ ] 9.7 Implement user_get_members handler (query with RBAC)
- [ ] 9.8 Implement user_create_api_key handler (same as HTTP endpoint)
- [ ] 9.9 Add execution trace recording for all MCP operations

## 10. HTTP Server

- [ ] 10.1 Create src/index.ts with Bun.serve setup
- [ ] 10.2 Mount organization routes at /v1/organizations
- [ ] 10.3 Mount member routes at /v1/organizations/:id/members and /v1/invitations
- [ ] 10.4 Mount API key routes at /v1/api-keys
- [ ] 10.5 Mount seat allocation routes at /v1/organizations/:id/seats
- [ ] 10.6 Add /health endpoint returning service status
- [ ] 10.7 Add JWT authentication middleware (validates with identity-vessel)
- [ ] 10.8 Add error handling middleware (catch RBAC errors, return proper status codes)
- [ ] 10.9 Add request logging middleware
- [ ] 10.10 Test server starts and responds to health check

## 11. MCP Server

- [ ] 11.1 Add MCP server to src/index.ts alongside HTTP server
- [ ] 11.2 Register all MCP tools from definitions
- [ ] 11.3 Add MCP tool request handler calling tool handlers
- [ ] 11.4 Add MCP listTools endpoint for discovery
- [ ] 11.5 Test MCP server with standalone client script

## 12. Activity API Connection Integration

- [ ] 12.1 Create src/clients/activity-api.ts with HTTP client
- [ ] 12.2 Implement POST /v2/connections endpoint call
- [ ] 12.3 Implement PATCH /v2/connections/:id/heartbeat endpoint call
- [ ] 12.4 Implement DELETE /v2/connections/:id endpoint call
- [ ] 12.5 Implement GET /v2/connections/count?api_key_id=X endpoint call
- [ ] 12.6 Add retry logic for activity-api calls (3 attempts, exponential backoff)
- [ ] 12.7 Test connection tracking with activity-api

## 13. Helm Chart

- [ ] 13.1 Create helm/charts/user-vessel/Chart.yaml
- [ ] 13.2 Create helm/charts/user-vessel/values.yaml with config defaults
- [ ] 13.3 Create helm/charts/user-vessel/templates/deployment.yaml
- [ ] 13.4 Create helm/charts/user-vessel/templates/service.yaml (ClusterIP only)
- [ ] 13.5 Create helm/charts/user-vessel/templates/configmap.yaml for SurrealDB connection
- [ ] 13.6 Add init container for schema migration (apply .surql files)
- [ ] 13.7 Update helm/helmfile.yaml to include user-vessel release
- [ ] 13.8 Deploy to local cluster: helmfile -e local sync
- [ ] 13.9 Verify pod is running: kubectl get pods -n activity-system

## 14. Dashboard Backend Integration

- [ ] 14.1 Update repos/metabob-cloud-dashboard/src/index.ts proxy configuration
- [ ] 14.2 Change /api/v2/* proxy target from analysis-api to user-vessel
- [ ] 14.3 Update ANALYSIS_API_URL env var to point to user-vessel
- [ ] 14.4 Test API Keys page loads and calls user-vessel successfully
- [ ] 14.5 Test Settings page password change still works (uses identity-vessel)

## 15. Dashboard Page Cleanup

- [ ] 15.1 Remove src/pages/Projects.tsx
- [ ] 15.2 Remove src/pages/Issues.tsx
- [ ] 15.3 Remove src/pages/DevelopmentEvents.tsx
- [ ] 15.4 Remove src/pages/Analysis.tsx
- [ ] 15.5 Remove src/pages/ValueImpact.tsx
- [ ] 15.6 Update src/components/Sidebar.tsx to remove nav items for deleted pages
- [ ] 15.7 Update src/App.tsx to remove routes for deleted pages
- [ ] 15.8 Test dashboard navigation (only Settings, API Keys, Overview should remain)

## 16. Organization Page

- [ ] 16.1 Create src/pages/Organization.tsx component
- [ ] 16.2 Add organization details card (name, tier, created date)
- [ ] 16.3 Add seat usage card (used/limit with progress bar)
- [ ] 16.4 Add organization settings form (name update, admin only)
- [ ] 16.5 Add upgrade prompt when near seat limit
- [ ] 16.6 Add route to App.tsx for Organization page
- [ ] 16.7 Add sidebar nav item for Organization
- [ ] 16.8 Test Organization page displays correctly

## 17. Members Page

- [ ] 17.1 Create src/pages/Members.tsx component
- [ ] 17.2 Add members table (email, role, status, joined date)
- [ ] 17.3 Add invite member modal (email input, role selector)
- [ ] 17.4 Add role change dropdown (admin only)
- [ ] 17.5 Add remove member button with confirmation (admin only)
- [ ] 17.6 Add pending invitations list (with revoke option)
- [ ] 17.7 Add route to App.tsx for Members page
- [ ] 17.8 Add sidebar nav item for Members
- [ ] 17.9 Test member invite/remove/role change workflows

## 18. API Client Updates

- [ ] 18.1 Create src/lib/api/organizations.ts with org endpoints
- [ ] 18.2 Create src/lib/api/members.ts with member endpoints
- [ ] 18.3 Update src/lib/api/api-keys.ts to use new user-vessel endpoints
- [ ] 18.4 Create src/lib/api/seats.ts with seat allocation endpoints
- [ ] 18.5 Update src/types/api.ts with new types (Organization, Member, Invitation, Seat)

## 19. Integration Testing

- [ ] 19.1 Create test organization via SurrealDB
- [ ] 19.2 Create test users and assign to organization
- [ ] 19.3 Login to dashboard as test user
- [ ] 19.4 Create API key via dashboard, verify in database
- [ ] 19.5 Invite member via dashboard, verify invitation record
- [ ] 19.6 Accept invitation (simulate with direct API call)
- [ ] 19.7 Verify seat_usage incremented correctly
- [ ] 19.8 Remove member, verify seat_usage decremented
- [ ] 19.9 Test RBAC: attempt cross-org access (should 403)
- [ ] 19.10 Test RBAC: non-admin attempts admin action (should 403)

## 20. MiniBob Connection Testing

- [ ] 20.1 Test MiniBob connection with valid API key
- [ ] 20.2 Verify connection recorded in activity-api
- [ ] 20.3 Verify current_connections incremented
- [ ] 20.4 Test connection at max_connections limit (should 429)
- [ ] 20.5 Test graceful disconnect (current_connections decremented)
- [ ] 20.6 Test heartbeat timeout (connection cleaned up after 30s)
- [ ] 20.7 Test connection with revoked API key (should 401)

## 21. Documentation

- [ ] 21.1 Create repos/user-vessel/README.md with service overview
- [ ] 21.2 Document HTTP API endpoints in OpenAPI spec
- [ ] 21.3 Document MCP tools in MCP registry format
- [ ] 21.4 Update CLAUDE.md with user-vessel deployment instructions
- [ ] 21.5 Add user-vessel to architecture diagrams
- [ ] 21.6 Document RBAC patterns and PERMISSIONS examples

## 22. Deployment Verification

- [ ] 22.1 Verify user-vessel pod running: kubectl get pods -n activity-system
- [ ] 22.2 Verify service accessible internally: kubectl exec test curl user-vessel:8080/health
- [ ] 22.3 Verify schema applied: kubectl logs user-vessel init-container
- [ ] 22.4 Verify no public ingress: kubectl get ingress -n activity-system
- [ ] 22.5 Test dashboard API calls reach user-vessel (check logs)
- [ ] 22.6 Run smoke tests: all critical user workflows pass
