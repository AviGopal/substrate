# Validation Harnesses

Automated validation scripts for testing specifications without LLM involvement.

## Template Loading Persistence Harness

**Specification**: `template-loading-persistence`

**File**: `template-loading-persistence-harness.ts`

**Purpose**: Validates that activity templates persist in SurrealDB and are accessible after Redis cache is cleared.

### Validation Strategy

1. Create test template (writes to SurrealDB + Redis cache)
2. Verify template exists in both SurrealDB and Redis
3. Clear Redis cache (FLUSHDB)
4. Query template via API (should load from SurrealDB)
5. Verify template returned successfully
6. Verify Redis cache repopulated automatically

### Usage

#### CLI (Standalone)

```bash
# Run with default settings
tsx tests/validation-harnesses/template-loading-persistence-harness.ts

# Run with custom template name
TEMPLATE_NAME="My Test Template" tsx tests/validation-harnesses/template-loading-persistence-harness.ts

# Run with custom RPC API URL
RPC_API_URL="http://metabob-rpc-api:8000" tsx tests/validation-harnesses/template-loading-persistence-harness.ts

# Run with kubectl context
KUBECTL_CONTEXT="my-k8s-context" tsx tests/validation-harnesses/template-loading-persistence-harness.ts
```

#### Programmatic (Node.js)

```typescript
import { runValidation } from './template-loading-persistence-harness';

const input = {
  templateName: 'Test Template Persistence',
  templateCategory: 'feature',
  rpcApiUrl: 'http://localhost:8000',
  kubectlContext: undefined,
};

const result = await runValidation(input);

if (result.pass) {
  console.log('✅ PASS:', result.details);
} else {
  console.log('❌ FAIL:', result.details);
  console.log('Errors:', result.errors);
}
```

#### CI/CD Integration

```bash
# Add to CI pipeline
npm run test:validation:template-persistence

# Or directly
tsx tests/validation-harnesses/template-loading-persistence-harness.ts || exit 1
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TEMPLATE_NAME` | Name of test template | `Test Template Persistence` |
| `TEMPLATE_CATEGORY` | Template category | `feature` |
| `RPC_API_URL` | RPC API URL | `http://localhost:8000` |
| `KUBECTL_CONTEXT` | Kubectl context | (none) |

### Output Format

```json
{
  "pass": true,
  "actual": {
    "templateCreated": true,
    "existsInSurrealDB": true,
    "existsInRedisBeforeClear": true,
    "redisCleared": true,
    "loadedAfterClear": true,
    "existsInRedisAfterClear": true,
    "cacheRepopulated": true
  },
  "expected": {
    "templateCreated": true,
    "existsInSurrealDB": true,
    "existsInRedisBeforeClear": true,
    "redisCleared": true,
    "loadedAfterClear": true,
    "existsInRedisAfterClear": true,
    "cacheRepopulated": true
  },
  "details": "✅ PASS: Template loading persistence validated successfully."
}
```

### Exit Codes

- `0`: All checks passed (PASS)
- `1`: One or more checks failed (FAIL)

### Prerequisites

1. **Runtime Dependencies**:
   - Node.js (v18+)
   - TypeScript (`tsx` or `ts-node`)
   - `kubectl` CLI (for K8s access)
   - `curl` (for HTTP requests)

2. **K8s Resources**:
   - Redis pod (`deployment/redis`)
   - SurrealDB pod (`deployment/surreal`)
   - RPC API pod (running and accessible)

3. **Network Access**:
   - Access to RPC API (HTTP)
   - Access to K8s cluster (kubectl)

### Test Cases

Test cases are stored as impulses in `impulses/` directory:

1. **Case 1: Basic Template Persistence** (`validation-template-loading-persistence-case-1.json`)
   - Single template
   - Basic cache clear → load → verify flow

2. **Case 2: TTL Expiration Recovery** (`validation-template-loading-persistence-case-2.json`)
   - Template with TTL expiration
   - Manual cache key deletion
   - Automatic refresh from SurrealDB

3. **Case 3: Multiple Templates Persistence** (`validation-template-loading-persistence-case-3.json`)
   - 5 templates
   - Bulk cache clear
   - Verify all templates load correctly

### Troubleshooting

#### Template Creation Fails

```bash
# Check RPC API health
kubectl logs -l app=rpc-api --tail=50

# Verify RPC API is accessible
curl http://localhost:8000/
```

#### SurrealDB Check Fails

```bash
# Check SurrealDB pod
kubectl get pods | grep surreal

# Verify SurrealDB connectivity
kubectl exec -it deployment/surreal -- surreal sql \
  --conn http://localhost:8000 \
  --user root --pass root \
  --ns test --db test \
  "INFO FOR DB"
```

#### Redis Check Fails

```bash
# Check Redis pod
kubectl get pods | grep redis

# Verify Redis connectivity
kubectl exec -it deployment/redis -- redis-cli PING
```

#### Cache Clear Fails

```bash
# Manually clear Redis
kubectl exec -it deployment/redis -- redis-cli FLUSHDB

# Verify cache is empty
kubectl exec -it deployment/redis -- redis-cli DBSIZE
```

### Related Documentation

- **Specification**: `surrealdb-primary-redis-cache`
- **Trace Analysis**: `TRACE_TEMPLATE_LOADING_PERSISTENCE.md`
- **Enforcement Summary**: `ENFORCEMENT_TEMPLATE_LOADING_PERSISTENCE.md`
- **Impulses**:
  - `trace-template-loading-persistence`
  - `enforcement-template-loading-persistence`
  - `harness-template-loading-persistence`

