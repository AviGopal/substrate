# Metabob DevBob Environment

**Self-Healing Multi-Agent Development Environment**

This is the **Metabob DevBob orchestration layer** - a multi-agent development environment where AI agents autonomously develop and maintain the Metabob platform components using Metabob's own code quality tools.

> **Note**: This is the orchestration directory. The actual Metabob services (RPC API, CLI, Dashboard, OpenCode) are in `repos/` subdirectories.

---

## What is DevBob?

DevBob is a **multi-agent development environment** where:
- Each agent runs in an isolated Docker container
- Agents have full access to their codebase (metabob-rpc-api, metabob-dashboard, metabob-cli, metabob-opencode)
- Agents use **Metabob MCP tools** for code analysis, annotations, and co-change prediction
- Agents coordinate via **impulses** (shared knowledge) and **annotations** (design decisions)
- Agents are **specification-driven**: read requirements, implement, test, annotate
- System is **self-sustaining**: agents develop themselves incrementally

---

## Directory Structure

```
metabob-devbob/                          # Orchestration layer
├── README.md                            # This file
├── QUICK_START.md                       # Get started in 5 minutes
│
├── repos/                               # Metabob service repositories
│   ├── metabob-rpc-api/                # FastAPI backend service
│   ├── metabob-cli/                    # Python CLI + MCP server
│   ├── metabob-opencode/               # Bun-based agent IDE
│   └── cpg-inference/                  # Code Property Graph engine
│
├── configs/                             # Docker and environment configs
│   ├── docker-compose.devbob.yaml      # Services + agents
│   ├── .env.devbob                     # Environment configuration
│   ├── devbob-entrypoint.sh            # Container initialization
│   └── Dockerfile.devbob               # Agent container image
│
├── scripts/                             # Helper scripts
│   ├── start-with-backend.sh           # Start all services + agents
│   ├── build-devbob.sh                 # Build agent image
│   ├── stop-devbob.sh                  # Stop environment
│   └── bootstrap-devbob.sh             # Initialize setup
│
├── templates/                           # Activity templates
│   ├── implement-self-healing-system.json
│   ├── specification-driven-implementation.json
│   └── fix-devbob-network-access.json
│
└── docs/                                # Documentation
    ├── SELF_HEALING_DEVBOB_ARCHITECTURE.md
    ├── DEVBOB_SELF_SUSTAINING_ROADMAP.md
    ├── investigations/                  # Session reports
    │   ├── TIMEOUT_INVESTIGATION_REPORT.md
    │   └── BACKEND_INTEGRATION_GUIDE.md
    └── [other architecture docs]
```

---

## Quick Start

### Prerequisites
- Docker and Docker Compose
- OpenCode installed on host
- Metabob backend running (or configured)
- API keys: `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`

### Launch DevBob Environment

```bash
cd metabob-devbob

# 1. Configure environment
cp .env.devbob.example .env.devbob
# Edit .env.devbob with your API keys

# 2. Build agent image
./scripts/build-devbob.sh

# 3. Start backend services + agent containers
./devbob start

# 4. Verify services (wait 2-3 min for startup)
curl http://localhost:8080/status       # Backend API
curl http://localhost:3001/config       # devbob-rpc-api agent
curl http://localhost:3004/config       # devbob-opencode agent

# 5. Test from inside container
docker exec devbob-opencode curl http://api-server-dev:80/status
```

### First Dogfooding Session

```bash
# In host OpenCode session
opencode run

# Then in the session:
```

```typescript
// 1. Create your first specification
await impulse_create({
  id: "spec-test-devbob",
  pointer: {
    type: "memo",
    content: `# Test DevBob Environment

## Purpose
Verify DevBob containers can receive and implement specifications.

## Requirements
- Add a simple utility function
- File: src/utils/test.ts
- Function: testDevBob() => string
- Returns: "DevBob is working!"
- Write tests

## Success Criteria
- Function exists and works
- Tests pass
- Impulses created for results
    `
  },
  budget: 3000,
  type: "specification"
});

// 2. Delegate to DevBob
await acp_delegate({
  target: "docker://devbob-opencode-agent",
  taskDescription: "Test DevBob environment setup",
  prompt: `Implement the test feature from specification.
  
Load impulse: spec-test-devbob
Follow the specification and create result impulses.`,
  shareImpulses: ["spec-test-devbob"],
  timeout: 300
});

// 3. Verify results
await impulse_list({ type: "test-result" });
await impulse_list({ type: "activity-result" });
```

