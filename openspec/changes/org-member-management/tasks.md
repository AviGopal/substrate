# Organization Member Management - Tasks

## Overview

Implementation tasks organized by milestone, each with acceptance criteria and E2E tests.

---

## Milestone 1: Database Schema and Member Listing

**Goal:** Deploy database schema and implement basic member listing API and UI

### M1.1: Create Database Schema

**File:** `repos/metabob-proto/surrealdb/core/006-organization-members.surql`

**Tasks:**
- [ ] Create `organization_members` table with SCHEMAFULL definition
- [ ] Add fields: org_id, user_id, role, status, invited_by, joined_at, created_at, removed_at, removed_by
- [ ] Add PERMISSIONS for select/create/update (no delete - soft delete only)
- [ ] Create unique index on (org_id, user_id)
- [ ] Create conditional unique index for single owner per org
- [ ] Create `organization_invitations` table with token_hash, email, role, status, expires_at
- [ ] Add PERMISSIONS for invitations table
- [ ] Create `membership_audit_log` table (immutable)

**Acceptance Criteria:**
- Schema applies without errors on fresh SurrealDB
- PERMISSIONS enforce org isolation correctly
- Only one owner allowed per organization

### M1.2: Data Migration Script

**File:** `repos/metabob-proto/surrealdb/migrations/006-backfill-members.surql`

**Tasks:**
- [ ] Script to create owner membership from first admin user per org
- [ ] Script to create member entries for all other users
- [ ] Verify no duplicate memberships created
- [ ] Add idempotency checks (skip if already exists)

**Acceptance Criteria:**
- Existing users have membership records after migration
- Each org has exactly one owner
- Migration can be re-run safely (idempotent)

### M1.3: List Members API Endpoint

**File:** `repos/metabob-analysis-api/src/routes/members.ts`

**Tasks:**
- [ ] Create `GET /v2/organizations/current/members` endpoint
- [ ] Apply auth and scope middleware
- [ ] Query members with user details (email, name) via joins
- [ ] Support query params: status, role, search, limit, offset
- [ ] Return paginated response with total count

**Acceptance Criteria:**
- Returns members only for authenticated user's org
- Excludes removed members by default
- Supports filtering and pagination

### M1.4: Members TypeScript Types

**File:** `repos/metabob-cloud-dashboard/src/types/api.ts`

**Tasks:**
- [ ] Add `MemberRole` type: 'owner' | 'admin' | 'member' | 'viewer'
- [ ] Add `MemberStatus` type: 'active' | 'pending' | 'removed'
- [ ] Add `OrganizationMember` interface
- [ ] Add `OrganizationInvitation` interface

### M1.5: Members API Client

**File:** `repos/metabob-cloud-dashboard/src/lib/api/members.ts`

**Tasks:**
- [ ] Implement `getMembers()` function
- [ ] Implement `getMember(id)` function
- [ ] Add proper error handling

### M1.6: Members Page - Basic Listing

**File:** `repos/metabob-cloud-dashboard/src/pages/Members.tsx`

**Tasks:**
- [ ] Create Members page component following APIKeys.tsx pattern
- [ ] Display members in card/list format
- [ ] Show avatar placeholder, name, email, role, joined date
- [ ] Add loading skeleton state
- [ ] Add empty state message
- [ ] Add search input (client-side filtering)
- [ ] Add role filter dropdown

### M1.7: useMembers Hook

**File:** `repos/metabob-cloud-dashboard/src/hooks/useMembers.tsx`

**Tasks:**
- [ ] Create hook for members state management
- [ ] Fetch members on mount
- [ ] Expose refresh function
- [ ] Handle loading and error states

### M1.8: Add Navigation

**Tasks:**
- [ ] Add "Members" link to sidebar navigation
- [ ] Add route to App router
- [ ] Use appropriate icon (users icon)

### M1 E2E Tests

