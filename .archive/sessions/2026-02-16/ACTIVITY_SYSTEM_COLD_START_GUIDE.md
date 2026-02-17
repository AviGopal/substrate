# Activity System Cold-Start Guide

**Version**: 1.0  
**Date**: February 16, 2026  
**Status**: Production Ready  
**Target**: Fresh installation from empty database to working activity system

---

## Overview

This guide walks through bootstrapping the complete activity system from scratch:
1. **Database Setup** - Organizations, users, API keys
2. **Template Seeding** - Core activity templates
3. **MCP Connection** - Enable activity search/execution
4. **Verification** - End-to-end activity execution test

**Time**: 10-15 minutes  
**Result**: Fully functional activity system ready for AI agent use

---

## Prerequisites

### Required Services Running

```bash
# Start backend services
cd repos/platform
docker-compose up -d surreal redis api-server

# Verify services healthy
docker ps --filter name=surreal --filter name=redis --filter name=api
# All should show "Up" status

# Check API server
curl http://localhost:8080/status
# Expected: {"status":"ok","version":"0.16.x"}
```

### Required Tools

- Python 3.10+ (for admin CLI)
- Docker & Docker Compose (for backend services)
- curl or httpie (for verification)

---

## Method Comparison

### Method 1: Admin CLI (Recommended for Fresh Install)
✅ **Best for**: Clean installs, development environments  
✅ **Pros**: Interactive, debuggable, clear error messages  
❌ **Cons**: Manual steps required

### Method 2: Python Scripts (Recommended for CI/CD)
✅ **Best for**: Automated deployments, repeatable setups  
✅ **Pros**: Fully automated, version controlled  
❌ **Cons**: Less visibility into issues

### Method 3: Docker Init Container (Production)
✅ **Best for**: Production deployments via Helm/Kubernetes  
✅ **Pros**: Zero manual intervention, declarative  
❌ **Cons**: Harder to debug failures

---

## Cold-Start Procedure: Method 1 (Admin CLI)

### Step 1: Database Setup

#### 1.1 Create Organization

```bash
cd repos/metabob-rpc-api

# Create organization
python -m admin.cli orgs create \
  --name "Development Org" \
  --org-id "exp-repo-dev"
```

**Expected Output**:
```
✅ Organization created successfully
Organization ID: exp-repo-dev
Name: Development Org
Status: active
```

#### 1.2 Create Admin User

```bash
# Create admin user
python -m admin.cli users create \
  --email "admin@example.com" \
  --password "changeme123" \
  --org-id "exp-repo-dev" \
  --role "owner"
```

**Expected Output**:
```
✅ User created successfully
User ID: user:xxxxxxxx
Email: admin@example.com
Organization: exp-repo-dev
Role: owner
```

#### 1.3 Create API Key

```bash
# Create API key for programmatic access
python -m admin.cli apikeys create \
  --name "Development API Key" \
  --org-id "exp-repo-dev" \
  --scopes "read,write,admin"
```

**Expected Output**:
```
✅ API key created successfully
Key ID: apikey:xxxxxxxx
API Key: mb_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
Name: Development API Key
Organization: exp-repo-dev
Scopes: read, write, admin

⚠️  SAVE THIS KEY - It will not be shown again!
```

**IMPORTANT**: Save the API key to `.metabob/config.json`:

```bash
# Create config directory if needed
mkdir -p .metabob

# Save API key
cat > .metabob/config.json <<EOF
{
  "api_key": "mb_xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "base_url": "http://localhost:8080",
  "project_id": "exp-repo-dev"
}
EOF
```

#### 1.4 Verify Database Setup

```bash
# Check organization exists
python -m admin.cli db query "SELECT * FROM orgs WHERE org_id = 'exp-repo-dev'"

# Check user exists
python -m admin.cli db query "SELECT id, email, org_id, role FROM users WHERE org_id = 'exp-repo-dev'"

# Check API key exists (keys are hashed)
python -m admin.cli db query "SELECT id, name, org_id, scopes FROM apikeys WHERE org_id = 'exp-repo-dev'"
```

**Expected**: All queries return 1 record each

---

### Step 2: Activity Template Seeding

#### 2.1 Seed Bootstrap Templates

The admin CLI can seed templates from the `metabob-proto` repository:

