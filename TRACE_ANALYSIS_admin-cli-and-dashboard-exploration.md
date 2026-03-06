# Trace Analysis: admin-cli-and-dashboard-exploration

**Generated**: 2026-03-06  
**Activity**: trace-enforce-validate-loop  
**Specification**: admin-cli-and-dashboard-exploration  
**Impulse ID**: trace-admin-cli-and-dashboard-exploration

---

## Executive Summary

This trace analysis documents the **current state** vs **desired state** for the admin-cli-and-dashboard-exploration specification. The goal is to:

1. **Admin CLI Tool**: Create comprehensive CLI commands in `metabob-rpc-api/server/cli.py` for managing organizations, users, activity templates, and boredom activity configuration
2. **Dashboard Data Flow**: Demonstrate the complete end-to-end flow from OpenCode execution in devbob container → data aggregation → visualization in cloud dashboard at `app.metabob.local`
3. **Playwright Automation**: Use Playwright browser automation to showcase login, navigation, and activity history viewing

---

## Current State Analysis

### ✅ What Exists

#### 1. Database Operations Layer (repos/metabob-rpc-api/server/db/operations/)

**Organizations** (organization_ops.py:1-244):
- ✅ `create_organization(org_id, name, display_name, settings, metadata)` 
- ✅ `get_organization(org_id)`
- ✅ `list_organizations(limit, offset)`
- ✅ `update_organization(org_id, ...)`
- ✅ `delete_organization(org_id)`
- ✅ `get_organization_stats(org_id)` - aggregates projects, developers, sessions, activities

**Templates** (template_data.py:1-250):
- ✅ `create_template_record(template_data)`
- ✅ `get_template_by_variant_id(variant_id)`
- ✅ `list_all_templates(limit, org_id, project_id)` - multi-tenant filtering
- ✅ `update_template_record(variant_id, update_data)`
- ✅ `delete_template_record(variant_id)`
- ✅ `get_templates_by_activity_id(activity_id)` - for variant genealogy

**Authentication Schema** (sql/migrations/007-auth-users-table.surql:1-54):
- ✅ `users` table with fields: user_id, email, password_hash, name, org_id, role, is_active, email_verified, last_login_at
- ✅ `user_organizations` junction table for many-to-many relationships
- ✅ `refresh_tokens` table for JWT rotation
- ✅ Indexes: user_id_idx (UNIQUE), user_email_idx (UNIQUE), user_org_idx

#### 2. CLI Infrastructure (repos/metabob-rpc-api/server/cli.py:1-293)

**Existing Commands**:
- ✅ `start_server start` - Start uvicorn server with WebSocket support
- ✅ `start_server version` - Show version
- ✅ `start_server db init-schema` - Initialize SurrealDB schema
- ✅ `start_server db validate` - Validate schema and connectivity
- ✅ `start_server db status` - Show database metrics

**Framework**: Click CLI framework with command groups, options, environment variable support

#### 3. Boredom System (repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts:1-400+)

**BoredomManager Components**:
- ✅ Idle detection (5 min threshold, 30s check interval)
- ✅ `fetchBoredomActivities()` - calls `metabob_fetch_boredom_activities` MCP tool
- ✅ Hardcoded filters: `priority_threshold: 0.6`, `max_activities: 5`, `exclude_recent_hours: 24`
- ✅ Activity type mapping: "improve-template" → "evolve-activity-self-contained"
- ✅ Lifecycle automation config checks (`auto_evolve_on_staleness`, `auto_debug_on_failure`)

#### 4. Dashboard Data Flow (DEMONSTRATION_Dashboard_Activity_History_Viewing.md)

**Documented Flow**:
```
OpenCode CLI (devbob container)
  ↓
POST /v2/activities/content
  ↓
SurrealDB (activity_content table) ← PRIMARY STORAGE
  ↓
Dashboard UI: GET /auth/orgs/{org_id}/activity
  ↓
Redis Cache (60s TTL, 90-95% hit rate)
  ↓ (on cache miss)
SurrealDB query
  ↓
JSON Response → Timeline Render
```

**Kubernetes Setup**:
- ✅ DNS: `/etc/hosts` maps `app.metabob.local` → `127.0.0.1`
- ✅ Services: metabob-dashboard (port 80), metabob-rpc-api (port 8080), surrealdb (port 8000), redis (port 6379)
- ✅ Ingress or port-forwarding for local access

