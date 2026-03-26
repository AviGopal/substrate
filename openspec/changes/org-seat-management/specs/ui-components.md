# UI Components - Organization Seat Management

**Created:** 2026-03-25
**Updated:** 2026-03-25
**Repo:** repos/metabob-cloud-dashboard

---

## Overview

This document specifies the React components for the seat management feature in the cloud dashboard. Components follow existing patterns from the metabob-cloud-dashboard codebase.

## File Structure

```
repos/metabob-cloud-dashboard/src/
├── pages/
│   └── SeatManagement.tsx           # Main page component
├── components/
│   └── seats/
│       ├── SeatUsageCard.tsx        # Overview card
│       ├── SeatProgressBar.tsx      # Visual progress
│       ├── MemberSeatTable.tsx      # Allocation list
│       ├── MemberSeatRow.tsx        # Table row
│       ├── DeallocateDialog.tsx     # Confirmation modal
│       ├── UpgradePrompt.tsx        # Upgrade CTA
│       └── index.ts                 # Barrel export
├── hooks/
│   └── useSeats.ts                  # Data fetching hook
├── lib/
│   └── api/
│       └── seats.ts                 # API client
└── types/
    └── seats.ts                     # TypeScript types
```

---

## Components

### SeatUsageCard

Summary card showing current seat usage.

**File:** `src/components/seats/SeatUsageCard.tsx`

**Props:**

```typescript
interface SeatUsageCardProps {
  seatInfo: SeatInfo;
  onManageClick?: () => void;
  compact?: boolean;
}
```

**Design:**

```
┌─────────────────────────────────────────────┐
│ [Users Icon]                                │
│                                             │
│ 4                                          │
│ / 10 seats used                            │
│                                             │
│ ████████░░░░░░░░░░░░░░░░ 40%               │
│ 4 used                      6 available     │
│                                             │
│ Pro Plan                                    │
│                                             │
│                        [Manage Seats]       │
└─────────────────────────────────────────────┘
```

**States:**

1. **Normal** (< 80%): Green progress bar
2. **Warning** (>= 80%): Amber/orange progress bar, warning message
3. **At Capacity** (>= 100%): Red progress bar, error message

**Usage:**

```tsx
<SeatUsageCard
  seatInfo={seatInfo}
  onManageClick={() => navigate('/settings/seats')}
/>
```

---

### SeatProgressBar

Visual representation of seat usage.

**File:** `src/components/seats/SeatProgressBar.tsx`

**Props:**

```typescript
interface SeatProgressBarProps {
  usage: number;
  limit: number;
  percentage: number;
  warning: boolean;
  atCapacity: boolean;
  showLabels?: boolean;
}
```

**Styling:**

```css
/* Normal state */
.progress-bar-normal {
  background: var(--success-main);  /* #18bf80 */
}

/* Warning state (>= 80%) */
.progress-bar-warning {
  background: var(--warning);  /* rgba(255, 171, 112, 0.75) */
}

/* At capacity (>= 100%) */
.progress-bar-error {
  background: var(--error-main);  /* #ff3c54 */
}
```

---

### MemberSeatTable

Table displaying all seat allocations.

**File:** `src/components/seats/MemberSeatTable.tsx`

**Props:**

```typescript
interface MemberSeatTableProps {
  allocations: SeatAllocation[];
  onDeallocate: (userId: string) => void;
  canDeallocate: boolean;
  currentUserId: string;
}
```

**Design:**

```
┌───────────────────────────────────────────────────────────────┐
│ Member                     │ Allocated      │ By      │       │
├────────────────────────────┼────────────────┼─────────┼───────┤
│ [Avatar] Alice Smith       │ Mar 15, 2026   │ System  │       │
│          alice@acme.com    │                │         │       │
├────────────────────────────┼────────────────┼─────────┼───────┤
│ [Avatar] Bob Jones         │ Mar 20, 2026   │ Alice   │ [...] │
│          bob@acme.com      │                │         │       │
└────────────────────────────┴────────────────┴─────────┴───────┘
```

**Features:**

- Sort by allocation date
- Search/filter members
- Actions dropdown for each row
- Current user row is highlighted, cannot be deallocated

---

### MemberSeatRow

Individual row in the member table.

**File:** `src/components/seats/MemberSeatRow.tsx`

**Props:**

```typescript
interface MemberSeatRowProps {
  allocation: SeatAllocation;
  onDeallocate: () => void;
  canDeallocate: boolean;
  isCurrentUser: boolean;
}
```

**Actions Menu:**

```
[...] →  ┌─────────────────────┐
         │ View Profile        │
         │ ─────────────────── │
         │ Remove Seat    [!]  │
         └─────────────────────┘
```

---

### DeallocateDialog

Confirmation dialog for removing a seat.

**File:** `src/components/seats/DeallocateDialog.tsx`

**Props:**

```typescript
interface DeallocateDialogProps {
  open: boolean;
  userName: string;
  userEmail: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}
```

**Design:**

```
┌─────────────────────────────────────────────┐
│ Remove Seat                           [X]   │
├─────────────────────────────────────────────┤
│                                             │
│ Are you sure you want to remove the seat    │
│ from Bob Jones (bob@acme.com)?              │
│                                             │
│ This will revoke their access to the        │
│ organization. They can be re-added later    │
│ if a seat is available.                     │
│                                             │
├─────────────────────────────────────────────┤
│               [Cancel]  [Remove Seat]       │
└─────────────────────────────────────────────┘
```

---

