# Organization Member Management - Design

## Context

**Current State:**
- `users` table has `org_id` field linking users to organizations
- `organizations` table has `seat_limit` and `seat_usage` fields for billing
- Users are created directly in signup flow (creates org or joins existing via org_id)
- No formal invitation process or role hierarchy beyond admin/member
- Dashboard has APIKeys and Projects pages as CRUD patterns to follow

**Constraints:**
- Must use SurrealDB 3.0 PERMISSIONS for database-enforced access control
- Must follow existing Hono route patterns in metabob-analysis-api
- Must match shadcn/ui component patterns in metabob-cloud-dashboard
- Invitation tokens must be secure and single-use
- Email integration deferred (MVP uses console logging)

**Stakeholders:**
- Organization owners: Need to manage their team, transfer ownership
- Organization admins: Need to invite/remove members, change roles
- Organization members: Need to view team, leave organization
- Invited users: Need to accept/decline invitations without existing account

## Goals / Non-Goals

**Goals:**
- Database-enforced member access control via PERMISSIONS clauses
- Complete invitation lifecycle (create -> send -> accept/decline -> expire)
- Role hierarchy with clear permission boundaries (owner > admin > member > viewer)
- Audit trail for all membership changes (joins, removals, role changes)
- Seat limit enforcement on invitation creation
- Single page dashboard UI for all member operations

**Non-Goals:**
- Email delivery (MVP logs to console, production integrates SendGrid/Resend later)
- Bulk member operations (import CSV, mass role changes)
- Organization hierarchy (parent/child orgs)
- SSO/SAML integration (separate feature)
- Fine-grained per-resource permissions (using role-based for MVP)

## Decisions

### Decision 1: Separate Invitations Table (Not Embedded in Members)

**Choice:** Create distinct `organization_invitations` table rather than using `organization_members` with `status='pending'`

**Alternatives Considered:**
- Single table with status field: Simpler schema but mixes user references (null for pending)
- Embedded in users table: Requires creating user records before acceptance

**Rationale:**
- Invitations may never result in members (declined, expired)
- Invitation tokens need different security model (public access for accept/decline)
- Separates concerns: invitations are ephemeral, members are persistent
- Easier to query pending invitations vs active members separately

**Trade-offs:**
- Two tables to maintain instead of one
- Need to coordinate seat_usage updates across tables

### Decision 2: Role Hierarchy with Owner Separation

**Choice:** Four roles - `owner` (1 per org), `admin` (unlimited), `member`, `viewer`

**Role Permissions:**
```
owner:  Can transfer ownership, delete org, all admin permissions
admin:  Can invite/remove members, change roles (except owner), manage all resources
member: Can create/edit resources, view all org data
viewer: Read-only access to all org data
```

**Alternatives Considered:**
- Two roles (admin/member): Current state, insufficient for enterprise
- Flexible permissions: Complex, requires permission matrix
- Team-based roles: Over-engineering for current scale

**Rationale:**
- `owner` ensures exactly one person can delete org or transfer ownership
- `admin` allows multiple managers without full control
- `member` is the default working role
- `viewer` enables stakeholder access without modification risk

**Implementation:**
```sql
-- Enforce single owner per org
DEFINE INDEX idx_org_owner ON organization_members FIELDS org_id, role
  WHERE role = 'owner' UNIQUE;
```

### Decision 3: Secure Token-Based Invitation Flow

**Choice:** Cryptographically secure tokens with 7-day expiration

**Flow:**
```
1. Admin creates invitation -> token generated (UUID v4)
2. Email sent with link: /invite/{token}
3. User clicks link -> sees invitation details (no auth required)
4. User accepts -> if logged in, adds to org; if not, redirects to signup
5. After signup/login -> token is consumed, member created
```

**Alternatives Considered:**
- Email code (6-digit): Requires email delivery confirmation
- Direct org join with password: Security risk, no audit trail
- Admin approval after signup: Complicated flow, poor UX

**Rationale:**
- Token acts as proof of invitation
- No account required to view invitation (reduces friction)
- Single-use prevents token sharing abuse
- 7-day expiration balances convenience and security

