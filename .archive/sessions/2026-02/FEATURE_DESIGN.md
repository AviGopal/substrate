# Feature Design: User Profile API

## Overview
REST endpoints for user profile management with full CRUD operations (GET/PUT/DELETE) including authentication and validation.

## Requirements
- GET endpoint to retrieve user profile
- PUT endpoint to update user profile
- DELETE endpoint to remove user (soft delete)
- Authentication using Actor context (workspace-based authorization)
- Input validation using Zod schemas
- Error handling with proper HTTP status codes
- Integration with existing User namespace

## Acceptance Criteria
- All endpoints tested with comprehensive unit and integration tests
- Endpoints documented with OpenAPI schema via hono-openapi
- Integrated with auth system using Actor.assert() pattern
- Proper validation errors (400) and not found errors (404)
- Follows existing codebase patterns for error responses

## Existing Patterns Found

### Pattern 1: REST Endpoint Structure (server.ts:325-352)
**File**: `repos/metabob-opencode/packages/opencode/src/server/server.ts`
**Example**: GET /session/:id endpoint
- Uses `describeRoute()` for OpenAPI documentation
- Validates parameters with `validator()` from hono-openapi
- Returns typed responses using `resolver()` with Zod schemas
- Consistent error handling with `...errors(400, 404)` pattern
- JSON responses with proper status codes

```typescript
.get(
  "/session/:id",
  describeRoute({
    description: "Get session",
    operationId: "session.get",
    responses: {
      200: {
        description: "Get session",
        content: {
          "application/json": {
            schema: resolver(Session.Info),
          },
        },
      },
      ...errors(400, 404),
    },
  }),
  validator(
    "param",
    z.object({
      id: Session.get.schema,
    }),
  ),
  async (c) => {
    const sessionID = c.req.valid("param").id
    const session = await Session.get(sessionID)
    return c.json(session)
  },
)
```

### Pattern 2: Business Logic in Namespace (user.ts:21-32)
**File**: `repos/metabob-opencode/packages/console/core/src/user.ts`
**Example**: User namespace with fn() wrapper
- Business logic separated into namespace (User.*)
- Functions wrapped with `fn(schema, implementation)` for type safety
- Uses Drizzle ORM for database operations
- Actor-based authorization (Actor.workspace(), Actor.assertAdmin())
- Workspace-scoped queries with Actor.workspace()

```typescript
export const list = fn(z.void(), () =>
  Database.use((tx) =>
    tx
      .select({
        ...getTableColumns(UserTable),
        authEmail: AuthTable.subject,
      })
      .from(UserTable)
      .leftJoin(AuthTable, and(eq(UserTable.accountID, AuthTable.accountID), eq(AuthTable.provider, "email")))
      .where(and(eq(UserTable.workspaceID, Actor.workspace()), isNull(UserTable.timeDeleted))),
  ),
)
```

### Pattern 3: Update Operations with Authorization (user.ts:195-211)
**File**: `repos/metabob-opencode/packages/console/core/src/user.ts`
**Example**: User.update() function
- Actor.assertAdmin() for permission checks
- assertNotSelf() validation to prevent self-modification
- Workspace-scoped updates
- Returns result from database operation

```typescript
export const update = fn(
  z.object({
    id: z.string(),
    role: z.enum(UserRole),
    monthlyLimit: z.number().nullable(),
  }),
  async ({ id, role, monthlyLimit }) => {
    Actor.assertAdmin()
    if (role === "member") assertNotSelf(id)
    return await Database.use((tx) =>
      tx
        .update(UserTable)
        .set({ role, monthlyLimit })
        .where(and(eq(UserTable.id, id), eq(UserTable.workspaceID, Actor.workspace()))),
    )
  },
)
```

### Pattern 4: Soft Delete Pattern (user.ts:213-225)
**File**: `repos/metabob-opencode/packages/console/core/src/user.ts`
**Example**: User.remove() function
- Uses timeDeleted timestamp for soft delete
- SQL `now()` function for current timestamp
- Prevents self-deletion with assertNotSelf()
- Admin-only operation

