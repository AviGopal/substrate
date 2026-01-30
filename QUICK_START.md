# DevBob Quick Start Guide

**Get DevBob running in 5 minutes**

---

## Prerequisites

- ✅ Docker and Docker Compose installed
- ✅ OpenCode installed on host machine
- ✅ API keys (ANTHROPIC_API_KEY or OPENAI_API_KEY)
- ✅ Metabob backend running (optional but recommended)

---

## Step 1: Configure Environment (1 minute)

```bash
cd metabob-devbob

# Copy example config
cp configs/.env.devbob.example configs/.env.devbob

# Edit with your API keys
nano configs/.env.devbob
```

**Required in .env.devbob**:
```bash
ANTHROPIC_API_KEY=sk-...  # or OPENAI_API_KEY
```

---

## Step 2: Start DevBob (2 minutes)

```bash
# Start all containers
./scripts/start-devbob.sh

# Expected output:
# ✓ Metabob backend is running
# ✓ All DevBob containers started
# ✓ devbob-rpc-api (port 3001) - ACP accessible
# ✓ devbob-dashboard (port 3002) - ACP accessible
# ✓ devbob-cli (port 3003) - ACP accessible
# ✓ devbob-opencode (port 3004) - ACP accessible
```

**Verify containers running**:
```bash
docker ps --filter name=devbob
```

Should show 4 containers: devbob-rpc-api, devbob-dashboard-agent, devbob-cli-agent, devbob-opencode-agent.

---

## Step 3: Bootstrap Templates (30 seconds)

```bash
# Install activity templates and helpers
./scripts/bootstrap-devbob.sh

# Expected output:
# ✓ Installed: fix-devbob-network-access.json
# ✓ Installed: specification-driven-implementation.json
# ✓ Installed: find-messages-for.sh
# ✓ Created: IMPULSE_CONVENTIONS.md
# ✓ All containers accessible
```

---

## Step 4: First Dogfooding Session (2 minutes)

Open OpenCode on your host machine:

```bash
opencode
```

### Create Your First Specification

```typescript
// In OpenCode session
await impulse_create({
  id: "spec-hello-devbob",
  pointer: {
    type: "memo",
    content: `# Hello DevBob Test

## Purpose
Verify DevBob can implement features from specifications.

## Requirements
- Create file: src/utils/hello-devbob.ts
- Function: helloDevBob() => string
- Returns: "Hello from DevBob!"
- Write test: tests/utils/hello-devbob.test.ts

## Success Criteria
- Function exists and works
- Test passes
- test-result impulse created
- activity-result impulse created

## Constraints
- Less than 10 lines of code
- Follow existing code style
    `
  },
  budget: 3000,
  priority: "high",
  type: "specification",
  metadata: {
    targetRepository: ["metabob-opencode"],
    testFeature: true
  }
});
```

### Delegate to DevBob

```typescript
// In OpenCode session
const result = await acp_delegate({
  target: "docker://devbob-opencode-agent",
  taskDescription: "Test DevBob specification-driven implementation",
  prompt: `Implement the hello-devbob test feature.

IMPORTANT:
1. Load specification impulse: spec-hello-devbob
2. Read and understand the requirements
3. Implement the function and test
4. Run tests and capture output as test-result impulse
5. Create activity-result impulse with summary

This validates our dogfooding pattern is working.`,
  shareImpulses: ["spec-hello-devbob"],
  timeout: 300
});

console.log("Delegation result:", result);
```

### Verify Results

```typescript
// Check impulses created by DevBob
const testResults = await impulse_list({ type: "test-result" });
console.log("Test results:", testResults);

const activityResults = await impulse_list({ type: "activity-result" });
console.log("Activity results:", activityResults);
```

**Success!** 🎉 If you see impulses with type `test-result` and `activity-result`, DevBob is working!

---

## Step 5: Verify Implementation

Check if DevBob created the files:

```bash
# In the metabob-opencode container
docker exec devbob-opencode-agent ls -la /workspace/src/utils/hello-devbob.ts
docker exec devbob-opencode-agent ls -la /workspace/tests/utils/hello-devbob.test.ts

# Run the tests
docker exec devbob-opencode-agent sh -c 'cd /workspace && npm test -- hello-devbob'
```

