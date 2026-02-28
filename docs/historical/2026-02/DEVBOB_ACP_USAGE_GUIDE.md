# DevBob ACP Server - Usage Guide

## Quick Start

### Prerequisites
- Kubernetes cluster running (Docker Desktop, Minikube, etc.)
- `kubectl` configured
- DevBob pod running in `metabob` namespace

### Verify Deployment
```bash
# Check pod status
kubectl get pods -n metabob -l app.kubernetes.io/name=devbob

# Expected output:
# NAME                     READY   STATUS    RESTARTS   AGE
# devbob-cccfc4478-jtsm5   1/1     Running   0          5m

# Verify ACP is ready
kubectl logs -n metabob -l app.kubernetes.io/name=devbob | grep "acp-command setup connection"

# Expected output:
# INFO service=acp-command setup connection
```

## Using ACP Delegation from OpenCode

### Method 1: Direct acp_delegate Tool (Recommended)

From any OpenCode session, use the `acp_delegate` tool:

```typescript
// Example: Delegate a simple task
const result = await acp_delegate({
  target: "docker://devbob",  // or "ssh://user@host:port/path"
  taskDescription: "List files and check status",
  prompt: "List all files in the current directory and tell me what you see",
  timeout: 300  // seconds
})

console.log(result.response)
```

### Method 2: With Impulse Sharing

Share context between agents using impulses:

```typescript
// Step 1: Create an impulse with context
impulse_create({
  id: "feature-requirements",
  pointer: { 
    type: "memo", 
    content: "Feature Requirements:\n- REST endpoint\n- JWT auth\n- Rate limiting" 
  },
  budget: 2000
})

// Step 2: Delegate with shared context
const result = await acp_delegate({
  target: "docker://devbob",
  taskDescription: "Implement REST endpoint",
  prompt: "Implement the REST endpoint based on the shared requirements",
  shareImpulses: ["feature-requirements"],
  timeout: 600
})
```

### Method 3: Multi-Agent Parallel Execution

Run multiple tasks simultaneously:

```typescript
const [backend, frontend, tests] = await Promise.all([
  acp_delegate({
    target: "docker://devbob-backend",
    taskDescription: "Implement backend API",
    prompt: "Create the backend API endpoints"
  }),
  acp_delegate({
    target: "docker://devbob-frontend",
    taskDescription: "Build frontend UI",
    prompt: "Create the React components"
  }),
  acp_delegate({
    target: "docker://devbob-test",
    taskDescription: "Write integration tests",
    prompt: "Create end-to-end tests"
  })
])
```

## Connection Methods

### Docker Connection
For DevBob running in Docker/Kubernetes:
```
target: "docker://devbob"
target: "docker://container-name"
```

### SSH Connection
For remote DevBob instances:
```
target: "ssh://user@host:22/workspace"
target: "ssh://devbob@10.0.0.5:2222/opt/workspace"
```

## Port Forwarding for Local Testing

If you want to test the HTTP endpoint directly:

```bash
# Forward port 3000 from DevBob service
kubectl port-forward -n metabob svc/devbob 3000:3000

# In another terminal, test the connection
curl http://localhost:3000/config
```

## Common Use Cases

### 1. Code Implementation
```typescript
acp_delegate({
  target: "docker://devbob",
  taskDescription: "Implement user authentication",
  prompt: `
    Implement JWT-based user authentication with:
    1. Login endpoint (/api/auth/login)
    2. Token validation middleware
    3. Password hashing with bcrypt
    4. Tests for all endpoints
  `
})
```

### 2. Bug Fixing
```typescript
acp_delegate({
  target: "docker://devbob",
  taskDescription: "Fix authentication bug",
  prompt: `
    Fix the bug in src/auth.ts where tokens expire immediately.
    The issue is on line 45 where we use Date.now() instead of Date.now() + 3600000.
    Update the code and run tests to verify.
  `
})
```

### 3. Testing
```typescript
acp_delegate({
  target: "docker://devbob",
  taskDescription: "Run test suite",
  prompt: "Run the full test suite and report any failures with details"
})
```

### 4. Documentation
```typescript
acp_delegate({
  target: "docker://devbob",
  taskDescription: "Generate API docs",
  prompt: "Generate OpenAPI documentation for all REST endpoints in src/api/"
})
```

