# Shape Registry Specification

**Component:** Central shape definition registry in Activity-API
**Purpose:** Provide versioned shape definitions for impulse validation and vessel-to-vessel communication

---

## Design Principles

1. **Single Source of Truth** - Activity-API is the authoritative registry for all shape definitions
2. **Semantic Versioning** - Shapes use semver (MAJOR.MINOR.PATCH) for backward compatibility tracking
3. **Metadata First** - Shape metadata describes structure without containing actual data
4. **Validation at Boundaries** - Impulses validated against registered shapes at creation and resolution
5. **Backward Compatibility** - Breaking changes require MAJOR version bump with explicit deprecation

---

## Requirements

### Requirement: Shape definition schema
The system SHALL store shape definitions with name, description, version, JSON schema, and example.

#### Scenario: Register new shape definition
- **WHEN** vessel registers shape with name="file_diff", version="1.0.0", schema={...}, example={...}
- **THEN** system stores shape_definition record with all metadata and returns shape_id

#### Scenario: Retrieve shape by name and version
- **WHEN** client requests GET /v2/shapes/file_diff?version=1.0.0
- **THEN** system returns shape definition with schema and example

#### Scenario: List all versions of a shape
- **WHEN** client requests GET /v2/shapes/file_diff/versions
- **THEN** system returns array of all registered versions for file_diff shape, sorted by semver

### Requirement: Semantic versioning enforcement
The system SHALL enforce semantic versioning rules for shape definitions.

#### Scenario: Register patch version with compatible changes
- **WHEN** vessel registers file_diff version 1.0.1 with only documentation changes
- **THEN** system accepts registration and marks as backward compatible with 1.0.0

#### Scenario: Register major version with breaking changes
- **WHEN** vessel registers file_diff version 2.0.0 with removed required field
- **THEN** system accepts registration and marks as breaking change from 1.x.x

#### Scenario: Prevent version downgrade
- **WHEN** vessel attempts to register file_diff version 1.0.0 after 1.1.0 exists
- **THEN** system returns 400 Bad Request with error "Cannot register older version"

#### Scenario: Enforce semver format
- **WHEN** vessel attempts to register shape with version="latest" or version="v1"
- **THEN** system returns 400 Bad Request with error "Version must follow semver format (MAJOR.MINOR.PATCH)"

### Requirement: Shape validation for impulses
The system SHALL validate impulse content against registered shape schemas.

#### Scenario: Validate impulse against shape schema
- **WHEN** impulse created with shape="file_diff" version="1.0.0" and valid content
- **THEN** system validates content against registered JSON schema and accepts impulse

#### Scenario: Reject impulse with invalid content
- **WHEN** impulse created with shape="file_diff" but missing required field "old_path"
- **THEN** system returns 400 Bad Request with validation error "Missing required field: old_path"

#### Scenario: Validate using latest compatible version
- **WHEN** impulse specifies shape="file_diff" with version constraint "^1.0.0" and latest is 1.2.0
- **THEN** system validates against 1.2.0 schema (latest compatible with constraint)

#### Scenario: Automatic validation on impulse creation
- **WHEN** POST /v2/impulses called with shape reference in metadata
- **THEN** system validates content before storing impulse record

### Requirement: Backward compatibility rules
The system SHALL enforce backward compatibility constraints based on semver.

#### Scenario: PATCH version allows optional fields
- **WHEN** vessel registers file_diff 1.0.1 adding optional field "author"
- **THEN** system accepts registration as backward compatible patch

#### Scenario: MINOR version allows new optional fields
- **WHEN** vessel registers file_diff 1.1.0 adding optional field "commit_sha"
- **THEN** system accepts registration as backward compatible minor version

#### Scenario: MAJOR version for removed fields
- **WHEN** vessel registers file_diff 2.0.0 removing previously required field "old_path"
- **THEN** system accepts as breaking change requiring major version bump

#### Scenario: Prevent breaking changes in MINOR version
- **WHEN** vessel attempts to register 1.1.0 that removes required field from 1.0.0
- **THEN** system returns 400 Bad Request with error "Breaking change requires major version bump"