---

## Troubleshooting

### Can't Access ACP from Host

```bash
# Test inside container (should work)
docker exec devbob-rpc-api curl -s http://localhost:3001/acp/sessions

# Test from host (should also work)
curl http://localhost:3001/acp/sessions

# If host fails, run:
cd metabob-devbob
opencode activity execute fix-devbob-network-access
```

### Container Not Starting

```bash
# Check logs
docker logs devbob-rpc-api

# Common issues:
# - Missing API key in .env.devbob
# - Port already in use (change in docker-compose)
# - Need to build image: docker build -f configs/Dockerfile.devbob -t devbob:latest .
```

### Impulse Not Transferred

```typescript
// Verify impulse exists before delegation
await impulse_list({ type: "specification" });

// Ensure shareImpulses is an array
acp_delegate({
  shareImpulses: ["spec-hello-devbob"],  // ← Must be array
  ...
});
```

### Delegation Times Out

```typescript
// Increase timeout (default is 300s = 5 min)
acp_delegate({
  timeout: 900,  // 15 minutes
  ...
});
```

---

## Next Steps

### Real Dogfooding

Now that DevBob works, use it to build real features:

```typescript
// 1. Create specification for actual feature
await impulse_create({
  id: "spec-activity-persistence",
  pointer: {
    type: "memo",
    content: `# Activity Persistence

## Purpose
Save activity state so it survives container restarts.

## Requirements
- Checkpoint after each task
- Save to .opencode/activities/checkpoints/
- Auto-resume on container start

## Success Criteria
- Container restart resumes activity
- No data loss on crash
    `
  },
  budget: 5000,
  type: "specification"
});

// 2. Delegate to DevBob
await acp_delegate({
  target: "docker://devbob-opencode-agent",
  taskDescription: "Implement activity persistence",
  prompt: "Implement activity persistence per specification. Use specification-driven-implementation activity template.",
  shareImpulses: ["spec-activity-persistence"]
});
```

### Cross-Container Coordination

Test MESSAGE_FOR pattern:

```typescript
// DevBob-rpc-api makes a change
await acp_delegate({
  target: "docker://devbob-rpc-api",
  prompt: "Add a new auth endpoint. Annotate with MESSAGE_FOR:dashboard explaining what UI changes are needed."
});

// DevBob-dashboard responds
await acp_delegate({
  target: "docker://devbob-dashboard-agent",
  prompt: "Query for MESSAGE_FOR:dashboard annotations and implement required changes."
});
```

---

## Useful Commands

```bash
# Start DevBob
./scripts/start-devbob.sh

# Stop DevBob (preserve volumes)
./scripts/stop-devbob.sh

# Stop and clean (remove volumes)
./scripts/stop-devbob.sh --clean

# Bootstrap templates
./scripts/bootstrap-devbob.sh

# Find cross-container messages
../scripts/find-messages-for.sh dashboard

# Check container logs
docker logs devbob-rpc-api
docker logs -f devbob-opencode-agent  # Follow logs

# Execute command in container
docker exec devbob-rpc-api <command>

# Shell into container
docker exec -it devbob-rpc-api /bin/sh
```

---

## Documentation

- **README.md** - Full overview
- **docs/INCREMENTAL_DEVBOB_DOGFOODING.md** - 6-week plan
- **docs/DOGFOODING_QUICK_START.md** - Detailed dogfooding guide
- **docs/DEVBOB_SELF_SUSTAINING_ROADMAP.md** - Infrastructure roadmap
- **workflows/** - Example workflows

---

## Success Criteria

✅ **You're ready when**:
- All 4 DevBob containers running
- ACP accessible from host on ports 3001-3004
- First specification impulse implemented successfully
- test-result and activity-result impulses created

---

**Now start building Metabob with Metabob!** 🚀

For detailed dogfooding workflows, see:
- `workflows/first-dogfooding-session.md`
- `workflows/cross-container-coordination.md`
- `workflows/autonomous-development.md`
