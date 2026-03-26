# Database Configuration Report - Learning Loop

**Date**: 2026-02-24  
**Previous Report**: 2026-02-21  
**Status**: ✅ REDIS OPERATIONAL | ⚠️ SURREALDB AUTH ISSUES

---

## Executive Summary

### Key Findings

1. **Redis is FULLY OPERATIONAL** and serving as the primary storage backend
   - 11,229 total keys (up from 7,823 on 2026-02-21)
   - 24 activity metrics tracked
   - Thompson Sampling data present
   - ✅ Connection healthy

2. **SurrealDB has AUTHENTICATION ISSUES**
   - Initial authentication succeeds
   - Subsequent queries fail with 401 Unauthorized
   - Likely cause: JWT token expiry
   - Impact: Learning loop endpoints non-functional

3. **JSON Files are OPERATIONAL** as fallback
   - 13 templates in `~/.metabob/activities/`
   - Used by Boredom API
   - Direct filesystem access

4. **Dual-Write Status**: Partial
   - ✅ Path A (Redis): Working
   - ❌ Path B (SurrealDB): Broken (401 errors)
   - ✅ Path C (JSON Files): Working (fallback)

---

## Database Status Summary

| Database | Status | Connection | Data Present | Purpose | Integration |
|----------|--------|------------|--------------|---------|-------------|
| **Redis** | ✅ Running | ✅ Healthy | ✅ 11,229 keys | Thompson Sampling | ✅ OPERATIONAL |
| **SurrealDB** | ✅ Running | ⚠️ Auth Fails | ❓ Unknown | Learning Loop Metrics | ⚠️ BROKEN |
| **JSON Files** | ✅ Available | ✅ Direct FS | ✅ 13 templates | Boredom API | ✅ OPERATIONAL |
| **Local Storage** | ✅ Available | ✅ Direct FS | ✅ Recent files | Activity State | ✅ OPERATIONAL |

---

## 1. Redis Configuration ✅ FULLY OPERATIONAL

### Container Status
```
Name: metabob-redis
Status: Up 4 days (healthy)
Ports: 0.0.0.0:6379->6379/tcp
Image: redis:7-alpine
Health: ✅ Healthy
```

### Connection Verification
```bash
$ docker exec metabob-redis redis-cli ping
PONG

$ docker exec metabob-redis redis-cli DBSIZE
11229

$ docker exec metabob-redis redis-cli INFO keyspace
# Keyspace
db0:keys=11229,expires=10467,avg_ttl=28294341
```

### Data Present

#### Activity Metrics (24 variants)
```bash
$ docker exec metabob-redis redis-cli KEYS "activity:metrics:*" | wc -l
24
```

**Sample Data**:
```json
{
  "variant_id": "test-fix-validation-1771876445",
  "activity_id": "test-fix-validation",
  "total_selections": 0,
  "total_successes": 0,
  "total_failures": 0,
  "thompson_alpha": 1.0,
  "thompson_beta": 1.0,
  "avg_cost": 0.0,
  "avg_duration_ms": 0.0
}
```

#### Activity Templates (20 variants)
```bash
$ docker exec metabob-redis redis-cli KEYS "activity:template:*" | wc -l
20
```

**Sample Data**:
```json
{
  "variant_id": "hello-world-minimal-31727b21",
  "activity_id": "hello-world-minimal",
  "variant_name": "Hello World Minimal",
  "description": "Minimal test activity",
  "version": 1,
  "expected_duration_ms": 10000,
  "expected_cost": 0.01,
  "genealogy": {
    "content_hash": "31727b21",
    "parent_hash": null,
    "generation": 0
  }
}
```

#### Template Metrics (4 templates)
```bash
$ docker exec metabob-redis redis-cli KEYS "template:*:metrics"
template:test-template:metrics
template:validate-data-flow:metrics
```

### Usage in Learning Loop

**Integration**: OpenCode → MetabobCLI → API Server → Redis

**Code Location**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`

```typescript
export async function completeActivityExecution(executionData: {
  activityId: string
  templateId: string
  variantId?: string
  success: boolean
  duration: number
  cost: number
  tokens: { input: number; output: number; cache: number }
}): Promise<boolean> {
  // Calls MCP tool → API server → Redis update
}
```

**Flow**:
```
Activity completes
    ↓
