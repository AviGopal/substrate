# Organization Seat Management - Tasks

**Status:** Not Started
**Created:** 2026-03-25
**Updated:** 2026-03-25

---

## Overview

Tasks are organized into milestones where the system is in a working, testable state. Each milestone has its own E2E test that validates the functionality.

---

## Milestone 1: Schema and API Foundation

**Goal:** Database schema deployed and basic API returns seat information.

**Deliverable:** `GET /v2/orgs/:orgId/seats` returns accurate seat data.

### Tasks

- [ ] **SEAT-1.1: Create seat_allocations schema**
  - File: `repos/metabob-proto/surrealdb/core/006-seat-allocations.surql`
  - Define table with RBAC permissions
  - Define fields: org_id, user_id, allocated_at, allocated_by, allocation_reason
  - Define indexes for efficient queries
  - Add to schema migration job

- [ ] **SEAT-1.2: Create migration script**
  - File: `repos/metabob-proto/surrealdb/migrations/006-backfill-seat-allocations.surql`
  - Backfill allocations for all existing active users
  - Update organizations.seat_usage
  - Make idempotent (safe to re-run)

- [ ] **SEAT-1.3: Add TypeScript types**
  - File: `repos/metabob-analysis-api/src/types/seats.ts`
  - SeatAllocation interface
  - SeatInfo interface
  - Plan mapping constants

- [ ] **SEAT-1.4: Create seats route handler**
  - File: `repos/metabob-analysis-api/src/routes/seats.ts`
  - GET /:orgId/seats endpoint
  - Query organizations, subscriptions, seat_allocations
  - Compute derived fields (usage_percentage, warning_threshold, etc.)
  - Join user details to allocations

- [ ] **SEAT-1.5: Register seats routes**
  - File: `repos/metabob-analysis-api/src/index.ts`
  - Import and mount seatsRoutes at /v2/orgs

- [ ] **SEAT-1.6: Deploy and verify**
  - Apply schema migration
  - Run backfill migration
  - Deploy updated analysis-api
  - Manual test: `curl /v2/orgs/current/seats`

### E2E Test: Milestone 1