#### 5. Dashboard Exploration (BROWSER_NAVIGATION_DEMONSTRATION.md)

**Playwright Actions Demonstrated**:
- ✅ Navigate to `http://app.metabob.local`
- ✅ Screenshot capture (3 screenshots saved)
- ✅ Console log inspection (feature flags discovered)
- ✅ Login form interaction (validation errors captured)
- ✅ HTML structure inspection (Material-UI framework identified)

**Blockers**:
- ❌ Authentication required (cloud mode)
- ❌ Test credentials not working (HTTP 500 errors)
- ⚠️ Need to configure local mode OR create valid user

---

## Gaps Analysis

### ❌ What's Missing

#### 1. User Operations Module

**File**: `repos/metabob-rpc-api/server/db/operations/user_ops.py`  
**Status**: ❌ Does NOT exist

**Required Functions**:
```python
async def create_user(email: str, password: str, name: str, org_id: str, role: str = "member") -> Dict[str, Any]
async def get_user(user_id: str) -> Optional[Dict[str, Any]]
async def get_user_by_email(email: str) -> Optional[Dict[str, Any]]
async def list_users(org_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]
async def update_user(user_id: str, **kwargs) -> Optional[Dict[str, Any]]
async def delete_user(user_id: str) -> bool
async def assign_user_to_org(user_id: str, org_id: str, role: str = "member") -> Dict[str, Any]
async def verify_password(email: str, password: str) -> Optional[Dict[str, Any]]
```

**Dependencies**: 
- `bcrypt` for password hashing (likely already installed)
- `sanitize_record` from `server.db.surrealdb_client`

#### 2. Admin CLI Command Group

**File**: `repos/metabob-rpc-api/server/cli.py`  
**Missing Section**: `@cli.group() def admin():`

**Required Commands**:

**Organization Management**:
```python
@admin.group()
def org():
    """Organization management commands."""
    pass

@org.command(name="create")
@click.option("--org-id", required=True, help="Organization ID")
@click.option("--name", required=True, help="Organization name")
@click.option("--display-name", help="Display name")
def org_create(org_id: str, name: str, display_name: str):
    """Create a new organization."""
    # Call organization_ops.create_organization()

@org.command(name="list")
@click.option("--limit", default=50, help="Max results")
def org_list(limit: int):
    """List all organizations."""
    # Call organization_ops.list_organizations()

@org.command(name="stats")
@click.option("--org-id", required=True, help="Organization ID")
def org_stats(org_id: str):
    """Show organization statistics."""
    # Call organization_ops.get_organization_stats()
```

**User Management**:
```python
@admin.group()
def user():
    """User management commands."""
    pass

@user.command(name="create")
@click.option("--email", required=True, help="User email")
@click.option("--password", required=True, prompt=True, hide_input=True, help="User password")
@click.option("--name", required=True, help="User full name")
@click.option("--org-id", required=True, help="Organization ID")
@click.option("--role", default="member", help="User role")
def user_create(email: str, password: str, name: str, org_id: str, role: str):
    """Create a new user."""
    # Call user_ops.create_user()

@user.command(name="list")
@click.option("--org-id", help="Filter by organization")
@click.option("--limit", default=50, help="Max results")
def user_list(org_id: str, limit: int):
    """List users."""
    # Call user_ops.list_users()

@user.command(name="assign")
@click.option("--user-id", required=True, help="User ID")
@click.option("--org-id", required=True, help="Organization ID")
@click.option("--role", default="member", help="Role in organization")
def user_assign(user_id: str, org_id: str, role: str):
    """Assign user to organization."""
    # Call user_ops.assign_user_to_org()
```

**Template Management**:
```python
@admin.group()
def template():
    """Activity template management commands."""
    pass

@template.command(name="list")
@click.option("--org-id", help="Filter by organization")
@click.option("--limit", default=50, help="Max results")
def template_list(org_id: str, limit: int):
    """List activity templates."""
    # Call template_data.list_all_templates()

@template.command(name="set-boredom")
@click.option("--template-id", required=True, help="Template variant ID")
@click.option("--enable/--disable", default=True, help="Enable/disable for boredom")
@click.option("--priority", type=float, help="Boredom priority (0.0-1.0)")
def template_set_boredom(template_id: str, enable: bool, priority: float):
    """Configure template for boredom activity selection."""
    # Call template_data.update_template_record()
```

