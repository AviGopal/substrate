# Proto Compliance Validation Plan

**Date**: 2026-02-08  
**Goal**: Validate proto-compliant communication using devbob environment  
**Method**: Start services, monitor logs, verify proto message flow

---

## Validation Strategy

### 1. **Start Backend Services (Full Mode)**
Start the full metabob backend with all services

### 2. **Monitor Logs in Real-Time**
Watch for proto-compliant communication in logs:
- metabob-rpc-api: v2 API responses
- metabob-cli: Proto message parsing
- Content-Type headers
- Proto field names (snake_case)

### 3. **Test Communication Flow**
- Session creation (API key → proto Session)
- Template search (→ proto ActivityVariant messages)
- Activity execution (proto messages throughout)

---

## Test Execution Steps

### Step 1: Check Environment
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Check if .env.devbob exists
ls -la .env.devbob

# Show current mode
./devbob mode
```

### Step 2: Start Full Backend (if needed)
```bash
# Switch to full mode
export DEVBOB_MODE=full

# Start backend services
./devbob backend

# Wait for services to be healthy
sleep 10

# Check status
./devbob status
```

### Step 3: Tail Logs (Multiple Terminals)

**Terminal 1: RPC API Logs**
```bash
./devbob logs metabob-rpc-api-server
```

Watch for:
- `Content-Type: application/protobuf+json`
- `POST /v2/session`
- `GET /v2/activities/templates`
- Proto field names in responses

**Terminal 2: Worker Logs (if applicable)**
```bash
./devbob logs metabob-rpc-api-worker
```

### Step 4: Test Session Creation

```bash
# Create session using v2 API
curl -X POST http://localhost:8080/v2/session \
  -H "X-API-Key: test_key_123" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "test-project"}' \
  -v

# Expected:
# - Status: 200 OK
# - Content-Type: application/protobuf+json
# - Response: Proto Session message with:
#   - session_id
#   - session_type: "SESSION_TYPE_AUTHENTICATED"
#   - consumer_id: "cli:user_123"
#   - metadata.session_token
#   - created_at, expires_at (RFC3339)
```

### Step 5: Test Template Search

```bash
# Extract session_token from step 4
SESSION_TOKEN="eyJ..."

# Search templates
curl -X GET "http://localhost:8080/v2/activities/templates?category=feature&limit=5" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -v

# Expected:
# - Status: 200 OK
# - Content-Type: application/protobuf+json
# - Response: Array of proto ActivityVariant messages with:
#   - variant_id, activity_id, variant_name
#   - task_steps array (TaskStep protos)
#   - genealogy (Genealogy proto)
#   - optimization_config (OptimizationConfig proto)
#   - Snake_case field names throughout
```

### Step 6: Test Template Details

```bash
# Get specific template
curl -X GET "http://localhost:8080/v2/activities/templates/feature-impl-v1" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -v | jq .

# Expected:
# - Full ActivityVariant proto with all fields
# - task_steps array with nested structures:
#   - prompt.template, prompt.max_tokens
#   - validation.required_files
#   - retry.max_attempts, retry.strategy
#   - metrics.success_rate, metrics.avg_tokens
```

### Step 7: Grep Logs for Proto Compliance

```bash
# Check for proto content-type in logs
./devbob logs metabob-rpc-api-server 2>&1 | grep -i "protobuf+json"

# Check for v2 endpoint hits
./devbob logs metabob-rpc-api-server 2>&1 | grep -E "(POST|GET) /v2/"

# Check for proto field names (snake_case)
./devbob logs metabob-rpc-api-server 2>&1 | grep -E "(variant_id|task_steps|created_at)"
```

---

## Expected Log Patterns

### Proto-Compliant Logs ✅

```
INFO - "POST /v2/session HTTP/1.1" 200 OK
INFO - Response headers: Content-Type: application/protobuf+json
DEBUG - Proto Session message: {
  "session_id": "test-org:test-project:uuid",
  "session_type": "SESSION_TYPE_AUTHENTICATED",
  "consumer_id": "cli:user_123",
  "metadata": {"session_token": "eyJ..."},
  "created_at": "2026-02-08T05:00:00Z",
  "expires_at": "2026-02-09T05:00:00Z"
}