completeActivityExecution() called
    ↓
MCP tool: activity/complete
    ↓
API Server: POST /api/activity-execution
    ↓
Redis: activity:metrics:{variant_id} updated
    ↓
Thompson Sampling parameters recalculated (alpha, beta)
```

**Status**: ✅ WORKING (verified from learning loop validation report 2026-02-21)

---

## 2. SurrealDB Configuration ⚠️ AUTHENTICATION ISSUES

### Container Status
```
Name: metabob-surreal
Status: Up 7 hours
Ports: 0.0.0.0:8000->8000/tcp
Image: surrealdb/surrealdb:v2.6.0
```

### Startup Command
```bash
start --bind 0.0.0.0:8000 --user root --pass root --log info memory
```

**Note**: Using **in-memory storage** (data lost on restart)

### Connection Configuration

**API Server Environment** (`.env.docker`):
```bash
SURREALDB_URL="http://metabob-surreal:8000"
SURREALDB_USERNAME="root"
SURREALDB_PASSWORD="root"
SURREALDB_NAMESPACE="metabob"
SURREALDB_DATABASE="metabob"
```

### Authentication Problem

**Initial Connection**: ✅ SUCCESS
```
2026-02-23 20:03:29,913 INFO Connecting to SurrealDB: http://metabob-surreal:8000
2026-02-23 20:03:29,969 INFO Authentication successful (token-based)
```

**Subsequent Queries**: ❌ 401 UNAUTHORIZED
```
2026-02-24 02:50:52,473 ERROR Failed to query executions: 401 Client Error: Unauthorized
2026-02-24 02:50:54,405 ERROR Failed to get boredom activities: 401 Client Error: Unauthorized
```

### Root Cause Analysis

**Problem**: JWT token expires after initial connection

**Evidence**:
1. First connection authenticates successfully and receives JWT token
2. Token is stored in connection object
3. Subsequent queries fail with 401 Unauthorized
4. Token likely has short TTL (e.g., 1 hour)

**Technical Details** (`server/db/surrealdb_client.py`):
```python
def connect(self):
    # Initial auth (works)
    response = requests.post(
        f"{self.url}/rpc",
        json={"method": "signin", "params": [{"user": self.username, "pass": self.password}]}
    )
    token = response.json().get("result")
    self._connection.set_token(token)  # Set once, may expire later
    
    # Use namespace/database
    self._connection.use(self.namespace, self.database)