**Boredom Configuration**:
```python
@admin.group()
def boredom():
    """Boredom system configuration commands."""
    pass

@boredom.command(name="config")
@click.option("--priority-threshold", type=float, help="Priority threshold (0.0-1.0)")
@click.option("--max-activities", type=int, help="Max activities to fetch")
@click.option("--exclude-hours", type=int, help="Exclude recent executions (hours)")
def boredom_config(priority_threshold: float, max_activities: int, exclude_hours: int):
    """Configure boredom system settings."""
    # Update config in SurrealDB or environment

@boredom.command(name="stats")
def boredom_stats():
    """Show boredom system statistics."""
    # Query boredom-eligible templates, execution stats
```

#### 3. Boredom Eligibility Schema

**File**: `repos/metabob-rpc-api/sql/migrations/008-boredom-eligibility.surql`  
**Status**: ❌ Does NOT exist

**Required Schema**:
```sql
-- Add boredom eligibility fields to activity_template table
DEFINE FIELD boredom_eligible ON activity_template TYPE bool DEFAULT false;
DEFINE FIELD boredom_priority ON activity_template TYPE float DEFAULT 0.5;
DEFINE FIELD boredom_config ON activity_template TYPE object DEFAULT {};

-- Index for efficient boredom activity queries
DEFINE INDEX boredom_eligible_idx ON activity_template FIELDS boredom_eligible;
```

#### 4. Boredom API Endpoint Updates

**File**: `repos/metabob-rpc-api/server/routes/activity.py:524`  
**Current**: Likely queries all templates  
**Desired**: Filter by `boredom_eligible=true`

**Required Change**:
```python
# In metabob_fetch_boredom_activities endpoint
query = """
    SELECT * FROM activity_template
    WHERE boredom_eligible = true 
      AND boredom_priority >= $priority_threshold
      AND (last_executed IS NONE OR last_executed < time::now() - $exclude_duration)
    ORDER BY boredom_priority DESC
    LIMIT $max_activities
"""
```

#### 5. Playwright E2E Demonstration Script

**File**: `repos/metabob-rpc-api/tests/playwright/dashboard-e2e-demo.spec.ts`  
**Status**: ❌ Does NOT exist

**Required Implementation**:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Dashboard Activity History E2E', () => {
  test('should demonstrate complete data flow from devbob to dashboard', async ({ page }) => {
    // Step 1: Navigate to dashboard
    await page.goto('http://app.metabob.local');
    await page.screenshot({ path: 'screenshots/01-dashboard-home.png', fullPage: true });
    
    // Step 2: Login (or skip if local mode)
    if (await page.locator('#email').isVisible()) {
      await page.fill('#email', 'admin@example.com');
      await page.fill('#password', 'testpass123');
      await page.click('button[type="submit"]');
      await page.waitForNavigation();
      await page.screenshot({ path: 'screenshots/02-after-login.png', fullPage: true });
    }
    
    // Step 3: Navigate to Activity History
    await page.click('nav button:has-text("Development")');
    await page.click('a:has-text("Activity History")');
    await page.waitForSelector('.activity-timeline');
    await page.screenshot({ path: 'screenshots/03-activity-history.png', fullPage: true });
    
    // Step 4: Verify data is displayed
    const activityItems = await page.locator('.activity-item').count();
    expect(activityItems).toBeGreaterThan(0);
    
    // Step 5: Verify data structure
    const firstActivity = page.locator('.activity-item').first();
    await expect(firstActivity.locator('.activity-name')).toBeVisible();
    await expect(firstActivity.locator('.activity-timestamp')).toBeVisible();
    
    // Step 6: Capture final state
    await page.screenshot({ path: 'screenshots/04-verified-data.png', fullPage: true });
  });
});
```

#### 6. Dashboard Local Mode Configuration

**Current**: Dashboard in cloud mode (authentication required)  
**Desired**: Configure local mode OR create test user

**Option 1: Local Mode Environment Variables**
```bash
kubectl set env deployment/metabob-dashboard -n metabob \
  REACT_APP_DEPLOYMENT_MODE=local \
  REACT_APP_SKIP_AUTH=true

kubectl rollout restart deployment/metabob-dashboard -n metabob
```

**Option 2: Create Test User via CLI**
```bash
# After user_ops.py is implemented
start_server admin user create \
  --email admin@example.com \
  --password testpass123 \
  --name "Admin User" \
  --org-id default-org \
  --role admin
