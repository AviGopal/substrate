# Dataflow Quick Reference

**TL;DR**: Cannot test without metabob-rpc-api. It's the required gateway to SurrealDB.

---

## The Enforced Dataflow

```
metabob-opencode → metabob-cli → metabob-rpc-api → SurrealDB
      (MCP)             (HTTP)          (DB Driver)
```

**No shortcuts allowed!**

---

## At Each Point

### 1. metabob-opencode
- **Role**: Execution orchestration
- **Does**: Execute activities, detect boredom, call MCP tools
- **Does NOT**: Access DB, calculate gradients, store metrics

### 2. metabob-cli
- **Role**: Stateless MCP gateway
- **Does**: Proxy MCP → HTTP, validate schemas, retry on failure
- **Does NOT**: Business logic, state storage, metric calculation

### 3. metabob-rpc-api
- **Role**: Learning engine + DB gateway
- **Does**: Thompson Sampling, gradient calculation, DB writes
- **Does NOT**: Execute activities, manage sessions

### 4. SurrealDB
- **Role**: Learning state persistence
- **Stores**: Templates, executions, metrics, failure patterns
- **Updates**: Success rates, gradients, priorities

---

## Learning: How It Works

```
Execute Activity
    ↓
Measure (success, duration, cost, tokens)
    ↓
Record to Backend (via MCP → HTTP → DB)
    ↓
Thompson Sampling Updates Success Rate
    ↓
Calculate Improvement Gradient
    ↓
Prioritize Templates (gradient × urgency)
    ↓
Boredom System Fetches High-Priority Templates
    ↓
Auto-Execute Improvements
    ↓
Loop back to Execute
```

---

## Improvement Gradient Formula

```python
gradient = (
    (1.0 - success_rate) * 0.5 +      # 50%: Gap to perfect
    (usage_frequency / 50) * 0.2 +    # 20%: How often used
    recency_weight * 0.2 +            # 20%: Recent failures
    (max_severity / 10) * 0.1         # 10%: Error severity
)
```

**Range**: 0.0 (perfect, no improvement needed) to 1.0 (urgent)

---

## What Is a Vessel?

**Vessel = Instructional State** (the capacity to execute)

Examples:
- OpenCode binary (`/usr/local/bin/opencode`)
- Activity template JSON file
- DevBob container image
- Docker image layer

**NOT a vessel**:
- Running process (that's an instance)
- Execution in progress (that's becoming)
- Completed activity (that's an instance)

---

## Three-State Ontology

```
VESSEL (Instructional)
    ↓ Instantiation
BECOMING (Transient)
    ↓ Actualization  
INSTANCE (Functional)
    ↓ Learning
IMPROVED VESSEL (Next iteration)
```

**The system exists primarily in the BECOMING state** (continuous transformation).

---

## DevBob Coordination

### How vessels communicate:
1. **ACP (Agent Client Protocol)** - Task delegation
2. **Shared SurrealDB** - Activity state sync
3. **Impulse sharing** - Context transfer

### Pattern: Parallel execution
```
Host → Delegate Task A to Vessel 1 (Backend)
    └→ Delegate Task B to Vessel 2 (Frontend)
         → Both vessels execute independently
         → Results merged back to host
```

---

## Boredom Activities

**Trigger**: Session idle 5+ minutes  
**Purpose**: Autonomous self-improvement

**Lifecycle**:
1. Idle detected
2. Fetch high-priority templates (GET /boredom-activities)
3. Select highest gradient
4. Execute with `initiatedBy='boredom-auto'`
5. Record results → Update metrics → Recalculate gradient
6. Loop

---

## Testing Requirements

**Minimal Stack** (3 services):
```bash
docker-compose up -d redis surrealdb metabob-rpc-api
```

**Validation**:
```bash
./scripts/validate-metabob-stack.sh
```

**E2E Test Activity**:
```bash
opencode activity execute --template test-metabob-stack-e2e-fixed
```

**You CANNOT skip metabob-rpc-api** - it's the only gateway to SurrealDB.

---

## Key Metrics

| Metric | Stored Where | Updated When | Used For |
|--------|-------------|--------------|----------|
| Success Rate | SurrealDB | After execution | Thompson Sampling |
| Improvement Gradient | SurrealDB | After execution | Boredom priorities |
| Execution Count | SurrealDB | After execution | Frequency weight |
| Last Execution | SurrealDB | After execution | Recency weight |
| Failure Patterns | SurrealDB | After failure | Severity weight |

---

## See Full Documentation

👉 **DATAFLOW_AND_LEARNING_ARCHITECTURE.md** (complete trace, 800+ lines)

Contains:
- Complete dataflow diagrams
- Thompson Sampling algorithm
- Gradient calculation formulas
- Vessel transformation cycles
- DevBob coordination patterns
- Testing strategies
- Example queries and code

---

**Quick Status Check**:
```bash
# Are all services running?
curl http://localhost:8080/health  # metabob-rpc-api
redis-cli -h localhost -p 6379 ping  # Redis
curl http://localhost:8000/health  # SurrealDB
```

**If any fail**: You cannot test dataflow until all 3 are running.