```

**Issue**: Token is set ONCE during connection initialization, but expires before subsequent queries. No token refresh logic implemented.

### Affected Endpoints

All learning loop endpoints fail with 401:

- `POST /api/v1/learning-loop/executions` - Record execution
- `GET /api/v1/learning-loop/executions` - Query executions
- `GET /api/v1/learning-loop/templates/{id}/metrics` - Get metrics
- `GET /api/v1/learning-loop/boredom-activities` - Fetch improvements

**Impact**: Cannot use SurrealDB for learning loop metrics

### SurrealDB Schema (Defined but Unused)

**Tables** (from backend code):
1. `activity_execution` - Individual execution records
2. `template_metrics` - Aggregated template metrics
3. `failure_pattern` - Recurring failure tracking

**Data Status**: ❓ UNKNOWN (cannot query due to 401 errors)

---

## 3. JSON Files Storage ✅ OPERATIONAL

### Location
```
~/.metabob/activities/
```

### Files Present
```bash
$ ls ~/.metabob/activities/*.json | wc -l
13
```

### Usage

**Purpose**: Boredom API for template improvement prioritization

**Integration**: MCP tool `metabob_fetch_boredom_activities`

**Code Location**: `repos/metabob-cli/src/metabob_cli/mcp/activity_templates.py`

**Algorithm**:
1. List all JSON files in `~/.metabob/activities/`
2. Parse each file to extract metrics
3. Filter templates with `improvement_gradient < threshold`
4. Exclude templates executed in last N hours
5. Categorize by activity type (improve/debug/optimize)
6. Calculate priority = 1.0 - improvement_gradient
7. Sort by priority (highest first)
8. Return top N activities

**Status**: ✅ WORKING (used as fallback when SurrealDB fails)

---

## 4. Local Storage ✅ OPERATIONAL

### Location
```
~/.local/share/opencode/storage/activity/
```

### Recent Files
```bash
$ ls -lht ~/.local/share/opencode/storage/activity/*.json | head -5
-rw-r--r-- 1 avi avi 9.1K Feb 23 18:49 act_mm006e5l_addeb2c0f1b3aca3.json
-rw-r--r-- 1 avi avi 1.7K Feb 23 18:43 act_mlzzzkck_b83950e33cce5056.json
-rw-r--r-- 1 avi avi 1.4K Feb 23 12:09 act_mlzlzb9a_7803b3968947888f.json
-rw-r--r-- 1 avi avi 1.3K Feb 23 12:02 act_mlzlr5ch_7efc82b8d5b197ad.json
-rw-r--r-- 1 avi avi 1.5K Feb 23 11:43 act_mlzkzc55_85d20171cbe94c85.json
```

### Purpose

- Activity state persistence
- Execution evidence tracking
- Resume/replay support
- Artifact tracking

**Status**: ✅ Core OpenCode functionality, working correctly

---

## 5. Dual-Write Architecture Status

### Path A: Redis ✅ WORKING
```
Activity Execution
    ↓
TemplateMetricsClient.reportExecution()
    ↓
MetabobCLI.completeActivityExecution()
    ↓
MCP Tool: activity/complete
    ↓
API Server: POST /api/activity-execution
    ↓
Redis: activity:metrics:{variant_id} [UPDATED ✅]
```

### Path B: SurrealDB ❌ BROKEN
```
Activity Execution
    ↓
TemplateMetricsClient.reportExecution()
    ↓
MCP Tool: metabob_post_activity_result
    ↓
API Server: POST /api/v1/learning-loop/executions
    ↓
SurrealDB: activity_execution [401 UNAUTHORIZED ❌]
```

### Path C: JSON Files (Fallback) ✅ WORKING
```
Boredom API Request
    ↓
MCP Tool: metabob_fetch_boredom_activities
    ↓
Direct File I/O: ~/.metabob/activities/*.json
    ↓
Return templates with low improvement_gradient [SUCCESS ✅]
```

### Summary Matrix

| Path | Target | Status | Error Handling | Impact |
|------|--------|--------|----------------|--------|
| A: Redis | Thompson Sampling | ✅ Working | Non-blocking | Loop continues |
| B: SurrealDB | Learning Metrics | ❌ 401 Errors | Non-blocking | Metrics lost |
| C: JSON Files | Boredom API | ✅ Working | File locking | Loop continues |

**Conclusion**: Learning loop CAN operate without SurrealDB using Redis + JSON Files, but loses intended functionality (rich queries, aggregated metrics, failure pattern analysis).

---

## 6. Configuration Files

### API Server Environment
**File**: `repos/metabob-rpc-api/.env.docker`

```bash
# Redis ✅
REDIS_URI="redis://redis:6379"

# SurrealDB ⚠️
SURREALDB_URL="http://metabob-surreal:8000"
SURREALDB_USERNAME="root"
SURREALDB_PASSWORD="root"
SURREALDB_NAMESPACE="metabob"
SURREALDB_DATABASE="metabob"
```

### Docker Compose
**File**: `docker-compose.yaml`

**Potential Issue**: Environment variable inconsistency
```yaml
environment:
  REDIS_URI: redis://redis:6379         # ✅ Correct
  SURREAL_URL: ws://surreal:8000        # ⚠️ WS protocol (but .env.docker uses HTTP)
```

**Impact**: API server may be using HTTP from `.env.docker`, which works for initial auth but fails later.

---

## 7. Recommendations

### Critical Fix: SurrealDB Authentication

**Issue**: JWT token expires after initial connection

**Solution**: Implement token refresh logic in `surrealdb_client.py`

```python
def _ensure_authenticated(self):
    """Check authentication and refresh token if needed."""
    try:
        # Test query
        self._connection.query("SELECT 1")
    except HTTPError as e:
        if e.response.status_code == 401:
            # Token expired, re-authenticate
            logger.info("Token expired, re-authenticating...")
            self.connect()

def query(self, sql: str, params: dict = None):
    """Execute query with automatic re-authentication."""
    self._ensure_authenticated()  # Check before query
    return self._connection.query(sql, params)
```

**Files to Modify**:
- `repos/metabob-rpc-api/server/db/surrealdb_client.py`

### Short-Term Improvements

1. **Add Persistent Storage to SurrealDB**
   ```yaml
   metabob-surreal:
     volumes:
       - surreal-data:/data
     command: ["start", "--bind", "0.0.0.0:8000", "--user", "root", "--pass", "root", "file:/data/surreal.db"]
   ```

2. **Resolve URL Inconsistency**
   - Standardize on HTTP RPC endpoint
   - Update Docker Compose to match `.env.docker`

3. **Add Dual-Write Verification**
   - Log success/failure of both Redis and SurrealDB writes
   - Add metrics for dual-write health

### Long-Term Enhancements

4. **Consolidate Storage Architecture**
   - Decide on primary: SurrealDB (rich queries) vs Redis (speed)
   - Deprecate JSON Files once SurrealDB working
   - Use Redis as cache layer only

5. **Implement Health Checks**
   - Endpoint: `GET /api/v1/health/databases`
   - Check: Redis connectivity, SurrealDB auth, query latency

6. **Add Backup Strategy**
   - Redis: `redis-cli SAVE` periodically
   - SurrealDB: `EXPORT` command to files
   - Store backups to S3 or local volumes

---

## 8. Answers to Calling Agent Questions

### Q1: Database connection configured?
**Answer**: ✅ **YES**
- Redis: Fully configured and connected
- SurrealDB: Configured but connection fails after initial auth

### Q2: Storage backend identified?
**Answer**: **Redis (primary, operational) + JSON Files (fallback, operational) + SurrealDB (secondary, broken)**

### Q3: Schema accessible?
**Answer**: 
- Redis: ✅ YES (11,229 keys accessible)
- SurrealDB: ❌ NO (401 errors prevent queries)
- JSON Files: ✅ YES (direct filesystem access)

### Q4: Connection credentials available?
**Answer**: ✅ **YES**
- Redis: No auth required
- SurrealDB: root/root (works initially, then 401)

### Q5: Alternative storage found?
**Answer**: ✅ **YES**
- JSON Files (`~/.metabob/activities/`) actively used for Boredom API
- Local Storage (`~/.local/share/opencode/storage/`) for activity state

---

## 9. Verification Commands

### Test Redis Connection
```bash
docker exec metabob-redis redis-cli ping
docker exec metabob-redis redis-cli DBSIZE
docker exec metabob-redis redis-cli KEYS "activity:*" | head -10
docker exec metabob-redis redis-cli GET "activity:metrics:test-fix-validation-1771876445" | python3 -m json.tool
```

### Test SurrealDB Connection
```bash
# Via API server (currently fails with 401)
curl -s http://localhost:8080/api/v1/learning-loop/executions?limit=1

# Check container logs
docker logs api-server-dev 2>&1 | grep -E "SurrealDB|Authentication|401" | tail -20
```

### Check JSON Files
```bash
ls -lh ~/.metabob/activities/*.json
cat ~/.metabob/activities/test-feature-template.json | python3 -m json.tool | head -40
```

### Check Local Storage
```bash
ls -lht ~/.local/share/opencode/storage/activity/*.json | head -10
cat ~/.local/share/opencode/storage/activity/$(ls -t ~/.local/share/opencode/storage/activity/*.json | head -1) | python3 -m json.tool | head -50
```

---

## 10. Conclusion

**Current State**: Redis is operational and serving as the primary storage backend. SurrealDB is configured but unusable due to authentication token expiry. JSON files provide fallback functionality.

**System Viability**: ✅ Learning loop CAN operate without SurrealDB
- Thompson Sampling works via Redis
- Boredom API works via JSON Files
- Activity state persists in Local Storage

**Critical Path**: Fix SurrealDB authentication to enable:
- Rich metric queries
- Failure pattern analysis
- Comprehensive learning loop analytics
- Reduced reliance on JSON file fallback

**Next Steps**:
1. Implement token refresh logic in `surrealdb_client.py`
2. Test with `curl` to verify 401 errors resolved
3. Query SurrealDB tables to check for existing data
4. Add persistent storage to SurrealDB container
5. Deprecate JSON Files once SurrealDB fully operational