```

---

## Data Flow Documentation

### 1. Admin CLI → Organization Management

```
Command: start_server admin org create --org-id=acme --name="Acme Corp"
  ↓
CLI Handler (cli.py:org_create)
  ↓
organization_ops.create_organization(org_id="acme", name="Acme Corp")
  ↓
SurrealDB Client: db.create("organizations", data)
  ↓
SurrealDB: INSERT INTO organizations {...}
  ↓
Return: {"org_id": "acme", "name": "Acme Corp", "created_at": "2026-03-06T...", ...}
  ↓
CLI Output: ✅ Organization created: acme
```

### 2. Admin CLI → User Management

```
Command: start_server admin user create --email=admin@example.com --password=*** --name="Admin" --org-id=acme
  ↓
CLI Handler (cli.py:user_create)
  ↓
user_ops.create_user(email, password, name, org_id, role)
  ↓
bcrypt.hashpw(password.encode(), bcrypt.gensalt())
  ↓
SurrealDB Client: db.create("users", data with password_hash)
  ↓
SurrealDB: INSERT INTO users {user_id, email, password_hash, name, org_id, role, ...}
  ↓
Return: {"user_id": "user-abc123", "email": "admin@example.com", ...}
  ↓
CLI Output: ✅ User created: user-abc123 (admin@example.com)
```

### 3. Admin CLI → Template Boredom Configuration

```
Command: start_server admin template set-boredom --template-id=hello-world-abc123 --enable --priority=0.8
  ↓
CLI Handler (cli.py:template_set_boredom)
  ↓
template_data.update_template_record(
  variant_id="hello-world-abc123",
  update_data={"boredom_eligible": true, "boredom_priority": 0.8}
)
  ↓
SurrealDB Client: db.merge(record_id, update_data)
  ↓
SurrealDB: UPDATE activity_template:hello-world-abc123 SET boredom_eligible=true, boredom_priority=0.8
  ↓
Return: Updated template record
  ↓
CLI Output: ✅ Template hello-world-abc123 configured for boredom (priority: 0.8)
```

### 4. Boredom Activity Selection

```
BoredomManager (5 min idle)
  ↓
fetchBoredomActivities()
  ↓
MCP.callTool("metabob_fetch_boredom_activities", {max_activities: 5, priority_threshold: 0.6})
  ↓
RPC API Endpoint: GET /api/boredom/activities
  ↓
SurrealDB Query:
  SELECT * FROM activity_template
  WHERE boredom_eligible = true
    AND boredom_priority >= 0.6
  ORDER BY boredom_priority DESC
  LIMIT 5
  ↓
Return: [
  {template_id: "improve-error-handling", priority: 0.85, activity_type: "improve-template"},
  {template_id: "refactor-auth", priority: 0.75, activity_type: "improve-template"},
  ...
]
  ↓
BoredomManager: Execute top activity ("improve-error-handling")
```

### 5. Dashboard Data Flow (Complete Journey)

```
OpenCode CLI Execution (devbob container)
  ↓
Activity Execution Completes
  ↓
POST http://api.metabob.local/v2/activities/content
  Headers: {"X-API-Key": "...", "X-Org-ID": "...", "X-Project-ID": "..."}
  Body: {
    activity_id: "...",
    variant_id: "...",
    start_time: "...",
    end_time: "...",
    success: true,
    cost: 0.023,
    tokens: {input: 1200, output: 300, cache: 0},
    task_steps: [...],
    genealogy: {...}
  }
  ↓
RPC API: POST /v2/activities/content Handler
  ↓
activity_content.create_activity_content(org_id, project_id, activity_data)
  ↓
SurrealDB: INSERT INTO activity_content {...}
  ↓
Return: {content_id: "...", status: "stored"}
  ↓
--- TIME PASSES ---
  ↓
User Opens Dashboard in Browser
  ↓
Navigate to http://app.metabob.local
  ↓
React App Loads → Login (or skip in local mode)
  ↓
Navigate to "Activity History" Section
  ↓
Frontend: GET http://api.metabob.local/auth/orgs/{org_id}/activity?limit=50
  Headers: {"Authorization": "Bearer <jwt_token>"}
  ↓
RPC API: GET /auth/orgs/{org_id}/activity Handler
  ↓
Check Redis Cache: redis.get(f"activity_history:{org_id}")
  ↓
Cache HIT (90-95% of requests, 60s TTL):
  ↓ Return cached JSON