```bash
# Seed core activity templates
python -m admin.cli activities seed \
  --source ../metabob-proto/activities/bootstrap \
  --category bootstrap

# Alternative: seed specific templates
python -m admin.cli activities seed \
  --source ../metabob-proto/activities/bootstrap \
  --templates activity-create,feature-impl,bug-fix,refactor
```

**Expected Output**:
```
🔍 Scanning source directory: ../metabob-proto/activities/bootstrap
📦 Found 16 template files

Uploading templates:
  ✅ activity-create.json → INFRASTRUCTURE-57327686 (5 tasks)
  ✅ feature-impl.json → FEATURE-d3f6c989 (5 tasks)
  ✅ bug-fix.json → BUGFIX-69d6ab39 (4 tasks)
  ✅ refactor.json → REFACTOR-9c629da6 (4 tasks)
  ✅ activity-debug.json → INFRASTRUCTURE-99a2e10c (5 tasks)
  ✅ activity-evolve.json → INFRASTRUCTURE-0013e379 (5 tasks)
  ✅ code-analysis.json → INFRASTRUCTURE-c0b9dfaa (4 tasks)
  ... (9 more templates)

✨ Successfully seeded 16 templates
```

#### 2.2 Verify Templates Loaded

```bash
# List all templates
python -m admin.cli activities list

# Count templates with tasks (V2 format)
python -m admin.cli activities list --format json | \
  jq '[.[] | select(.tasks != null and (.tasks | length) > 0)] | length'
# Expected: 13+ templates

# Check specific core templates
python -m admin.cli activities list | grep -E "activity-create|feature-impl|bug-fix|refactor"
```

**Expected Output**:
```
activity-create       INFRASTRUCTURE-57327686  5 tasks   bootstrap
feature-impl          FEATURE-d3f6c989        5 tasks   feature-impl
bug-fix               BUGFIX-69d6ab39         4 tasks   bugfix
refactor              REFACTOR-9c629da6       4 tasks   refactor
```

#### 2.3 Inspect Template Details

```bash
# Get detailed info for a specific template
python -m admin.cli activities get activity-create

# Export template for inspection
python -m admin.cli activities export \
  --template-id INFRASTRUCTURE-57327686 \
  --output /tmp/activity-create-export.json

# View template task structure
cat /tmp/activity-create-export.json | jq '.tasks[] | {id, description}'
```

---

### Step 3: MCP Connection Setup

#### 3.1 Configure MCP in OpenCode

Add MCP server configuration to `opencode.json`:

```json
{
  "model": "anthropic/claude-sonnet-4-5-20250929",
  "mcp": {
    "metabob": {
      "command": "metabob-cli",
      "args": ["mcp"],
      "env": {
        "METABOB_API_URL": "http://localhost:8080",
        "METABOB_API_KEY": "mb_xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "METABOB_PROJECT_ID": "exp-repo-dev"
      }
    }
  }
}
```

**Alternative: Using Docker Container MCP**

If using devbob-opencode container:

```json
{
  "mcp": {
    "metabob": {
      "command": "docker",
      "args": [
        "exec",
        "devbob-opencode",
        "metabob-cli",
        "mcp"
      ],
      "env": {
        "METABOB_API_URL": "http://api-server-dev:8080",
        "METABOB_API_KEY": "mb_xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "METABOB_PROJECT_ID": "exp-repo-dev"
      }
    }
  }
}
```

#### 3.2 Test MCP Connection

```bash
# Test MCP server directly (manual verification)
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | \
  METABOB_API_URL=http://localhost:8080 \
  METABOB_API_KEY=mb_xxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  METABOB_PROJECT_ID=exp-repo-dev \
  metabob-cli mcp

# Expected: List of metabob tools including search_activities
```

**Expected Tools**:
- `metabob_search_activities` - Search for activity templates
- `metabob_activity` - Execute activity templates
- `metabob_get_priority_issues` - Get code quality issues
- `metabob_annotate_component` - Document code components
- ... (8+ more tools)

#### 3.3 Test Activity Search

```bash
# Test search_activities tool via MCP
echo '{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "metabob_search_activities",
    "arguments": {
      "category": "feature",
      "verbose": true
    }
  }
}' | METABOB_API_URL=http://localhost:8080 \
     METABOB_API_KEY=mb_xxxxxxxxxxxxxxxxxxxxxxxxxxxx \
     METABOB_PROJECT_ID=exp-repo-dev \
     metabob-cli mcp
```

