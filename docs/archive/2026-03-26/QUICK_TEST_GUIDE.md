# Quick Test Guide - MCP Integration

## Prerequisites Check
```bash
# 1. Verify MiniBob backend is running
curl http://localhost:8081/health | jq '.status'
# Expected: "healthy"

# 2. Verify port-forward is active
ps aux | grep "port-forward.*8081"
# Expected: kubectl port-forward process running

# 3. Run validation script
./validate-mcp-integration.sh
# Expected: All checks pass ✓
```

## Manual Test in OpenCode

### Test 1: Simple Goal
```typescript
goal({
  goal: "Add a hello world function to test.ts",
  context: { files: ["test.ts"] },
  maxActivities: 1,
  maxCost: 1.0
})
```

**Expected output:**
```
[INFO] initializing MiniBob MCP client { sessionID: '...', endpoint: 'http://localhost:8081' }
[INFO] MiniBob MCP client initialized { sessionID: '...' }
[INFO] starting goal execution loop { goalType: 'implement', maxActivities: 1 }
[INFO] got recommendations from backend
[INFO] executing activity
```

### Test 2: Verify Backend Received Request
```bash
# Check backend logs for recommendation request
kubectl logs -n activity-system -l app=minibob-minibob-cluster --tail=50 | grep "recommend"
```

### Test 3: Verify Trace Stored
```bash
# Query execution traces
curl -s http://localhost:8081/v2/activities/execution-traces | jq '.traces | length'
# Expected: > 0
```

## Troubleshooting

### Problem: 0 activities executed
**Symptom:** Goal returns immediately with no activities
**Check:**
```bash
# Verify MCP initialization happened
grep "MiniBob MCP client initialized" opencode.log

# Verify backend is reachable
curl http://localhost:8081/health
```

### Problem: "minibob MCP not enabled"
**Symptom:** Log shows "minibob MCP not enabled, stopping"
**Cause:** `isMCPEnabled()` returned false
**Fix:**
1. Check config has `minibob.url` (not `endpoint`)
2. Verify `initializeMCP()` was called
3. Restart OpenCode session

### Problem: Backend not responding
**Symptom:** Timeout or connection refused
**Check:**
```bash
# 1. Is backend running?
kubectl get pods -n activity-system | grep minibob

# 2. Is port-forward active?
ps aux | grep "port-forward.*8081"

# 3. Recreate port-forward if needed
kubectl port-forward -n activity-system svc/minibob-minibob-cluster 8081:8080 &
```

## Success Indicators

✅ **Integration Working:**
- MCP init log appears
- Goal executes 1+ activities
- Backend logs show `/v2/activities/recommend` requests
- Execution traces appear in database
- No TypeScript errors

❌ **Integration Not Working:**
- No MCP init log
- 0 activities executed
- Log shows "minibob MCP not enabled"
- Backend shows no requests

## Next Steps After Success

1. **Collect Data:** Use goal tool for real tasks to build execution history
2. **Monitor Learning:** Check if Thompson Sampling improves over time (need 10+ executions)
3. **Test Debugging:** Create impulse pointing to execution trace
4. **Test Extraction:** Use ribosome to extract template from trace (future)

## Quick Commands

```bash
# Restart port-forward
pkill -f "port-forward.*8081"
kubectl port-forward -n activity-system svc/minibob-minibob-cluster 8081:8080 &

# Check backend health
curl -s http://localhost:8081/health | jq '.'

# Count execution traces
curl -s http://localhost:8081/v2/activities/execution-traces | jq '.traces | length'

# Get latest trace
curl -s http://localhost:8081/v2/activities/execution-traces | jq '.traces[0]'

# Run validation
./validate-mcp-integration.sh
```