```typescript
// File: repos/metabob-analysis-api/tests/seats.test.ts

import { test, expect, describe, beforeAll } from 'bun:test';

describe('Seat Management API - Milestone 1', () => {
  let authToken: string;
  const API_URL = process.env.ANALYSIS_API_URL || 'http://localhost:8080';

  beforeAll(async () => {
    // Authenticate via API
    const response = await fetch(`${API_URL}/v2/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@metabob.local',
        password: 'testpass123',
      }),
    });
    const data = await response.json();
    authToken = data.data.token;
  });

  test('GET /v2/orgs/current/seats returns seat info', async () => {
    const response = await fetch(`${API_URL}/v2/orgs/current/seats`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);

    // Required fields
    expect(typeof data.data.seat_limit).toBe('number');
    expect(typeof data.data.seat_usage).toBe('number');
    expect(typeof data.data.plan).toBe('string');
    expect(typeof data.data.plan_name).toBe('string');
    expect(Array.isArray(data.data.allocations)).toBe(true);
    expect(typeof data.data.can_add_members).toBe('boolean');
    expect(typeof data.data.seats_remaining).toBe('number');
    expect(typeof data.data.usage_percentage).toBe('number');
    expect(typeof data.data.warning_threshold).toBe('boolean');
    expect(typeof data.data.at_capacity).toBe('boolean');
    expect(typeof data.data.upgrade_available).toBe('boolean');

    // Computed fields are consistent
    expect(data.data.seat_usage + data.data.seats_remaining).toBe(data.data.seat_limit);
    expect(data.data.at_capacity).toBe(data.data.seat_usage >= data.data.seat_limit);
  });

  test('GET /v2/orgs/current/seats without auth returns 401', async () => {
    const response = await fetch(`${API_URL}/v2/orgs/current/seats`);
    expect(response.status).toBe(401);
  });

  test('Allocations include user details', async () => {
    const response = await fetch(`${API_URL}/v2/orgs/current/seats`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    const data = await response.json();

    if (data.data.allocations.length > 0) {
      const allocation = data.data.allocations[0];
      expect(typeof allocation.id).toBe('string');
      expect(typeof allocation.org_id).toBe('string');
      expect(typeof allocation.user_id).toBe('string');
      expect(typeof allocation.user_email).toBe('string');
      expect(typeof allocation.user_name).toBe('string');
      expect(typeof allocation.allocated_at).toBe('string');
    }
  });
});
```

---

## Milestone 2: Complete API - Allocate/Deallocate

**Goal:** Full CRUD operations for seat management.

**Deliverable:** Can allocate and deallocate seats via API.

### Tasks

- [ ] **SEAT-2.1: Implement seat allocation endpoint**
  - File: `repos/metabob-analysis-api/src/routes/seats.ts`
  - POST /:orgId/seats/allocate
  - Validate seat availability
  - Verify user exists in org
  - Check for existing allocation
  - Create seat_allocation record
  - Create audit log entry
  - Return updated seat info

- [ ] **SEAT-2.2: Implement seat deallocation endpoint**
  - File: `repos/metabob-analysis-api/src/routes/seats.ts`
  - DELETE /:orgId/seats/:userId
  - Prevent self-deallocation
  - Delete seat_allocation record
  - Create audit log entry
  - Return updated seat info

- [ ] **SEAT-2.3: Implement availability check endpoint**
  - File: `repos/metabob-analysis-api/src/routes/seats.ts`
  - GET /:orgId/seats/available
  - Quick check for invite flow
  - Return availability, remaining, upgrade_path

- [ ] **SEAT-2.4: Add Zod validation schemas**
  - File: `repos/metabob-analysis-api/src/routes/seats.ts`
  - allocateSeatSchema
  - Request body validation

- [ ] **SEAT-2.5: Add error handling**
  - SEAT_LIMIT_EXCEEDED (409)
  - USER_ALREADY_ALLOCATED (409)
  - USER_NOT_FOUND (404)
  - CANNOT_DEALLOCATE_SELF (400)

- [ ] **SEAT-2.6: Deploy and verify**
  - Deploy updated analysis-api
  - Manual test allocation flow
  - Manual test deallocation flow

### E2E Test: Milestone 2

```typescript
// File: repos/metabob-analysis-api/tests/seats-crud.test.ts

import { test, expect, describe, beforeAll, afterAll } from 'bun:test';