INFO - "GET /v2/activities/templates?category=feature HTTP/1.1" 200 OK
DEBUG - Proto ActivityVariant response with 5 templates
DEBUG - Field names: variant_id, activity_id, task_steps (snake_case)
```

### Non-Proto Logs ❌

```
ERROR - Missing Content-Type: application/protobuf+json
ERROR - CamelCase field names detected: variantId, taskSteps
ERROR - Enum value is integer, not string: session_type=2
ERROR - Missing required proto fields: genealogy, optimization_config
```

---

## Validation Checklist

### Backend (metabob-rpc-api)

- [ ] `/v2/session` returns proto Session message
- [ ] Response has `Content-Type: application/protobuf+json` header
- [ ] Session message includes all 9 required fields
- [ ] `session_type` enum is string ("SESSION_TYPE_AUTHENTICATED")
- [ ] `session_token` is in `metadata` map
- [ ] Timestamps are RFC3339 format

- [ ] `/v2/activities/templates` returns proto ActivityVariant messages
- [ ] Response has `Content-Type: application/protobuf+json` header
- [ ] ActivityVariant includes all 14+ required fields
- [ ] `task_steps` array is properly structured (TaskStep protos)
- [ ] `genealogy` proto is present
- [ ] `optimization_config` proto is present (Thompson Sampling)
- [ ] All field names are snake_case (not camelCase)
- [ ] `status` enum is string ("ENTITY_STATUS_ACTIVE")

### CLI (metabob-cli)

- [ ] CLI successfully extracts `session_token` from `metadata.session_token`
- [ ] CLI parses proto ActivityVariant responses
- [ ] CLI handles snake_case field names correctly
- [ ] CLI accesses nested proto structures (prompt, validation, retry)
- [ ] CLI doesn't break on new proto fields

### Integration

- [ ] Full auth flow works (API key → session_token → templates)
- [ ] No proto-related errors in logs
- [ ] All responses are proto-compliant
- [ ] Backward compatibility maintained (old endpoints still work)

---

## Troubleshooting

### Issue: Connection Refused

**Symptom**: `curl: (7) Failed to connect to localhost:8080`

**Fix**:
```bash
# Check if backend is running
./devbob status

# Start backend if not running
export DEVBOB_MODE=full
./devbob backend
```

### Issue: 401 Unauthorized

**Symptom**: `{"detail": "Authentication required"}`

**Fix**:
- Check API key is valid
- Verify API key is in database (SurrealDB)
- Check logs for API key validation errors

### Issue: Non-Proto Response

**Symptom**: Response has `Content-Type: application/json` (not `protobuf+json`)

**Fix**:
- Verify v2 routes are registered in `server/app.py`
- Check `proto_response()` function is used in endpoints
- Restart backend: `./devbob restart metabob-rpc-api-server`

### Issue: CamelCase Field Names

**Symptom**: Response has `variantId` instead of `variant_id`

**Fix**:
- Check `MessageToDict()` has `preserving_proto_field_name=True`
- Verify proto messages are used (not Pydantic models)
- Check import statements for proto modules

---

## Success Criteria

1. ✅ All v2 endpoints respond with `Content-Type: application/protobuf+json`
2. ✅ Session proto has all 9 required fields
3. ✅ ActivityVariant proto has all 14+ required fields
4. ✅ All field names are snake_case
5. ✅ All enums are string names (not integers)
6. ✅ All timestamps are RFC3339 format
7. ✅ Nested proto structures are correct (task_steps, genealogy, etc.)
8. ✅ CLI successfully parses proto responses
9. ✅ No proto-related errors in logs
10. ✅ Full communication flow works end-to-end

---

## Log Files to Capture

Save logs for analysis:

```bash
# Capture 1 minute of logs during testing
./devbob logs metabob-rpc-api-server > proto_validation_logs.txt 2>&1 &
LOG_PID=$!

# Run tests (steps 4-6)
# ... perform API calls ...

# Stop log capture
sleep 60
kill $LOG_PID

# Analyze logs
grep -i "protobuf+json" proto_validation_logs.txt
grep -i "v2/session\|v2/activities" proto_validation_logs.txt
grep -i "error\|warning" proto_validation_logs.txt
```

---

## Next Steps After Validation

If validation passes:
1. Document proto compliance in README
2. Update API documentation with proto examples
3. Add proto compliance to CI/CD tests
4. Mark proto compliance task as complete

If validation fails:
1. Identify specific failures from logs
2. Fix issues in backend/CLI code
3. Re-run validation
4. Update implementation as needed

---

**Ready to Start**: Run `./devbob backend` and begin validation