Cache MISS (first request or expired):
  ↓
  SurrealDB Query:
    SELECT * FROM activity_content
    WHERE org_id = $org_id
    ORDER BY end_time DESC
    LIMIT 50
  ↓
  Redis: redis.setex(f"activity_history:{org_id}", 60, json_data)
  ↓
Return: {
  activities: [
    {activity_id, variant_id, start_time, end_time, success, cost, tokens, task_steps},
    ...
  ]
}
  ↓
Frontend: Render Timeline Component
  ↓
Display Activity Cards with:
  - Activity name and variant
  - Execution time and duration
  - Success/failure status
  - Cost and token usage
  - Task execution breakdown
  ↓
User Sees Activity History ✅
```

### 6. Playwright E2E Demonstration Flow

```
Test Runner: npm run test:e2e
  ↓
Playwright Launches Chromium
  ↓
Step 1: Navigate to http://app.metabob.local
  ↓
page.goto('http://app.metabob.local')
  ↓
Screenshot: 01-dashboard-home.png
  ↓
Step 2: Login (if auth enabled)
  ↓
page.fill('#email', 'admin@example.com')
page.fill('#password', 'testpass123')
page.click('button[type="submit"]')
  ↓
Wait for navigation
  ↓
Screenshot: 02-after-login.png
  ↓
Step 3: Navigate to Activity History
  ↓
page.click('nav button:has-text("Development")')
page.click('a:has-text("Activity History")')
  ↓
Wait for .activity-timeline element
  ↓
Screenshot: 03-activity-history.png
  ↓
Step 4: Verify Data
  ↓
activityItems = page.locator('.activity-item').count()
expect(activityItems).toBeGreaterThan(0)
  ↓
firstActivity = page.locator('.activity-item').first()
expect(firstActivity.locator('.activity-name')).toBeVisible()
expect(firstActivity.locator('.activity-timestamp')).toBeVisible()
  ↓
Screenshot: 04-verified-data.png
  ↓
Test PASS ✅
  ↓
Console Output:
  ✅ Dashboard loaded successfully
  ✅ Login succeeded
  ✅ Activity history displayed
  ✅ Found 23 activities
  ✅ Data structure validated
```

---

## Implementation Phases

### Phase 1: Add User Operations and CLI Admin Group

**Duration**: ~2-4 hours  
**Files Modified**:
- `repos/metabob-rpc-api/server/db/operations/user_ops.py` (NEW)
- `repos/metabob-rpc-api/server/cli.py` (ADD admin group)

**Tasks**:
1. Create `user_ops.py` with full CRUD operations
   - `create_user()` with bcrypt password hashing
   - `get_user()`, `get_user_by_email()`
   - `list_users()` with org_id filtering
   - `update_user()`, `delete_user()`
   - `assign_user_to_org()` for many-to-many relationships
   - `verify_password()` for authentication

2. Add admin CLI group to `cli.py`
   - `@cli.group() def admin():`
   - Import asyncio and user_ops
   - Add error handling and logging

3. Add organization management commands
   - `admin org create --org-id X --name Y`
   - `admin org list --limit 50`
   - `admin org stats --org-id X`
   - `admin org update --org-id X --name Y`
   - `admin org delete --org-id X`

4. Add user management commands
   - `admin user create --email X --password Y --name Z --org-id W`
   - `admin user list --org-id X --limit 50`
   - `admin user assign --user-id X --org-id Y --role Z`
   - `admin user update --user-id X --name Y`
   - `admin user delete --user-id X`

5. Test CLI commands against local SurrealDB
   - Start SurrealDB: `docker-compose up surrealdb`
   - Run migrations: `start_server db init-schema`
   - Test org creation: `start_server admin org create --org-id test-org --name "Test Org"`
   - Test user creation: `start_server admin user create --email test@example.com --password testpass123 --name "Test User" --org-id test-org`
   - Verify in SurrealDB: `SELECT * FROM users WHERE email = 'test@example.com'`

**Validation Criteria**:
- [ ] `user_ops.py` passes unit tests
- [ ] All CLI commands execute without errors
- [ ] Organizations created successfully in SurrealDB
- [ ] Users created with hashed passwords
- [ ] User-org assignments work correctly

---

### Phase 2: Add Boredom Activity Configuration

**Duration**: ~3-5 hours  
**Files Modified**:
- `repos/metabob-rpc-api/sql/migrations/008-boredom-eligibility.surql` (NEW)
- `repos/metabob-rpc-api/server/cli.py` (ADD template and boredom groups)
- `repos/metabob-rpc-api/server/routes/activity.py` (UPDATE boredom endpoint)

**Tasks**:
1. Create schema migration for boredom eligibility
   - Add `boredom_eligible`, `boredom_priority`, `boredom_config` fields to activity_template
   - Add index on `boredom_eligible` for fast queries
   - Run migration: `start_server db init-schema --schema-file sql/migrations/008-boredom-eligibility.surql`

2. Add template management commands
   - `admin template list --org-id X --limit 50`
   - `admin template set-boredom --template-id X --enable --priority 0.8`
   - `admin template get --template-id X`

3. Add boredom configuration commands
   - `admin boredom config --priority-threshold 0.7 --max-activities 10`
   - `admin boredom stats` - show boredom-eligible templates count, avg priority, recent executions
   - `admin boredom list` - show all boredom-eligible templates

4. Update boredom API endpoint (activity.py)
   - Modify query to filter by `boredom_eligible=true`
   - Respect `boredom_priority` in sorting
   - Add `exclude_recent_hours` logic using `last_executed` field

5. Test boredom configuration
   - Enable template for boredom: `start_server admin template set-boredom --template-id hello-world-abc123 --enable`
   - Verify in DB: `SELECT * FROM activity_template WHERE boredom_eligible = true`
   - Test API: `curl http://localhost:8080/api/boredom/activities?priority_threshold=0.5`