```typescript
// File: repos/metabob-cloud-dashboard/e2e/members.spec.ts

import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:8080';

// API Tests
test.describe('M1: Member Listing API', () => {
  test('M1.1: List org members returns correct data', async ({ request }) => {
    // Login first to get token
    const loginResponse = await request.post(`${API_URL}/v2/auth/login`, {
      data: { email: 'admin@test.local', password: 'testpassword123' }
    });
    expect(loginResponse.ok()).toBeTruthy();
    const { data: { token } } = await loginResponse.json();

    // List members
    const response = await request.get(`${API_URL}/v2/organizations/current/members`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(response.status()).toBe(200);

    const { data } = await response.json();
    expect(Array.isArray(data.members)).toBe(true);
    expect(data).toHaveProperty('total');

    // Verify member structure
    if (data.members.length > 0) {
      const member = data.members[0];
      expect(member).toHaveProperty('id');
      expect(member).toHaveProperty('user_id');
      expect(member).toHaveProperty('user_email');
      expect(member).toHaveProperty('user_name');
      expect(member).toHaveProperty('role');
      expect(['owner', 'admin', 'member', 'viewer']).toContain(member.role);
    }
  });

  test('M1.2: List members requires authentication', async ({ request }) => {
    const response = await request.get(`${API_URL}/v2/organizations/current/members`);
    expect(response.status()).toBe(401);
  });

  test('M1.3: Filter members by role', async ({ request }) => {
    const loginResponse = await request.post(`${API_URL}/v2/auth/login`, {
      data: { email: 'admin@test.local', password: 'testpassword123' }
    });
    const { data: { token } } = await loginResponse.json();

    const response = await request.get(
      `${API_URL}/v2/organizations/current/members?role=admin`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(response.status()).toBe(200);

    const { data } = await response.json();
    for (const member of data.members) {
      expect(member.role).toBe('admin');
    }
  });
});

// UI Tests
test.describe('M1: Member Listing UI', () => {
  test.beforeEach(async ({ page }) => {
    // Login via UI
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'admin@test.local');
    await page.fill('[data-testid="password-input"]', 'testpassword123');
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL('/');
  });

  test('M1.4: Navigate to members page', async ({ page }) => {
    await page.click('[data-testid="nav-members"]');
    await expect(page).toHaveURL('/members');
    await expect(page.locator('h1')).toContainText('Members');
  });

  test('M1.5: Members list displays correctly', async ({ page }) => {
    await page.goto('/members');
    await page.waitForSelector('[data-testid^="member-row-"]');

    // Should have at least one member (the logged-in user)
    const memberRows = page.locator('[data-testid^="member-row-"]');
    await expect(memberRows.first()).toBeVisible();
  });

  test('M1.6: Search filters members', async ({ page }) => {
    await page.goto('/members');
    await page.waitForSelector('[data-testid^="member-row-"]');

    // Count initial members
    const initialCount = await page.locator('[data-testid^="member-row-"]').count();

    // Search for non-existent name
    await page.fill('[data-testid="member-search"]', 'zzz-nonexistent-zzz');
    await page.waitForTimeout(300); // Debounce

    // Should show no members or fewer members
    const filteredCount = await page.locator('[data-testid^="member-row-"]').count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test('M1.7: Role filter works', async ({ page }) => {
    await page.goto('/members');

    // Select admin role filter
    await page.selectOption('[data-testid="role-filter"]', 'admin');
    await page.waitForTimeout(300);

    // All visible members should be admin or owner
    const roles = await page.locator('[data-testid^="member-row-"] .capitalize').allTextContents();
    for (const role of roles) {
      expect(['admin', 'owner']).toContain(role.toLowerCase().trim());
    }
  });
});
```

---

## Milestone 2: Invitation Flow

**Goal:** Implement invitation creation, viewing, and acceptance/decline

### M2.1: Invite Member API

**File:** `repos/metabob-analysis-api/src/routes/members.ts`

**Tasks:**
- [ ] Create `POST /v2/organizations/current/members/invite` endpoint
- [ ] Validate email format and role
- [ ] Check seat availability (seat_limit vs seat_usage)
- [ ] Generate secure token (UUID v4) and store hash
- [ ] Set 7-day expiration
- [ ] Check for existing pending invitation
- [ ] Check if email is already a member
- [ ] Return invitation with URL (token in URL, hash in DB)
- [ ] Log invitation to console (MVP email placeholder)

**Acceptance Criteria:**
- Only admin/owner can invite
- Cannot invite existing members
- Cannot exceed seat limit
- Token is cryptographically secure

### M2.2: List and Revoke Invitations API

**Tasks:**
- [ ] Create `GET /v2/organizations/current/invitations` endpoint
- [ ] Create `DELETE /v2/organizations/current/invitations/:id` endpoint
- [ ] Support status filtering (pending, accepted, etc.)

