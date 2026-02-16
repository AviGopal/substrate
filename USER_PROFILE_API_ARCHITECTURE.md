# User Profile API - Architecture Diagram

## Component Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           HTTP CLIENT REQUEST                            │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        HONO WEB FRAMEWORK                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  GET /api/user/:id/profile                                      │   │
│  │  PUT /api/user/:id/profile                                      │   │
│  │  DELETE /api/user/:id                                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  Middleware Chain:                                                       │
│  1. describeRoute() - OpenAPI documentation                             │
│  2. validator() - Zod schema validation                                 │
│  3. endpoint handler - business logic invocation                        │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         ACTOR CONTEXT (Authorization)                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Actor.workspace() - Workspace scoping                          │   │
│  │  Actor.assertAdmin() - Admin authorization                      │   │
│  │  Actor.userID() - Current user identification                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    USER NAMESPACE (Business Logic)                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  User.getProfile(id)                                            │   │
│  │    - Join UserTable + AuthTable                                 │   │
│  │    - Filter by workspace                                        │   │
│  │    - Exclude deleted users                                      │   │
│  │                                                                  │   │
│  │  User.updateProfile({ id, name, email })                       │   │
│  │    - Validate input                                             │   │
│  │    - Check duplicates                                           │   │
│  │    - Update database                                            │   │
│  │                                                                  │   │
│  │  User.remove(id) - EXISTING                                     │   │
│  │    - Soft delete (set timeDeleted)                             │   │
│  │    - Require admin role                                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    DRIZZLE ORM (Database Layer)                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Database.use((tx) => {                                         │   │
│  │    tx.select().from(UserTable)                                  │   │
│  │      .leftJoin(AuthTable, ...)                                  │   │
│  │      .where(and(                                                │   │
│  │        eq(UserTable.workspaceID, workspace),                    │   │
│  │        eq(UserTable.id, id),                                    │   │
│  │        isNull(UserTable.timeDeleted)                            │   │
│  │      ))                                                          │   │
│  │  })                                                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          DATABASE TABLES                                 │
│                                                                           │
│  ┌──────────────────────────┐      ┌──────────────────────────┐        │
│  │      UserTable           │      │      AuthTable           │        │
│  ├──────────────────────────┤      ├──────────────────────────┤        │
│  │ id (PK)                  │      │ accountID (FK)           │        │
│  │ workspaceID (FK)         │◄─────┤ subject (email)          │        │
│  │ accountID (FK)           │      │ provider                 │        │
│  │ email                    │      │ ...                      │        │
│  │ name                     │      └──────────────────────────┘        │
│  │ role (admin/member)      │                                            │
│  │ timeCreated              │                                            │
│  │ timeUpdated              │                                            │
│  │ timeDeleted (soft)       │                                            │
│  │ ...                      │                                            │
│  └──────────────────────────┘                                            │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           JSON RESPONSE                                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Success (200):                                                 │   │
│  │  {                                                               │   │
│  │    "id": "user_abc123",                                         │   │
│  │    "name": "John Doe",                                          │   │
│  │    "email": "john@example.com",                                 │   │
│  │    "role": "admin",                                             │   │
│  │    "timeCreated": 1234567890,                                   │   │
│  │    "timeUpdated": 1234567890                                    │   │
│  │  }                                                               │   │
│  │                                                                  │   │
│  │  Error (400/404):                                               │   │
│  │  {                                                               │   │
│  │    "success": false,                                            │   │
│  │    "error": { "type": "NotFoundError", "message": "..." }      │   │
│  │  }                                                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Request Flow Examples

### Example 1: GET User Profile

```
Client: GET /api/user/user_abc123/profile
   ↓
Hono: validator() checks path param
   ↓
Actor: Actor.workspace() = "workspace_xyz"
   ↓
User: User.getProfile("user_abc123")
   ↓
Drizzle: SELECT * FROM user 
         LEFT JOIN auth ON user.accountID = auth.accountID
         WHERE user.id = "user_abc123"
           AND user.workspaceID = "workspace_xyz"
           AND user.timeDeleted IS NULL
   ↓
Response: 200 { id, name, email, role, ... }
```

### Example 2: PUT Update Profile

```
Client: PUT /api/user/user_abc123/profile
        Body: { "name": "Jane Doe", "email": "jane@example.com" }
   ↓
Hono: validator() checks body schema (Zod)
   ↓
Actor: Actor.workspace() = "workspace_xyz"
   ↓
User: User.updateProfile({ id: "user_abc123", name: "Jane Doe", email: "jane@example.com" })
   ↓
Drizzle: UPDATE user 
         SET name = "Jane Doe", email = "jane@example.com", timeUpdated = NOW()
         WHERE id = "user_abc123" 
           AND workspaceID = "workspace_xyz"
   ↓
Response: 200 { id, name, email, role, ... }
```

### Example 3: DELETE User (Soft Delete)