**Validation Criteria**:
- [ ] Schema migration applied successfully
- [ ] Templates can be enabled/disabled for boredom
- [ ] Boredom API endpoint filters correctly
- [ ] Priority threshold respected in results
- [ ] Stats command shows accurate metrics

---

### Phase 3: Playwright Dashboard E2E Demonstration

**Duration**: ~4-6 hours  
**Files Modified**:
- `repos/metabob-rpc-api/tests/playwright/dashboard-e2e-demo.spec.ts` (NEW)
- Dashboard deployment config (for local mode OR user creation)

**Tasks**:
1. Configure dashboard for access
   - **Option A**: Set local mode (skip auth)
     ```bash
     kubectl set env deployment/metabob-dashboard -n metabob REACT_APP_DEPLOYMENT_MODE=local REACT_APP_SKIP_AUTH=true
     kubectl rollout restart deployment/metabob-dashboard -n metabob
     ```
   - **Option B**: Create test user via CLI
     ```bash
     start_server admin user create --email admin@example.com --password testpass123 --name "Admin User" --org-id default-org --role admin
     ```

2. Create Playwright test spec
   - Install Playwright: `npm install -D @playwright/test`
   - Create test file: `tests/playwright/dashboard-e2e-demo.spec.ts`
   - Implement login flow (or skip if local mode)
   - Implement navigation to Activity History
   - Implement data verification assertions

3. Implement screenshot capture at each step
   - 01-dashboard-home.png
   - 02-after-login.png (if auth enabled)
   - 03-activity-history.png
   - 04-verified-data.png

4. Implement data verification
   - Count activity items
   - Verify activity structure (name, timestamp, status, cost, tokens)
   - Verify data matches expected format from OpenCode execution

5. Run test and capture output
   - `npm run test:e2e`
   - Review screenshots
   - Verify test passes

6. Document complete data flow
   - Create DEMONSTRATION_COMPLETE.md with screenshots
   - Explain each step of the flow
   - Provide evidence of end-to-end data journey

**Validation Criteria**:
- [ ] Playwright test executes without errors
- [ ] Dashboard loads successfully
- [ ] Activity history displays data
- [ ] Screenshots captured at all steps
- [ ] Data structure validated
- [ ] Documentation complete with visual proof

---

## Validation Criteria Summary

### Admin CLI Functionality

✅ **Organizations**:
```bash
$ start_server admin org create --org-id acme --name "Acme Corp"
✅ Organization created: acme

$ start_server admin org list
Organizations (2):
  - acme (Acme Corp)
  - default-org (Default Organization)

$ start_server admin org stats --org-id acme
Organization: acme
  Total Projects: 3
  Total Developers: 12
  Active Sessions: 2
  Total Activities: 145
```

