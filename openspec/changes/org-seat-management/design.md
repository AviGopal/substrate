# Organization Seat Management - Design Document

**Status:** Draft
**Created:** 2026-03-25
**Updated:** 2026-03-25
**Author:** System (via Claude Code)
**Type:** Full-Stack Feature

---

## Overview

Seat management enables organizations to track and control user access based on their subscription tier. This document details the technical design for implementing seat visibility, allocation, and enforcement across the stack.

## Architecture

### Service Ownership

```
┌─────────────────────────────────────────────────────────────────┐
│                        Data Flow                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │ metabob-cloud-   │    │ metabob-         │                   │
│  │ dashboard        │───▶│ analysis-api     │                   │
│  │                  │    │                  │                   │
│  │ - Display UI     │    │ - Seat CRUD      │                   │
│  │ - User actions   │    │ - Enforcement    │                   │
│  └──────────────────┘    │ - Audit logging  │                   │
│                          └────────┬─────────┘                   │
│                                   │                              │
│                                   ▼                              │
│                          ┌──────────────────┐                   │
│                          │ SurrealDB        │                   │
│                          │                  │                   │
│                          │ - organizations  │                   │
│                          │ - subscriptions  │                   │
│                          │ - users          │                   │
│                          │ - seat_allocs    │                   │
│                          │ - audit_logs     │                   │
│                          └──────────────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Table Ownership

| Table | Owner Service | Read Access | Write Access |
|-------|--------------|-------------|--------------|
| `organizations` | analysis-api | all services | analysis-api |
| `subscriptions` | analysis-api | all services | analysis-api (+ Stripe webhooks) |
| `users` | analysis-api | all services | analysis-api |
| `seat_allocations` | analysis-api | all services | analysis-api |
| `audit_logs` | analysis-api | analysis-api | all services (write-only) |

---

## Database Schema

### New Table: seat_allocations

```sql
-- Tracks which users occupy seats in an organization
-- Source of truth for seat_usage count

DEFINE TABLE IF NOT EXISTS seat_allocations SCHEMAFULL
  PERMISSIONS
    -- Users can view allocations in their org
    FOR select WHERE org_id = $auth.org_id
    -- Only admins can allocate/deallocate seats
    FOR create WHERE $auth.role IN ['admin', 'owner'] AND org_id = $auth.org_id
    FOR delete WHERE $auth.role IN ['admin', 'owner'] AND org_id = $auth.org_id
    -- No updates - delete and recreate for changes
    FOR update NONE;

-- Core fields
DEFINE FIELD IF NOT EXISTS org_id ON seat_allocations TYPE record<organizations>
  ASSERT $value != NONE
  VALUE $value;

DEFINE FIELD IF NOT EXISTS user_id ON seat_allocations TYPE record<users>
  ASSERT $value != NONE
  VALUE $value;

DEFINE FIELD IF NOT EXISTS allocated_at ON seat_allocations TYPE datetime
  VALUE $value OR time::now()
  DEFAULT time::now();

-- Who allocated this seat (null for system/migration)
DEFINE FIELD IF NOT EXISTS allocated_by ON seat_allocations TYPE option<record<users>>
  VALUE $value;

-- Optional: reason for allocation (invite, migration, reassignment)
DEFINE FIELD IF NOT EXISTS allocation_reason ON seat_allocations TYPE option<string>
  VALUE $value;

-- Indexes for efficient queries
DEFINE INDEX IF NOT EXISTS idx_seat_alloc_org ON seat_allocations FIELDS org_id;
DEFINE INDEX IF NOT EXISTS idx_seat_alloc_user ON seat_allocations FIELDS user_id UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_seat_alloc_org_user ON seat_allocations FIELDS org_id, user_id UNIQUE;
```

### Schema Updates: organizations

The `organizations` table already has `seat_limit` and `seat_usage`. We need to ensure these are properly maintained:

```sql
-- No schema changes needed, but add a computed field view for real-time count
-- This can be a query pattern rather than a stored field