**Expected Output**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "templates": [
      {
        "id": "feature-impl-d3f6c989",
        "name": "Feature Implementation",
        "category": "feature-impl",
        "description": "Implement new features...",
        "tasks": 5,
        "variables": [...]
      }
    ]
  }
}
```

---

### Step 4: Verification & Testing

#### 4.1 End-to-End Activity Execution Test

Create a simple test activity execution:

```bash
# Create test script
cat > /tmp/test_activity.py <<'EOF'
#!/usr/bin/env python3
import json
import requests

# Load config
config = json.load(open('.metabob/config.json'))
api_key = config['api_key']
base_url = config['base_url']

# Search for templates
response = requests.get(
    f"{base_url}/v2/activities/templates",
    headers={'x-api-key': api_key}
)
templates = response.json()['templates']

print(f"✅ Found {len(templates)} templates")

# Find feature-impl template
feature_template = next(
    (t for t in templates if 'feature' in t.get('activity_id', '').lower()),
    None
)

if feature_template:
    print(f"✅ Feature template: {feature_template['variant_id']}")
    print(f"   Tasks: {len(feature_template.get('tasks', []))}")
    print(f"   Variables: {list(feature_template.get('variables', {}).keys())}")
else:
    print("❌ Feature template not found")
    exit(1)

# Execute activity (dry-run)
print("\n🚀 Testing activity execution...")
response = requests.post(
    f"{base_url}/v2/activities/execute",
    headers={
        'x-api-key': api_key,
        'Content-Type': 'application/json'
    },
    json={
        'template_id': feature_template['variant_id'],
        'variables': {
            'feature_name': 'test-feature',
            'feature_description': 'Cold-start verification test',
            'target_location': 'src/test'
        },
        'dry_run': True
    }
)

if response.status_code == 200:
    print(f"✅ Activity execution started")
    result = response.json()
    print(f"   Execution ID: {result.get('execution_id')}")
else:
    print(f"❌ Activity execution failed: {response.status_code}")
    print(f"   Error: {response.text}")
    exit(1)

print("\n✨ All tests passed! Activity system is operational.")
EOF

chmod +x /tmp/test_activity.py

# Run test
cd repos/metabob-rpc-api
python /tmp/test_activity.py
```

**Expected Output**:
```
✅ Found 16 templates
✅ Feature template: FEATURE-d3f6c989
   Tasks: 5
   Variables: ['feature_name', 'feature_description', 'target_location']

🚀 Testing activity execution...
✅ Activity execution started
   Execution ID: exec_xxxxxxxx

✨ All tests passed! Activity system is operational.
```

#### 4.2 Test from OpenCode CLI

```bash
# Start OpenCode with MCP enabled
opencode chat

# In OpenCode session, try:
# "Search for feature implementation activities"
# Agent should use search_activities tool and find results

# Then try:
# "Show me the feature-impl template details"
# Agent should retrieve template structure
```

#### 4.3 Verify Database State

```bash
cd repos/metabob-rpc-api

# Check all database entities
python -m admin.cli db stats

# Expected output:
# Organizations: 1
# Users: 1
# API Keys: 1
# Activity Templates: 16
# Activity Executions: 0-1 (if test ran)
```

---

## Cold-Start Procedure: Method 2 (Python Scripts)

### Quick Automated Bootstrap

```bash
cd /path/to/metabob-devbob

# Step 1: Create session token
python3 scripts/create_session_state.py

# Step 2: Bootstrap core templates
python3 scripts/bootstrap_core_templates.py

# Step 3: Verify templates
python3 << 'EOF'
import requests, json

token = json.load(open('.metabob/state'))['session_metadata']['session_token']
headers = {'Authorization': f'Bearer {token}'}

response = requests.get('http://localhost:8080/v2/activities/templates', headers=headers)
templates = response.json()['templates']

print(f'✅ Total templates: {len(templates)}')
for t in templates:
    if any(k in t['variant_id'] for k in ['feature', 'bug', 'refactor', 'activity']):
        print(f'  ✅ {t["variant_id"]} ({len(t.get("tasks", []))} tasks)')
EOF
```

**See Also**: `BOOTSTRAP_QUICK_START.md` for detailed Python script documentation

---

## Cold-Start Procedure: Method 3 (Docker Init)

### Automated via Docker Compose

```yaml
# In docker-compose.yaml
services:
  db-init:
    image: metabob-rpc-api:latest
    depends_on:
      - surreal
      - redis
    volumes:
      - ../metabob-proto/activities:/opt/app/bootstrap:ro
    environment:
      - SURREAL_URL=http://surreal:8000
      - SURREAL_USER=root
      - SURREAL_PASS=root
    command: python -m scripts.init-db
    restart: "no"