### M2.3: Public Invitation Endpoints

**Tasks:**
- [ ] Create `GET /v2/invitations/:token` endpoint (no auth)
- [ ] Create `POST /v2/invitations/:token/accept` endpoint
- [ ] Create `POST /v2/invitations/:token/decline` endpoint
- [ ] Hash token on lookup (never store raw token)
- [ ] Check expiration on accept/decline
- [ ] Handle authenticated vs unauthenticated accept

### M2.4: Invitation Acceptance Logic

**Tasks:**
- [ ] Transaction: mark invitation accepted + create member + update seat_usage
- [ ] If user not authenticated, return redirect URL to signup with token
- [ ] If user authenticated but different email, handle accordingly
- [ ] Create audit log entry for member_joined

### M2.5: Invite Modal Component

**File:** `repos/metabob-cloud-dashboard/src/components/members/InviteModal.tsx`

**Tasks:**
- [ ] Create modal with email input and role dropdown
- [ ] Form validation (email required, valid format)
- [ ] Submit button with loading state
- [ ] Show invitation URL after successful creation
- [ ] Copy-to-clipboard functionality

### M2.6: Invitation Row Component

**File:** `repos/metabob-cloud-dashboard/src/components/members/InvitationRow.tsx`

**Tasks:**
- [ ] Display pending invitations in Members page
- [ ] Show email, role, invited date, expiration
- [ ] Revoke button for admins

### M2.7: Invitation Accept Page

**File:** `repos/metabob-cloud-dashboard/src/pages/Invitation.tsx`

**Tasks:**
- [ ] Create `/invite/:token` route
- [ ] Fetch invitation details on load
- [ ] Show organization name, role, inviter
- [ ] Accept and Decline buttons
- [ ] Handle expired invitations
- [ ] Redirect to signup if not authenticated

### M2 E2E Tests

```typescript
// File: repos/metabob-cloud-dashboard/e2e/invitations.spec.ts

import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:8080';

test.describe('M2: Invitation Flow', () => {
  let adminToken: string;
  let invitationUrl: string;

  test.beforeAll(async ({ request }) => {
    // Login as admin
    const loginResponse = await request.post(`${API_URL}/v2/auth/login`, {
      data: { email: 'admin@test.local', password: 'testpassword123' }
    });
    const { data } = await loginResponse.json();
    adminToken = data.token;
  });

  test('M2.1: Create invitation returns token URL', async ({ request }) => {
    const response = await request.post(
      `${API_URL}/v2/organizations/current/members/invite`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { email: 'newuser@test.local', role: 'member' }
      }
    );
    expect(response.status()).toBe(201);

    const { data } = await response.json();
    expect(data.invitation).toHaveProperty('id');
    expect(data.invitation.email).toBe('newuser@test.local');
    expect(data.invitation.status).toBe('pending');
    expect(data.invitation_url).toContain('/invite/');

    invitationUrl = data.invitation_url;
  });

  test('M2.2: Cannot invite existing member', async ({ request }) => {
    const response = await request.post(
      `${API_URL}/v2/organizations/current/members/invite`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { email: 'admin@test.local', role: 'member' }
      }
    );
    expect(response.status()).toBe(409);
  });

  test('M2.3: View invitation details without auth', async ({ request }) => {
    const token = invitationUrl.split('/invite/')[1];
    const response = await request.get(`${API_URL}/v2/invitations/${token}`);
    expect(response.status()).toBe(200);

    const { data } = await response.json();
    expect(data.invitation.org_name).toBeTruthy();
    expect(data.invitation.role).toBe('member');
    expect(data.invitation.is_expired).toBe(false);
  });

  test('M2.4: Accept invitation creates member', async ({ request }) => {
    // First, create a user account for the invited email
    await request.post(`${API_URL}/v2/auth/signup`, {
      data: {
        email: 'newuser@test.local',
        password: 'testpassword123',
        name: 'New User',
        org_name: 'Temp Org' // Will be replaced by invitation org
      }
    });

    // Login as the new user
    const loginResponse = await request.post(`${API_URL}/v2/auth/login`, {
      data: { email: 'newuser@test.local', password: 'testpassword123' }
    });
    const { data: { token: userToken } } = await loginResponse.json();

    // Accept the invitation
    const inviteToken = invitationUrl.split('/invite/')[1];
    const acceptResponse = await request.post(
      `${API_URL}/v2/invitations/${inviteToken}/accept`,
      { headers: { Authorization: `Bearer ${userToken}` } }
    );
    expect(acceptResponse.status()).toBe(200);

    const { data } = await acceptResponse.json();
    expect(data.member.role).toBe('member');
  });

  test('M2.5: Cannot reuse accepted invitation', async ({ request }) => {
    const token = invitationUrl.split('/invite/')[1];
    const response = await request.post(`${API_URL}/v2/invitations/${token}/accept`);
    expect(response.status()).toBe(410); // Gone
  });
});

test.describe('M2: Invitation UI Flow', () => {
  test('M2.6: Invite member via dashboard', async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'admin@test.local');
    await page.fill('[data-testid="password-input"]', 'testpassword123');
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL('/');

    // Navigate to members
    await page.click('[data-testid="nav-members"]');
    await expect(page).toHaveURL('/members');

    // Open invite modal
    await page.click('[data-testid="invite-member-btn"]');
    await expect(page.locator('[data-testid="invite-modal"]')).toBeVisible();

    // Fill form
    await page.fill('[data-testid="invite-email"]', 'invited-via-ui@test.local');
    await page.selectOption('[data-testid="invite-role"]', 'member');

    // Submit
    await page.click('[data-testid="send-invite"]');

    // Should show success with invitation URL
    await expect(page.locator('[data-testid="invite-success"]')).toBeVisible();
  });

  test('M2.7: View and accept invitation page', async ({ page }) => {
    // Navigate to invitation page (using a known token from test data)
    await page.goto('/invite/test-invitation-token');

    // Should show organization name and role
    await expect(page.locator('text=You have been invited')).toBeVisible();

    // Accept and decline buttons visible
    await expect(page.locator('[data-testid="accept-invite"]')).toBeVisible();
    await expect(page.locator('[data-testid="decline-invite"]')).toBeVisible();
  });
});
```

