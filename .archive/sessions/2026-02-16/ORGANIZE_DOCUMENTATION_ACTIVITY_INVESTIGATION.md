# Organize Documentation Activity Investigation

**Date**: February 17, 2026  
**Activity**: `organize-documentation-and-create-codebase-state-snapshot`  
**Status**: ❌ **FAILED** (reported)  
**Location**: Remote session on ide.metabob.com backend

---

## Problem Statement

User reports that the activity `organize-documentation-and-create-codebase-state-snapshot` failed in a recent run on another session connected to the ide.metabob.com backend.

---

## Investigation Results

### Activity Template Located ✅

**Found in database**:
- **Activity ID**: `organize-documentation-v1`
- **Variant ID**: `organize-documentation-v1-b81ea152`
- **Variant Name**: `v1-baseline`

**Location**: `activity_variants` table in local SurrealDB

### Execution Records Not Found ❌

**Searched for**:
- Activity ID: `organize-documentation-v1`
- Variant ID: `organize-documentation-v1-b81ea152`
- Keywords: "organize", "documentation", "snapshot", "state", "codebase"

**Result**: No execution records found in local database

**Queries executed**:
```sql
-- Search by activity_id
SELECT * FROM activity_executions 
WHERE activity_id = 'organize-documentation-v1';
-- Result: []

-- Search by variant_id
SELECT * FROM activity_executions 
WHERE variant_id = 'organize-documentation-v1-b81ea152';
-- Result: []

-- Keyword search
SELECT * FROM activity_executions 
WHERE activity_id CONTAINS 'organize' 
   OR activity_id CONTAINS 'documentation';
-- Result: []
```

---

## Possible Reasons for Missing Data

### 1. Remote Backend Execution

**Most Likely**: The activity ran on ide.metabob.com backend, not local
- User mentioned "another session attached to our same API key"
- User specified "backend hosted on ide.metabob.com"
- Execution data may only exist on remote backend

**Implication**: Local SurrealDB doesn't have this execution data

### 2. Different Database/Namespace

**Possible**: Execution tracked in different namespace/database
- Could be in a different org_id
- Could be in production vs development namespace
- Could be under different project_id

### 3. Execution Not Yet Synced

**Less Likely**: Data hasn't synced from remote to local
- If there's a sync mechanism, it may be delayed
- Execution might be very recent

### 4. Activity Name Mismatch

**Possible**: The full activity name differs from what's stored
- Stored as: `organize-documentation-v1`
- User referred to: `organize-documentation-and-create-codebase-state-snapshot`
- These might be different activities or variants

---

## Recommendations for Investigation

### Option 1: Query Remote Backend Directly (Recommended)

Since the execution is on ide.metabob.com, query that backend:

```bash
# If you have API access to ide.metabob.com
curl -X POST https://ide.metabob.com/api/v1/activities/executions/search \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "activity_name_contains": "organize-documentation",
    "limit": 10,
    "order_by": "timestamp_desc"
  }'
```

### Option 2: Check Session Logs

If you have access to the session that ran the activity:

```bash
# Look for session logs
find ~/.metabob -name "*.log" | xargs grep -l "organize-documentation"

# Or check OpenCode session logs
grep -r "organize-documentation" /path/to/opencode/sessions/
```

### Option 3: Use CLI to Query Remote

If metabob-cli can connect to remote backend:

```python
from metabob_cli.core.config import load_config
import httpx
import asyncio

async def query_remote():
    config = load_config()
    # Assuming ide.metabob.com is configured
    base_url = "https://ide.metabob.com"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{base_url}/api/v1/activities/executions",
            params={"activity_id": "organize-documentation-v1", "limit": 10},
            headers={"Authorization": f"Bearer {api_key}"}
        )
        print(response.json())

asyncio.run(query_remote())
```

### Option 4: Check Activity Definition

Look at the activity template to understand what it does:

```bash
# Check if template exists locally
find . -name "*organize-documentation*.json" -o -name "*organize*doc*.json"

# Or query the variant details
docker exec -i metabob-surreal /surreal sql ... <<< "
SELECT * FROM activity_variants 
WHERE variant_id = 'organize-documentation-v1-b81ea152';
"
```