```

```bash
# Start services (db-init runs automatically)
docker-compose up -d

# Check db-init logs
docker logs metabob-db-init-1

# Verify templates loaded
docker exec metabob-rpc-api-server-dev-1 \
  python -m admin.cli activities list
```

---

## Minimal Bootstrap Template Set

For a functional activity system, you need these templates:

### Tier 1: Self-Hosting (Required First)
1. **activity-create** (`INFRASTRUCTURE-*`)
   - Creates new activity templates
   - Bootstrap all other templates with this

### Tier 2: Core Development
2. **feature-impl** (`FEATURE-*`)
   - Implement new features
3. **bug-fix** (`BUGFIX-*`)
   - Fix bugs systematically
4. **refactor** (`REFACTOR-*`)
   - Refactor code safely

### Tier 3: Meta-Operations
5. **activity-debug** (`INFRASTRUCTURE-*`)
   - Debug failed activities
6. **activity-evolve** (`INFRASTRUCTURE-*`)
   - Evolve/improve templates

### Tier 4: Quality & Analysis
7. **code-analysis** (`INFRASTRUCTURE-*`)
   - Analyze code quality
8. **security-audit** (`INFRASTRUCTURE-*`)
   - Security scanning

**Minimum for basic functionality**: Tier 1 + Tier 2 (4 templates)  
**Recommended for production**: All tiers (8 templates)

---

## Verification Checklist

### Database Bootstrap ✓
- [ ] Organization created (`exp-repo-dev`)
- [ ] Admin user created with owner role
- [ ] API key created with full scopes
- [ ] API key saved to `.metabob/config.json`
- [ ] Database query returns all entities

### Template Seeding ✓
- [ ] Templates uploaded (16+ expected)
- [ ] Core templates present (activity-create, feature-impl, bug-fix, refactor)
- [ ] Templates have V2 format (`tasks` key present)
- [ ] Template task counts match expected (5, 4, 4, etc.)

### MCP Connection ✓
- [ ] OpenCode `opencode.json` configured with MCP
- [ ] MCP server responds to `tools/list`
- [ ] `search_activities` tool available
- [ ] `activity` tool available
- [ ] Search returns template results

### End-to-End Execution ✓
- [ ] Activity search works from OpenCode
- [ ] Activity execution can start (dry-run)
- [ ] Agent can find and use activities
- [ ] Results recorded in database

---

## Troubleshooting

### Issue: "Organization already exists"

**Cause**: Database not empty  
**Solution**: Either use existing org or reset database

```bash
# Option 1: Use existing organization
python -m admin.cli orgs list

# Option 2: Reset database (DESTRUCTIVE)
docker-compose down -v
docker-compose up -d surreal redis api-server
# Then retry bootstrap
```

### Issue: "API key creation failed"

**Cause**: Missing organization or permissions  
**Solution**: Verify organization exists first

```bash
# Check organization
python -m admin.cli db query "SELECT * FROM orgs"

# If empty, create organization first
python -m admin.cli orgs create --name "Org" --org-id "exp-repo-dev"
```

### Issue: "Template upload failed: 500"

**Cause**: Schema mismatch or database constraint violation  
**Solution**: Check backend logs and template format

```bash
# Check backend logs
docker logs metabob-rpc-api-server-dev-1 --tail 50

# Validate template JSON
python -c "import json; json.load(open('template.json'))"

# Check template has required fields
cat template.json | jq 'keys'
# Should have: activity_id, variant_name, tasks, variables, etc.
```

### Issue: "MCP search_activities returns empty"

**Cause**: API key wrong, database empty, or endpoint mismatch  
**Solution**: Verify API connection and templates exist

```bash
# Test API directly
curl -H "x-api-key: mb_xxx" http://localhost:8080/v2/activities/templates

# Check template count
python -m admin.cli activities list

# Verify MCP environment variables
echo $METABOB_API_URL
echo $METABOB_API_KEY
echo $METABOB_PROJECT_ID
```

### Issue: "Activity execution fails immediately"

**Cause**: Missing required variables or template format error  
**Solution**: Check template requirements

```bash
# Get template details
python -m admin.cli activities get <template-id>

# Check required variables
cat template.json | jq '.variables | to_entries[] | select(.value.required == true)'

