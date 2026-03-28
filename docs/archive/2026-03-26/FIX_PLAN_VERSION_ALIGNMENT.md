# Fix Plan: Version Alignment & Proper SurrealDB Integration

## Root Cause (Confirmed)
**Version mismatch**: Using SurrealDB 2.3.10 with custom HTTP RPC client, causing parameter serialization issues.

## Solution: Upgrade to Official Stack

### 1. Version Requirements
- **SurrealDB**: Upgrade from 2.3.10 → **3.0** (latest stable)
- **Python Library**: Use official **surrealdb-py** from PyPI (has wheel, no build needed)
- **Package**: `pip install surrealdb`

### 2. Implementation Plan

#### Step 1: Update Dependencies (5 min)
**File**: `repos/metabob-rpc-api/requirements.txt`
```diff
- # No surrealdb library currently (using custom HTTP client)
+ surrealdb>=1.0.0  # Official library with SurrealDB 3.0 support
```

#### Step 2: Update K8s Deployment (5 min)
**File**: `helm/charts/metabob-rpc-api.values.yaml`
```diff
surrealdb:
  image:
-   tag: "2.3.10"
+   tag: "3.0.0"  # or latest 3.x
```

**Apply**:
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
helmfile -f helm/helmfile.yaml sync
```

#### Step 3: Replace Custom HTTP Client with Official Library (30 min)

**File**: `repos/metabob-rpc-api/server/db/surrealdb_client.py`

**Current (custom HTTP client)**:
```python
class SurrealDBHTTPClient:
    def query(self, sql, params):
        # Manual HTTP RPC implementation
        response = self._session.post(...)
```

**New (official library)**:
```python
from surrealdb import Surreal

class SurrealDBClient:
    """Wrapper around official surrealdb-py library."""
    
    def __init__(self, url: str, namespace: str, database: str, 
                 username: str, password: str):
        self.url = url
        self.namespace = namespace
        self.database = database
        self.username = username
        self.password = password
        self._client = None
    
    async def connect(self):
        """Connect and authenticate."""
        self._client = Surreal(self.url)
        await self._client.connect()
        await self._client.signin({"user": self.username, "pass": self.password})
        await self._client.use(self.namespace, self.database)
        return self
    
    async def query(self, sql: str, params: Optional[Dict] = None):
        """Execute query with parameters."""
        if params:
            return await self._client.query(sql, params)
        return await self._client.query(sql)
    
    async def create(self, table: str, data: Dict):
        """Create record."""
        return await self._client.create(table, data)
    
    async def select(self, thing: str):
        """Select record(s)."""
        return await self._client.select(thing)
    
    async def update(self, thing: str, data: Dict):
        """Update record (replaces all fields)."""
        return await self._client.update(thing, data)
    
    async def merge(self, thing: str, data: Dict):
        """Merge update (updates only specified fields)."""
        return await self._client.merge(thing, data)
    
    async def close(self):
        """Close connection."""
        if self._client:
            await self._client.close()

# Singleton pattern for reuse
_db_client: Optional[SurrealDBClient] = None

async def get_surreal_client() -> SurrealDBClient:
    """Get or create singleton client."""
    global _db_client
    if _db_client is None:
        from server.config import settings
        _db_client = SurrealDBClient(
            url=settings.SURREALDB_URL,
            namespace=settings.SURREALDB_NAMESPACE,
            database=settings.SURREALDB_DATABASE,
            username=settings.SURREALDB_USERNAME,
            password=settings.SURREALDB_PASSWORD,
        )
        await _db_client.connect()
    return _db_client
