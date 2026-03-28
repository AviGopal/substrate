# API Contracts - Organization Seat Management

**Created:** 2026-03-25
**Updated:** 2026-03-25
**Service:** metabob-analysis-api

---

## Overview

This document defines the HTTP API contracts for seat management. All endpoints are implemented in `repos/metabob-analysis-api/src/routes/seats.ts`.

## Base URL

```
{ANALYSIS_API_URL}/v2/orgs/{orgId}/seats
```

Where `{orgId}` can be:
- Explicit org ID: `organizations:acme`
- `current` - uses authenticated user's org_id from JWT

## Authentication

All endpoints require JWT authentication via Bearer token:

```http
Authorization: Bearer <jwt_token>
```

The JWT must contain:
- `org_id`: Organization ID
- `user_id`: User ID
- `role`: User role (admin, member, owner)

---

## Endpoints

### GET /v2/orgs/:orgId/seats

Get complete seat information for an organization.

**Authorization:** Any authenticated user in the organization

#### Request

```http
GET /v2/orgs/current/seats HTTP/1.1
Authorization: Bearer <jwt>
```

#### Response (200 OK)

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
      },
      {
        "id": "seat_allocations:def456",
        "org_id": "organizations:acme",
        "user_id": "users:bob",
        "user_email": "bob@acme.com",
        "user_name": "Bob Jones",
        "allocated_at": "2026-03-20T14:00:00Z",
        "allocated_by": "users:alice",
        "allocation_reason": "invite"
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

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `seat_limit` | number | Maximum seats allowed by plan |
| `seat_usage` | number | Currently allocated seats |
| `plan` | string | Subscription plan ID |
| `plan_name` | string | Human-readable plan name |
| `allocations` | array | List of seat allocations |
| `can_add_members` | boolean | True if seats available |
| `seats_remaining` | number | Available seats |
| `usage_percentage` | number | Percentage of seats used |
| `warning_threshold` | boolean | True if usage >= 80% |
| `at_capacity` | boolean | True if usage >= 100% |
| `upgrade_available` | boolean | True if not on enterprise |
| `upgrade_path` | string\|null | Next plan tier or null |

#### Allocation Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Allocation record ID |
| `org_id` | string | Organization ID |
| `user_id` | string | User ID |
| `user_email` | string | User's email (joined) |
| `user_name` | string | User's display name (joined) |
| `allocated_at` | string | ISO 8601 timestamp |
| `allocated_by` | string\|null | ID of user who allocated |
| `allocation_reason` | string\|null | Reason for allocation |

#### Errors

| Status | Code | Description |
|--------|------|-------------|
| 401 | `UNAUTHORIZED` | Missing or invalid JWT |
| 403 | `FORBIDDEN` | Accessing different org |

---

### GET /v2/orgs/:orgId/seats/available

Quick check for seat availability. Lightweight endpoint for invite flow.

**Authorization:** Any authenticated user in the organization

#### Request

```http
GET /v2/orgs/current/seats/available HTTP/1.1
Authorization: Bearer <jwt>
```

#### Response (200 OK)

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

#### At Capacity Response

```json
{
  "success": true,
  "data": {
    "available": false,
    "remaining": 0,
    "upgrade_path": "enterprise",
    "message": "No seats available. Upgrade to Pro or remove existing members."
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `available` | boolean | True if can add member |
| `remaining` | number | Number of free seats |
| `upgrade_path` | string\|null | Next plan tier |
| `message` | string | Human-readable status |

---

### POST /v2/orgs/:orgId/seats/allocate

Allocate a seat to a user.

**Authorization:** Admin or owner role required

#### Request

```http
POST /v2/orgs/current/seats/allocate HTTP/1.1
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "user_id": "users:bob",
  "reason": "new_hire"
}
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | string | yes | User to allocate seat to |
| `reason` | string | no | Allocation reason |