# Check task structure
cat template.json | jq '.tasks[] | {id, description}'
```

### Issue: "Permission denied on API operations"

**Cause**: API key missing scopes  
**Solution**: Recreate API key with full scopes

```bash
# List existing keys
python -m admin.cli apikeys list

# Revoke old key
python -m admin.cli apikeys revoke --key-id <key-id>

# Create new key with all scopes
python -m admin.cli apikeys create \
  --name "Full Access Key" \
  --org-id "exp-repo-dev" \
  --scopes "read,write,admin"
```

---

## Database Schema Reference

### Core Tables

```sql
-- Organizations
CREATE TABLE orgs (
  org_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Users
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  org_id TEXT REFERENCES orgs(org_id),
  role TEXT DEFAULT 'member',
  created_at TIMESTAMP DEFAULT NOW()
);

-- API Keys
CREATE TABLE apikeys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  org_id TEXT REFERENCES orgs(org_id),
  scopes TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP
);

-- Activity Templates
CREATE TABLE templates (
  variant_id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL,
  variant_name TEXT,
  description TEXT,
  category TEXT,
  tasks JSONB NOT NULL,  -- V2 format
  variables JSONB DEFAULT '{}',
  context_requirements JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Activity Executions
CREATE TABLE executions (
  execution_id TEXT PRIMARY KEY,
  template_id TEXT REFERENCES templates(variant_id),
  status TEXT DEFAULT 'pending',
  variables JSONB,
  results JSONB,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

### Query Examples

```bash
# Count entities
python -m admin.cli db query "SELECT COUNT(*) FROM orgs"
python -m admin.cli db query "SELECT COUNT(*) FROM users"
python -m admin.cli db query "SELECT COUNT(*) FROM templates"

# List templates with task counts
python -m admin.cli db query "
  SELECT 
    variant_id, 
    activity_id, 
    jsonb_array_length(tasks) as task_count 
  FROM templates 
  WHERE tasks IS NOT NULL
  ORDER BY task_count DESC
"

# Find templates by category
python -m admin.cli db query "
  SELECT variant_id, activity_id, category 
  FROM templates 
  WHERE category = 'feature-impl'
"

# Check recent activity executions
python -m admin.cli db query "
  SELECT 
    execution_id, 
    template_id, 
    status, 
    started_at 
  FROM executions 
  ORDER BY started_at DESC 
  LIMIT 10
"
```

---

## Post-Bootstrap Operations

### Adding More Templates

#### Method 1: Via Admin CLI
```bash
# Import template from file
python -m admin.cli activities import \
  --file /path/to/template.json

# Or create new template programmatically
python -m admin.cli activities create \
  --name "My Template" \
  --category "custom" \
  --tasks-file /path/to/tasks.json
```

#### Method 2: Via API
```bash
# Upload via REST API
curl -X POST http://localhost:8080/v2/activities/templates \
  -H "x-api-key: mb_xxx" \
  -H "Content-Type: application/json" \
  -d @template.json
```

#### Method 3: Via activity-create Activity (Self-Hosting!)
```javascript
// From OpenCode
activity({
  activityId: "activity-create",
  variables: {
    activity_name: "My New Template",
    activity_id: "my-template-v1",
    target_category: "custom",
    source_pattern: "Description of workflow to formalize"
  },
  reason: "Create new activity template from successful pattern"
})
```

### User Management

```bash
# Add developer user
python -m admin.cli users create \
  --email "dev@example.com" \
  --password "dev123" \
  --org-id "exp-repo-dev" \
  --role "developer"

# Change user role
python -m admin.cli users update \
  --user-id "user:xxx" \
  --role "admin"

# Deactivate user
python -m admin.cli users deactivate \
  --user-id "user:xxx"
```

### API Key Rotation

```bash
# List existing keys
python -m admin.cli apikeys list --org-id "exp-repo-dev"

# Create new key
python -m admin.cli apikeys create \
  --name "Rotated Key $(date +%Y%m%d)" \
  --org-id "exp-repo-dev" \
  --scopes "read,write"

# Revoke old key
python -m admin.cli apikeys revoke --key-id "apikey:old-key-id"

# Update config with new key
jq '.api_key = "mb_new_key"' .metabob/config.json > /tmp/config.json
mv /tmp/config.json .metabob/config.json
```

---

## Backup & Restore

### Database Backup

```bash
# Backup database to file
docker exec metabob-surreal-dev-1 \
  surreal export --endpoint http://localhost:8000 \
  --user root --pass root \
  --ns metabob --db metabob \
  /tmp/backup.surql

# Copy backup to host
docker cp metabob-surreal-dev-1:/tmp/backup.surql ./backups/db-$(date +%Y%m%d).surql
```

### Database Restore

```bash
# Copy backup to container
docker cp ./backups/db-20260216.surql metabob-surreal-dev-1:/tmp/restore.surql

# Restore database
docker exec metabob-surreal-dev-1 \
  surreal import --endpoint http://localhost:8000 \
  --user root --pass root \
  --ns metabob --db metabob \
  /tmp/restore.surql
```

### Template Backup

```bash
# Export all templates
python -m admin.cli activities export --output ./backups/templates-$(date +%Y%m%d).json

# Export specific template
python -m admin.cli activities export \
  --template-id FEATURE-d3f6c989 \
  --output ./backups/feature-impl-backup.json
```

---

## Production Deployment Considerations

### Environment Variables

```bash
# Required for production
export METABOB_API_URL="https://api.metabob.example.com"
export METABOB_API_KEY="mb_production_key_xxx"
export METABOB_PROJECT_ID="production-org-id"

# Optional (with defaults)
export METABOB_LOG_LEVEL="INFO"  # DEBUG, INFO, WARNING, ERROR
export METABOB_TIMEOUT="300"      # API timeout in seconds
export METABOB_RETRY_ATTEMPTS="3" # Number of retry attempts
```

### Security Best Practices

1. **API Keys**: Rotate regularly, use least-privilege scopes
2. **Passwords**: Use strong passwords, consider SSO integration
3. **Network**: Restrict database access to backend services only
4. **Backups**: Automated daily backups with retention policy
5. **Audit Logs**: Enable audit logging for all admin operations

### High Availability Setup

```yaml
# docker-compose.yaml for HA
services:
  surreal-primary:
    image: surrealdb/surrealdb:latest
    # ... config ...
  
  surreal-replica:
    image: surrealdb/surrealdb:latest
    depends_on:
      - surreal-primary
    # ... replication config ...
  
  api-server-1:
    image: metabob-rpc-api:latest
    # ... config ...
  
  api-server-2:
    image: metabob-rpc-api:latest
    # ... config ...
  
  nginx-lb:
    image: nginx:latest
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    ports:
      - "8080:8080"
```

---

## Related Documentation

- **`BOOTSTRAP_QUICK_START.md`** - Python script bootstrap method
- **`METABOB_ADMIN_CLI_GUIDE.md`** - Complete admin CLI reference
- **`COLD_START_BOOTSTRAP_PLAN.md`** - Bootstrap strategy and planning
- **`ACTIVITY_SYSTEM_WORKING.md`** - System architecture and status
- **`BOOTSTRAP_VALIDATION_REPORT.md`** - Template validation results

---

## Quick Reference Card

```bash
# === Database Setup ===
python -m admin.cli orgs create --name "Org" --org-id "org-id"
python -m admin.cli users create --email "user@ex.com" --password "pass" --org-id "org-id" --role "owner"
python -m admin.cli apikeys create --name "Key" --org-id "org-id" --scopes "read,write,admin"

# === Template Seeding ===
python -m admin.cli activities seed --source ../metabob-proto/activities/bootstrap
python -m admin.cli activities list

# === Verification ===
python -m admin.cli db stats
curl -H "x-api-key: mb_xxx" http://localhost:8080/v2/activities/templates

# === MCP Testing ===
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | \
  METABOB_API_URL=http://localhost:8080 \
  METABOB_API_KEY=mb_xxx \
  METABOB_PROJECT_ID=org-id \
  metabob-cli mcp

# === Troubleshooting ===
docker logs metabob-rpc-api-server-dev-1 --tail 50
python -m admin.cli db query "SELECT COUNT(*) FROM templates"
```

---

## Success Criteria

✅ **Database Setup**: Org, user, API key created  
✅ **Templates Loaded**: 16+ templates with tasks in database  
✅ **MCP Connected**: search_activities returns results  
✅ **Execution Works**: Activity can start (dry-run succeeds)  
✅ **Agent Ready**: AI agent can search and execute activities

---

**Status**: 🟢 Production Ready  
**Version**: 1.0  
**Last Updated**: February 16, 2026  
**Maintainer**: Metabob DevOps Team