```typescript
export const remove = fn(z.string(), async (id) => {
  Actor.assertAdmin()
  assertNotSelf(id)

  return await Database.use((tx) =>
    tx
      .update(UserTable)
      .set({
        timeDeleted: sql`now()`,
      })
      .where(and(eq(UserTable.id, id), eq(UserTable.workspaceID, Actor.workspace()))),
  )
})
```

### Pattern 5: Comprehensive Testing (test-endpoint.test.ts:14-41)
**File**: `repos/metabob-opencode/packages/opencode/test/server/test-endpoint.test.ts`
**Example**: Test structure for endpoints
- Uses bun:test framework
- Instance.provide() wrapper for test context
- Imports server via dynamic import
- Tests organized into describe blocks: success cases, validation errors, error handling, edge cases
- Uses app.request() to test endpoints
- Validates response status, headers, and JSON schema

```typescript
describe("GET /api/test", () => {
  let app: any

  beforeAll(async () => {
    await Instance.provide({
      directory: process.cwd(),
      init: InstanceBootstrap,
      fn: async () => {
        const { Server } = await import("../../src/server/server")
        app = Server.App()
      },
    })
  })

  describe("Success cases", () => {
    test("returns 200 with valid request and default limit", async () => {
      const res = await app.request("/api/test")
      
      expect(res.status).toBe(200)
      expect(res.headers.get("content-type")).toContain("application/json")

      const json = await res.json()
      expect(json).toBeDefined()
      expect(json.total).toBe(10)
    })
  })
})
```

### Naming Conventions
- Namespace functions: lowercase with verbs (get, list, update, remove)
- Endpoint paths: RESTful with resource names (/user/:id)
- Schema types: PascalCase with Info suffix (User.Info)
- Test files: kebab-case with .test.ts suffix

### Error Handling Approach
- Validation errors return 400 with structured error objects
- Not found errors return 404 with Storage.NotFoundError
- Authorization errors throw Error with descriptive message
- All errors caught by global error handler in server.ts
- Consistent error response format: `{ success: false, error: {...} }`

## Architecture

### File Structure
```
repos/metabob-opencode/packages/console/
├── core/src/
│   ├── user.ts                          # Add new profile functions here
│   └── schema/
│       └── user.sql.ts                  # Existing schema (no changes)
└── function/src/
    └── user-profile-api.ts              # New API endpoint handlers
```

Additional test files:
```
repos/metabob-opencode/packages/console/
└── test/
    └── user-profile-api.test.ts         # New integration tests
```

### Components

#### 1. Business Logic Functions (`repos/metabob-opencode/packages/console/core/src/user.ts`)
**Purpose**: Add new functions to existing User namespace for profile operations
**Public API**:
- `User.getProfile(id: string)` - Get user profile with email and metadata
- `User.updateProfile(params: { id, name, email })` - Update profile fields
- `User.fromID(id: string)` - Already exists, will be used internally

**Dependencies**:
- Actor (authorization context)
- Database (Drizzle ORM)
- UserTable, AuthTable schemas
- z (Zod validation)

**Implementation Details**:
- getProfile: LEFT JOIN with AuthTable to get email, filter by workspace and timeDeleted
- updateProfile: Validate email format, check for duplicates, Actor.assertAdmin() not required (users can edit own profile)
- Both functions use Actor.workspace() for workspace scoping

#### 2. API Endpoints (`repos/metabob-opencode/packages/console/function/src/user-profile-api.ts`)
**Purpose**: Hono router with profile endpoints
**Public API**:
- `GET /api/user/:id/profile` - Get user profile
- `PUT /api/user/:id/profile` - Update user profile
- `DELETE /api/user/:id` - Delete user (soft delete, delegates to existing User.remove)

**Dependencies**:
- Hono (web framework)
- hono-openapi (OpenAPI documentation)
- User namespace (business logic)
- Actor (authorization)
- Zod schemas

