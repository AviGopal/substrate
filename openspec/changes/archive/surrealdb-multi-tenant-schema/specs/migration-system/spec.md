## ADDED Requirements

### Requirement: Core schema migration runner in metabob-proto
The system SHALL provide a Bun-based migration runner in `metabob-proto/surrealdb/migrate.ts` that applies core multi-tenant schemas.

#### Scenario: Apply core schemas to fresh database
- **WHEN** migrate.ts runs against an empty database
- **THEN** all core schema files (001-auth-access through 004-subscriptions) are applied in order

#### Scenario: Skip already-applied migrations
- **WHEN** migrate.ts runs against a database with schema_version table indicating migration 002 is complete
- **THEN** only migrations 003 and later are applied

#### Scenario: Rollback on migration failure
- **WHEN** migration 003 fails due to syntax error
- **THEN** the transaction is rolled back and schema_version remains at 002

#### Scenario: Export applyCoreSchemas function
- **WHEN** activity-api imports @metabob/proto/surrealdb
- **THEN** the applyCoreSchemas function is available for import

### Requirement: Service-specific migration runners
The system SHALL provide separate migration runners in each service directory for service-owned schemas.

#### Scenario: Activity-api migration imports core schemas
- **WHEN** activity-api migrate.ts runs
- **THEN** it first calls applyCoreSchemas() before applying activity-specific schemas

#### Scenario: Analysis-api migration imports core schemas
- **WHEN** analysis-api migrate.ts runs
- **THEN** it first calls applyCoreSchemas() before applying analysis-specific schemas

#### Scenario: Service migration fails but core succeeds
- **WHEN** activity-api migration 011 fails but core migrations 001-004 succeeded
- **THEN** core schemas remain applied and only activity migration rolls back

### Requirement: Schema version tracking table
The system SHALL provide a `schema_version` table that records applied migrations with fields: `version`, `migration_name`, `applied_at`, `applied_by`, `checksum`, `success`.

#### Scenario: Record successful migration
- **WHEN** migration 003-projects.surql applies successfully
- **THEN** a schema_version record is created with version = 3, success = true, and timestamp

#### Scenario: Record failed migration
- **WHEN** migration 004-subscriptions.surql fails
- **THEN** a schema_version record is created with version = 4, success = false, and error message

#### Scenario: Query current schema version
- **WHEN** migration runner starts
- **THEN** it queries MAX(version) WHERE success = true from schema_version to determine current state

### Requirement: Migration file naming convention
The system SHALL enforce migration file naming pattern: `NNN-description.surql` where NNN is zero-padded 3-digit version.

#### Scenario: Valid migration filename
- **WHEN** a file named "001-auth-access.surql" is present
- **THEN** the migration runner parses version = 1 and description = "auth-access"

#### Scenario: Invalid migration filename rejected
- **WHEN** a file named "auth-access.surql" (no version number) is present
- **THEN** the migration runner throws error "Invalid migration filename"

#### Scenario: Gap in version numbers detected
- **WHEN** migrations 001, 002, 004 exist (003 missing)
- **THEN** the migration runner throws error "Gap detected: missing version 003"

### Requirement: Idempotent migration execution
The system SHALL support idempotent migrations using IF NOT EXISTS clauses where applicable.

#### Scenario: Re-run migration on table that exists
- **WHEN** migration 002 with "DEFINE TABLE IF NOT EXISTS organizations" runs twice
- **THEN** the second run succeeds without error (table already exists)

#### Scenario: Add field to existing table idempotently
- **WHEN** migration adds field with "DEFINE FIELD IF NOT EXISTS org_id"
- **THEN** running migration multiple times does not fail

### Requirement: Migration checksum validation
The system SHALL compute and validate checksums of migration files to detect unauthorized changes.

#### Scenario: Compute checksum on migration application
- **WHEN** migration 003 is applied
- **THEN** SHA256 checksum of file content is computed and stored in schema_version

#### Scenario: Detect modified migration file
- **WHEN** migration 003 has already been applied with checksum ABC, but file now has checksum DEF
- **THEN** migration runner throws error "Migration 003 has been modified after application"

### Requirement: Dry-run mode for testing
The system SHALL provide a --dry-run flag that shows SQL without executing.

#### Scenario: Dry-run shows pending migrations
- **WHEN** migration runner runs with --dry-run flag
- **THEN** it prints SQL content of pending migrations without executing

#### Scenario: Dry-run does not modify schema_version
- **WHEN** migration runner runs with --dry-run flag
- **THEN** no records are inserted into schema_version table

### Requirement: Rollback capability
The system SHALL provide a --rollback flag that reverts to specified version.

#### Scenario: Rollback to previous version
- **WHEN** rollback runs with --target-version=2
- **THEN** migrations 003 and 004 are reversed (DROP statements executed)

#### Scenario: Rollback updates schema_version
- **WHEN** rollback succeeds
- **THEN** schema_version records for rolled-back migrations are marked with success = false

#### Scenario: Rollback fails if no down migration
- **WHEN** migration file lacks DOWN section
- **THEN** rollback throws error "Migration 003 does not support rollback"

### Requirement: Environment-specific configuration
The system SHALL support environment variables for database connection and migration options.

#### Scenario: Connect using SURREALDB_URL
- **WHEN** migration runner starts with SURREALDB_URL=http://localhost:8000
- **THEN** it connects to specified URL with namespace/database from URL or env vars

#### Scenario: Use namespace/database from env
- **WHEN** SURREALDB_NAMESPACE=production and SURREALDB_DATABASE=metabob are set
- **THEN** migrations are applied to production:metabob

#### Scenario: Require authentication credentials
- **WHEN** migration runner starts without SURREALDB_USERNAME or SURREALDB_PASSWORD
- **THEN** it throws error "Missing authentication credentials"

### Requirement: Kubernetes migration job integration
The system SHALL support running migrations as Kubernetes Jobs with Helm pre-install/pre-upgrade hooks.

#### Scenario: Run migration job before deployment
- **WHEN** Helm chart is installed or upgraded
- **THEN** migration job runs with hook annotation "helm.sh/hook: pre-install,pre-upgrade"

#### Scenario: Deployment waits for migration completion
- **WHEN** migration job is running
- **THEN** main service deployment waits for migration job success

#### Scenario: Failed migration blocks deployment
- **WHEN** migration job exits with non-zero code
- **THEN** Helm rollback is triggered and deployment is aborted

#### Scenario: Migration job logs captured
- **WHEN** migration job runs
- **THEN** stdout/stderr are captured and available via kubectl logs