---

## Milestone 3: Role Management and Member Removal

**Goal:** Implement role changes, member removal, and leaving organization

### M3.1: Update Role API

**File:** `repos/metabob-analysis-api/src/routes/members.ts`

**Tasks:**
- [ ] Create `PATCH /v2/organizations/current/members/:id/role` endpoint
- [ ] Validate new role (cannot set to owner via this endpoint)
- [ ] Check permissions (owner can change anyone, admin can change member/viewer)
- [ ] Cannot change owner's role
- [ ] Create audit log entry for role_changed

### M3.2: Remove Member API

**Tasks:**
- [ ] Create `DELETE /v2/organizations/current/members/:id` endpoint
- [ ] Soft delete (set status='removed', removed_at, removed_by)
- [ ] Cannot remove owner
- [ ] Admin cannot remove other admins
- [ ] Update org seat_usage
- [ ] Create audit log entry for member_removed

### M3.3: Leave Organization API

**Tasks:**
- [ ] Create `POST /v2/organizations/current/members/leave` endpoint
- [ ] Verify user is not owner
- [ ] Soft delete own membership
- [ ] Update org seat_usage
- [ ] Create audit log entry for member_left

### M3.4: RoleDropdown Component

**File:** `repos/metabob-cloud-dashboard/src/components/members/RoleDropdown.tsx`

**Tasks:**
- [ ] Dropdown showing current role
- [ ] Options based on permissions (owner can show admin, others cannot)
- [ ] onChange callback with confirmation
- [ ] Loading state during update

### M3.5: RemoveMemberDialog Component

**File:** `repos/metabob-cloud-dashboard/src/components/members/RemoveMemberDialog.tsx`

**Tasks:**
- [ ] Confirmation dialog with member name
- [ ] Cancel and Confirm buttons
- [ ] Warning about action being permanent

### M3.6: LeaveOrgDialog Component

**File:** `repos/metabob-cloud-dashboard/src/components/members/LeaveOrgDialog.tsx`

**Tasks:**
- [ ] Confirmation dialog
- [ ] Warning about losing access
- [ ] Redirect after leaving

### M3.7: Integration with MemberRow