-- Query pattern for accurate seat_usage:
-- SELECT *, (SELECT count() FROM seat_allocations WHERE org_id = $parent.id)[0].count AS computed_seat_usage
-- FROM organizations WHERE id = $org_id
```

### Schema Updates: subscriptions

Add seat limit by plan:

```sql
-- Add plan-to-seat-limit mapping as a function
-- Plans: free=1, starter=3, pro=10, enterprise=unlimited (999999)

DEFINE FUNCTION IF NOT EXISTS fn::get_seat_limit_for_plan($plan: string) {
  RETURN IF $plan = 'free' THEN 1
    ELSE IF $plan = 'starter' THEN 3
    ELSE IF $plan = 'pro' THEN 10
    ELSE IF $plan = 'enterprise' THEN 999999
    ELSE 1
    END
  ;
};
```

---

## TypeScript Interfaces

### API Types

```typescript
// repos/metabob-analysis-api/src/types/seats.ts

export interface SeatAllocation {
  id: string;
  org_id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  allocated_at: string;        // ISO datetime
  allocated_by: string | null; // user_id or null for system
  allocation_reason?: string;
}

export interface SeatInfo {
  seat_limit: number;
  seat_usage: number;
  plan: SubscriptionPlan;
  plan_name: string;
  allocations: SeatAllocation[];
  can_add_members: boolean;    // seat_usage < seat_limit
  seats_remaining: number;     // seat_limit - seat_usage
  usage_percentage: number;    // (seat_usage / seat_limit) * 100
  warning_threshold: boolean;  // usage >= 80%
  at_capacity: boolean;        // usage >= 100%
  upgrade_available: boolean;  // !enterprise
  upgrade_path: SubscriptionPlan | null;
}

export interface SeatAvailability {
  available: boolean;
  remaining: number;
  upgrade_path: SubscriptionPlan | null;
  message: string;
}

export interface AllocateSeatRequest {
  user_id: string;
  reason?: string;
}

export interface AllocateSeatResponse {
  allocation: SeatAllocation;
  seat_info: SeatInfo;
}

export interface DeallocateSeatResponse {
  deallocated_user_id: string;
  seat_info: SeatInfo;
}

export type SubscriptionPlan = 'free' | 'starter' | 'pro' | 'enterprise';

export const PLAN_SEAT_LIMITS: Record<SubscriptionPlan, number> = {
  free: 1,
  starter: 3,
  pro: 10,
  enterprise: 999999,
};

export const PLAN_DISPLAY_NAMES: Record<SubscriptionPlan, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

export const PLAN_UPGRADE_PATH: Record<SubscriptionPlan, SubscriptionPlan | null> = {
  free: 'starter',
  starter: 'pro',
  pro: 'enterprise',
  enterprise: null,
};
```

### Dashboard Types

```typescript
// repos/metabob-cloud-dashboard/src/types/seats.ts

export interface SeatInfo {
  seat_limit: number;
  seat_usage: number;
  plan: string;
  plan_name: string;
  allocations: SeatAllocation[];
  can_add_members: boolean;
  seats_remaining: number;
  usage_percentage: number;
  warning_threshold: boolean;
  at_capacity: boolean;
  upgrade_available: boolean;
  upgrade_path: string | null;
}

export interface SeatAllocation {
  id: string;
  org_id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  allocated_at: string;
  allocated_by: string | null;
  allocation_reason?: string;
}