**Security measures:**
- Token stored as SHA-256 hash in database
- Original token only exposed in email/link
- Accept endpoint validates token hash match
- Consumed tokens cannot be reused

### Decision 4: Soft Delete for Member Removal

**Choice:** Set `status='removed'` and `removed_at` timestamp instead of DELETE

**Alternatives Considered:**
- Hard delete: Loses audit trail
- Move to archive table: Extra complexity
- Tombstone record: Similar to soft delete with more fields

**Rationale:**
- Audit trail preserved (who removed whom and when)
- User account remains intact (can be re-invited)
- Billing history accurate (seat usage timeline)
- Easy to implement re-invitation (check existing removed record)

**Implementation:**
```sql
-- Members query always filters by status
SELECT * FROM organization_members
WHERE org_id = $auth.org_id AND status != 'removed'
```

### Decision 5: Ownership Transfer Requires Current Owner Action

**Choice:** Only current owner can transfer ownership, two-step confirmation

**Flow:**
```
1. Owner initiates transfer -> selects admin recipient
2. System validates recipient is admin in same org
3. Owner confirms (re-enters password or clicks confirm)
4. Transaction: old owner -> admin, new owner -> owner
```

**Alternatives Considered:**
- Allow admins to claim ownership: Security risk
- Require recipient acceptance: Complicated flow
- Time-delayed transfer: Over-engineering

**Rationale:**
- Ownership transfer is critical action, should be intentional
- Two-step prevents accidental transfers
- Atomic transaction prevents orphaned orgs
- New owner must already be admin (not external)

**Edge cases:**
- Owner leaving org: Must transfer first, cannot leave as owner
- Owner deleting account: Must transfer first
- Single-member org: Owner can delete org

## Data Flow

### Invitation Creation Flow
```
Dashboard              Analysis API           SurrealDB
   |                        |                     |
   |-- POST /invite ------->|                     |
   |   {email, role}        |                     |
   |                        |-- Check seat_usage -|
   |                        |<- seats available --|
   |                        |                     |
   |                        |-- INSERT invitation-|
   |                        |<- invitation created|
   |                        |                     |
   |                        |-- Log email to ------>| (MVP)
   |                        |   console            |
   |<-- 201 {invitation} ---|                     |
```

### Invitation Acceptance Flow
```
Browser                 Analysis API           SurrealDB
   |                        |                     |
   |-- GET /invite/:token ->|                     |
   |                        |-- SELECT invitation-|
   |                        |<- invitation data --|
   |<-- Invitation page ----|                     |
   |                        |                     |
   |-- POST /accept ------->|                     |
   |   (with JWT if logged) |                     |
   |                        |-- Validate token ---|
   |                        |<- valid, not expired|
   |                        |                     |
   |                        |-- BEGIN TRANSACTION-|
   |                        |   CREATE member     |
   |                        |   UPDATE invitation |
   |                        |   UPDATE org seats  |
   |                        |<- COMMIT -----------|
   |                        |                     |
   |<-- 200 {member} -------|                     |
```

### Member Removal Flow
```
Dashboard              Analysis API           SurrealDB
   |                        |                     |
   |-- DELETE /members/:id->|                     |
   |                        |-- Check auth role --|
   |                        |<- admin/owner ------|
   |                        |                     |
   |                        |-- Check target not -|
   |                        |   owner             |
   |                        |                     |
   |                        |-- UPDATE member ----|
   |                        |   status='removed'  |
   |                        |   removed_at=now    |
   |                        |   removed_by=$auth  |
   |                        |<- updated ---------|
   |                        |                     |
   |                        |-- UPDATE org -------|
   |                        |   seat_usage -= 1   |
   |                        |<- updated ----------|
   |                        |                     |
   |<-- 200 {success} ------|                     |
```

## Interfaces

### TypeScript Types (Dashboard)