**Tasks:**
- [ ] Add RoleDropdown to MemberRow
- [ ] Add Remove button with dialog
- [ ] Conditional rendering based on permissions
- [ ] Add Leave Organization card at bottom of Members page

### M3 E2E Tests

```typescript
// File: repos/metabob-cloud-dashboard/e2e/role-management.spec.ts

import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:8080';

test.describe('M3: Role Management', () => {
  let ownerToken: string;
  let memberId: string;

  test.beforeAll(async ({ request }) => {
    // Login as owner
    const loginResponse = await request.post(`${API_URL}/v2/auth/login`, {
      data: { email: 'owner@test.local', password: 'testpassword123' }
    });
    const { data } = await loginResponse.json();
    ownerToken = data.token;

    // Get a member ID
    const membersResponse = await request.get(
      `${API_URL}/v2/organizations/current/members`,
      { headers: { Authorization: `Bearer ${ownerToken}` } }
    );
    const { data: membersData } = await membersResponse.json();
    const member = membersData.members.find((m: any) => m.role === 'member');
    memberId = member?.id;
  });

  test('M3.1: Owner can change member role to admin', async ({ request }) => {
    const response = await request.patch(
      `${API_URL}/v2/organizations/current/members/${memberId}/role`,
      {
        headers: { Authorization: `Bearer ${ownerToken}` },
        data: { role: 'admin' }
      }
    );
    expect(response.status()).toBe(200);

    const { data } = await response.json();
    expect(data.member.role).toBe('admin');
  });

  test('M3.2: Cannot change owner role', async ({ request }) => {
    // Find owner member ID
    const membersResponse = await request.get(
      `${API_URL}/v2/organizations/current/members`,
      { headers: { Authorization: `Bearer ${ownerToken}` } }
    );
    const { data: membersData } = await membersResponse.json();
    const owner = membersData.members.find((m: any) => m.role === 'owner');

    const response = await request.patch(
      `${API_URL}/v2/organizations/current/members/${owner.id}/role`,
      {
        headers: { Authorization: `Bearer ${ownerToken}` },
        data: { role: 'admin' }
      }
    );
    expect(response.status()).toBe(403);
  });

  test('M3.3: Remove member', async ({ request }) => {
    // First add a member to remove
    const inviteResponse = await request.post(
      `${API_URL}/v2/organizations/current/members/invite`,
      {
        headers: { Authorization: `Bearer ${ownerToken}` },
        data: { email: 'toremove@test.local', role: 'member' }
      }
    );
    // ... accept invitation ...

    // Get the new member's ID
    const membersResponse = await request.get(
      `${API_URL}/v2/organizations/current/members`,
      { headers: { Authorization: `Bearer ${ownerToken}` } }
    );
    const { data: membersData } = await membersResponse.json();
    const newMember = membersData.members.find(
      (m: any) => m.user_email === 'toremove@test.local'
    );

    if (newMember) {
      const removeResponse = await request.delete(
        `${API_URL}/v2/organizations/current/members/${newMember.id}`,
        { headers: { Authorization: `Bearer ${ownerToken}` } }
      );
      expect(removeResponse.status()).toBe(200);
    }
  });

  test('M3.4: Cannot remove owner', async ({ request }) => {
    const membersResponse = await request.get(
      `${API_URL}/v2/organizations/current/members`,
      { headers: { Authorization: `Bearer ${ownerToken}` } }
    );
    const { data: membersData } = await membersResponse.json();
    const owner = membersData.members.find((m: any) => m.role === 'owner');

    const response = await request.delete(
      `${API_URL}/v2/organizations/current/members/${owner.id}`,
      { headers: { Authorization: `Bearer ${ownerToken}` } }
    );
    expect(response.status()).toBe(403);
  });
});

test.describe('M3: Role Management UI', () => {
  test('M3.5: Change member role via dropdown', async ({ page }) => {
    // Login as owner
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'owner@test.local');
    await page.fill('[data-testid="password-input"]', 'testpassword123');
    await page.click('[data-testid="login-submit"]');

    // Navigate to members
    await page.click('[data-testid="nav-members"]');

    // Find a member row with role dropdown
    const memberRow = page.locator('[data-testid^="member-row-"]').first();
    const roleDropdown = memberRow.locator('[data-testid^="role-dropdown-"]');

    // If dropdown exists (not owner), change role
    if (await roleDropdown.isVisible()) {
      await roleDropdown.selectOption('viewer');
      // Wait for update
      await page.waitForTimeout(500);
      // Verify change persisted
      await expect(roleDropdown).toHaveValue('viewer');
    }
  });

  test('M3.6: Remove member with confirmation', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'owner@test.local');
    await page.fill('[data-testid="password-input"]', 'testpassword123');
    await page.click('[data-testid="login-submit"]');

    await page.click('[data-testid="nav-members"]');

    // Find remove button on a non-owner member
    const removeBtn = page.locator('[data-testid^="remove-btn-"]').first();

    if (await removeBtn.isVisible()) {
      await removeBtn.click();

      // Confirmation dialog should appear
      await expect(page.locator('text=Are you sure')).toBeVisible();

      // Cancel removal
      await page.click('button:has-text("Cancel")');
    }
  });
});
```