export interface SeatAvailability {
  available: boolean;
  remaining: number;
  upgrade_path: string | null;
  message: string;
}
```

---

## API Endpoints

### GET /v2/orgs/:orgId/seats

Get complete seat information for an organization.

**Authorization:** Any authenticated user in the organization

**Response:**
```json
{
  "success": true,
  "data": {
    "seat_limit": 10,
    "seat_usage": 4,
    "plan": "pro",
    "plan_name": "Pro",
    "allocations": [
      {
        "id": "seat_allocations:abc123",
        "org_id": "organizations:acme",
        "user_id": "users:alice",
        "user_email": "alice@acme.com",
        "user_name": "Alice Smith",
        "allocated_at": "2026-03-15T10:30:00Z",
        "allocated_by": null,
        "allocation_reason": "migration"
      }
    ],
    "can_add_members": true,
    "seats_remaining": 6,
    "usage_percentage": 40,
    "warning_threshold": false,
    "at_capacity": false,
    "upgrade_available": true,
    "upgrade_path": "enterprise"
  }
}
```

**Implementation:**

```typescript
// GET /v2/orgs/:orgId/seats
seatsRoutes.get('/:orgId/seats', async (c) => {
  const db = c.get('surrealDB');
  const orgIdParam = c.req.param('orgId');
  const userOrgId = c.get('orgId');

  // Verify user belongs to this org
  if (orgIdParam !== userOrgId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
  }

  // Get organization with subscription
  const [org] = await db.query(`
    SELECT
      id,
      name,
      seat_limit,
      (SELECT count() FROM seat_allocations WHERE org_id = $parent.id)[0].count AS seat_usage
    FROM organizations
    WHERE id = $orgId
    LIMIT 1
  `, { orgId: orgIdParam });

  // Get subscription plan
  const [sub] = await db.query(`
    SELECT plan FROM subscriptions WHERE org_id = $orgId LIMIT 1
  `, { orgId: orgIdParam });

  // Get allocations with user details
  const allocations = await db.query(`
    SELECT
      id,
      org_id,
      user_id,
      (SELECT email FROM users WHERE id = $parent.user_id)[0].email AS user_email,
      (SELECT name FROM users WHERE id = $parent.user_id)[0].name AS user_name,
      allocated_at,
      allocated_by,
      allocation_reason
    FROM seat_allocations
    WHERE org_id = $orgId
    ORDER BY allocated_at ASC
  `, { orgId: orgIdParam });

  const plan = sub?.plan || 'free';
  const seatLimit = org?.seat_limit || PLAN_SEAT_LIMITS[plan];
  const seatUsage = org?.seat_usage || 0;
  const usagePercentage = seatLimit > 0 ? (seatUsage / seatLimit) * 100 : 0;

  return c.json({
    success: true,
    data: {
      seat_limit: seatLimit,
      seat_usage: seatUsage,
      plan,
      plan_name: PLAN_DISPLAY_NAMES[plan],
      allocations,
      can_add_members: seatUsage < seatLimit,
      seats_remaining: Math.max(0, seatLimit - seatUsage),
      usage_percentage: Math.round(usagePercentage),
      warning_threshold: usagePercentage >= 80,
      at_capacity: seatUsage >= seatLimit,
      upgrade_available: plan !== 'enterprise',
      upgrade_path: PLAN_UPGRADE_PATH[plan],
    },
  });
});
```

### POST /v2/orgs/:orgId/seats/allocate

Allocate a seat to a user.

**Authorization:** Admin or owner role required

**Request:**
```json
{
  "user_id": "users:bob",
  "reason": "new_hire"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "allocation": {
      "id": "seat_allocations:xyz789",
      "org_id": "organizations:acme",
      "user_id": "users:bob",
      "user_email": "bob@acme.com",
      "user_name": "Bob Jones",
      "allocated_at": "2026-03-25T14:30:00Z",
      "allocated_by": "users:alice",
      "allocation_reason": "new_hire"
    },
    "seat_info": { /* full SeatInfo object */ }
  }
}
```

**Error Responses:**

- `409 SEAT_LIMIT_EXCEEDED`: Organization is at seat capacity
- `409 USER_ALREADY_ALLOCATED`: User already has a seat
- `404 USER_NOT_FOUND`: User doesn't exist in organization
- `403 FORBIDDEN`: Caller is not admin/owner

**Implementation:**

```typescript
// POST /v2/orgs/:orgId/seats/allocate
seatsRoutes.post('/:orgId/seats/allocate', zValidator('json', allocateSeatSchema), async (c) => {
  const db = c.get('surrealDB');
  const orgIdParam = c.req.param('orgId');
  const userOrgId = c.get('orgId');
  const callerRole = c.get('role');
  const callerId = c.get('userId');
  const { user_id, reason } = c.req.valid('json');

  // Verify permissions
  if (orgIdParam !== userOrgId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
  }

  if (!['admin', 'owner'].includes(callerRole)) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Admin role required' } }, 403);
  }

  // Check seat availability
  const [org] = await db.query(`
    SELECT
      seat_limit,
      (SELECT count() FROM seat_allocations WHERE org_id = $parent.id)[0].count AS seat_usage
    FROM organizations
    WHERE id = $orgId
    LIMIT 1
  `, { orgId: orgIdParam });

  if (org.seat_usage >= org.seat_limit) {
    return c.json({
      error: {
        code: 'SEAT_LIMIT_EXCEEDED',
        message: 'Organization has reached its seat limit',
        suggestion: 'Upgrade your plan or deallocate an existing seat',
      },
    }, 409);
  }

  // Verify user exists in org
  const [user] = await db.query(`
    SELECT id, email, name FROM users
    WHERE id = $userId AND org_id = $orgId
    LIMIT 1
  `, { userId: user_id, orgId: orgIdParam });

  if (!user) {
    return c.json({
      error: { code: 'USER_NOT_FOUND', message: 'User not found in organization' },
    }, 404);
  }

  // Check if already allocated
  const [existing] = await db.query(`
    SELECT id FROM seat_allocations WHERE user_id = $userId LIMIT 1
  `, { userId: user_id });

  if (existing) {
    return c.json({
      error: { code: 'USER_ALREADY_ALLOCATED', message: 'User already has a seat allocated' },
    }, 409);
  }

  // Create allocation
  const [allocation] = await db.query(`
    CREATE seat_allocations SET
      org_id = $orgId,
      user_id = $userId,
      allocated_at = time::now(),
      allocated_by = $allocatedBy,
      allocation_reason = $reason
  `, {
    orgId: orgIdParam,
    userId: user_id,
    allocatedBy: callerId,
    reason: reason || 'manual',
  });

  // Log audit event
  await db.query(`
    CREATE audit_logs SET
      org_id = $orgId,
      user_id = $callerId,
      action = 'create',
      resource_type = 'seat_allocation',
      resource_id = $allocationId,
      timestamp = time::now(),
      details = { user_id: $userId, reason: $reason }
  `, {
    orgId: orgIdParam,
    callerId,
    allocationId: allocation.id,
    userId: user_id,
    reason: reason || 'manual',
  });

  // Return full seat info
  const seatInfo = await getSeatInfo(db, orgIdParam);

  return c.json({
    success: true,
    data: {
      allocation: {
        ...allocation,
        user_email: user.email,
        user_name: user.name,
      },
      seat_info: seatInfo,
    },
  }, 201);
});
```

### DELETE /v2/orgs/:orgId/seats/:userId

Deallocate a seat from a user.

**Authorization:** Admin or owner role required

**Response:**
```json
{
  "success": true,
  "data": {
    "deallocated_user_id": "users:bob",
    "seat_info": { /* full SeatInfo object */ }
  }
}
```

### GET /v2/orgs/:orgId/seats/available

Quick check for seat availability (useful before invite flow).

**Response:**
```json
{
  "success": true,
  "data": {
    "available": true,
    "remaining": 6,
    "upgrade_path": "enterprise",
    "message": "6 seats available"
  }
}
```

---

## Dashboard Components

### Component Hierarchy

```
src/
├── pages/
│   └── SeatManagement.tsx       # Main page
├── components/
│   ├── seats/
│   │   ├── SeatUsageCard.tsx    # Summary card
│   │   ├── SeatProgressBar.tsx  # Visual progress
│   │   ├── MemberSeatTable.tsx  # Allocation list
│   │   ├── MemberSeatRow.tsx    # Table row
│   │   ├── DeallocateDialog.tsx # Confirmation modal
│   │   └── UpgradePrompt.tsx    # Upgrade CTA
│   └── ...
├── hooks/
│   └── useSeats.ts              # Data fetching hook
└── lib/
    └── api/
        └── seats.ts             # API client