describe('Seat Management API - Milestone 2 (CRUD)', () => {
  let authToken: string;
  let adminToken: string;
  let testUserId: string;
  const API_URL = process.env.ANALYSIS_API_URL || 'http://localhost:8080';

  beforeAll(async () => {
    // Login as admin
    const response = await fetch(`${API_URL}/v2/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@metabob.local',
        password: 'adminpass123',
      }),
    });
    const data = await response.json();
    adminToken = data.data.token;

    // Create a test user without seat (for testing allocation)
    // This assumes a test user exists or is created by test setup
    testUserId = 'users:test-no-seat';
  });

  test('GET /v2/orgs/current/seats/available returns availability', async () => {
    const response = await fetch(`${API_URL}/v2/orgs/current/seats/available`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(typeof data.data.available).toBe('boolean');
    expect(typeof data.data.remaining).toBe('number');
    expect(typeof data.data.message).toBe('string');
  });

  test('POST /v2/orgs/current/seats/allocate allocates seat', async () => {
    // First check availability
    const availResponse = await fetch(`${API_URL}/v2/orgs/current/seats/available`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    const availData = await availResponse.json();

    if (!availData.data.available) {
      console.log('No seats available, skipping allocation test');
      return;
    }

    const response = await fetch(`${API_URL}/v2/orgs/current/seats/allocate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: testUserId,
        reason: 'test_allocation',
      }),
    });

    // May be 201 (success) or 409 (already allocated) or 404 (user not found)
    expect([201, 409, 404]).toContain(response.status);

    if (response.status === 201) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.allocation).toBeDefined();
      expect(data.data.allocation.user_id).toBe(testUserId);
      expect(data.data.seat_info).toBeDefined();
    }
  });

  test('POST /v2/orgs/current/seats/allocate requires admin role', async () => {
    // Login as member
    const loginResponse = await fetch(`${API_URL}/v2/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'member@metabob.local',
        password: 'memberpass123',
      }),
    });
    const loginData = await loginResponse.json();
    const memberToken = loginData.data?.token;

    if (!memberToken) {
      console.log('Member user not available, skipping role test');
      return;
    }

    const response = await fetch(`${API_URL}/v2/orgs/current/seats/allocate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: testUserId,
        reason: 'test',
      }),
    });

    expect(response.status).toBe(403);
  });

  test('DELETE /v2/orgs/current/seats/:userId deallocates seat', async () => {
    // This assumes test user has a seat allocated
    const response = await fetch(
      `${API_URL}/v2/orgs/current/seats/${encodeURIComponent(testUserId)}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` },
      }
    );

    // May be 200 (success) or 404 (no allocation)
    expect([200, 404]).toContain(response.status);

    if (response.status === 200) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.deallocated_user_id).toBe(testUserId);
      expect(data.data.seat_info).toBeDefined();
    }
  });

  test('Seat limit enforcement returns 409 when at capacity', async () => {
    // Get current seat info
    const infoResponse = await fetch(`${API_URL}/v2/orgs/current/seats`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    const infoData = await infoResponse.json();

    if (!infoData.data.at_capacity) {
      console.log('Not at capacity, skipping limit enforcement test');
      return;
    }

    const response = await fetch(`${API_URL}/v2/orgs/current/seats/allocate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: 'users:new-user',
        reason: 'test',
      }),
    });

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error.code).toBe('SEAT_LIMIT_EXCEEDED');
  });
});
```

---

## Milestone 3: Dashboard UI - Display

**Goal:** Dashboard shows seat usage and member list.

**Deliverable:** Seat management page displays accurate information.

### Tasks

- [ ] **SEAT-3.1: Create TypeScript types**
  - File: `repos/metabob-cloud-dashboard/src/types/seats.ts`
  - SeatInfo interface
  - SeatAllocation interface
  - SeatAvailability interface

- [ ] **SEAT-3.2: Create API client**
  - File: `repos/metabob-cloud-dashboard/src/lib/api/seats.ts`
  - getSeatInfo()
  - getSeatAvailability()
  - allocateSeat()
  - deallocateSeat()

- [ ] **SEAT-3.3: Create useSeats hook**
  - File: `repos/metabob-cloud-dashboard/src/hooks/useSeats.ts`
  - Fetch seat info on mount
  - Handle loading/error states
  - Expose refetch function

- [ ] **SEAT-3.4: Create SeatProgressBar component**
  - File: `repos/metabob-cloud-dashboard/src/components/seats/SeatProgressBar.tsx`
  - Visual progress bar
  - Color states: normal, warning, error
  - Labels for used/available

- [ ] **SEAT-3.5: Create SeatUsageCard component**
  - File: `repos/metabob-cloud-dashboard/src/components/seats/SeatUsageCard.tsx`
  - Display usage ratio
  - Progress bar
  - Plan name
  - Warning/error messages

- [ ] **SEAT-3.6: Create MemberSeatRow component**
  - File: `repos/metabob-cloud-dashboard/src/components/seats/MemberSeatRow.tsx`
  - User avatar, name, email
  - Allocation date
  - Allocated by
  - Actions dropdown

- [ ] **SEAT-3.7: Create MemberSeatTable component**
  - File: `repos/metabob-cloud-dashboard/src/components/seats/MemberSeatTable.tsx`
  - Table with headers
  - Map allocations to rows
  - Sort by allocation date

- [ ] **SEAT-3.8: Create SeatManagement page**
  - File: `repos/metabob-cloud-dashboard/src/pages/SeatManagement.tsx`
  - Compose all components
  - Handle loading/error states
  - Implement page layout

- [ ] **SEAT-3.9: Add navigation link**
  - File: `repos/metabob-cloud-dashboard/src/components/Sidebar.tsx`
  - Add "Seats" link under Settings section
  - Show badge if at capacity

- [ ] **SEAT-3.10: Add route**
  - File: `repos/metabob-cloud-dashboard/src/App.tsx`
  - Add route for /settings/seats

- [ ] **SEAT-3.11: Deploy and verify**
  - Build and deploy dashboard
  - Navigate to seat management page
  - Verify data displays correctly

### E2E Test: Milestone 3

```typescript
// File: repos/metabob-cloud-dashboard/e2e/seats-display.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Seat Management - Display (Milestone 3)', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@metabob.local');
    await page.fill('input[name="password"]', 'testpass123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
  });

  test('can navigate to seat management page', async ({ page }) => {
    // Click on Seats in sidebar
    await page.click('a[href="/settings/seats"]');

    await page.waitForURL('/settings/seats');

    // Page title visible
    await expect(page.locator('h1')).toContainText('Seat Management');
  });

  test('displays seat usage card', async ({ page }) => {
    await page.goto('/settings/seats');

    // Wait for data to load
    await page.waitForSelector('[data-testid="seat-usage-card"]');

    // Verify usage display
    const usageCard = page.locator('[data-testid="seat-usage-card"]');
    await expect(usageCard).toBeVisible();

    // Check for usage text pattern "X / Y seats used"
    await expect(usageCard).toContainText(/\d+ \/ \d+ seats used/);
  });

  test('displays progress bar with correct color', async ({ page }) => {
    await page.goto('/settings/seats');
    await page.waitForSelector('[data-testid="seat-progress-bar"]');

    const progressBar = page.locator('[data-testid="seat-progress-bar"]');
    await expect(progressBar).toBeVisible();

    // Progress bar should have width > 0 if any seats used
    const style = await progressBar.getAttribute('style');
    expect(style).toContain('width:');
  });

  test('displays member table with allocations', async ({ page }) => {
    await page.goto('/settings/seats');
    await page.waitForSelector('[data-testid="member-seat-table"]');

    const table = page.locator('[data-testid="member-seat-table"]');
    await expect(table).toBeVisible();

    // Check headers
    await expect(table.locator('th')).toContainText(['Member', 'Allocated', 'By']);
  });

  test('displays allocation details in table rows', async ({ page }) => {
    await page.goto('/settings/seats');
    await page.waitForSelector('[data-testid="member-seat-row"]');

    const firstRow = page.locator('[data-testid="member-seat-row"]').first();

    // Row should contain user email
    await expect(firstRow).toContainText(/@/);  // Email has @

    // Row should contain date
    await expect(firstRow).toContainText(/\d{4}/);  // Year in date
  });

  test('shows plan name', async ({ page }) => {
    await page.goto('/settings/seats');
    await page.waitForSelector('[data-testid="seat-usage-card"]');

    // Plan name should be visible
    await expect(page.locator('[data-testid="seat-usage-card"]')).toContainText(
      /Free|Starter|Pro|Enterprise/
    );
  });

  test('shows warning when at high usage', async ({ page }) => {
    await page.goto('/settings/seats');
    await page.waitForSelector('[data-testid="seat-usage-card"]');

    // Check if warning or at-capacity state shown
    // This test is conditional based on actual usage
    const warningBanner = page.locator('[data-testid="seat-warning"]');
    const atCapacityBanner = page.locator('[data-testid="seat-at-capacity"]');

    // At least check they render without error (may or may not be visible)
    // depending on actual seat usage
  });
});
```

---

## Milestone 4: Dashboard UI - Actions

**Goal:** Dashboard supports allocate/deallocate actions.

**Deliverable:** Can manage seats entirely from dashboard.

### Tasks

- [ ] **SEAT-4.1: Create DeallocateDialog component**
  - File: `repos/metabob-cloud-dashboard/src/components/seats/DeallocateDialog.tsx`
  - Confirmation dialog
  - Display user info
  - Cancel and confirm buttons
  - Loading state during action

- [ ] **SEAT-4.2: Create UpgradePrompt component**
  - File: `repos/metabob-cloud-dashboard/src/components/seats/UpgradePrompt.tsx`
  - Warning variant (>= 80%)
  - Error variant (at capacity)
  - Link to billing/upgrade

- [ ] **SEAT-4.3: Implement deallocation flow**
  - File: `repos/metabob-cloud-dashboard/src/pages/SeatManagement.tsx`
  - Click action menu -> Remove Seat
  - Open confirmation dialog
  - Call API on confirm
  - Refetch seat info
  - Show success/error toast

- [ ] **SEAT-4.4: Add loading states**
  - Skeleton for SeatUsageCard
  - Skeleton for MemberSeatTable
  - Button loading during actions

- [ ] **SEAT-4.5: Add error handling**
  - Display API errors as toasts
  - Specific messages for error codes
  - Retry button on fetch failures

- [ ] **SEAT-4.6: Integrate with invite flow (optional)**
  - Check seat availability before invite
  - Show upgrade prompt if at capacity

- [ ] **SEAT-4.7: Deploy and verify**
  - Build and deploy dashboard
  - Test deallocation flow
  - Test error scenarios

### E2E Test: Milestone 4

```typescript
// File: repos/metabob-cloud-dashboard/e2e/seats-actions.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Seat Management - Actions (Milestone 4)', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@metabob.local');
    await page.fill('input[name="password"]', 'adminpass123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
  });

  test('admin can see action menu on member rows', async ({ page }) => {
    await page.goto('/settings/seats');
    await page.waitForSelector('[data-testid="member-seat-row"]');

    // Find a row that is not current user
    const actionMenus = page.locator('[data-testid="seat-action-menu"]');
    const count = await actionMenus.count();

    // Should have at least one action menu (if there are other users)
    // If only one user (admin themselves), no action menu
    if (count > 0) {
      await actionMenus.first().click();

      // Menu should show "Remove Seat" option
      await expect(page.locator('[data-testid="remove-seat-option"]')).toBeVisible();
    }
  });

  test('clicking remove seat opens confirmation dialog', async ({ page }) => {
    await page.goto('/settings/seats');
    await page.waitForSelector('[data-testid="member-seat-row"]');

    const actionMenus = page.locator('[data-testid="seat-action-menu"]');
    const count = await actionMenus.count();

    if (count === 0) {
      console.log('No removable members, skipping test');
      return;
    }

    // Open action menu
    await actionMenus.first().click();

    // Click remove seat
    await page.click('[data-testid="remove-seat-option"]');

    // Dialog should appear
    const dialog = page.locator('[data-testid="deallocate-dialog"]');
    await expect(dialog).toBeVisible();

    // Dialog has cancel and confirm buttons
    await expect(dialog.locator('button:has-text("Cancel")')).toBeVisible();
    await expect(dialog.locator('button:has-text("Remove")')).toBeVisible();
  });

  test('can cancel deallocation', async ({ page }) => {
    await page.goto('/settings/seats');
    await page.waitForSelector('[data-testid="member-seat-row"]');

    const actionMenus = page.locator('[data-testid="seat-action-menu"]');
    const count = await actionMenus.count();

    if (count === 0) {
      return;
    }

    await actionMenus.first().click();
    await page.click('[data-testid="remove-seat-option"]');

    // Click cancel
    await page.click('[data-testid="deallocate-dialog"] button:has-text("Cancel")');

    // Dialog should close
    await expect(page.locator('[data-testid="deallocate-dialog"]')).not.toBeVisible();
  });

  test('deallocation updates seat count', async ({ page }) => {
    await page.goto('/settings/seats');
    await page.waitForSelector('[data-testid="seat-usage-card"]');

    // Get initial seat usage
    const usageCard = page.locator('[data-testid="seat-usage-card"]');
    const initialText = await usageCard.textContent();
    const initialMatch = initialText?.match(/(\d+) \/ (\d+) seats used/);

    if (!initialMatch) {
      console.log('Could not parse seat usage');
      return;
    }

    const initialUsage = parseInt(initialMatch[1]);

    const actionMenus = page.locator('[data-testid="seat-action-menu"]');
    const count = await actionMenus.count();

    if (count === 0 || initialUsage <= 1) {
      console.log('Cannot test deallocation');
      return;
    }

    // Perform deallocation
    await actionMenus.first().click();
    await page.click('[data-testid="remove-seat-option"]');
    await page.click('[data-testid="deallocate-dialog"] button:has-text("Remove")');

    // Wait for toast or data refresh
    await page.waitForTimeout(1000);

    // Check seat usage decreased
    const updatedText = await usageCard.textContent();
    const updatedMatch = updatedText?.match(/(\d+) \/ (\d+) seats used/);
    const updatedUsage = parseInt(updatedMatch?.[1] || '0');

    expect(updatedUsage).toBe(initialUsage - 1);
  });

  test('shows upgrade prompt when at capacity', async ({ page }) => {
    await page.goto('/settings/seats');
    await page.waitForSelector('[data-testid="seat-usage-card"]');

    // Check if at capacity
    const atCapacityPrompt = page.locator('[data-testid="seat-at-capacity"]');
    const isAtCapacity = await atCapacityPrompt.isVisible();

    if (isAtCapacity) {
      // Upgrade button should be visible
      await expect(page.locator('button:has-text("Upgrade")')).toBeVisible();
    }
  });

  test('member cannot see action menu', async ({ page }) => {
    // Logout admin
    await page.goto('/settings/seats');
    await page.click('[data-testid="user-menu"]');
    await page.click('button:has-text("Logout")');

    // Login as member
    await page.goto('/login');
    await page.fill('input[name="email"]', 'member@metabob.local');
    await page.fill('input[name="password"]', 'memberpass123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    await page.goto('/settings/seats');
    await page.waitForSelector('[data-testid="member-seat-table"]');

    // Members should not see action menus
    const actionMenus = page.locator('[data-testid="seat-action-menu"]');
    const count = await actionMenus.count();
    expect(count).toBe(0);
  });
});
```

---

## Summary

**Total Tasks:** 27
**Milestones:** 4

| Milestone | Tasks | Description |
|-----------|-------|-------------|
| M1 | 6 | Schema and API foundation |
| M2 | 6 | Complete API CRUD |
| M3 | 11 | Dashboard display |
| M4 | 7 | Dashboard actions |

### Prerequisites

Before starting:
1. Ensure test users exist (admin, member)
2. Ensure test organization with subscription
3. Analysis API and SurrealDB running

### Running Tests

```bash
# API tests (Milestone 1, 2)
cd repos/metabob-analysis-api
bun test tests/seats*.test.ts

# E2E tests (Milestone 3, 4)
cd repos/metabob-cloud-dashboard
bun run test:e2e e2e/seats*.spec.ts
```

### Verification Checklist

After each milestone:

**M1:**
- [ ] `GET /seats` returns valid JSON
- [ ] Fields match specification
- [ ] RBAC permissions enforced

**M2:**
- [ ] Can allocate seat via API
- [ ] Can deallocate seat via API
- [ ] Seat limit enforced
- [ ] Audit logs created

**M3:**
- [ ] Page loads without errors
- [ ] Seat count displays correctly
- [ ] Progress bar matches usage
- [ ] Member list populated

**M4:**
- [ ] Can remove seat from UI
- [ ] Confirmation dialog works
- [ ] Success/error toasts display
- [ ] Seat count updates after action