### UpgradePrompt

Call-to-action when at or near capacity.

**File:** `src/components/seats/UpgradePrompt.tsx`

**Props:**

```typescript
interface UpgradePromptProps {
  currentPlan: string;
  upgradePlan: string | null;
  seatsRemaining: number;
  variant: 'warning' | 'error';
}
```

**Warning Variant (>= 80%):**

```
┌─────────────────────────────────────────────┐
│ [!] Running low on seats                    │
│                                             │
│ You have 2 seats remaining. Consider        │
│ upgrading to Pro for more seats.            │
│                                             │
│                          [Upgrade to Pro →] │
└─────────────────────────────────────────────┘
```

**Error Variant (at capacity):**

```
┌─────────────────────────────────────────────┐
│ [X] No seats available                      │
│                                             │
│ You've reached your seat limit. Upgrade     │
│ to add more team members.                   │
│                                             │
│  [Remove Member]         [Upgrade to Pro →] │
└─────────────────────────────────────────────┘
```

---

### SeatManagement Page

Main page combining all components.

**File:** `src/pages/SeatManagement.tsx`

**Route:** `/settings/seats`

**Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│ Seat Management                             [Upgrade Plan]      │
│ Manage who has access to your organization                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─────────────────────────────┐                                │
│ │ SeatUsageCard               │                                │
│ │ 4 / 10 seats used           │                                │
│ │ ████████░░░░░░░░░░░░ 40%    │                                │
│ └─────────────────────────────┘                                │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ [UpgradePrompt - only shown if warning/at_capacity]         ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Members with Seats                                          ││
│ │ 4 members allocated                                         ││
│ ├─────────────────────────────────────────────────────────────┤│
│ │ [MemberSeatTable]                                           ││
│ │                                                             ││
│ │ Alice Smith         Mar 15, 2026    System                  ││
│ │ Bob Jones           Mar 20, 2026    Alice       [...]       ││
│ │ Carol White         Mar 22, 2026    Alice       [...]       ││
│ │ Dave Brown          Mar 24, 2026    Bob         [...]       ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**State Management:**

```typescript
interface SeatManagementState {
  seatInfo: SeatInfo | null;
  isLoading: boolean;
  error: string | null;
  deallocateTarget: string | null;  // userId for dialog
  isDeallocating: boolean;
}
```

---

## Hooks

### useSeats

Data fetching hook for seat information.

**File:** `src/hooks/useSeats.ts`

```typescript
interface UseSeatResult {
  seatInfo: SeatInfo | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSeats(): UseSeatResult {
  // Implementation
}
```

**Caching:**

- Cache seat info for 30 seconds
- Refetch on window focus
- Invalidate on allocate/deallocate

---

## API Client

### seats.ts

**File:** `src/lib/api/seats.ts`

```typescript
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
  return del(`${API_BASE}/v2/orgs/current/seats/${encodeURIComponent(userId)}`);
}
```

---

## Types

### seats.ts

**File:** `src/types/seats.ts`

```typescript
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

## Navigation Integration

Add to sidebar navigation:

**File:** `src/components/Sidebar.tsx`

```tsx
// In navigation items array
{
  name: 'Seats',
  href: '/settings/seats',
  icon: Users,
  badge: seatInfo?.at_capacity ? 'Full' : undefined,
  badgeColor: seatInfo?.at_capacity ? 'destructive' : undefined,
}
```

---

## Loading States

### Skeleton for SeatUsageCard

```tsx
function SeatUsageCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-20" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-10 w-16 mb-4" />
        <Skeleton className="h-2 w-full mb-2" />
        <div className="flex justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}
```

### Skeleton for MemberSeatTable

```tsx
function MemberSeatTableSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Member</TableHead>
          <TableHead>Allocated</TableHead>
          <TableHead>By</TableHead>
          <TableHead className="w-[100px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[1, 2, 3].map((i) => (
          <TableRow key={i}>
            <TableCell>
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div>
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            </TableCell>
            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
            <TableCell><Skeleton className="h-8 w-8" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

---

## Error States

### Error Display

```tsx
function SeatErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <Card className="border-destructive/50">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <div>
            <h3 className="font-semibold">Failed to load seat information</h3>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <Button onClick={onRetry}>Try Again</Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Accessibility

### Keyboard Navigation

- Tab through all interactive elements
- Enter/Space to activate buttons
- Escape to close dialogs
- Arrow keys in dropdown menus

### ARIA Labels

```tsx
<Progress
  value={percentage}
  aria-label={`${usage} of ${limit} seats used`}
  aria-valuenow={usage}
  aria-valuemin={0}
  aria-valuemax={limit}
/>

<Button
  aria-label={`Remove seat from ${userName}`}
  aria-describedby="deallocate-warning"
/>
```

### Screen Reader Announcements

```tsx
// Announce changes
<div aria-live="polite" className="sr-only">
  {announceMessage}
</div>
```

---

## Responsive Design

### Mobile View

On mobile (< 640px):
- Cards stack vertically
- Table becomes card list
- Actions in swipe or tap menu

### Tablet View

On tablet (640-1024px):
- 2-column grid for summary cards
- Table remains but with condensed columns

---

## Animation

### Progress Bar Transition

```css
.progress-bar {
  transition: width 300ms ease-out,
              background-color 200ms ease;
}
```

### Toast Notifications

Use existing toast system for:
- "Seat allocated successfully"
- "Seat removed"
- Error messages

---

## Testing

See [tasks.md](../tasks.md) for E2E test specifications.
