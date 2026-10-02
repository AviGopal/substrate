# User Management Library — Engineering Specification

## Overview

This library provides a minimal user management system with session-based authentication, role-based access control, and audit logging. It is intentionally simple — no database, no HTTP layer — just the core domain logic in TypeScript.

## Modules

### `src/types.ts`

Defines the core domain types: `User`, `Session`, `CreateUserInput`, `UpdateUserInput`.

- `User.id` — opaque string identifier; auto-assigned at creation
- `User.role` — one of `"admin"`, `"member"`, `"guest"`
- `Session.scopes` — list of permission scopes (e.g. `"read"`, `"write"`, `"admin"`)
- `Session.expiresAt` — sessions expire after a configurable TTL (default 1 hour)

### `src/user-store.ts`

In-memory user store. Operations: `createUser`, `getUser`, `updateUser`, `deleteUser`, `listUsers`, `clearStore`.

The store uses a `Map<UserID, User>` and assigns sequential numeric IDs.

### `src/session-store.ts`

In-memory session store. Operations: `createSession`, `getSession`, `revokeSession`, `revokeAllSessions`, `clearSessions`.

Sessions are keyed by a random `sessionId` with prefix `sess_`. Expired sessions are lazily evicted on `getSession`.

### `src/auth.ts`

Authentication facade: `login`, `logout`, `validateSession`.

**Known issues:**
- `login` does not validate that the user exists before creating a session.
- `logout` implementation is incorrect — it does not actually revoke the session.

### `src/index.ts`

Public API re-export barrel.

## Required Changes

The following changes are needed to bring the library to production quality:

### 1. Fix `login` in `src/auth.ts`

`login(userId, password)` must:
1. Call `getUser(userId)`. If the user does not exist, return `{ success: false, error: "User not found" }` without creating a session.
2. (Existing behaviour when user exists is acceptable for now — password is not validated.)

### 2. Fix `logout` in `src/auth.ts`

`logout(sessionId)` must:
1. Call `revokeSession(sessionId)` from session-store.
2. Return `true` if the session existed and was revoked, `false` otherwise.
The current implementation does not revoke anything.

### 3. Add `src/rbac.ts`

Create a new module with:
```ts
export function hasScope(session: Session, scope: string): boolean
export function requireRole(user: User, role: "admin" | "member" | "guest"): boolean
```

- `hasScope(session, scope)` — returns `true` if `session.scopes` includes `scope`.
- `requireRole(user, role)` — returns `true` if `user.role === role || user.role === "admin"` (admins pass all role checks).

### 4. Add `src/rbac.test.ts`

Unit tests for `hasScope` and `requireRole`:
- `hasScope` with matching scope, non-matching scope, empty scopes array
- `requireRole` where user is admin (passes all checks), member (passes member/guest checks), guest (passes only guest check)

### 5. Export from `src/index.ts`

Add exports for `hasScope` and `requireRole` from the new `src/rbac.ts`.

### 6. Run all tests

All tests must pass after the changes.

## Non-requirements

- No HTTP layer
- No database persistence
- No password hashing (authentication is a stub)
- No JWT tokens

## Acceptance criteria

- `bun test` exits 0
- `src/auth.test.ts` passing (currently has one failing test due to login bug)
- `src/rbac.test.ts` exists and passes
- `src/index.ts` exports `hasScope` and `requireRole`