#### Scenario: Deprecation warning for old versions
- **WHEN** client requests shape version 1.0.0 and current major version is 3.x.x
- **THEN** system returns shape with deprecation warning "Version 1.x.x is deprecated, migrate to 3.x.x"

### Requirement: Shape metadata schema
The system SHALL enforce shape_definition table schema with all required fields.

#### Scenario: Complete shape registration
- **WHEN** vessel registers shape with all required fields (name, version, schema, description, example)
- **THEN** system creates shape_definition record with org_id, created_at, and public flag

#### Scenario: Missing required field
- **WHEN** vessel attempts to register shape without "schema" field
- **THEN** system returns 400 Bad Request with error "Field 'schema' is required"

#### Scenario: Invalid JSON schema
- **WHEN** vessel registers shape with malformed JSON in schema field
- **THEN** system returns 400 Bad Request with error "Invalid JSON schema syntax"

#### Scenario: Example validation against schema
- **WHEN** vessel registers shape where example does not match provided schema
- **THEN** system returns 400 Bad Request with error "Example must validate against schema"

### Requirement: Multi-tenant shape isolation
The system SHALL enforce org-scoped shape access with public shape visibility.

#### Scenario: Org-private shape creation
- **WHEN** org A registers shape with public=false
- **THEN** shape is only visible to org A members

#### Scenario: Public shape visibility
- **WHEN** org A registers shape with public=true
- **THEN** shape is visible to all organizations

#### Scenario: Prevent cross-org private shape access
- **WHEN** org B requests private shape created by org A
- **THEN** system returns 404 Not Found

#### Scenario: Global public shapes
- **WHEN** system bootstrap registers shapes with org_id=NULL and public=true
- **THEN** shapes are visible to all organizations as global standards

### Requirement: Shape registry API endpoints
The system SHALL provide REST API for shape registration, retrieval, and search.

#### Scenario: Register new shape
- **WHEN** POST /v2/shapes called with valid shape definition
- **THEN** system validates, stores, and returns 201 Created with shape_id and version

#### Scenario: Get shape by name and version
- **WHEN** GET /v2/shapes/{name}?version={semver}
- **THEN** system returns shape definition with schema, example, and metadata

#### Scenario: Get latest shape version
- **WHEN** GET /v2/shapes/{name} without version parameter
- **THEN** system returns latest MAJOR version of shape

#### Scenario: List all shapes
- **WHEN** GET /v2/shapes
- **THEN** system returns array of latest version of each shape accessible to requesting org

#### Scenario: Search shapes by tag
- **WHEN** GET /v2/shapes?tag=analysis
- **THEN** system returns all shapes tagged with "analysis"

#### Scenario: List shape versions
- **WHEN** GET /v2/shapes/{name}/versions
- **THEN** system returns all versions of shape sorted descending by semver

### Requirement: Version constraint resolution
The system SHALL support semver constraints for shape resolution.

#### Scenario: Resolve exact version
- **WHEN** impulse specifies shape version "1.2.3"
- **THEN** system validates against exactly version 1.2.3

#### Scenario: Resolve caret constraint
- **WHEN** impulse specifies shape version "^1.2.0"
- **THEN** system validates against latest version >=1.2.0 and <2.0.0

#### Scenario: Resolve tilde constraint
- **WHEN** impulse specifies shape version "~1.2.0"
- **THEN** system validates against latest version >=1.2.0 and <1.3.0

#### Scenario: Resolve wildcard minor
- **WHEN** impulse specifies shape version "1.x"
- **THEN** system validates against latest 1.x.x version

#### Scenario: No matching version
- **WHEN** impulse specifies shape version "^2.0.0" but only 1.x.x versions exist
- **THEN** system returns 400 Bad Request with error "No version matches constraint ^2.0.0"

### Requirement: Shape evolution tracking
The system SHALL track shape evolution history and migration paths.

#### Scenario: Record shape lineage
- **WHEN** vessel registers file_diff 2.0.0 with migration_from="1.x.x"
- **THEN** system stores migration path from 1.x.x to 2.0.0

#### Scenario: Query migration path
- **WHEN** GET /v2/shapes/file_diff/migrations?from=1.0.0&to=2.0.0
- **THEN** system returns breaking changes and suggested migration steps