```
Client: DELETE /api/user/user_abc123
   ↓
Actor: Actor.assertAdmin() - checks if admin role
   ↓
User: User.remove("user_abc123")
   ↓
User: assertNotSelf("user_abc123") - prevent self-deletion
   ↓
Drizzle: UPDATE user 
         SET timeDeleted = NOW()
         WHERE id = "user_abc123" 
           AND workspaceID = "workspace_xyz"
   ↓
Response: 200 true
```

## Error Flow Examples

### Example 4: Unauthorized Access

```
Client: DELETE /api/user/user_abc123
   ↓
Actor: Actor.assertAdmin() - throws Error (user is "member")
   ↓
Global Error Handler: Catch Error
   ↓
Response: 403 { "success": false, "error": { "message": "Action not allowed..." } }
```

### Example 5: User Not Found

```
Client: GET /api/user/user_nonexistent/profile
   ↓
User: User.getProfile("user_nonexistent")
   ↓
Drizzle: SELECT ... WHERE id = "user_nonexistent" 
         → returns undefined
   ↓
User: throw Storage.NotFoundError
   ↓
Global Error Handler: Catch NotFoundError
   ↓
Response: 404 { "success": false, "error": { "type": "NotFoundError", ... } }
```

### Example 6: Validation Error

```
Client: PUT /api/user/user_abc123/profile
        Body: { "email": "invalid-email" }
   ↓
Hono: validator() checks body with Zod schema
   ↓
Zod: email.parse("invalid-email") fails validation
   ↓
validator() middleware: Returns 400 automatically
   ↓
Response: 400 { "success": false, "errors": [ { "path": "email", "message": "Invalid email" } ] }
```

## Data Model Relationships

```
┌──────────────┐
│  Workspace   │
└──────┬───────┘
       │ 1:N
       ▼
┌──────────────┐       ┌──────────────┐
│     User     │───────│     Auth     │
│              │  1:1  │              │
│ - id         │       │ - accountID  │
│ - workspaceID│       │ - subject    │
│ - accountID  │◄──────│   (email)    │
│ - name       │       │ - provider   │
│ - email      │       └──────────────┘
│ - role       │
│ - timeDeleted│ ← Soft delete flag
└──────────────┘
```

## Authorization Matrix

| Endpoint | User Type | Self | Other User | Notes |
|----------|-----------|------|------------|-------|
| GET /api/user/:id/profile | Admin | ✅ | ✅ | Workspace-scoped |
| GET /api/user/:id/profile | Member | ✅ | ✅ | Workspace-scoped |
| PUT /api/user/:id/profile | Admin | ✅ | ✅ | Can edit any user |
| PUT /api/user/:id/profile | Member | ✅ | ✅ | Can edit any user |
| DELETE /api/user/:id | Admin | ❌ | ✅ | Cannot delete self |
| DELETE /api/user/:id | Member | ❌ | ❌ | Admin only |

## File Dependency Graph

```
user-profile-api.ts (NEW)
    │
    ├─→ Hono (framework)
    ├─→ hono-openapi (docs + validation)
    ├─→ User namespace (business logic)
    │      │
    │      ├─→ Actor (authorization)
    │      ├─→ Database (Drizzle)
    │      ├─→ UserTable (schema)
    │      ├─→ AuthTable (schema)
    │      └─→ Zod (validation)
    │
    └─→ Zod schemas (ProfileInfo, UpdateProfileInput)

user-profile-api.test.ts (NEW)
    │
    ├─→ bun:test (framework)
    ├─→ Instance.provide() (test context)
    ├─→ Server.App() (test server)
    └─→ User namespace (test target)
```

## Testing Coverage Map

```
┌────────────────────────────────────────────────────────────┐
│                    Test Categories                          │
├────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Success Cases (7 tests)                            │  │
│  │  ✓ GET profile returns 200                          │  │
│  │  ✓ GET includes email from AuthTable                │  │
│  │  ✓ PUT updates name                                 │  │
│  │  ✓ PUT updates email                                │  │
│  │  ✓ PUT updates both fields                          │  │
│  │  ✓ DELETE soft deletes user                         │  │
│  │  ✓ Responses match schemas                          │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Validation Errors (5 tests)                        │  │
│  │  ✓ Invalid ID format → 400                          │  │
│  │  ✓ Invalid email → 400                              │  │
│  │  ✓ Empty body → 400                                 │  │
│  │  ✓ Name too short → 400                             │  │
│  │  ✓ Non-admin delete → 403                           │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Error Handling (5 tests)                           │  │
│  │  ✓ Non-existent user GET → 404                      │  │
│  │  ✓ Non-existent user PUT → 404                      │  │
│  │  ✓ Non-existent user DELETE → 404                   │  │
│  │  ✓ Duplicate email → 400                            │  │
│  │  ✓ Self-deletion → 400                              │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Authorization (4 tests)                            │  │
│  │  ✓ Workspace scoping enforced                       │  │
│  │  ✓ Different workspace → 404                        │  │
│  │  ✓ DELETE requires admin                            │  │
│  │  ✓ GET/PUT work for non-admin                       │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                              │
│  Total: 21 tests covering all critical paths               │
└────────────────────────────────────────────────────────────┘
```