✅ **Users**:
```bash
$ start_server admin user create --email admin@example.com --name "Admin User" --org-id acme --role admin
Password: ********
✅ User created: user-abc123 (admin@example.com)

$ start_server admin user list --org-id acme
Users in org acme (5):
  - user-abc123 (admin@example.com) - Admin - role: admin
  - user-def456 (dev@example.com) - Developer - role: member

$ start_server admin user assign --user-id user-abc123 --org-id another-org --role member
✅ User user-abc123 assigned to another-org with role member
```

✅ **Templates**:
```bash
$ start_server admin template list --org-id acme --limit 10
Templates (10):
  - hello-world-abc123 (Hello World Minimal) - boredom: disabled
  - error-handling-def456 (Error Handling) - boredom: enabled (priority: 0.85)
  - refactor-auth-ghi789 (Refactor Auth) - boredom: enabled (priority: 0.75)

$ start_server admin template set-boredom --template-id hello-world-abc123 --enable --priority 0.8
✅ Template hello-world-abc123 configured for boredom (priority: 0.8)
```

✅ **Boredom System**:
```bash
$ start_server admin boredom stats
Boredom System Statistics:
  Total Templates: 45
  Boredom-Eligible: 12 (26.7%)
  Average Priority: 0.72
  Recent Executions (24h): 8

$ start_server admin boredom list
Boredom-Eligible Templates (12):
  1. improve-error-handling (priority: 0.85) - last executed: 2h ago
  2. refactor-auth (priority: 0.75) - last executed: 5h ago
  3. optimize-queries (priority: 0.70) - last executed: never
```

### Dashboard E2E Demonstration

✅ **Playwright Test Output**:
```
Running 1 test using 1 worker

  ✓ Dashboard Activity History E2E › should demonstrate complete data flow from devbob to dashboard (12s)

Screenshots:
  - screenshots/01-dashboard-home.png
  - screenshots/02-after-login.png
  - screenshots/03-activity-history.png
  - screenshots/04-verified-data.png

Assertions:
  ✓ Dashboard loaded successfully
  ✓ Login succeeded (or skipped in local mode)
  ✓ Activity history page accessible
  ✓ Found 23 activity items
  ✓ Activity structure validated (name, timestamp, status, cost, tokens)

  1 passed (12s)
```

✅ **Data Flow Verification**:
- OpenCode execution in devbob → POST /v2/activities/content → SurrealDB storage
- Dashboard GET /auth/orgs/{org_id}/activity → Redis cache (60s TTL) → SurrealDB (on miss)
- Timeline renders 23 activities with correct data structure
- Screenshots provide visual proof of end-to-end flow

---

## Files to Create/Modify

### New Files (5)

1. `repos/metabob-rpc-api/server/db/operations/user_ops.py` (~250 lines)
2. `repos/metabob-rpc-api/sql/migrations/008-boredom-eligibility.surql` (~10 lines)
3. `repos/metabob-rpc-api/tests/playwright/dashboard-e2e-demo.spec.ts` (~80 lines)
4. `repos/metabob-rpc-api/tests/playwright/playwright.config.ts` (~30 lines)
5. `DEMONSTRATION_COMPLETE_admin-cli-and-dashboard-exploration.md` (~200 lines)

### Modified Files (2)

1. `repos/metabob-rpc-api/server/cli.py` (+150 lines for admin commands)
2. `repos/metabob-rpc-api/server/routes/activity.py` (+20 lines for boredom filtering)

---

## Impulse Metadata

**Impulse ID**: `trace-admin-cli-and-dashboard-exploration`  
**Type**: `templateDefinition`  
**Budget**: 5000 tokens  
**Created By**: `trace-enforce-validate-loop` activity  
**Purpose**: Trace analysis for downstream validation and enforcement tasks

**Components Traced**: 8  
**Data Flows Documented**: 6  
**Implementation Phases**: 3  
**Estimated Duration**: 9-15 hours total

---

## Next Steps for Enforcement

This trace impulse will be used by the **enforcement** task to:

1. **Create user_ops.py** with full CRUD operations
2. **Extend CLI** with admin, org, user, template, and boredom command groups
3. **Add schema migration** for boredom eligibility
4. **Update boredom API** to filter by boredom_eligible flag
5. **Create Playwright test** for dashboard E2E demonstration
6. **Configure dashboard** for local mode or create test user
7. **Run demonstration** and capture screenshots
8. **Document complete flow** with visual proof

The enforcement agent will use this trace data to implement each component systematically, ensuring full compliance with the specification requirements.

---

**End of Trace Analysis**