```

#### Step 4: Update Data Operations to Use Official Library (20 min)

**File**: `repos/metabob-rpc-api/server/db/operations/template_metrics.py`

**Key change**: Use `merge()` instead of `update()` to preserve fields:

```python
async def update_metrics_after_execution(
    template_id: str,
    success: bool,
    duration_ms: int,
    cost_usd: float,
    tokens_input: int,
    tokens_output: int,
    tokens_cache: int,
) -> Dict[str, Any]:
    """Update template metrics after execution."""
    db = await get_surreal_client()
    
    # Get current metrics
    metrics = await get_metrics(template_id)
    if not metrics:
        metrics = await create_metrics(template_id)
    
    # Calculate new values
    n = metrics.get("total_executions", 0)
    n_new = n + 1
    # ... (existing calculation logic)
    
    # Prepare update data
    update_data = {
        "total_executions": n_new,
        "successful_executions": successful_executions,
        "failed_executions": failed_executions,
        "success_rate": success_rate,
        "avg_duration_ms": int(new_avg_duration),
        "avg_cost_usd": new_avg_cost,
        "thompson_alpha": thompson_alpha,
        "thompson_beta": thompson_beta,
        "last_executed_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    
    # Use MERGE instead of UPDATE to preserve variant_id/activity_id
    record_id = f"template_metrics:{template_id}"
    result = await db.merge(record_id, update_data)  # ← Key change
    return result
```

#### Step 5: Create Unified Schema Initialization (30 min)

**New File**: `repos/metabob-rpc-api/server/db/schema.py`

```python
"""
Unified schema initialization and migration.
Single source of truth for all SurrealDB schema operations.
"""

from typing import Dict, List
import logging
from server.db.surrealdb_client import get_surreal_client

logger = logging.getLogger(__name__)

SCHEMA_DEFINITIONS = {
    "template_metrics": """
        DEFINE TABLE template_metrics SCHEMALESS PERMISSIONS FULL;
        
        -- Create indexes for common queries
        DEFINE INDEX idx_variant_id ON template_metrics FIELDS variant_id;
        DEFINE INDEX idx_activity_id ON template_metrics FIELDS activity_id;
    """,
    
    "activity_execution": """
        DEFINE TABLE activity_execution SCHEMALESS PERMISSIONS FULL;
        
        -- Indexes for time-series queries
        DEFINE INDEX idx_template_id ON activity_execution FIELDS template_id;
        DEFINE INDEX idx_started_at ON activity_execution FIELDS started_at;
    """,
    
    # Add other tables as needed
}

async def initialize_schema():
    """
    Initialize or update database schema.
    Idempotent - safe to run multiple times.
    """
    db = await get_surreal_client()
    
    logger.info("Initializing SurrealDB schema...")
    
    for table_name, schema_sql in SCHEMA_DEFINITIONS.items():
        try:
            logger.info(f"Applying schema for table: {table_name}")
            await db.query(schema_sql)
            logger.info(f"✓ Schema applied for {table_name}")
        except Exception as e:
            logger.error(f"✗ Failed to apply schema for {table_name}: {e}")
            raise
    
    logger.info("✓ Schema initialization complete")

async def verify_schema():
    """Verify schema is correctly applied."""
    db = await get_surreal_client()
    
    for table_name in SCHEMA_DEFINITIONS.keys():
        info = await db.query(f"INFO FOR TABLE {table_name};")
        logger.info(f"Table {table_name}: {info}")
```

**Usage in startup** (`server/app.py`):
```python
from server.db.schema import initialize_schema

@app.on_event("startup")
async def startup():
    """Initialize on app startup."""
    await initialize_schema()
```

### 3. Testing Plan (15 min)

#### Test 1: Verify SurrealDB 3.0 Running
```bash
kubectl exec -n metabob deploy/surrealdb -- surreal version
# Expected: surrealdb 3.0.x
```

#### Test 2: Test Official Library Connection
```python
# repos/metabob-rpc-api/test_connection.py
import asyncio
from server.db.surrealdb_client import get_surreal_client

async def test():
    db = await get_surreal_client()
    result = await db.query("SELECT * FROM template_metrics LIMIT 1;")
    print(f"Connection successful: {result}")

asyncio.run(test())
```

#### Test 3: Test variant_id Persistence
```bash
kubectl port-forward -n metabob svc/metabob-rpc-api 8080:8080 &

curl -X POST http://localhost:8080/v2/activities/templates/test-official-lib/metrics \
  -H "Content-Type: application/json" \
  -d '{"metrics": {"total_executions": 1, "success_rate": 1.0}}'

# Verify in DB:
kubectl exec -n metabob deploy/surrealdb -- \
  surreal sql --endpoint http://localhost:8000 \
  --namespace metabob --database production \
  --username root --password root \
  --command "SELECT variant_id, activity_id FROM template_metrics WHERE variant_id = 'test-official-lib';"
```

### 4. Migration Strategy

#### Option A: Fresh Start (Recommended for Dev)
1. Delete K8s namespace: `kubectl delete namespace metabob`
2. Deploy with new versions: `helmfile sync`
3. Schema auto-initializes on startup

#### Option B: In-Place Upgrade (Production-Safe)
1. Stop RPC API pods
2. Upgrade SurrealDB to 3.0
3. Run migration script to update existing records
4. Start RPC API with new code

### 5. Benefits of This Approach

✅ **Official Library**: Battle-tested, maintained, supports latest features
✅ **Async/Await**: Proper async support (FastAPI is async)
✅ **MERGE Operation**: Built-in support to preserve fields
✅ **Version Compatibility**: Library designed for SurrealDB 3.0
✅ **Code Reuse**: Single client wrapper, consistent API
✅ **Schema Management**: Unified schema initialization
✅ **Fewer Bugs**: No custom HTTP serialization issues

### 6. File Checklist

- [ ] `requirements.txt` - Add surrealdb package
- [ ] `helm/charts/metabob-rpc-api.values.yaml` - Update SurrealDB to 3.0
- [ ] `server/db/surrealdb_client.py` - Replace with official library wrapper
- [ ] `server/db/schema.py` - Create unified schema manager
- [ ] `server/db/operations/template_metrics.py` - Use merge() instead of update()
- [ ] `server/app.py` - Add schema initialization on startup
- [ ] `docker/Dockerfile.server` - Rebuild with new dependencies
- [ ] Test script - Verify variant_id persistence

## Timeline

- **Schema + Client Wrapper**: 30 min
- **Update Operations**: 20 min  
- **Update Deployment**: 10 min
- **Testing**: 15 min
- **Total**: ~75 minutes

## Next Session: Execute This Plan

1. Start with dependency updates
2. Deploy SurrealDB 3.0
3. Implement official library wrapper
4. Update operations to use merge()
5. Test end-to-end
6. Verify variant_id persists correctly

---

**Key Insight**: The custom HTTP RPC client was masking parameter serialization bugs. The official library handles all the edge cases correctly.
