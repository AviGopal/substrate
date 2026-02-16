# Metabob Admin CLI - Complete Reference Guide

**Version**: 1.1.0  
**Date**: February 16, 2026  
**Status**: Production Ready

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Installation & Setup](#installation--setup)
3. [Command Reference](#command-reference)
4. [Common Workflows](#common-workflows)
5. [Database Management](#database-management)
6. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites
```bash
# 1. Start backend services
docker-compose up -d surreal redis api-server

# 2. Verify services
curl http://localhost:8080/status
# Expected: {"status":"ok","version":"0.16.x"}
```

### Basic Commands
```bash
# Navigate to RPC API directory
cd repos/metabob-rpc-api

# Check database stats
python -m admin.cli db stats

# List organizations
python -m admin.cli orgs list

# List users
python -m admin.cli users list

# List API keys
python -m admin.cli apikeys list

# Query database directly
python -m admin.cli db query "SELECT * FROM users LIMIT 5"
```

---

## Installation & Setup

### Method 1: Direct Python (Recommended)

```bash
# From the metabob-rpc-api directory
cd repos/metabob-rpc-api

# Install dependencies (if needed)
pip install -r requirements.txt

# Run CLI
python -m admin.cli --help
```

### Method 2: Docker Container

```bash
# Execute inside api-server container
docker exec -it metabob-rpc-api-server-dev-1 \
  python -m admin.cli db stats
```

### Method 3: Create Alias (Optional)

```bash
# Add to ~/.bashrc or ~/.zshrc
alias metabob-admin='cd /path/to/repos/metabob-rpc-api && python -m admin.cli'

# Usage
metabob-admin db stats
metabob-admin users list
```

---

## Command Reference

### Overview

The admin CLI has 8 command groups:

| Group | Purpose | Example |
|-------|---------|---------|
| `activities` | Activity template management | `activities list` |
| `users` | User account management | `users list --org-id exp-repo` |
| `orgs` | Organization management | `orgs get exp-repo` |
| `apikeys` | API key management | `apikeys list` |
| `projects` | Project management | `projects list` |
| `db` | Direct database operations | `db query "SELECT * FROM users"` |
| `sessions` | Session management | `sessions list` |
| `config` | Configuration & health | `config check` |

---

### 1. Activities Commands

Manage activity templates with genealogy tracking.

#### `activities list`
List all activity templates.

```bash
python -m admin.cli activities list

# Filter by status
python -m admin.cli activities list --status active
python -m admin.cli activities list --status testing

# Filter by activity ID
python -m admin.cli activities list --activity-id feature-impl

# Filter by evolution type
python -m admin.cli activities list --evolution derived

# JSON output
python -m admin.cli activities list --format json

# Limit results
python -m admin.cli activities list --limit 10
```

**Options**:
- `--status, -s`: Filter by status (draft/testing/active/deprecated/all)
- `--activity-id, -a`: Filter by activity ID
- `--evolution, -e`: Filter by evolution type (root/derived/merged/refined/split/all)
- `--format, -f`: Output format (table/json)
- `--limit, -l`: Maximum results (default: 50)

**Output**:
```
variant_id             activity_id      status  content_hash  parent_hash  evolution
feature-impl-abc123    feature-impl     active  a1b2c3d4...   -           root
bug-fix-def456         bug-fix          active  e5f6g7h8...   -           root
refactor-ghi789        refactor         testing i9j0k1l2...   a1b2c3...   derived
```

#### `activities get <variant_id>`
Get details of a specific template.

```bash
python -m admin.cli activities get feature-impl-abc123

# JSON output
python -m admin.cli activities get feature-impl-abc123 --format json
```

**Output shows**:
- Template metadata (name, description, category)
- Task definitions
- Variables and their types
- Context requirements
- Performance metrics
- Genealogy information

#### `activities seed`
Seed bootstrap templates from metabob-proto.

```bash
# Seed from default location
python -m admin.cli activities seed

# Seed from custom path
python -m admin.cli activities seed --source /path/to/templates

# Dry run (preview without applying)
python -m admin.cli activities seed --dry-run
```

**Options**:
- `--source`: Path to template directory (default: ../metabob-proto/activities/bootstrap)
- `--dry-run`: Show what would be seeded without applying
- `--force`: Overwrite existing templates

**Use case**: Cold-start database initialization

#### `activities derive <parent_id>`
Create a derived variant from an existing template.

```bash
# Create derived variant
python -m admin.cli activities derive feature-impl-abc123 \
  --name "v2-optimized" \
  --description "Optimized version with better prompts"

# Specify changes as JSON
python -m admin.cli activities derive bug-fix-def456 \
  --name "v2-with-tests" \
  --changes '{"task_steps": [...]}'
```

**Options**:
- `--name`: Name for new variant (required)
- `--description`: Description of changes
- `--changes`: JSON with modifications

#### `activities lineage <variant_id>`
Show genealogy tree for a template.

```bash
python -m admin.cli activities lineage feature-impl-abc123
```

**Output**:
```
feature-impl-abc123 (root)
├── feature-impl-def456 (derived)
│   └── feature-impl-ghi789 (refined)
└── feature-impl-jkl012 (split)
```

#### `activities metrics`
Show performance metrics for templates.

```bash
# Metrics for specific variant
python -m admin.cli activities metrics feature-impl-abc123

# Metrics for all variants
python -m admin.cli activities metrics --all

# Summary statistics
python -m admin.cli activities metrics --summary
```

**Output shows**:
- Success rate
- Average execution time
- Average cost
- Common failure modes

#### `activities export`
Export templates to JSON files.

```bash
# Export all templates
python -m admin.cli activities export --output ./templates/

# Export specific template
python -m admin.cli activities export --variant-id feature-impl-abc123 --output ./templates/
```

#### `activities import`
Import templates from JSON files.

```bash
# Import all templates from directory
python -m admin.cli activities import --source ./templates/

# Import specific file
python -m admin.cli activities import --file ./templates/feature-impl.json
```

---

### 2. Users Commands

Manage user accounts.

#### `users list`
List all users.

```bash
python -m admin.cli users list

# Filter by organization
python -m admin.cli users list --org-id exp-repo

# Filter by role
python -m admin.cli users list --role admin

# JSON output
python -m admin.cli users list --format json

# CSV output
python -m admin.cli users list --format csv

# Limit results
python -m admin.cli users list --limit 50
```

**Options**:
- `--org-id`: Filter by organization ID
- `--role`: Filter by role (owner/admin/member)
- `--limit`: Maximum results (default: 100)
- `--format`: Output format (table/json/csv)

**Output**:
```
+----------------------+-------------------------+--------+-------------+---------------------+---------------------+
| User ID              | Email                   | Role   | Org ID      | Created             | Last Login          |
+======================+=========================+========+=============+=====================+=====================+
| user_abc123          | admin@metabob.com       | owner  | exp-repo    | 2026-01-15 10:30:00 | 2026-02-16 08:00:00 |
| user_def456          | developer@metabob.com   | member | exp-repo    | 2026-01-20 14:15:00 | 2026-02-15 16:45:00 |
+----------------------+-------------------------+--------+-------------+---------------------+---------------------+
```

#### `users get <user_id>`
Get user details.

```bash
python -m admin.cli users get user_abc123

# JSON output
python -m admin.cli users get user_abc123 --format json
```

#### `users create`
Create a new user.

```bash
python -m admin.cli users create \
  --email "newuser@example.com" \
  --password "secure-password" \
  --org-id "exp-repo" \
  --role "member"
```

**Options**:
- `--email`: User email (required)
- `--password`: User password (required)
- `--org-id`: Organization ID (required)
- `--role`: User role (owner/admin/member, default: member)
- `--name`: User's full name (optional)

#### `users update <user_id>`
Update user details.

```bash
# Update email
python -m admin.cli users update user_abc123 --email "newemail@example.com"

# Update role
python -m admin.cli users update user_abc123 --role admin

# Update name
python -m admin.cli users update user_abc123 --name "John Doe"
```

#### `users delete <user_id>`
Delete a user (soft delete).

```bash
python -m admin.cli users delete user_abc123

# Hard delete (permanent)
python -m admin.cli users delete user_abc123 --hard
```

#### `users reset-password <user_id>`
Reset user password.

```bash
# Generate random password
python -m admin.cli users reset-password user_abc123

# Set specific password
python -m admin.cli users reset-password user_abc123 --password "new-secure-password"
```

---

### 3. Orgs Commands

Manage organizations.

#### `orgs list`
List all organizations.

```bash
python -m admin.cli orgs list

# JSON output
python -m admin.cli orgs list --format json

# CSV output
python -m admin.cli orgs list --format csv

# Limit results
python -m admin.cli orgs list --limit 50
```

**Output**:
```
+-------------+-------------------+---------+------------+---------------------+
| Org ID      | Name              | Members | Seat Limit | Created             |
+=============+===================+=========+============+=====================+
| exp-repo    | Experimental Repo | 5       | 10         | 2026-01-10 12:00:00 |
| prod-org    | Production Org    | 20      | 50         | 2025-12-01 09:00:00 |
+-------------+-------------------+---------+------------+---------------------+
```

#### `orgs get <org_id>`
Get organization details.

```bash
python -m admin.cli orgs get exp-repo

# JSON output
python -m admin.cli orgs get exp-repo --format json
```

**Output shows**:
- Organization metadata
- Member count
- Seat limits
- Projects associated
- API key count

#### `orgs create`
Create a new organization.

```bash
python -m admin.cli orgs create \
  --name "New Organization" \
  --org-id "new-org" \
  --seat-limit 10
```

**Options**:
- `--name`: Organization name (required)
- `--org-id`: Organization ID (optional, auto-generated if not provided)
- `--seat-limit`: Maximum number of members (default: 5)
- `--description`: Organization description (optional)

#### `orgs update <org_id>`
Update organization details.

```bash
# Update seat limit
python -m admin.cli orgs update exp-repo --seat-limit 20

# Update name
python -m admin.cli orgs update exp-repo --name "Updated Name"
```

#### `orgs delete <org_id>`
Delete an organization.

```bash
python -m admin.cli orgs delete old-org

# Force delete (bypasses safety checks)
python -m admin.cli orgs delete old-org --force
```

⚠️ **Warning**: Deleting an organization will also delete all associated users, projects, and API keys.

---

### 4. API Keys Commands

Manage API keys.

#### `apikeys list`
List all API keys.

```bash
python -m admin.cli apikeys list

# Filter by organization
python -m admin.cli apikeys list --org-id exp-repo

# JSON output
python -m admin.cli apikeys list --format json

# Limit results
python -m admin.cli apikeys list --limit 50
```

**Output**:
```
+----------------+-----------------+-------------+-----------+--------+---------------------+---------------------+
| Key ID         | Name            | Org ID      | Scopes    | Status | Created             | Expires             |
+================+=================+=============+===========+========+=====================+=====================+
| key_abc123...  | Dashboard Key   | exp-repo    | read,write| Active | 2026-01-15 10:00:00 | Never               |
| key_def456...  | CI/CD Key       | exp-repo    | read      | Active | 2026-02-01 14:00:00 | 2026-08-01 00:00:00 |
+----------------+-----------------+-------------+-----------+--------+---------------------+---------------------+
```

#### `apikeys get <key_id>`
Get API key details.

```bash
python -m admin.cli apikeys get key_abc123

# JSON output
python -m admin.cli apikeys get key_abc123 --format json
```

#### `apikeys create`
Create a new API key.

```bash
python -m admin.cli apikeys create \
  --name "New Dashboard Key" \
  --org-id "exp-repo" \
  --scopes "read,write,admin"

# With expiration
python -m admin.cli apikeys create \
  --name "Temporary Key" \
  --org-id "exp-repo" \
  --scopes "read" \
  --expires "2026-12-31"
```

**Options**:
- `--name`: Key name (required)
- `--org-id`: Organization ID (required)
- `--scopes`: Comma-separated scopes (default: "read,write")
- `--expires`: Expiration date (YYYY-MM-DD, optional)
- `--description`: Key description (optional)

**Output**: Prints the full API key (only shown once!)

#### `apikeys revoke <key_id>`
Revoke an API key.

```bash
python -m admin.cli apikeys revoke key_abc123
```

**Note**: Revoked keys cannot be un-revoked. Create a new key instead.

#### `apikeys rotate <key_id>`
Rotate an API key (create new, revoke old).

```bash
python -m admin.cli apikeys rotate key_abc123
```

**Output**: New API key (only shown once!)

---

### 5. Projects Commands

Manage projects.

#### `projects list`
List all projects.

```bash
python -m admin.cli projects list

# Filter by organization
python -m admin.cli projects list --org-id exp-repo

# JSON output
python -m admin.cli projects list --format json
```

#### `projects get <project_id>`
Get project details.

```bash
python -m admin.cli projects get exp-repo-dev
```

#### `projects create`
Create a new project.

```bash
python -m admin.cli projects create \
  --name "New Project" \
  --project-id "new-project" \
  --org-id "exp-repo"
```

#### `projects delete <project_id>`
Delete a project.

```bash
python -m admin.cli projects delete old-project
```

---

### 6. Database Commands

Direct database operations using SurrealDB queries.

#### `db query <query>`
Execute a SurrealDB query.

```bash
# Simple select
python -m admin.cli db query "SELECT * FROM users LIMIT 5"

# Query with parameters
python -m admin.cli db query \
  "SELECT * FROM users WHERE org_id = \$org_id" \
  --params '{"org_id": "exp-repo"}'

# Count records
python -m admin.cli db query "SELECT count() FROM organizations GROUP ALL"

# Table format
python -m admin.cli db query "SELECT * FROM users" --format table

# JSON format (default)
python -m admin.cli db query "SELECT * FROM users" --format json
```

**Common Queries**:
```sql
-- List all tables
INFO FOR DB

-- Count records in a table
SELECT count() FROM users GROUP ALL

-- Get recent activity
SELECT * FROM executions ORDER BY created_at DESC LIMIT 10

-- Get active API keys
SELECT * FROM api_keys WHERE revoked_at IS NULL

-- Get users in an org
SELECT * FROM users WHERE org_id = 'exp-repo'

-- Get user with their org info
SELECT *, org_id.* FROM users WHERE user_id = 'user_abc123'

-- Search by email
SELECT * FROM users WHERE email CONTAINS 'metabob'
```

#### `db stats`
Get database statistics.

```bash
python -m admin.cli db stats
```

**Output**:
```
============================================================
Database Statistics
============================================================
users               : 12
organizations       : 3
api_keys            : 8
projects            : 15
============================================================
```

#### `db export`
Export database to JSON.

```bash
# Export all data
python -m admin.cli db export --output ./backup.json

# Export specific table
python -m admin.cli db export --output ./users.json --table users
```

#### `db import`
Import data from JSON.

```bash
# Import all data
python -m admin.cli db import --input ./backup.json

# Import specific table
python -m admin.cli db import --input ./users.json --table users
```

⚠️ **Warning**: Import will overwrite existing data. Create a backup first!

---

### 7. Sessions Commands

Manage user sessions.

#### `sessions list`
List active sessions.

```bash
python -m admin.cli sessions list

# Filter by user
python -m admin.cli sessions list --user-id user_abc123
```

#### `sessions get <session_id>`
Get session details.

```bash
python -m admin.cli sessions get session_abc123
```

#### `sessions revoke <session_id>`
Revoke a session.

```bash
python -m admin.cli sessions revoke session_abc123
```

#### `sessions cleanup`
Remove expired sessions.

```bash
python -m admin.cli sessions cleanup
```

---

### 8. Config Commands

Configuration and health checks.

#### `config check`
Check system configuration and connectivity.

```bash
python -m admin.cli config check
```

**Output**:
```
✅ SurrealDB connection: OK
✅ Redis connection: OK
✅ Database schema: OK
✅ Required tables: OK
⚠️  Missing indexes on users.email
```

#### `config show`
Show current configuration.

```bash
python -m admin.cli config show
```

#### `config test`
Test database connectivity.

```bash
python -m admin.cli config test
```

---

## Common Workflows

### Workflow 1: Cold-Start Database Setup

Starting from an empty database:

```bash
cd repos/metabob-rpc-api

# 1. Create first organization
python -m admin.cli orgs create \
  --name "Main Organization" \
  --org-id "main-org" \
  --seat-limit 10

# 2. Create admin user
python -m admin.cli users create \
  --email "admin@example.com" \
  --password "secure-password" \
  --org-id "main-org" \
  --role "owner"

# 3. Create API key
python -m admin.cli apikeys create \
  --name "Admin API Key" \
  --org-id "main-org" \
  --scopes "read,write,admin"
# Save the printed API key!

# 4. Seed activity templates
python -m admin.cli activities seed

# 5. Verify setup
python -m admin.cli db stats
python -m admin.cli config check
```

**Result**: Fully configured system ready for use.

---

### Workflow 2: Onboard New Organization

```bash
# 1. Create organization
python -m admin.cli orgs create \
  --name "ACME Corp" \
  --org-id "acme" \
  --seat-limit 25

# 2. Create owner account
python -m admin.cli users create \
  --email "owner@acme.com" \
  --password "temp-password-123" \
  --org-id "acme" \
  --role "owner"

# 3. Create initial project
python -m admin.cli projects create \
  --name "ACME Main Project" \
  --project-id "acme-main" \
  --org-id "acme"

# 4. Create API key for organization
python -m admin.cli apikeys create \
  --name "ACME API Key" \
  --org-id "acme" \
  --scopes "read,write"

# 5. Send credentials to customer
echo "Organization: acme"
echo "Owner email: owner@acme.com"
echo "Temporary password: temp-password-123"
echo "API Key: [key from step 4]"
```

---

### Workflow 3: Investigate Production Issue

```bash
# 1. Check database health
python -m admin.cli config check

# 2. Get database stats
python -m admin.cli db stats

# 3. Check recent activity
python -m admin.cli db query \
  "SELECT * FROM executions ORDER BY created_at DESC LIMIT 10"

# 4. Find affected users
python -m admin.cli users list --org-id problematic-org

# 5. Check API key usage
python -m admin.cli apikeys list --org-id problematic-org

# 6. Review error logs (custom query)
python -m admin.cli db query \
  "SELECT * FROM executions WHERE status = 'failed' ORDER BY created_at DESC LIMIT 20"
```

---

### Workflow 4: User Management

```bash
# Add new user to existing org
python -m admin.cli users create \
  --email "newdev@example.com" \
  --password "temp-pass-456" \
  --org-id "exp-repo" \
  --role "member"

# Promote user to admin
python -m admin.cli users update user_abc123 --role admin

# Reset forgotten password
python -m admin.cli users reset-password user_def456

# Remove user
python -m admin.cli users delete user_ghi789
```

---

### Workflow 5: API Key Rotation

```bash
# 1. List current keys
python -m admin.cli apikeys list --org-id exp-repo

# 2. Create new key
python -m admin.cli apikeys create \
  --name "New Production Key" \
  --org-id "exp-repo" \
  --scopes "read,write"
# Save the new key!

# 3. Update application with new key
# (manual step - update config files, env vars, etc.)

# 4. Revoke old key
python -m admin.cli apikeys revoke key_old123

# 5. Verify
python -m admin.cli apikeys list --org-id exp-repo
```

---

## Database Management

### Database Schema Overview

The metabob-rpc-api uses SurrealDB with the following main tables:

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `users` | User accounts | user_id, email, org_id, role |
| `organizations` | Organizations | org_id, name, seat_limit |
| `api_keys` | API authentication | key_id, org_id, key_hash, scopes |
| `projects` | Code projects | project_id, org_id, name |
| `executions` | Activity executions | execution_id, activity_id, status |
| `activity_variants` | Activity templates | variant_id, activity_id, tasks |
| `sessions` | User sessions | session_id, user_id, token |

### Backup and Restore

#### Create Backup

```bash
# Backup entire database
python -m admin.cli db export --output ./backups/backup-$(date +%Y%m%d).json

# Backup specific table
python -m admin.cli db export --output ./backups/users.json --table users
```

#### Restore from Backup

```bash
# Restore entire database
python -m admin.cli db import --input ./backups/backup-20260216.json

# Restore specific table
python -m admin.cli db import --input ./backups/users.json --table users
```

### Database Maintenance

#### Check Database Health

```bash
python -m admin.cli config check
```

#### Clean Up Old Data

```bash
# Remove expired sessions
python -m admin.cli sessions cleanup

# Remove old executions (custom query)
python -m admin.cli db query \
  "DELETE FROM executions WHERE created_at < time::now() - 30d"
```

#### Rebuild Indexes

```bash
# Via direct query
python -m admin.cli db query "DEFINE INDEX email_idx ON users FIELDS email UNIQUE"
```

---

## Troubleshooting

### Issue: "Cannot connect to database"

**Symptoms**:
```
Error: Could not connect to database at ws://localhost:8000/rpc
```

**Solutions**:
1. Check if SurrealDB is running:
   ```bash
   docker ps | grep surreal
   ```

2. Start SurrealDB if not running:
   ```bash
   docker-compose up -d surreal
   ```

3. Check connection string in `.env` file

4. Verify port 8000 is not blocked:
   ```bash
   curl http://localhost:8000/health
   ```

---

### Issue: "Authentication failed"

**Symptoms**:
```
Error: Authentication failed for database
```

**Solutions**:
1. Check environment variables:
   ```bash
   echo $SURREALDB_USER
   echo $SURREALDB_PASS
   ```

2. Verify credentials in `docker-compose.yaml`

3. Reset database if needed:
   ```bash
   docker-compose down -v surreal
   docker-compose up -d surreal
   ```

---

### Issue: "Command not found: admin.cli"

**Symptoms**:
```
python: No module named admin.cli
```

**Solutions**:
1. Ensure you're in the correct directory:
   ```bash
   cd repos/metabob-rpc-api
   pwd  # Should show path/to/metabob-rpc-api
   ```

2. Check Python path:
   ```bash
   python -c "import sys; print(sys.path)"
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

---

### Issue: "Query returned empty results"

**Symptoms**:
```
No users found.
No organizations found.
```

**Solutions**:
1. Check if database is actually empty:
   ```bash
   python -m admin.cli db stats
   ```

2. Verify you're querying the correct database:
   ```bash
   python -m admin.cli config show
   ```

3. If truly empty, run cold-start setup (see Workflow 1)

---

### Issue: "Permission denied" errors

**Symptoms**:
```
Error: User does not have permission to perform this operation
```

**Solutions**:
1. Check user role:
   ```bash
   python -m admin.cli users get <user_id>
   ```

2. Verify API key scopes:
   ```bash
   python -m admin.cli apikeys get <key_id>
   ```

3. Use admin CLI directly (bypasses API auth):
   ```bash
   python -m admin.cli db query "UPDATE users SET role = 'admin' WHERE user_id = 'user_abc123'"
   ```

---

## Environment Variables

The admin CLI uses these environment variables (from `.env` or docker-compose):

```bash
# SurrealDB Connection
SURREALDB_URL=ws://localhost:8000/rpc    # Database URL
SURREALDB_USER=root                       # Database user
SURREALDB_PASS=root                       # Database password
SURREALDB_NS=metabob                      # Namespace
SURREALDB_DB=production                   # Database name

# API Server (optional, for REST operations)
API_SERVER_URL=http://localhost:8080      # API server URL
```

---

## Best Practices

### 1. Always Backup Before Major Operations

```bash
# Before bulk updates or deletes
python -m admin.cli db export --output ./backup-before-change.json
```

### 2. Use Transactions for Critical Operations

```bash
# Use BEGIN/COMMIT for multi-step operations
python -m admin.cli db query "
BEGIN TRANSACTION;
UPDATE users SET role = 'admin' WHERE user_id = 'user_123';
INSERT INTO audit_log (action, user_id) VALUES ('role_change', 'user_123');
COMMIT TRANSACTION;
"
```

### 3. Limit Query Results

```bash
# Always use LIMIT for exploratory queries
python -m admin.cli db query "SELECT * FROM users LIMIT 10"
```

### 4. Use JSON Format for Automation

```bash
# JSON output is easier to parse in scripts
python -m admin.cli users list --format json | jq '.[] | select(.role == "admin")'
```

### 5. Document API Keys

```bash
# Always name keys descriptively
python -m admin.cli apikeys create --name "Jenkins CI - Production Deploy" --org-id prod
```

---

## Quick Reference Card

```bash
# === MOST COMMON COMMANDS ===

# Database health check
python -m admin.cli config check

# Database stats
python -m admin.cli db stats

# List resources
python -m admin.cli orgs list
python -m admin.cli users list
python -m admin.cli apikeys list
python -m admin.cli activities list

# Create organization + user + key (cold start)
python -m admin.cli orgs create --name "New Org" --org-id "new-org"
python -m admin.cli users create --email "user@example.com" --password "pass" --org-id "new-org" --role "owner"
python -m admin.cli apikeys create --name "API Key" --org-id "new-org" --scopes "read,write"

# Seed activity templates
python -m admin.cli activities seed

# Custom database query
python -m admin.cli db query "SELECT * FROM users WHERE org_id = 'exp-repo'"

# Backup database
python -m admin.cli db export --output ./backup.json
```

---

**Status**: Production Ready  
**Next**: See [ACTIVITY_SYSTEM_COLD_START_GUIDE.md](./ACTIVITY_SYSTEM_COLD_START_GUIDE.md) for activity system setup