```typescript
// repos/metabob-cloud-dashboard/src/types/api.ts

export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer';
export type MemberStatus = 'active' | 'pending' | 'removed';
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export interface OrganizationMember {
  id: string;
  org_id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  role: MemberRole;
  status: MemberStatus;
  invited_by: string;
  invited_by_name?: string;
  joined_at?: string;
  created_at: string;
}

export interface OrganizationInvitation {
  id: string;
  org_id: string;
  org_name: string;
  email: string;
  role: MemberRole;
  invited_by: string;
  invited_by_name: string;
  status: InvitationStatus;
  expires_at: string;
  created_at: string;
}

export interface InviteMemberRequest {
  email: string;
  role: MemberRole;
}

export interface UpdateMemberRoleRequest {
  role: MemberRole;
}

export interface TransferOwnershipRequest {
  new_owner_id: string;
  confirmation: string; // Password or "TRANSFER"
}

export interface InvitationDetails {
  org_name: string;
  role: MemberRole;
  invited_by_name: string;
  expires_at: string;
  is_expired: boolean;
}
```

### API Route Schemas (Zod)

```typescript
// repos/metabob-analysis-api/src/routes/members.ts

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']), // Cannot invite as owner
});

const updateRoleSchema = z.object({
  role: z.enum(['admin', 'member', 'viewer']), // Cannot promote to owner via this endpoint
});

const transferOwnershipSchema = z.object({
  new_owner_id: z.string().min(1),
  confirmation: z.string().min(1),
});
```

### SurrealDB Schema

```sql
-- repos/metabob-proto/surrealdb/core/006-organization-members.surql

DEFINE TABLE IF NOT EXISTS organization_members SCHEMAFULL
  PERMISSIONS
    FOR select WHERE org_id = $auth.org_id AND status != 'removed'
    FOR create WHERE $auth.role IN ['owner', 'admin'] AND org_id = $auth.org_id
    FOR update WHERE $auth.role IN ['owner', 'admin'] AND org_id = $auth.org_id
    FOR delete NONE; -- Use soft delete

DEFINE FIELD IF NOT EXISTS org_id ON organization_members TYPE record<organizations>
  ASSERT $value != NONE;
DEFINE FIELD IF NOT EXISTS user_id ON organization_members TYPE record<users>
  ASSERT $value != NONE;
DEFINE FIELD IF NOT EXISTS role ON organization_members TYPE string
  ASSERT $value IN ['owner', 'admin', 'member', 'viewer'];
DEFINE FIELD IF NOT EXISTS status ON organization_members TYPE string
  ASSERT $value IN ['active', 'removed']
  DEFAULT 'active';
DEFINE FIELD IF NOT EXISTS invited_by ON organization_members TYPE record<users>;
DEFINE FIELD IF NOT EXISTS joined_at ON organization_members TYPE datetime
  DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS created_at ON organization_members TYPE datetime
  DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS removed_at ON organization_members TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS removed_by ON organization_members TYPE option<record<users>>;

-- Ensure user can only be member of org once
DEFINE INDEX idx_org_member_unique ON organization_members FIELDS org_id, user_id UNIQUE;
-- Ensure only one owner per org
DEFINE INDEX idx_org_owner ON organization_members FIELDS org_id WHERE role = 'owner' UNIQUE;
-- Fast lookup by org
DEFINE INDEX idx_member_org ON organization_members FIELDS org_id;
-- Fast lookup by user
DEFINE INDEX idx_member_user ON organization_members FIELDS user_id;

-- Invitations table
DEFINE TABLE IF NOT EXISTS organization_invitations SCHEMAFULL
  PERMISSIONS
    FOR select WHERE org_id = $auth.org_id OR token_hash = $token_hash
    FOR create WHERE $auth.role IN ['owner', 'admin'] AND org_id = $auth.org_id
    FOR update WHERE org_id = $auth.org_id OR token_hash = $token_hash
    FOR delete WHERE $auth.role IN ['owner', 'admin'] AND org_id = $auth.org_id;

DEFINE FIELD IF NOT EXISTS org_id ON organization_invitations TYPE record<organizations>
  ASSERT $value != NONE;
DEFINE FIELD IF NOT EXISTS email ON organization_invitations TYPE string
  ASSERT string::is_email($value);
DEFINE FIELD IF NOT EXISTS role ON organization_invitations TYPE string
  ASSERT $value IN ['admin', 'member', 'viewer'];
DEFINE FIELD IF NOT EXISTS token_hash ON organization_invitations TYPE string
  ASSERT $value != NONE;
DEFINE FIELD IF NOT EXISTS invited_by ON organization_invitations TYPE record<users>;
DEFINE FIELD IF NOT EXISTS status ON organization_invitations TYPE string
  ASSERT $value IN ['pending', 'accepted', 'declined', 'expired']
  DEFAULT 'pending';
DEFINE FIELD IF NOT EXISTS expires_at ON organization_invitations TYPE datetime;
DEFINE FIELD IF NOT EXISTS created_at ON organization_invitations TYPE datetime
  DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS accepted_at ON organization_invitations TYPE option<datetime>;

-- Fast lookup by token hash
DEFINE INDEX idx_invitation_token ON organization_invitations FIELDS token_hash UNIQUE;
-- Fast lookup by org
DEFINE INDEX idx_invitation_org ON organization_invitations FIELDS org_id;
-- Fast lookup by email
DEFINE INDEX idx_invitation_email ON organization_invitations FIELDS email;
```