```

### SeatUsageCard Component

```tsx
// src/components/seats/SeatUsageCard.tsx

interface SeatUsageCardProps {
  seatInfo: SeatInfo;
  onManageClick?: () => void;
}

export function SeatUsageCard({ seatInfo, onManageClick }: SeatUsageCardProps) {
  const {
    seat_usage,
    seat_limit,
    usage_percentage,
    warning_threshold,
    at_capacity,
    plan_name,
  } = seatInfo;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Seats
        </CardTitle>
        <CardDescription>{plan_name} Plan</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Usage display */}
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{seat_usage}</span>
            <span className="text-muted-foreground">/ {seat_limit} seats used</span>
          </div>

          {/* Progress bar */}
          <SeatProgressBar
            usage={seat_usage}
            limit={seat_limit}
            percentage={usage_percentage}
            warning={warning_threshold}
            atCapacity={at_capacity}
          />

          {/* Warning/capacity messages */}
          {at_capacity && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>At capacity - upgrade to add more members</span>
            </div>
          )}
          {warning_threshold && !at_capacity && (
            <div className="flex items-center gap-2 text-warning text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>Approaching seat limit</span>
            </div>
          )}
        </div>
      </CardContent>
      {onManageClick && (
        <CardFooter>
          <Button variant="outline" onClick={onManageClick}>
            Manage Seats
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
```

### SeatProgressBar Component

```tsx
// src/components/seats/SeatProgressBar.tsx

interface SeatProgressBarProps {
  usage: number;
  limit: number;
  percentage: number;
  warning: boolean;
  atCapacity: boolean;
}

export function SeatProgressBar({
  usage,
  limit,
  percentage,
  warning,
  atCapacity,
}: SeatProgressBarProps) {
  const getColor = () => {
    if (atCapacity) return 'bg-destructive';
    if (warning) return 'bg-warning';
    return 'bg-success';
  };

  return (
    <div className="w-full">
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${getColor()}`}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>{usage} used</span>
        <span>{limit - usage} available</span>
      </div>
    </div>
  );
}
```

### MemberSeatTable Component

```tsx
// src/components/seats/MemberSeatTable.tsx

interface MemberSeatTableProps {
  allocations: SeatAllocation[];
  onDeallocate: (userId: string) => void;
  canDeallocate: boolean;
  currentUserId: string;
}

export function MemberSeatTable({
  allocations,
  onDeallocate,
  canDeallocate,
  currentUserId,
}: MemberSeatTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Member</TableHead>
          <TableHead>Allocated</TableHead>
          <TableHead>By</TableHead>
          <TableHead className="w-[100px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {allocations.map((allocation) => (
          <MemberSeatRow
            key={allocation.id}
            allocation={allocation}
            onDeallocate={onDeallocate}
            canDeallocate={canDeallocate && allocation.user_id !== currentUserId}
          />
        ))}
      </TableBody>
    </Table>
  );
}
```

### SeatManagement Page

```tsx
// src/pages/SeatManagement.tsx

export function SeatManagement() {
  const { seatInfo, isLoading, error, refetch } = useSeats();
  const { user } = useAuth();
  const [showDeallocate, setShowDeallocate] = useState<string | null>(null);

  const handleDeallocate = async (userId: string) => {
    try {
      await deallocateSeat(userId);
      refetch();
      toast.success('Seat deallocated');
    } catch (err) {
      toast.error('Failed to deallocate seat');
    }
  };

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorMessage error={error} />;
  if (!seatInfo) return null;

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Seat Management</h1>
          <p className="text-muted-foreground">
            Manage who has access to your organization
          </p>
        </div>
        {seatInfo.upgrade_available && (
          <Button variant="outline">
            Upgrade Plan
          </Button>
        )}
      </div>

      {/* Summary card */}
      <SeatUsageCard seatInfo={seatInfo} />

      {/* Upgrade prompt if at capacity */}
      {seatInfo.at_capacity && <UpgradePrompt plan={seatInfo.plan} />}

      {/* Member list */}
      <Card>
        <CardHeader>
          <CardTitle>Members with Seats</CardTitle>
          <CardDescription>
            {seatInfo.seat_usage} member{seatInfo.seat_usage !== 1 ? 's' : ''} allocated
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MemberSeatTable
            allocations={seatInfo.allocations}
            onDeallocate={(userId) => setShowDeallocate(userId)}
            canDeallocate={isAdmin}
            currentUserId={user?.id || ''}
          />
        </CardContent>
      </Card>

      {/* Deallocate confirmation dialog */}
      <DeallocateDialog
        open={!!showDeallocate}
        userId={showDeallocate}
        onConfirm={() => {
          if (showDeallocate) {
            handleDeallocate(showDeallocate);
          }
          setShowDeallocate(null);
        }}
        onCancel={() => setShowDeallocate(null)}
      />
    </div>
  );
}
```

### useSeats Hook

```typescript
// src/hooks/useSeats.ts

import { useState, useEffect, useCallback } from 'react';
import { getSeatInfo, allocateSeat, deallocateSeat } from '@/lib/api/seats';
import type { SeatInfo } from '@/types/seats';

export function useSeats() {
  const [seatInfo, setSeatInfo] = useState<SeatInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSeats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getSeatInfo();
      if (response.error) {
        setError(response.error.message);
        return;
      }
      setSeatInfo(response.data || null);
    } catch (err) {
      setError('Failed to load seat information');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSeats();
  }, [fetchSeats]);

  return {
    seatInfo,
    isLoading,
    error,
    refetch: fetchSeats,
  };
}
```

### API Client

```typescript
// src/lib/api/seats.ts

import { get, post, del, type ApiResponse } from './client';
import type { SeatInfo, SeatAllocation, SeatAvailability } from '@/types/seats';

const API_BASE = import.meta.env.VITE_ANALYSIS_API_URL || '';

export async function getSeatInfo(): Promise<ApiResponse<SeatInfo>> {
  return get<SeatInfo>(`${API_BASE}/v2/orgs/current/seats`);
}

export async function getSeatAvailability(): Promise<ApiResponse<SeatAvailability>> {
  return get<SeatAvailability>(`${API_BASE}/v2/orgs/current/seats/available`);
}

export async function allocateSeat(
  userId: string,
  reason?: string
): Promise<ApiResponse<{ allocation: SeatAllocation; seat_info: SeatInfo }>> {
  return post(`${API_BASE}/v2/orgs/current/seats/allocate`, {
    user_id: userId,
    reason,
  });
}

export async function deallocateSeat(
  userId: string
): Promise<ApiResponse<{ deallocated_user_id: string; seat_info: SeatInfo }>> {
  return del(`${API_BASE}/v2/orgs/current/seats/${userId}`);
}
```

---

## Data Flow Diagrams

### Load Seat Info

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│  Dashboard  │     │  analysis-api   │     │  SurrealDB   │
└──────┬──────┘     └────────┬────────┘     └──────┬───────┘
       │                     │                      │
       │ GET /seats          │                      │
       │────────────────────▶│                      │
       │                     │ SELECT organizations │
       │                     │─────────────────────▶│
       │                     │◀─────────────────────│
       │                     │                      │
       │                     │ SELECT subscriptions │
       │                     │─────────────────────▶│
       │                     │◀─────────────────────│
       │                     │                      │
       │                     │ SELECT seat_allocs   │
       │                     │   + JOIN users       │
       │                     │─────────────────────▶│
       │                     │◀─────────────────────│
       │                     │                      │
       │ SeatInfo response   │                      │
       │◀────────────────────│                      │
       │                     │                      │
```

### Allocate Seat

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│  Dashboard  │     │  analysis-api   │     │  SurrealDB   │
└──────┬──────┘     └────────┬────────┘     └──────┬───────┘
       │                     │                      │
       │ POST /allocate      │                      │
       │────────────────────▶│                      │
       │                     │                      │
       │                     │ Check seat_limit     │
       │                     │─────────────────────▶│
       │                     │◀─────────────────────│
       │                     │                      │
       │                     │ [If limit reached]   │
       │ 409 SEAT_LIMIT_     │                      │
       │ EXCEEDED            │                      │
       │◀────────────────────│                      │
       │                     │                      │
       │                     │ [If available]       │
       │                     │ Verify user exists   │
       │                     │─────────────────────▶│
       │                     │◀─────────────────────│
       │                     │                      │
       │                     │ Check existing alloc │
       │                     │─────────────────────▶│
       │                     │◀─────────────────────│
       │                     │                      │
       │                     │ CREATE seat_alloc    │
       │                     │─────────────────────▶│
       │                     │◀─────────────────────│
       │                     │                      │
       │                     │ CREATE audit_log     │
       │                     │─────────────────────▶│
       │                     │◀─────────────────────│
       │                     │                      │
       │ Allocation + Info   │                      │
       │◀────────────────────│                      │
       │                     │                      │
```

---

## Field Source Documentation

### SeatInfo Response Fields

| Field | Source | Owner | Notes |
|-------|--------|-------|-------|
| `seat_limit` | organizations.seat_limit | analysis-api | Synced from subscription |
| `seat_usage` | COUNT(seat_allocations) | computed | Real-time count |
| `plan` | subscriptions.plan | analysis-api | From Stripe webhook |
| `plan_name` | PLAN_DISPLAY_NAMES[plan] | computed | Static mapping |
| `allocations[]` | seat_allocations JOIN users | analysis-api | Dynamic join |
| `can_add_members` | seat_usage < seat_limit | computed | Business logic |
| `seats_remaining` | seat_limit - seat_usage | computed | Math |
| `usage_percentage` | (usage/limit) * 100 | computed | Math |
| `warning_threshold` | usage_percentage >= 80 | computed | Business rule |
| `at_capacity` | seat_usage >= seat_limit | computed | Business logic |
| `upgrade_available` | plan !== 'enterprise' | computed | Business rule |
| `upgrade_path` | PLAN_UPGRADE_PATH[plan] | computed | Static mapping |

### SeatAllocation Fields

| Field | Source | Owner | Notes |
|-------|--------|-------|-------|
| `id` | seat_allocations.id | SurrealDB | Auto-generated |
| `org_id` | seat_allocations.org_id | analysis-api | Foreign key |
| `user_id` | seat_allocations.user_id | analysis-api | Foreign key |
| `user_email` | users.email (JOIN) | analysis-api | Denormalized in response |
| `user_name` | users.name (JOIN) | analysis-api | Denormalized in response |
| `allocated_at` | seat_allocations.allocated_at | analysis-api | Timestamp |
| `allocated_by` | seat_allocations.allocated_by | analysis-api | Foreign key, nullable |
| `allocation_reason` | seat_allocations.allocation_reason | analysis-api | Optional string |

---

## Error Handling

### API Error Codes

| Code | HTTP Status | Description | User Message |
|------|-------------|-------------|--------------|
| `SEAT_LIMIT_EXCEEDED` | 409 | Org at capacity | "Your organization has reached its seat limit. Upgrade your plan or remove an existing member." |
| `USER_ALREADY_ALLOCATED` | 409 | User has seat | "This user already has a seat allocated." |
| `USER_NOT_FOUND` | 404 | User not in org | "User not found in your organization." |
| `CANNOT_DEALLOCATE_SELF` | 400 | Self-removal | "You cannot remove your own seat allocation." |
| `FORBIDDEN` | 403 | Not admin | "Admin privileges required to manage seats." |

### Dashboard Error Handling

```typescript
// Error display pattern
function handleSeatError(error: ApiError) {
  switch (error.code) {
    case 'SEAT_LIMIT_EXCEEDED':
      return {
        title: 'Seat Limit Reached',
        message: error.message,
        action: { label: 'Upgrade Plan', href: '/settings/billing' },
      };
    case 'USER_ALREADY_ALLOCATED':
      return {
        title: 'Already Allocated',
        message: 'This member already has a seat.',
      };
    default:
      return {
        title: 'Error',
        message: error.message || 'An unexpected error occurred',
      };
  }
}
```

---

## Migration Strategy

### Backfill Existing Users

All existing active users need seat allocations created:

```sql
-- Migration script: backfill_seat_allocations.surql

-- For each org, create allocations for existing active users
LET $orgs = SELECT id FROM organizations;

FOR $org IN $orgs {
  LET $users = SELECT id FROM users WHERE org_id = $org.id AND is_active = true;

  FOR $user IN $users {
    -- Create allocation if doesn't exist
    IF (SELECT count() FROM seat_allocations WHERE user_id = $user.id)[0].count = 0 {
      CREATE seat_allocations SET
        org_id = $org.id,
        user_id = $user.id,
        allocated_at = $user.created_at,
        allocated_by = NONE,
        allocation_reason = 'migration';
    };
  };

  -- Update org seat_usage
  UPDATE $org.id SET
    seat_usage = (SELECT count() FROM seat_allocations WHERE org_id = $org.id)[0].count;
};
```

### Soft Enforcement

For organizations already over their limit:

1. Display warning but don't block existing users
2. Prevent NEW allocations until under limit
3. Provide clear path to upgrade or deallocate

---

## Performance Considerations

### Query Optimization

1. **Indexed queries**: All seat queries use indexed fields
2. **Aggregation**: seat_usage is computed, not stored (avoid sync issues)
3. **Pagination**: Member list supports pagination for large orgs
4. **Caching**: Dashboard caches seat info for 30 seconds

### Load Testing Targets

| Operation | Target | Max |
|-----------|--------|-----|
| GET /seats | 50ms | 200ms |
| POST /allocate | 100ms | 500ms |
| DELETE /deallocate | 100ms | 500ms |
| GET /available | 25ms | 100ms |

---

## Security Considerations

### Authorization Matrix

| Operation | Owner | Admin | Member |
|-----------|-------|-------|--------|
| View seats | Yes | Yes | Yes |
| Allocate seat | Yes | Yes | No |
| Deallocate seat | Yes | Yes | No |
| Deallocate self | No | No | No |
| View other orgs | No | No | No |

### Audit Trail

All seat changes are logged to `audit_logs`:

```typescript
{
  action: 'create' | 'delete',
  resource_type: 'seat_allocation',
  resource_id: allocation.id,
  details: {
    user_id: affected_user_id,
    reason: allocation_reason,
  },
}
```

---

## Testing Strategy

### Unit Tests

- Seat limit calculations
- Plan mapping functions
- UI component rendering

### Integration Tests

- API endpoint responses
- Database RBAC enforcement
- Allocation/deallocation flows

### E2E Tests

- Full seat management flow
- Error scenarios
- Upgrade prompts

See [tasks.md](./tasks.md) for detailed test specifications.

---

## References

- Proposal: [proposal.md](./proposal.md)
- Tasks: [tasks.md](./tasks.md)
- Schema contracts: [specs/schema-contracts.md](./specs/schema-contracts.md)
- API contracts: [specs/api-contracts.md](./specs/api-contracts.md)