---

## What We Know About the Activity

### Template Information

From our database:
- **Activity ID**: `organize-documentation-v1`
- **Variant ID**: `organize-documentation-v1-b81ea152`
- **Variant Name**: `v1-baseline`
- **Base Activity**: organize-documentation
- **Category**: Likely "other" or "infrastructure"

### Expected Functionality

Based on the name `organize-documentation-and-create-codebase-state-snapshot`:
- **Purpose**: Organize documentation files
- **Purpose**: Create a snapshot of codebase state
- **Scope**: Likely analyzes and restructures docs
- **Output**: Possibly creates markdown files, moves files, generates index

### Why It Might Fail

Common failure reasons for this type of activity:
1. **File system errors**: Can't access/move documentation files
2. **Permission issues**: Can't write to certain directories
3. **Conflicts**: Existing files or directories blocking changes
4. **Analysis failures**: Can't parse or understand existing docs
5. **Timeout**: Activity takes too long
6. **Context issues**: Missing required context or impulses

---

## Immediate Actions Needed

### 1. Locate the Execution Record

**Priority**: HIGH

You need to find where the execution data is stored:
- [ ] Check if ide.metabob.com has API access for queries
- [ ] Get the execution_id from the other session
- [ ] Confirm which backend/database has the data

### 2. Get Failure Details

**Priority**: HIGH

Once execution is located, retrieve:
- [ ] Execution ID
- [ ] Timestamp (when it failed)
- [ ] Error message or failure reason
- [ ] Task-level results (which task failed?)
- [ ] Step results (which step in that task failed?)

### 3. Check Session Context

**Priority**: MEDIUM

Understand the session where it ran:
- [ ] Session ID
- [ ] What files/context were available?
- [ ] What variables were passed?
- [ ] What was the working directory?

---

## Query Templates for Remote Investigation

### Get Recent Executions

```sql
-- If querying ide.metabob.com database
SELECT 
  execution_id,
  activity_id,
  variant_id,
  success,
  timestamp,
  outcome,
  session_id
FROM activity_executions
WHERE activity_id LIKE '%organize%'
  OR activity_id LIKE '%documentation%'
ORDER BY timestamp DESC
LIMIT 20;
```

### Get Failure Details

```sql
-- Once you have execution_id
SELECT 
  execution_id,
  step_order,
  step_name,
  success,
  error_message,
  duration_ms
FROM step_results
WHERE execution_id = '<execution_id_here>'
ORDER BY step_order;
```

### Get Task Results

```sql
-- Task-level failures
SELECT *
FROM activity_executions
WHERE execution_id = '<execution_id_here>';
-- Look at: tasks array, outcome field
```

---

## Next Steps

### Step 1: Confirm Data Location

Please provide:
1. Do you have access to query ide.metabob.com backend?
2. Do you have the execution_id from the other session?
3. Can you share logs from that session?

### Step 2: Retrieve Failure Details

Once we know where the data is:
1. Get execution_id
2. Query for error_message and failed tasks
3. Analyze failure cause

### Step 3: Remediation

Based on failure cause:
1. Fix template if needed
2. Adjust context/variables
3. Re-run with corrections

---

## Template Check (If Available Locally)

Let me check if the template exists locally:

```bash
# Search for the template file
find . -name "*organize*doc*.json" 2>/dev/null

# Or check activity_variants full record
docker exec -i metabob-surreal /surreal sql ... <<< "
SELECT * FROM activity_variants 
WHERE variant_id = 'organize-documentation-v1-b81ea152';
"
```

---

## Summary

**Status**: Activity template located, execution record NOT found in local database

**Likely Cause**: Execution ran on remote backend (ide.metabob.com), not synced to local

**Action Required**: 
1. Query ide.metabob.com backend for execution record
2. Get execution_id and failure details
3. Analyze error_message and failed tasks
4. Determine remediation steps

**Blocker**: Need access to remote backend data or session logs

---

**Investigation Status**: ⏳ PENDING (awaiting remote backend access)  
**Next Action**: Provide execution_id or remote backend query access