## Component Structure

### Dashboard Pages

```
repos/metabob-cloud-dashboard/src/
  pages/
    Members.tsx           # Main members page
  components/
    members/
      MemberRow.tsx       # Single member display with actions
      InviteModal.tsx     # Invite member modal dialog
      RoleDropdown.tsx    # Role selection dropdown
      RemoveConfirm.tsx   # Confirmation dialog for removal
      TransferOwnership.tsx # Ownership transfer modal
  hooks/
    useMembers.tsx        # Members data fetching and mutations
  lib/api/
    members.ts            # API client functions
```

### API Routes

```
repos/metabob-analysis-api/src/routes/
  members.ts              # All member management endpoints
```

## Risks / Trade-offs

### Risk 1: Invitation Token Leakage
**Risk:** Invitation URLs could be shared or intercepted, allowing unauthorized access

**Mitigation:**
- Tokens are single-use (marked as accepted after use)
- 7-day expiration limits exposure window
- Token hash stored, original never saved
- HTTPS required for all endpoints
- Rate limiting on accept/decline endpoints

### Risk 2: Seat Limit Bypass via Concurrent Invitations
**Risk:** Multiple invitations could exceed seat limit if accepted simultaneously

**Mitigation:**
- Check seat availability at accept time (not just invite time)
- Use database transaction for member creation + seat update
- Return clear error if seats exhausted during acceptance
- Consider reservation system for pending invitations (future)

### Risk 3: Owner Account Compromise
**Risk:** If owner account compromised, attacker could transfer ownership

**Mitigation:**
- Require re-authentication for ownership transfer
- Log all ownership transfers with IP/timestamp
- Consider email notification to old owner (future)
- Rate limit ownership transfer attempts

### Risk 4: Email Deliverability (Future)
**Risk:** Invitation emails may not be delivered due to spam filters

**Mitigation (MVP):**
- Console logging allows manual invitation sharing
- Display invitation link in UI after creation
- Add copy-to-clipboard for invitation URL

**Mitigation (Production):**
- Use transactional email service (SendGrid, Resend)
- Implement proper SPF/DKIM/DMARC
- Monitor bounce rates and delivery metrics

## Open Questions

### Q1: Self-Service Role Downgrade
**Question:** Can members change their own role to a lower one (e.g., admin -> member)?

**Options:**
- A) Yes, allow self-downgrade but not self-upgrade
- B) No, all role changes require admin action
- C) Allow leaving org (which removes membership entirely)

**Recommendation:** C - Allow leaving, but role changes require admin

### Q2: Re-Invitation of Removed Members
**Question:** If a removed member is re-invited, should they get a fresh invitation or restore old membership?

**Options:**
- A) Always fresh invitation (like new member)
- B) Restore previous membership record with new status
- C) Block re-invitation (require manual database intervention)

**Recommendation:** A - Fresh invitation, clean slate

### Q3: Invitation to Existing Users
**Question:** If invited email belongs to existing user in different org, what happens?

**Options:**
- A) Allow multi-org membership (user sees org switcher)
- B) Require user to leave current org first
- C) Create new account with different email

**Recommendation:** A - Multi-org membership (future consideration), but for MVP: B