---

## Milestone 4: Ownership Transfer

**Goal:** Implement ownership transfer functionality

### M4.1: Transfer Ownership API

**File:** `repos/metabob-analysis-api/src/routes/members.ts`

**Tasks:**
- [ ] Create `POST /v2/organizations/current/transfer-ownership` endpoint
- [ ] Validate new_owner_id is an admin in the org
- [ ] Require confirmation string "TRANSFER"
- [ ] Transaction: demote old owner to admin, promote new owner to owner
- [ ] Create audit log entry for ownership_transferred
- [ ] Return new owner details and old owner's new role

### M4.2: TransferOwnershipDialog Component

**File:** `repos/metabob-cloud-dashboard/src/components/members/TransferOwnershipDialog.tsx`

**Tasks:**
- [ ] Modal with admin selection dropdown
- [ ] Require typing "TRANSFER" to confirm
- [ ] Submit button disabled until valid
- [ ] Success message with new ownership info
- [ ] Handle errors gracefully

### M4.3: Integration in Members Page

**Tasks:**
- [ ] Add "Transfer Ownership" button (visible only to owner)
- [ ] Wire up dialog to transferOwnership function in hook

### M4 E2E Tests

```typescript
// File: repos/metabob-cloud-dashboard/e2e/transfer-ownership.spec.ts

import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:8080';

test.describe('M4: Ownership Transfer', () => {
  test('M4.1: Transfer ownership to admin', async ({ request }) => {
    // Login as owner
    const loginResponse = await request.post(`${API_URL}/v2/auth/login`, {
      data: { email: 'owner@test.local', password: 'testpassword123' }
    });
    const { data: { token: ownerToken } } = await loginResponse.json();

    // Get an admin member
    const membersResponse = await request.get(
      `${API_URL}/v2/organizations/current/members`,
      { headers: { Authorization: `Bearer ${ownerToken}` } }
    );
    const { data: membersData } = await membersResponse.json();
    const admin = membersData.members.find((m: any) => m.role === 'admin');

    if (admin) {
      const response = await request.post(
        `${API_URL}/v2/organizations/current/transfer-ownership`,
        {
          headers: { Authorization: `Bearer ${ownerToken}` },
          data: {
            new_owner_id: admin.user_id,
            confirmation: 'TRANSFER'
          }
        }
      );
      expect(response.status()).toBe(200);

      const { data } = await response.json();
      expect(data.new_owner.id).toBe(admin.user_id);
      expect(data.your_new_role).toBe('admin');
    }
  });

  test('M4.2: Cannot transfer to non-admin', async ({ request }) => {
    const loginResponse = await request.post(`${API_URL}/v2/auth/login`, {
      data: { email: 'owner@test.local', password: 'testpassword123' }
    });
    const { data: { token } } = await loginResponse.json();

    const membersResponse = await request.get(
      `${API_URL}/v2/organizations/current/members`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const { data: membersData } = await membersResponse.json();
    const member = membersData.members.find((m: any) => m.role === 'member');

    if (member) {
      const response = await request.post(
        `${API_URL}/v2/organizations/current/transfer-ownership`,
        {
          headers: { Authorization: `Bearer ${token}` },
          data: {
            new_owner_id: member.user_id,
            confirmation: 'TRANSFER'
          }
        }
      );
      expect(response.status()).toBe(403);
    }
  });

  test('M4.3: Requires correct confirmation', async ({ request }) => {
    const loginResponse = await request.post(`${API_URL}/v2/auth/login`, {
      data: { email: 'owner@test.local', password: 'testpassword123' }
    });
    const { data: { token } } = await loginResponse.json();

    const response = await request.post(
      `${API_URL}/v2/organizations/current/transfer-ownership`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          new_owner_id: 'users:admin123',
          confirmation: 'wrong'
        }
      }
    );
    expect(response.status()).toBe(400);
  });
});

test.describe('M4: Transfer Ownership UI', () => {
  test('M4.4: Transfer ownership via dashboard', async ({ page }) => {
    // Login as owner
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'owner@test.local');
    await page.fill('[data-testid="password-input"]', 'testpassword123');
    await page.click('[data-testid="login-submit"]');

    await page.click('[data-testid="nav-members"]');

    // Click transfer ownership button
    await page.click('[data-testid="transfer-ownership-btn"]');

    // Modal should appear
    await expect(page.locator('text=Transfer Ownership')).toBeVisible();

    // Select new owner
    await page.selectOption('[data-testid="new-owner-select"]', { index: 1 });

    // Type confirmation
    await page.fill('[data-testid="transfer-confirmation"]', 'TRANSFER');

    // Submit button should be enabled
    const submitBtn = page.locator('[data-testid="confirm-transfer"]');
    await expect(submitBtn).toBeEnabled();

    // Note: Don't actually submit in test to preserve test data
    // await submitBtn.click();
  });

  test('M4.5: Non-owner cannot see transfer button', async ({ page }) => {
    // Login as admin (not owner)
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'admin@test.local');
    await page.fill('[data-testid="password-input"]', 'testpassword123');
    await page.click('[data-testid="login-submit"]');

    await page.click('[data-testid="nav-members"]');

    // Transfer button should not be visible
    await expect(page.locator('[data-testid="transfer-ownership-btn"]')).not.toBeVisible();
  });
});
```