**Implementation Details**:
- Each endpoint uses describeRoute() for OpenAPI docs
- validator() middleware for input validation
- Error handling delegated to global handler
- Returns JSON with proper status codes

#### 3. Zod Schemas (`repos/metabob-opencode/packages/console/core/src/user.ts`)
**Purpose**: Request/response validation schemas
**Public API**:
- `User.ProfileInfo` - Response schema for profile data
- `User.UpdateProfileInput` - Input schema for profile updates

**Dependencies**: Zod

**Implementation Details**:
```typescript
export const ProfileInfo = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email().nullable(),
  role: z.enum(UserRole),
  timeCreated: z.number(),
  timeUpdated: z.number(),
}).meta({ ref: "UserProfile" })

export const UpdateProfileInput = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
})
```

#### 4. Integration Tests (`repos/metabob-opencode/packages/console/test/user-profile-api.test.ts`)
**Purpose**: Comprehensive endpoint testing
**Public API**: Test suites for each endpoint

**Dependencies**:
- bun:test
- Server.App()
- User namespace
- Instance.provide()

### Data Flow
```
HTTP Request
    ↓
[Hono Router] → validator() → endpoint handler
    ↓                              ↓
[Actor Context] ←─────────────────┘
    ↓
[User Namespace Function]
    ↓
[Database Query (Drizzle)]
    ↓
[UserTable + AuthTable]
    ↓
[Response JSON] → Client
```

### Error Scenarios

#### Scenario 1: User not found
**Trigger**: GET/PUT/DELETE with non-existent user ID
**Error Type**: Storage.NotFoundError (404)
**Handling**: Database query returns undefined, throw NotFoundError

#### Scenario 2: Invalid email format
**Trigger**: PUT with malformed email (e.g., "notanemail")
**Error Type**: Zod validation error (400)
**Handling**: validator() middleware catches and returns structured error

#### Scenario 3: Unauthorized deletion
**Trigger**: DELETE without admin role
**Error Type**: Error (403 via global handler)
**Handling**: Actor.assertAdmin() throws, caught by global error handler

#### Scenario 4: User in different workspace
**Trigger**: Request for user ID in another workspace
**Error Type**: Storage.NotFoundError (404)
**Handling**: Workspace-scoped query returns no results

#### Scenario 5: Duplicate email
**Trigger**: PUT with email already in use
**Error Type**: Database constraint violation (400)
**Handling**: Catch database error, return validation error

#### Scenario 6: Self-deletion attempt
**Trigger**: DELETE by user on their own account
**Error Type**: Error (400)
**Handling**: assertNotSelf() throws error with message

#### Scenario 7: Update with no fields
**Trigger**: PUT with empty body {}
**Error Type**: Validation error (400)
**Handling**: Zod schema requires at least one field

## Change Impact Analysis

### Files to Modify

#### 1. `repos/metabob-opencode/packages/console/core/src/user.ts`
**Why**: Add new profile-specific functions to User namespace
**Changes**:
- Add `User.getProfile()` function
- Add `User.updateProfile()` function
- Add `User.ProfileInfo` schema
- Add `User.UpdateProfileInput` schema

**Impact Check**: Low - Adding new exports, not modifying existing functions

#### 2. `repos/metabob-opencode/packages/console/function/src/user-profile-api.ts` (NEW FILE)
**Why**: Create new API endpoint handlers
**Changes**: Create complete new file with Hono router
**Impact Check**: None - New file, no dependencies

### Files to Create

#### 1. `repos/metabob-opencode/packages/console/function/src/user-profile-api.ts`
Router with three endpoints (GET, PUT, DELETE)

#### 2. `repos/metabob-opencode/packages/console/test/user-profile-api.test.ts`
Integration tests for all endpoints

## Testing Strategy

### Unit Tests
**Location**: Inline with business logic (optional, covered by integration tests)
- Test 1: User.getProfile() returns profile data with email
- Test 2: User.updateProfile() updates name field
- Test 3: User.updateProfile() updates email field
- Test 4: User.getProfile() throws for non-existent user

### Integration Tests
**Location**: `repos/metabob-opencode/packages/console/test/user-profile-api.test.ts`