**Success!** If impulses are created, DevBob is working. You're ready for real development.

---

## Core Concepts

### 1. Specification-Driven Development

DevBob agents work from **specification impulses**:

```typescript
await impulse_create({
  id: "spec-feature-name",
  pointer: {
    type: "memo",
    content: `# Feature Specification
    
## Purpose
What this feature does

## Requirements
- Requirement 1
- Requirement 2

## Constraints
- Performance, compatibility, etc.

## Success Criteria
- How to verify it works
    `
  },
  budget: 5000,
  type: "specification",
  metadata: {
    targetRepository: ["metabob-rpc-api"],
    constraints: ["< 5s", "backward-compatible"]
  }
});
```

### 2. Cross-Container Coordination

Agents coordinate via **MESSAGE_FOR annotations**:

```typescript
// DevBob-rpc-api makes a change
await metabob_annotate_component({
  file_path: "src/auth/jwt.ts",
  component_name: "verifyToken",
  component_type: "function",
  reason: `Updated JWT to support RS256.
           Breaking change: requires 'algorithm' parameter.
           MESSAGE_FOR:dashboard,cli - Update auth API calls to pass algorithm.`
});

// DevBob-dashboard queries for messages
const messages = await metabob_search_codebase_issues({
  query: "MESSAGE_FOR:dashboard"
});
// Implements required changes
```

### 3. Knowledge Accumulation

Every implementation creates knowledge artifacts:

```typescript
// Test results
await impulse_create({
  id: "test-result-" + Date.now(),
  pointer: { type: "memo", content: testOutput },
  type: "test-result",
  metadata: { passed: true, timestamp: "..." }
});

// Activity results
await impulse_create({
  id: "activity-result-" + activityId,
  pointer: { type: "memo", content: JSON.stringify({...}) },
  type: "activity-result",
  metadata: { success: true, duration: 300000 }
});

// Design decisions
await metabob_annotate_component({
  reason: `DESIGN_DECISION: Use RS256
           WHY: Better security
           ALTERNATIVES: HS256, ES256
           TRADEOFFS: Complexity for security`
});
```

### 4. Metabob Integration

DevBob uses Metabob MCP tools:

- `metabob_search_codebase_issues` - Find similar code
- `metabob_suggest_related_changes` - Co-change prediction
- `metabob_annotate_component` - Document design decisions
- `metabob_analyze_change_impact` - Understand dependencies
- `metabob_get_priority_issues` - Find bugs to fix

---

## Development Phases

### Phase 0: Bootstrap (Week 1)
**Goal**: Get DevBob environment operational

- [ ] Fix network access (if needed)
- [ ] Test specification impulse pattern
- [ ] Validate cross-container delegation
- [ ] Document working setup

**Activity**: `fix-devbob-network-access`

### Phase 1: Specification-Driven (Week 1-2)
**Goal**: Build features from specifications

- [ ] Implement 3+ features via specifications
- [ ] Refine specification format
- [ ] Create reusable templates
- [ ] Document patterns

**Template**: `specification-driven-implementation`

### Phase 2: Cross-Container Coordination (Week 2-3)
**Goal**: Multi-agent collaboration

- [ ] Implement MESSAGE_FOR pattern
- [ ] Test cross-repo coordination
- [ ] Build helper scripts
- [ ] Validate integration

### Phase 3: Knowledge Accumulation (Week 3-4)
**Goal**: Learn from past work

- [ ] Track test results
- [ ] Document design decisions
- [ ] Build searchable corpus
- [ ] Enable knowledge reuse

### Phase 4: Autonomous Development (Week 4-6)
**Goal**: Self-sustaining agents

- [ ] Implement activity persistence
- [ ] Build task queue
- [ ] Enable autonomous work selection
- [ ] Full dogfooding

---

## Available Activity Templates

### 1. fix-devbob-network-access.json
**Purpose**: Debug and fix ACP network connectivity
**Use When**: Can't access containers from host
**Duration**: 10-30 minutes

### 2. specification-driven-implementation.json
**Purpose**: Implement features from specification impulses
**Use When**: Building any new feature or fix
**Duration**: 1-4 hours

### 3. implement-intent-driven-dataflow-orchestration.json
**Purpose**: Build advanced routing and orchestration
**Use When**: Ready for phase 4+ capabilities
**Duration**: 4-6 weeks (multi-phase)

---

## Helper Scripts

