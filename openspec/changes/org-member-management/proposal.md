# Organization Member Management

## Why

The metabob-cloud-dashboard currently lacks organization member management capabilities. While the database has `users` and `organizations` tables with `org_id` relationships, there is no:
- Invitation system to add new members to organizations
- Role management beyond basic `admin`/`member` roles
- Member listing with appropriate visibility controls
- Workflow for removing members or transferring ownership
- Audit trail for membership changes

This blocks team collaboration features and prevents organizations from onboarding new users without direct database access. The seat-based billing model (`seat_limit`/`seat_usage` fields exist in organizations) cannot be enforced without proper member management.

## What Changes

- **Add `organization_members` table** - Explicit membership relation with roles (`owner`/`admin`/`member`/`viewer`) and invitation status
- **Add `organization_invitations` table** - Track pending invitations with expiration and tokens
- **Create member management API endpoints** in metabob-analysis-api for CRUD operations on members and invitations
- **Build Members page in metabob-cloud-dashboard** with invitation modal, role management, and member removal
- **Implement invitation email flow** (placeholder: log to console for MVP, integrate email service later)
- **Add ownership transfer workflow** with confirmation requirements

## Capabilities

### New Capabilities

- `org-member-listing`: List organization members with role, status, and join date
- `org-member-invitation`: Create/revoke invitations, accept/decline flow with secure tokens
- `org-role-management`: Change member roles (owner/admin/member/viewer) with permission checks
- `org-member-removal`: Remove members from organization (soft delete for audit)
- `org-ownership-transfer`: Transfer organization ownership to another admin

### Modified Capabilities

- `org-seat-management`: Update seat_usage when members join/leave (existing seat_limit field)
- `user-auth`: Users can now belong to organizations via invitation acceptance flow

## Impact

**Code Changes:**
- `repos/metabob-proto/surrealdb/core/`: Add 006-organization-members.surql schema
- `repos/metabob-analysis-api/src/routes/`: Add members.ts route file
- `repos/metabob-cloud-dashboard/src/pages/`: Add Members.tsx page
- `repos/metabob-cloud-dashboard/src/lib/api/`: Add members.ts API client
- `repos/metabob-cloud-dashboard/src/types/api.ts`: Add member types

**API Changes:**
- `GET /v2/organizations/current/members` - List members in current org
- `POST /v2/organizations/current/members/invite` - Create invitation
- `DELETE /v2/organizations/current/members/:id` - Remove member
- `PATCH /v2/organizations/current/members/:id/role` - Update member role
- `POST /v2/invitations/:token/accept` - Accept invitation (unauthenticated)
- `POST /v2/invitations/:token/decline` - Decline invitation (unauthenticated)
- `POST /v2/organizations/current/transfer-ownership` - Transfer to admin

**Deployment:**
- Schema migration adds organization_members and organization_invitations tables
- No breaking changes (additive schema, new endpoints)

**Dependencies:**
- Email service integration (deferred to future milestone - console logging for MVP)
- No new package dependencies required

## Field Sourcing

### organization_members table
| Field | Source | Notes |
|-------|--------|-------|
| id | SurrealDB auto-generated | Record ID |
| org_id | From $auth.org_id on create | Organization reference |
| user_id | Provided on accept invitation | User reference |
| role | Provided on create/update | owner/admin/member/viewer |
| invited_by | From $auth.user_id on create | Who sent invitation |
| invited_email | Provided on create | Email before user exists |
| joined_at | Set on accept | When invitation accepted |
| status | Computed | active/pending/removed |
| created_at | time::now() | Membership record creation |
| removed_at | Set on removal | Soft delete timestamp |
| removed_by | From $auth.user_id on remove | Who removed member |

### organization_invitations table
| Field | Source | Notes |
|-------|--------|-------|
| id | SurrealDB auto-generated | Record ID |
| org_id | From $auth.org_id | Organization reference |
| email | Provided on create | Invitee email |
| role | Provided on create | Role to assign on accept |
| token | crypto::uuid() | Secure invitation token |
| invited_by | From $auth.user_id | User who created invite |
| expires_at | time::now() + 7d | 7-day expiration |
| status | pending/accepted/declined/expired | Invitation status |
| created_at | time::now() | Invitation creation |
| accepted_at | Set on accept | When accepted |