#### Success Cases
- Test 1: GET /api/user/:id/profile returns 200 with profile data
- Test 2: GET /api/user/:id/profile includes email from AuthTable
- Test 3: PUT /api/user/:id/profile updates name successfully
- Test 4: PUT /api/user/:id/profile updates email successfully
- Test 5: PUT /api/user/:id/profile updates both name and email
- Test 6: DELETE /api/user/:id soft deletes user (admin only)
- Test 7: Response schemas match ProfileInfo schema

#### Validation Errors
- Test 8: GET with invalid user ID format returns 400
- Test 9: PUT with invalid email format returns 400
- Test 10: PUT with empty body returns 400
- Test 11: PUT with name too short returns 400
- Test 12: DELETE without admin role returns 403

#### Error Handling
- Test 13: GET with non-existent user ID returns 404
- Test 14: PUT with non-existent user ID returns 404
- Test 15: DELETE with non-existent user ID returns 404
- Test 16: PUT with duplicate email returns 400
- Test 17: DELETE on self returns 400

#### Authorization
- Test 18: All endpoints enforce workspace scoping
- Test 19: User from different workspace returns 404
- Test 20: DELETE requires admin role
- Test 21: GET/PUT work for non-admin users on own profile

### Edge Cases
- Case 1: User with null email (no auth record) - should return null in email field
- Case 2: Concurrent updates to same user - database handles via transactions
- Case 3: Update email to same value - should succeed (idempotent)
- Case 4: Profile request immediately after deletion - should return 404
- Case 5: Very long name (>255 chars) - should be caught by Zod validation
- Case 6: Email with unicode characters - should validate correctly
- Case 7: Request with malformed JSON body - caught by Hono parser
- Case 8: User deleted (timeDeleted set) - should not appear in GET results

## Implementation Checklist
- [x] Analyze existing patterns (server.ts, user.ts, test files)
- [x] Identify file locations and structure
- [x] Design ProfileInfo and UpdateProfileInput schemas
- [x] Design getProfile() function with AuthTable join
- [x] Design updateProfile() function with validation
- [x] Design API endpoints with OpenAPI docs
- [x] Plan authorization strategy (Actor.assertAdmin for DELETE only)
- [x] Document error scenarios with HTTP codes
- [x] Plan comprehensive test suite (21 tests)
- [x] Verify workspace scoping for all operations
- [x] Confirm soft delete pattern usage
- [x] Document data flow and dependencies
- [x] Validate against acceptance criteria

## Implementation Notes

### Authentication Strategy
- Uses existing Actor context pattern from console package
- GET and PUT: Any authenticated user can access own profile
- DELETE: Admin only (uses Actor.assertAdmin())
- All operations workspace-scoped via Actor.workspace()

### Database Schema
No changes needed to UserTable schema. Existing fields:
- id, name, email, accountID, workspaceID, role
- timeCreated, timeUpdated, timeDeleted
- monthlyLimit, monthlyUsage

Profile API exposes subset: id, name, email, role, timeCreated, timeUpdated

### API Integration Points
Endpoints can be mounted in existing API server:
```typescript
// In server.ts or main API router
import { UserProfileRoute } from "@opencode-ai/console-function/user-profile-api"
app.route("/api/user", UserProfileRoute)
```

### Future Enhancements (Out of Scope)
- PATCH endpoint for partial updates (currently PUT handles this)
- Profile photo upload
- User preferences/settings
- Activity history endpoint
- Email verification workflow
- Password change endpoint

## Success Validation

This design is complete and ready for implementation because:
1. All file paths are specific and accurate
2. All patterns validated against actual codebase
3. No placeholder paths (TBD/TODO/FIXME)
4. Error scenarios comprehensively documented
5. Test strategy covers success, validation, errors, and edge cases
6. Authorization model matches existing Actor pattern
7. Database operations use existing Drizzle patterns
8. API structure follows hono-openapi conventions
9. Change impact analyzed for all modified files
10. Integration points clearly defined