#### Response (201 Created)

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
    "seat_info": {
      "seat_limit": 10,
      "seat_usage": 5,
      "plan": "pro",
      "plan_name": "Pro",
      "allocations": [...],
      "can_add_members": true,
      "seats_remaining": 5,
      "usage_percentage": 50,
      "warning_threshold": false,
      "at_capacity": false,
      "upgrade_available": true,
      "upgrade_path": "enterprise"
    }
  }
}
```

#### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_REQUEST` | Missing user_id |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT |
| 403 | `FORBIDDEN` | Not admin/owner |
| 404 | `USER_NOT_FOUND` | User not in organization |
| 409 | `SEAT_LIMIT_EXCEEDED` | Organization at capacity |
| 409 | `USER_ALREADY_ALLOCATED` | User already has seat |

#### Error Response Example

```json
{
  "success": false,
  "error": {
    "code": "SEAT_LIMIT_EXCEEDED",
    "message": "Organization has reached its seat limit",
    "suggestion": "Upgrade your plan or deallocate an existing seat"
  }
}
```

---

### DELETE /v2/orgs/:orgId/seats/:userId

Deallocate a seat from a user.

**Authorization:** Admin or owner role required

#### Request

```http
DELETE /v2/orgs/current/seats/users:bob HTTP/1.1
Authorization: Bearer <jwt>
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "deallocated_user_id": "users:bob",
    "seat_info": {
      "seat_limit": 10,
      "seat_usage": 3,
      "plan": "pro",
      "plan_name": "Pro",
      "allocations": [...],
      "can_add_members": true,
      "seats_remaining": 7,
      "usage_percentage": 30,
      "warning_threshold": false,
      "at_capacity": false,
      "upgrade_available": true,
      "upgrade_path": "enterprise"
    }
  }
}
```

#### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `CANNOT_DEALLOCATE_SELF` | Trying to remove own seat |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT |
| 403 | `FORBIDDEN` | Not admin/owner |
| 404 | `ALLOCATION_NOT_FOUND` | User has no allocation |

---

## Validation Schemas

### Zod Schemas

```typescript
// repos/metabob-analysis-api/src/routes/seats.ts

import { z } from 'zod';

export const allocateSeatSchema = z.object({
  user_id: z.string().min(1, 'user_id is required'),
  reason: z.string().optional(),
});

export const seatInfoResponseSchema = z.object({
  seat_limit: z.number().int().min(1),
  seat_usage: z.number().int().min(0),
  plan: z.enum(['free', 'starter', 'pro', 'enterprise']),
  plan_name: z.string(),
  allocations: z.array(z.object({
    id: z.string(),
    org_id: z.string(),
    user_id: z.string(),
    user_email: z.string().email(),
    user_name: z.string(),
    allocated_at: z.string().datetime(),
    allocated_by: z.string().nullable(),
    allocation_reason: z.string().nullable(),
  })),
  can_add_members: z.boolean(),
  seats_remaining: z.number().int().min(0),
  usage_percentage: z.number().int().min(0).max(100),
  warning_threshold: z.boolean(),
  at_capacity: z.boolean(),
  upgrade_available: z.boolean(),
  upgrade_path: z.enum(['starter', 'pro', 'enterprise']).nullable(),
});
```

---

## Rate Limits

| Endpoint | Rate Limit | Window |
|----------|-----------|--------|
| GET /seats | 100 | 1 minute |
| GET /available | 200 | 1 minute |
| POST /allocate | 20 | 1 minute |
| DELETE /seats/:userId | 20 | 1 minute |

---

## Audit Events

All seat changes emit audit events:

### Allocation Event

```json
{
  "action": "create",
  "resource_type": "seat_allocation",
  "resource_id": "seat_allocations:xyz789",
  "timestamp": "2026-03-25T14:30:00Z",
  "details": {
    "user_id": "users:bob",
    "reason": "new_hire"
  }
}
```

### Deallocation Event

```json
{
  "action": "delete",
  "resource_type": "seat_allocation",
  "resource_id": "seat_allocations:xyz789",
  "timestamp": "2026-03-25T15:00:00Z",
  "details": {
    "user_id": "users:bob"
  }
}
```

---

## Integration Points

### User Creation

When a new user is created via `/v2/users`:

1. Check seat availability
2. If available, auto-allocate seat
3. If not available, return error (user creation blocked)

### User Invitation

When inviting a user:

1. Call `GET /seats/available` first
2. If not available, show upgrade prompt
3. If available, proceed with invite flow

### Stripe Webhooks (Future)

When subscription changes:

1. Update organization seat_limit
2. If new limit < current usage, warn admin
3. Emit event for dashboard notification

---

## OpenAPI Specification

```yaml
openapi: 3.0.3
info:
  title: Seat Management API
  version: 1.0.0

paths:
  /v2/orgs/{orgId}/seats:
    get:
      summary: Get seat information
      security:
        - bearerAuth: []
      parameters:
        - name: orgId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Seat information
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SeatInfoResponse'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'

  /v2/orgs/{orgId}/seats/available:
    get:
      summary: Check seat availability
      security:
        - bearerAuth: []
      parameters:
        - name: orgId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Availability status
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SeatAvailabilityResponse'

  /v2/orgs/{orgId}/seats/allocate:
    post:
      summary: Allocate seat to user
      security:
        - bearerAuth: []
      parameters:
        - name: orgId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AllocateSeatRequest'
      responses:
        '201':
          description: Seat allocated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AllocateSeatResponse'
        '409':
          $ref: '#/components/responses/Conflict'

  /v2/orgs/{orgId}/seats/{userId}:
    delete:
      summary: Deallocate seat from user
      security:
        - bearerAuth: []
      parameters:
        - name: orgId
          in: path
          required: true
          schema:
            type: string
        - name: userId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Seat deallocated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DeallocateSeatResponse'

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    SeatInfoResponse:
      type: object
      required:
        - success
        - data
      properties:
        success:
          type: boolean
        data:
          $ref: '#/components/schemas/SeatInfo'

    SeatInfo:
      type: object
      required:
        - seat_limit
        - seat_usage
        - plan
        - plan_name
        - allocations
        - can_add_members
        - seats_remaining
        - usage_percentage
        - warning_threshold
        - at_capacity
        - upgrade_available
        - upgrade_path
      properties:
        seat_limit:
          type: integer
          minimum: 1
        seat_usage:
          type: integer
          minimum: 0
        plan:
          type: string
          enum: [free, starter, pro, enterprise]
        plan_name:
          type: string
        allocations:
          type: array
          items:
            $ref: '#/components/schemas/SeatAllocation'
        can_add_members:
          type: boolean
        seats_remaining:
          type: integer
          minimum: 0
        usage_percentage:
          type: integer
          minimum: 0
          maximum: 100
        warning_threshold:
          type: boolean
        at_capacity:
          type: boolean
        upgrade_available:
          type: boolean
        upgrade_path:
          type: string
          nullable: true

    SeatAllocation:
      type: object
      required:
        - id
        - org_id
        - user_id
        - user_email
        - user_name
        - allocated_at
      properties:
        id:
          type: string
        org_id:
          type: string
        user_id:
          type: string
        user_email:
          type: string
          format: email
        user_name:
          type: string
        allocated_at:
          type: string
          format: date-time
        allocated_by:
          type: string
          nullable: true
        allocation_reason:
          type: string
          nullable: true

    AllocateSeatRequest:
      type: object
      required:
        - user_id
      properties:
        user_id:
          type: string
        reason:
          type: string

    AllocateSeatResponse:
      type: object
      properties:
        success:
          type: boolean
        data:
          type: object
          properties:
            allocation:
              $ref: '#/components/schemas/SeatAllocation'
            seat_info:
              $ref: '#/components/schemas/SeatInfo'

    SeatAvailabilityResponse:
      type: object
      properties:
        success:
          type: boolean
        data:
          type: object
          properties:
            available:
              type: boolean
            remaining:
              type: integer
            upgrade_path:
              type: string
              nullable: true
            message:
              type: string

    DeallocateSeatResponse:
      type: object
      properties:
        success:
          type: boolean
        data:
          type: object
          properties:
            deallocated_user_id:
              type: string
            seat_info:
              $ref: '#/components/schemas/SeatInfo'

  responses:
    Unauthorized:
      description: Authentication required
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: object
                properties:
                  code:
                    type: string
                  message:
                    type: string

    Forbidden:
      description: Access denied
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: object
                properties:
                  code:
                    type: string
                  message:
                    type: string

    Conflict:
      description: Resource conflict
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: object
                properties:
                  code:
                    type: string
                  message:
                    type: string
                  suggestion:
                    type: string
```