#### Scenario: Changelog per version
- **WHEN** vessel registers new version with changelog field
- **THEN** system stores changelog and returns in version history

#### Scenario: Breaking changes summary
- **WHEN** GET /v2/shapes/{name}?version={major.0.0}
- **THEN** response includes breaking_changes array listing all breaking changes from previous major

---

## Data Schema

### shape_definition Table

```typescript
{
  id: string,                      // Record ID
  name: string,                    // Shape name (e.g., "file_diff")
  version: string,                 // Semver (e.g., "1.2.3")
  schema: object,                  // JSON Schema definition
  description: string,             // Human-readable description
  example: object,                 // Valid example matching schema
  tags: string[],                  // Optional categorization tags
  public: boolean,                 // If true, visible to all orgs
  org_id: string?,                 // Null for global shapes, org_id for private
  deprecated: boolean,             // Deprecation flag
  deprecation_reason: string?,     // Why deprecated
  migration_from: string?,         // Previous version(s) this replaces
  breaking_changes: string[],      // List of breaking changes from previous major
  changelog: string?,              // Version-specific changes
  created_at: datetime,
  created_by: string,              // User ID who registered shape
}
```

### shape_version_constraint Type

```typescript
{
  shape_name: string,              // Name of shape
  version_constraint: string,      // Semver constraint (^1.0.0, ~1.2.0, 1.x, etc.)
}
```

---

## API Endpoints

### POST /v2/shapes
Register new shape definition.

**Request Body:**
```json
{
  "name": "file_diff",
  "version": "1.0.0",
  "schema": {
    "type": "object",
    "required": ["old_path", "new_path", "hunks"],
    "properties": {
      "old_path": { "type": "string" },
      "new_path": { "type": "string" },
      "hunks": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["old_start", "old_lines", "new_start", "new_lines", "content"],
          "properties": {
            "old_start": { "type": "number" },
            "old_lines": { "type": "number" },
            "new_start": { "type": "number" },
            "new_lines": { "type": "number" },
            "content": { "type": "string" }
          }
        }
      }
    }
  },
  "description": "Unified diff format for file changes",
  "example": {
    "old_path": "src/index.ts",
    "new_path": "src/index.ts",
    "hunks": [
      {
        "old_start": 10,
        "old_lines": 3,
        "new_start": 10,
        "new_lines": 5,
        "content": "@@ -10,3 +10,5 @@\n-old line\n+new line\n+another line"
      }
    ]
  },
  "tags": ["analysis", "git"],
  "public": true,
  "changelog": "Initial release"
}
```

**Response (201 Created):**
```json
{
  "id": "shape_definition:01HZYX9W3KQZ8YV0GCDPQR5T2F",
  "name": "file_diff",
  "version": "1.0.0",
  "created_at": "2026-04-10T14:30:00Z"
}
```

### GET /v2/shapes/{name}
Get latest version of shape or specific version.

**Query Parameters:**
- `version` (optional): Semver or constraint (e.g., "1.2.3", "^1.0.0", "~1.2.0")

**Response (200 OK):**
```json
{
  "id": "shape_definition:01HZYX9W3KQZ8YV0GCDPQR5T2F",
  "name": "file_diff",
  "version": "1.0.0",
  "schema": { ... },
  "description": "Unified diff format for file changes",
  "example": { ... },
  "tags": ["analysis", "git"],
  "public": true,
  "deprecated": false,
  "created_at": "2026-04-10T14:30:00Z"
}
```

### GET /v2/shapes/{name}/versions
List all versions of a shape.

**Response (200 OK):**
```json
{
  "name": "file_diff",
  "versions": [
    {
      "version": "2.0.0",
      "created_at": "2026-04-15T10:00:00Z",
      "breaking_changes": ["Removed old_path field", "Added unified_path field"],
      "deprecated": false
    },
    {
      "version": "1.2.0",
      "created_at": "2026-04-12T08:30:00Z",
      "breaking_changes": [],
      "deprecated": false
    },
    {
      "version": "1.0.0",
      "created_at": "2026-04-10T14:30:00Z",
      "breaking_changes": [],
      "deprecated": true,
      "deprecation_reason": "Migrate to 2.x for improved API"
    }
  ]
}
```

### GET /v2/shapes
List all accessible shapes (latest version only).