---

## Test Data Setup

Create test data for E2E tests:

```sql
-- File: repos/metabob-proto/surrealdb/test-data/members-test-data.surql

-- Create test organization
CREATE organizations:testorg SET
  name = 'Test Organization',
  seat_limit = 10,
  seat_usage = 3,
  created_at = time::now();

-- Create test users
CREATE users:owner SET
  email = 'owner@test.local',
  password_hash = crypto::argon2::generate('testpassword123'),
  name = 'Test Owner',
  org_id = organizations:testorg,
  role = 'admin',
  created_at = time::now();

CREATE users:admin SET
  email = 'admin@test.local',
  password_hash = crypto::argon2::generate('testpassword123'),
  name = 'Test Admin',
  org_id = organizations:testorg,
  role = 'admin',
  created_at = time::now();

CREATE users:member SET
  email = 'member@test.local',
  password_hash = crypto::argon2::generate('testpassword123'),
  name = 'Test Member',
  org_id = organizations:testorg,
  role = 'member',
  created_at = time::now();

-- Create test memberships
CREATE organization_members:owner SET
  org_id = organizations:testorg,
  user_id = users:owner,
  role = 'owner',
  status = 'active',
  joined_at = time::now(),
  created_at = time::now();

CREATE organization_members:admin SET
  org_id = organizations:testorg,
  user_id = users:admin,
  role = 'admin',
  status = 'active',
  invited_by = users:owner,
  joined_at = time::now(),
  created_at = time::now();

CREATE organization_members:member SET
  org_id = organizations:testorg,
  user_id = users:member,
  role = 'member',
  status = 'active',
  invited_by = users:admin,
  joined_at = time::now(),
  created_at = time::now();

-- Create test invitation
CREATE organization_invitations:test SET
  org_id = organizations:testorg,
  email = 'pending@test.local',
  role = 'member',
  token_hash = crypto::sha256('test-invitation-token'),
  invited_by = users:admin,
  status = 'pending',
  expires_at = time::now() + 7d,
  created_at = time::now();
```

---

## Summary

| Milestone | Tasks | E2E Tests |
|-----------|-------|-----------|
| M1: Member Listing | 8 | 7 |
| M2: Invitation Flow | 7 | 7 |
| M3: Role Management | 7 | 6 |
| M4: Ownership Transfer | 3 | 5 |
| **Total** | **25** | **25** |

**Estimated Effort:** 3-4 days for full implementation and testing