### 5. Refactoring
```typescript
acp_delegate({
  target: "docker://devbob",
  taskDescription: "Refactor auth module",
  prompt: `
    Refactor the authentication module to:
    1. Separate concerns (auth, token, validation)
    2. Add TypeScript types
    3. Improve error handling
    4. Keep existing tests passing
  `
})
```

## Response Format

The `acp_delegate` tool returns:

```typescript
{
  sessionId: string          // Remote session ID for tracking
  response: string           // Agent's response text
  toolsUsed: string[]        // List of tools executed remotely
  metrics: {
    duration: number         // Execution time in seconds
    tokenEstimate: number    // Estimated tokens used
  }
}
```

## Best Practices

### 1. Clear Task Descriptions
✅ **Good:** "Implement user authentication with JWT"  
❌ **Bad:** "Do auth stuff"

### 2. Specific Prompts
✅ **Good:** "Create a POST /api/users endpoint that accepts {name, email} and returns 201 with user ID"  
❌ **Bad:** "Make an endpoint"

### 3. Appropriate Timeouts
- Simple tasks: 60-120 seconds
- Implementation: 300-600 seconds
- Complex refactoring: 600-1200 seconds

### 4. Error Handling
Always wrap in try-catch:
```typescript
try {
  const result = await acp_delegate({...})
  console.log("Success:", result.response)
} catch (error) {
  console.error("Delegation failed:", error)
  // Fallback to local execution or retry
}
```

### 5. Impulse Sharing
Share context strategically:
- ✅ Design decisions
- ✅ Requirements documents
- ✅ API schemas
- ❌ Large code files (use file paths instead)
- ❌ Binary data

## Troubleshooting

### Issue: "Connection refused"
**Solution:** Check pod is running and port-forward is active
```bash
kubectl get pods -n metabob
kubectl port-forward -n metabob svc/devbob 3000:3000
```

### Issue: "Timeout"
**Solution:** Increase timeout or break into smaller tasks
```typescript
timeout: 1200  // 20 minutes for complex tasks
```

### Issue: "No response from agent"
**Solution:** Check pod logs for errors
```bash
kubectl logs -n metabob -l app.kubernetes.io/name=devbob --tail=50
```

### Issue: "Impulse not found"
**Solution:** Create impulse before delegation
```typescript
// Create impulse first
impulse_create({...})

// Then delegate with sharing
acp_delegate({ shareImpulses: ["impulse-id"] })
```

## Advanced Configuration

### Custom Environment Variables
Add to helm values:
```yaml
env:
  CUSTOM_VAR: "value"
  FEATURE_FLAG: "enabled"
```

Redeploy:
```bash
cd helm && helmfile -f helmfile.simple.yaml apply
```

### Persistent Workspace
DevBob mounts a persistent volume at `/workspace`:
- Files created persist across pod restarts
- Use for long-running projects
- Clean up periodically to avoid disk pressure

Access workspace:
```bash
kubectl exec -n metabob -it devbob-xxx -- /bin/bash
cd /workspace
ls -la
```

### Resource Limits
Current limits (see helm values):
- CPU: 2000m (2 cores)
- Memory: 2Gi

For heavier workloads, increase:
```yaml
resources:
  limits:
    cpu: 4000m
    memory: 4Gi
```

## Monitoring

### Check Resource Usage
```bash
kubectl top pod -n metabob devbob-xxx
```

### View Logs in Real-Time
```bash
kubectl logs -n metabob -f -l app.kubernetes.io/name=devbob
```

### Check ACP Connection Status
```bash
kubectl logs -n metabob -l app.kubernetes.io/name=devbob | grep "acp-command"
```

Expected output:
```
INFO service=acp-command setup connection
```

## Next Steps

1. **Test Basic Delegation:** Start with simple echo tasks
2. **Try Impulse Sharing:** Share context between agents
3. **Implement Workflows:** Build multi-agent pipelines
4. **Monitor Performance:** Track success rates and timing
5. **Scale Up:** Add more DevBob instances for parallel work

## Support

For issues or questions:
1. Check pod logs: `kubectl logs -n metabob -l app.kubernetes.io/name=devbob`
2. Verify configuration: Review `DEVBOB_ACP_SUCCESS_SUMMARY.md`
3. Test connectivity: Use port-forward and curl
4. Check resources: Ensure sufficient CPU/memory

---

**Status:** ✅ Production Ready  
**Deployment:** Kubernetes + Helm  
**Version:** 1.0.0 (local-fixed)