**Query Parameters:**
- `tag` (optional): Filter by tag
- `public_only` (optional): Only return public shapes

**Response (200 OK):**
```json
{
  "shapes": [
    {
      "name": "file_diff",
      "version": "2.0.0",
      "description": "Unified diff format for file changes",
      "tags": ["analysis", "git"],
      "public": true
    },
    {
      "name": "error_log",
      "version": "1.0.0",
      "description": "Structured error log entry",
      "tags": ["logging", "debugging"],
      "public": true
    }
  ]
}
```

### GET /v2/shapes/{name}/migrations
Get migration path between versions.

**Query Parameters:**
- `from`: Source version (semver)
- `to`: Target version (semver)

**Response (200 OK):**
```json
{
  "from": "1.0.0",
  "to": "2.0.0",
  "breaking_changes": [
    "Removed field: old_path",
    "Removed field: new_path",
    "Added field: unified_path (string)"
  ],
  "migration_steps": [
    "Combine old_path and new_path into unified_path using format 'old_path -> new_path'",
    "Update all impulse creation code to use unified_path"
  ]
}
```

### POST /v2/impulses (enhanced with validation)
Create impulse with automatic shape validation.

**Request Body:**
```json
{
  "pointer": {
    "type": "memo",
    "content": {
      "old_path": "src/index.ts",
      "new_path": "src/index.ts",
      "hunks": [ ... ]
    }
  },
  "metadata": {
    "shape": "file_diff",
    "shape_version": "^1.0.0",
    "priority": "high",
    "budget": 5000
  }
}
```

**Validation Process:**
1. Resolve shape_version constraint to specific version
2. Validate pointer.content against resolved shape schema
3. Store impulse if valid, reject with 400 if invalid

---

## Versioning Strategy

### MAJOR Version (Breaking Changes)
- Removed required field
- Changed field type incompatibly (string → number)
- Renamed field without alias
- Changed validation constraints to be more restrictive

### MINOR Version (Backward Compatible Features)
- Added optional field
- Added new enum value
- Relaxed validation constraints
- Added field alias for renamed field

### PATCH Version (Fixes and Documentation)
- Documentation updates
- Example improvements
- Schema description clarifications
- Bug fixes that don't affect validation

---

## Migration Example

```typescript
// Example: Migrating from file_diff 1.0.0 to 2.0.0

// Version 1.0.0 impulse
const impulse_v1 = {
  shape: "file_diff",
  shape_version: "1.0.0",
  content: {
    old_path: "src/auth.ts",
    new_path: "src/auth.ts",
    hunks: [ ... ]
  }
};

// Version 2.0.0 impulse (breaking change: unified path)
const impulse_v2 = {
  shape: "file_diff",
  shape_version: "2.0.0",
  content: {
    unified_path: "src/auth.ts",  // Combined old_path and new_path
    hunks: [ ... ]
  }
};

// Migration function (generated from registry)
function migrate_file_diff_1_to_2(v1_content) {
  return {
    unified_path: v1_content.old_path === v1_content.new_path
      ? v1_content.old_path
      : `${v1_content.old_path} -> ${v1_content.new_path}`,
    hunks: v1_content.hunks
  };
}
```

---

## Performance Characteristics

| Operation | Target Latency | Notes |
|-----------|----------------|-------|
| Register shape | <100ms | Includes schema validation |
| Get shape by version | <10ms | Cached in Redis |
| Validate impulse content | <50ms | JSON Schema validation |
| Resolve version constraint | <20ms | In-memory semver resolution |
| List shape versions | <50ms | Database query with index |

---

## Bootstrap Shapes

The system SHALL include these global public shapes on deployment:

1. **memo** (1.0.0): Embedded text content
2. **file** (1.0.0): File system reference with path and range
3. **activityExecutionTrace** (1.0.0): Full execution trace with state
4. **activityTemplate** (1.0.0): Activity template structure
5. **activityMetrics** (1.0.0): Performance metrics
6. **error_log** (1.0.0): Structured error entry
7. **file_diff** (1.0.0): Unified diff format
8. **code_review_comment** (1.0.0): Review feedback structure

These shapes provide the foundation for vessel-to-vessel communication and are maintained by the platform team.