### start-devbob.sh
```bash
# Start all DevBob containers
./scripts/start-devbob.sh

# Start specific container
./scripts/start-devbob.sh devbob-rpc-api
```

### stop-devbob.sh
```bash
# Stop all DevBob containers
./scripts/stop-devbob.sh

# Stop and remove volumes (clean slate)
./scripts/stop-devbob.sh --clean
```

### bootstrap-devbob.sh
```bash
# Initialize DevBob environment
# - Copies templates to .metabob/activities/
# - Creates initial impulses
# - Tests connectivity
./scripts/bootstrap-devbob.sh
```

### find-messages-for.sh
```bash
# Find cross-container coordination messages
./scripts/find-messages-for.sh dashboard
./scripts/find-messages-for.sh cli
```

---

## Troubleshooting

### Container Not Starting
```bash
# Check logs
docker logs devbob-rpc-api

# Common issues:
# - Missing API key in .env.devbob
# - Port already in use
# - Image not built
```

### Can't Access ACP from Host
```bash
# Test inside container (should work)
docker exec devbob-rpc-api curl -s http://localhost:3001/acp/sessions

# Test from host (should also work)
curl http://localhost:3001/acp/sessions

# If host fails, check:
# - Port mapping in docker-compose
# - ACP hostname binding (should be 0.0.0.0)
# - Firewall rules
```

### Impulse Not Transferred
```bash
# Check shareImpulses parameter
acp_delegate({
  shareImpulses: ["spec-id"],  # Must be array
  ...
});

# Verify impulse exists before sharing
await impulse_list({ type: "specification" });
```

### Metabob Tools Not Available
```bash
# Check MCP server running
docker exec devbob-rpc-api ps aux | grep metabob-cli

# Should show: metabob-cli mcp --transport stdio

# Check OpenCode can see tools
# In OpenCode session, available tools should include metabob_*
```

---

## Documentation Guide

### For Getting Started
1. **QUICK_START.md** - 5-minute setup
2. **DOGFOODING_QUICK_START.md** - First dogfooding session
3. **INCREMENTAL_DEVBOB_DOGFOODING.md** - 6-week plan

### For Understanding Architecture
1. **DEVBOB_SELF_SUSTAINING_ROADMAP.md** - Infrastructure plan
2. **INTENT_DRIVEN_DATAFLOW_ORCHESTRATION.md** - Advanced routing
3. **GNN_COCHANGE_TOOLING_ARCHITECTURE.md** - ML-based predictions

### For Daily Operations
1. **workflows/first-dogfooding-session.md** - Step-by-step guide
2. **workflows/cross-container-coordination.md** - Multi-agent patterns
3. **workflows/autonomous-development.md** - Self-sustaining operations

---

## Contributing

DevBob develops itself! To contribute:

1. **Create specification impulse** describing the feature/fix
2. **Delegate to appropriate DevBob agent**
3. **Agent implements** following the specification
4. **Agent creates** test-result and activity-result impulses
5. **Agent annotates** design decisions
6. **Review and merge** the changes

---

## Success Metrics

### Week 1: Bootstrap
- [ ] All 4 DevBob containers running
- [ ] ACP accessible from host
- [ ] First specification implemented
- [ ] Pattern validated

### Week 2: Dogfooding
- [ ] 5+ features built via specifications
- [ ] Cross-container coordination working
- [ ] Knowledge corpus growing

### Week 4: Autonomous
- [ ] DevBob agents work autonomously
- [ ] Activity persistence implemented
- [ ] Task queue operational

### Week 6: Self-Sustaining
- [ ] Agents build Metabob features independently
- [ ] Learning from past implementations
- [ ] Zero manual intervention for common tasks

---

## Related Projects

- **metabob-opencode**: OpenCode framework with activity system
- **metabob-rpc-api**: Backend API and orchestration
- **metabob-dashboard**: Frontend visualization
- **metabob-cli**: CLI and MCP server

---

## Resources

- [OpenCode Documentation](https://github.com/metabob/opencode)
- [Metabob Platform](https://metabob.com)
- [Activity System Guide](./docs/DEVBOB_ACTIVITY_WORKFLOWS.md)
- [Impulse System Guide](./docs/IMPULSE_SYSTEM_GUIDE.md)

---

## License

Same as parent Metabob project

---

## Support

- Issues: File in parent repository
- Questions: See documentation in `docs/`
- Improvements: Create specification impulse and delegate to DevBob!

---

**Start now**: `./scripts/start-devbob.sh` and begin your first dogfooding session! 🚀
