# API Endpoints Specification

## Overview

This specification defines the REST API endpoints for organization member management in metabob-analysis-api.

## Base URL

All endpoints are prefixed with `/v2/organizations`

## Authentication

All endpoints require JWT authentication via `Authorization: Bearer <token>` header, except:
- `GET /v2/invitations/:token` - View invitation details (public)
- `POST /v2/invitations/:token/accept` - Accept invitation (optional auth)
- `POST /v2/invitations/:token/decline` - Decline invitation (public)

## Endpoints

### List Organization Members

**Endpoint:** `GET /v2/organizations/current/members`

**Description:** List all active members in the current user's organization

**Authorization:** Any authenticated member

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | string | No | Filter by status (active, removed). Default: active |
| role | string | No | Filter by role (owner, admin, member, viewer) |
| search | string | No | Search by name or email |
| limit | number | No | Max results (default: 50, max: 100) |
| offset | number | No | Pagination offset (default: 0) |

**Response:** `200 OK`
```typescript
{
  success: true,
  data: {
    members: [
      {
        id: "organization_members:abc123",
        user_id: "users:def456",
        user_email: "alice@example.com",
        user_name: "Alice Smith",
        role: "owner",
        status: "active",
        invited_by: "users:ghi789",
        invited_by_name: "Bob Jones",
        joined_at: "2026-01-15T10:30:00Z",
        created_at: "2026-01-15T10:30:00Z"
      }
    ],
    total: 5,
    limit: 50,
    offset: 0
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid JWT
- `500 Internal Server Error` - Database query failed

---

### Get Member Details

**Endpoint:** `GET /v2/organizations/current/members/:memberId`

**Description:** Get details of a specific member

**Authorization:** Any authenticated member

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| memberId | string | Yes | Member record ID |

**Response:** `200 OK`
```typescript
{
  success: true,
  data: {
    member: {
      id: "organization_members:abc123",
      user_id: "users:def456",
      user_email: "alice@example.com",
      user_name: "Alice Smith",
      role: "admin",
      status: "active",
      invited_by: "users:ghi789",
      invited_by_name: "Bob Jones",
      joined_at: "2026-01-15T10:30:00Z",
      created_at: "2026-01-15T10:30:00Z"
    }
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid JWT
- `404 Not Found` - Member not found in organization

---

### Invite Member

**Endpoint:** `POST /v2/organizations/current/members/invite`

**Description:** Create an invitation for a new member

**Authorization:** Owner or Admin role required

**Request Body:**
```typescript
{
  email: string;     // Email address to invite
  role: "admin" | "member" | "viewer";  // Role to assign
}
```

**Response:** `201 Created`
```typescript
{
  success: true,
  data: {
    invitation: {
      id: "organization_invitations:xyz789",
      email: "newuser@example.com",
      role: "member",
      status: "pending",
      expires_at: "2026-04-01T10:30:00Z",
      created_at: "2026-03-25T10:30:00Z"
    },
    // Only returned once - for sharing
    invitation_url: "https://app.metabob.com/invite/abc123-def456-ghi789"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid email or role
- `401 Unauthorized` - Missing or invalid JWT
- `403 Forbidden` - Insufficient role (not admin/owner)
- `409 Conflict` - Email already invited or member exists
- `422 Unprocessable Entity` - Seat limit reached

**Validation:**
- Email must be valid format
- Role cannot be "owner" (only one owner per org)
- Check seat_limit vs (active_members + pending_invitations)

---

### Update Member Role

**Endpoint:** `PATCH /v2/organizations/current/members/:memberId/role`

**Description:** Change a member's role

**Authorization:**
- Owner: Can change any member's role (except demote self)
- Admin: Can change member/viewer roles only

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| memberId | string | Yes | Member record ID |

**Request Body:**
```typescript
{
  role: "admin" | "member" | "viewer";  // New role
}
```

**Response:** `200 OK`
```typescript
{
  success: true,
  data: {
    member: {
      id: "organization_members:abc123",
      user_id: "users:def456",
      role: "admin",  // Updated role
      // ... other fields
    }
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid role
- `401 Unauthorized` - Missing or invalid JWT
- `403 Forbidden` - Cannot change owner role or insufficient permissions
- `404 Not Found` - Member not found

**Business Rules:**
- Cannot change owner's role (use transfer ownership instead)
- Owner can promote member to admin
- Admin cannot promote to admin (only owner can)
- Admin can demote other admins to member/viewer

---

### Remove Member

**Endpoint:** `DELETE /v2/organizations/current/members/:memberId`

**Description:** Remove a member from the organization (soft delete)

**Authorization:** Owner or Admin role required

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| memberId | string | Yes | Member record ID |

**Response:** `200 OK`
```typescript
{
  success: true,
  data: {
    message: "Member removed successfully"
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid JWT
- `403 Forbidden` - Cannot remove owner or insufficient permissions
- `404 Not Found` - Member not found

**Business Rules:**
- Cannot remove owner (must transfer ownership first)
- Admin cannot remove other admins (only owner can)
- Removing member updates org seat_usage

---

### Leave Organization

**Endpoint:** `POST /v2/organizations/current/members/leave`

**Description:** Current user leaves the organization

**Authorization:** Any authenticated member (except owner)

**Response:** `200 OK`
```typescript
{
  success: true,
  data: {
    message: "You have left the organization"
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid JWT
- `403 Forbidden` - Owner cannot leave (must transfer first)

---

### Transfer Ownership

**Endpoint:** `POST /v2/organizations/current/transfer-ownership`

**Description:** Transfer organization ownership to another admin

**Authorization:** Owner role required

**Request Body:**
```typescript
{
  new_owner_id: string;    // User ID of new owner (must be admin)
  confirmation: string;    // "TRANSFER" or re-enter password
}
```

**Response:** `200 OK`
```typescript
{
  success: true,
  data: {
    message: "Ownership transferred successfully",
    new_owner: {
      id: "users:def456",
      name: "Alice Smith",
      email: "alice@example.com"
    },
    your_new_role: "admin"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid confirmation
- `401 Unauthorized` - Missing or invalid JWT
- `403 Forbidden` - Not owner or target not admin
- `404 Not Found` - Target user not found in org

**Business Rules:**
- New owner must currently be admin in the organization
- Old owner becomes admin after transfer
- Requires explicit confirmation ("TRANSFER" string)

---

### List Pending Invitations

**Endpoint:** `GET /v2/organizations/current/invitations`

**Description:** List all pending invitations for the organization

**Authorization:** Owner or Admin role required

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | string | No | Filter by status. Default: pending |
| limit | number | No | Max results (default: 50) |
| offset | number | No | Pagination offset (default: 0) |

**Response:** `200 OK`
```typescript
{
  success: true,
  data: {
    invitations: [
      {
        id: "organization_invitations:xyz789",
        email: "newuser@example.com",
        role: "member",
        status: "pending",
        invited_by: "users:abc123",
        invited_by_name: "Bob Jones",
        expires_at: "2026-04-01T10:30:00Z",
        created_at: "2026-03-25T10:30:00Z"
      }
    ],
    total: 2,
    limit: 50,
    offset: 0
  }
}
```

---

### Revoke Invitation

**Endpoint:** `DELETE /v2/organizations/current/invitations/:invitationId`

**Description:** Revoke a pending invitation

**Authorization:** Owner or Admin role required

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| invitationId | string | Yes | Invitation record ID |

**Response:** `200 OK`
```typescript
{
  success: true,
  data: {
    message: "Invitation revoked"
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Missing or invalid JWT
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Invitation not found
- `409 Conflict` - Invitation already accepted/declined

---

### Get Invitation Details (Public)

**Endpoint:** `GET /v2/invitations/:token`

**Description:** View invitation details using the token (no auth required)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| token | string | Yes | Invitation token from URL |

**Response:** `200 OK`
```typescript
{
  success: true,
  data: {
    invitation: {
      org_name: "Acme Corp",
      role: "member",
      invited_by_name: "Bob Jones",
      expires_at: "2026-04-01T10:30:00Z",
      is_expired: false
    }
  }
}
```

**Error Responses:**
- `404 Not Found` - Invalid token or invitation not found
- `410 Gone` - Invitation expired or already used

---

### Accept Invitation

**Endpoint:** `POST /v2/invitations/:token/accept`

**Description:** Accept an invitation and join the organization

**Authorization:** Optional - if provided, uses existing user; if not, redirects to signup

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| token | string | Yes | Invitation token from URL |

**Response (Authenticated):** `200 OK`
```typescript
{
  success: true,
  data: {
    member: {
      id: "organization_members:abc123",
      org_id: "organizations:xyz789",
      role: "member",
      joined_at: "2026-03-25T10:30:00Z"
    },
    message: "Welcome to Acme Corp!"
  }
}
```

**Response (Not Authenticated):** `200 OK`
```typescript
{
  success: true,
  data: {
    redirect_to: "/signup?invitation=abc123-def456",
    message: "Please create an account to accept this invitation"
  }
}
```

**Error Responses:**
- `404 Not Found` - Invalid token
- `409 Conflict` - Already a member of this organization
- `410 Gone` - Invitation expired
- `422 Unprocessable Entity` - Seat limit reached

---

### Decline Invitation (Public)

**Endpoint:** `POST /v2/invitations/:token/decline`

**Description:** Decline an invitation

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| token | string | Yes | Invitation token from URL |

**Response:** `200 OK`
```typescript
{
  success: true,
  data: {
    message: "Invitation declined"
  }
}
```

**Error Responses:**
- `404 Not Found` - Invalid token
- `410 Gone` - Invitation already accepted/expired

---

## Route Implementation

### File: repos/metabob-analysis-api/src/routes/members.ts

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import crypto from 'crypto';
import type { SurrealDBClient } from '../db/surreal.js';
import { auth } from '../middleware/auth.js';
import { scope } from '../middleware/scope.js';

const memberRoutes = new Hono();

// Apply auth to protected routes
memberRoutes.use('/organizations/*', auth());
memberRoutes.use('/organizations/*', scope());

// Validation schemas
const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'member', 'viewer'], {
    errorMap: () => ({ message: 'Role must be admin, member, or viewer' })
  }),
});

const updateRoleSchema = z.object({
  role: z.enum(['admin', 'member', 'viewer']),
});

const transferOwnershipSchema = z.object({
  new_owner_id: z.string().min(1, 'New owner ID is required'),
  confirmation: z.literal('TRANSFER', {
    errorMap: () => ({ message: 'Confirmation must be exactly "TRANSFER"' })
  }),
});

// Helper: Generate secure token
function generateInvitationToken(): { token: string; hash: string } {
  const token = crypto.randomUUID();
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

// Helper: Hash token for lookup
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// GET /v2/organizations/current/members
memberRoutes.get('/organizations/current/members', async (c) => {
  const db = c.get('surrealDB') as SurrealDBClient;
  const orgId = c.get('orgId') as string;
  const { status = 'active', role, search, limit = '50', offset = '0' } = c.req.query();

  try {
    let query = `
      SELECT
        *,
        user_id.email AS user_email,
        user_id.name AS user_name,
        invited_by.name AS invited_by_name
      FROM organization_members
      WHERE org_id = $orgId
    `;
    const params: Record<string, any> = { orgId };

    if (status) {
      query += ' AND status = $status';
      params.status = status;
    }

    if (role) {
      query += ' AND role = $role';
      params.role = role;
    }

    if (search) {
      query += ' AND (user_id.email CONTAINS $search OR user_id.name CONTAINS $search)';
      params.search = search;
    }

    query += ' ORDER BY role DESC, joined_at ASC';
    query += ` LIMIT ${parseInt(limit)} START ${parseInt(offset)}`;

    const members = await db.query(query, params);

    // Get total count
    const countResult = await db.query(
      'SELECT count() FROM organization_members WHERE org_id = $orgId AND status = $status',
      { orgId, status }
    );

    return c.json({
      success: true,
      data: {
        members: members || [],
        total: countResult?.[0]?.count || 0,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    console.error('List members error:', error);
    return c.json({
      error: {
        code: 'QUERY_FAILED',
        message: 'Failed to list members',
      },
    }, 500);
  }
});

// POST /v2/organizations/current/members/invite
memberRoutes.post('/organizations/current/members/invite',
  zValidator('json', inviteMemberSchema),
  async (c) => {
    const db = c.get('surrealDB') as SurrealDBClient;
    const orgId = c.get('orgId') as string;
    const userId = c.get('userId') as string;
    const userRole = c.get('role') as string;
    const { email, role } = c.req.valid('json');

    // Check permission
    if (userRole !== 'owner' && userRole !== 'admin') {
      return c.json({
        error: {
          code: 'FORBIDDEN',
          message: 'Only owners and admins can invite members',
        },
      }, 403);
    }

    try {
      // Check if email already has pending invitation
      const existingInvite = await db.query(
        `SELECT id FROM organization_invitations
         WHERE org_id = $orgId AND email = $email AND status = 'pending'`,
        { orgId, email: email.toLowerCase() }
      );

      if (existingInvite && existingInvite.length > 0) {
        return c.json({
          error: {
            code: 'ALREADY_INVITED',
            message: 'This email already has a pending invitation',
          },
        }, 409);
      }

      // Check if user is already a member
      const existingMember = await db.query(
        `SELECT id FROM users WHERE email = $email AND org_id = $orgId`,
        { orgId, email: email.toLowerCase() }
      );

      if (existingMember && existingMember.length > 0) {
        return c.json({
          error: {
            code: 'ALREADY_MEMBER',
            message: 'This user is already a member of the organization',
          },
        }, 409);
      }

      // Check seat availability
      const org = await db.query(
        'SELECT seat_limit, seat_usage FROM organizations WHERE id = $orgId',
        { orgId }
      );

      if (org && org[0] && org[0].seat_usage >= org[0].seat_limit) {
        return c.json({
          error: {
            code: 'SEAT_LIMIT_REACHED',
            message: 'Organization has reached its seat limit',
            suggestion: 'Upgrade your plan to add more members',
          },
        }, 422);
      }

      // Generate secure token
      const { token, hash } = generateInvitationToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Create invitation
      const invitation = await db.query(
        `CREATE organization_invitations SET
          org_id = $orgId,
          email = $email,
          role = $role,
          token_hash = $tokenHash,
          invited_by = $userId,
          expires_at = $expiresAt,
          created_at = time::now()`,
        {
          orgId,
          email: email.toLowerCase(),
          role,
          tokenHash: hash,
          userId,
          expiresAt: expiresAt.toISOString(),
        }
      );

      // Log email (MVP - replace with email service later)
      const inviteUrl = `${process.env.APP_URL || 'https://app.metabob.com'}/invite/${token}`;
      console.log(`[INVITATION EMAIL] To: ${email}, URL: ${inviteUrl}`);

      // Create audit log
      await db.query(
        `CREATE membership_audit_log SET
          org_id = $orgId,
          action = 'member_invited',
          actor_id = $userId,
          target_email = $email,
          details = { role: $role },
          created_at = time::now()`,
        { orgId, userId, email, role }
      );

      return c.json({
        success: true,
        data: {
          invitation: invitation?.[0],
          invitation_url: inviteUrl,
        },
      }, 201);
    } catch (error) {
      console.error('Invite member error:', error);
      return c.json({
        error: {
          code: 'INVITE_FAILED',
          message: 'Failed to create invitation',
        },
      }, 500);
    }
  }
);

// Continue with other endpoints...
// PATCH /v2/organizations/current/members/:memberId/role
// DELETE /v2/organizations/current/members/:memberId
// POST /v2/organizations/current/members/leave
// POST /v2/organizations/current/transfer-ownership
// GET /v2/organizations/current/invitations
// DELETE /v2/organizations/current/invitations/:invitationId
// GET /v2/invitations/:token (no auth)
// POST /v2/invitations/:token/accept
// POST /v2/invitations/:token/decline

export { memberRoutes };
```
