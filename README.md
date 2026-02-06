# Activity Learning System

This repository contains the implementation of an **activity-driven development system** that learns from experience.

## Quick Start

**New here?** Start with [`ARCHITECTURE.md`](./ARCHITECTURE.md) - understand how the system works.

**Ready to implement?** See [`INTENT_VALIDATION_IMPLEMENTATION_PLAN.txt`](./INTENT_VALIDATION_IMPLEMENTATION_PLAN.txt) - detailed implementation steps.

**Need navigation?** See [`ACTIVITY_SYSTEM_ISSUES_INDEX.md`](./ACTIVITY_SYSTEM_ISSUES_INDEX.md) - complete documentation index.

---

## What Is This?

The activity system exists to **learn from experience**:

1. **Capture intent** - Activities capture the "why" (goal, acceptance criteria)
2. **Execute work** - Activities implement changes to achieve the intent
3. **Validate outcomes** - Objective validators prove intent was achieved
4. **Learn from results** - Outcomes feed into Thompson Sampling to improve recommendations

This creates a **self-improving system** where:
- Good templates are promoted
- Bad templates are demoted
- Patterns of success are learned
- Mistakes are detected and corrected

---

## Core Architecture

```
Intent → Implementation → Validation → Learning
  ↓            ↓              ↓           ↓
Capture     Execute      Synthesize   Thompson
 goal      activity     validators   Sampling
                           ↓
                    Continuous
                    validation
                           ↓
                    Failure
                    detection
```

**Key Innovation**: Validators are **synthesized from intent** using LLM, not manually written. They capture **what should happen** (goals), not **how it happens** (implementation).

---

## Repository Structure

```
repos/
├── metabob-opencode/     # Activity execution engine
├── metabob-cli/          # Activity manager & MCP server
├── metabob-rpc-api/      # Backend API & Thompson Sampling
└── metabob-dashboard/    # Frontend visualization

docs/
├── ARCHITECTURE.md                           # Core architecture (START HERE)
├── INTENT_VALIDATION_IMPLEMENTATION_PLAN.txt # Implementation steps
└── ACTIVITY_SYSTEM_ISSUES_INDEX.md          # Complete documentation index
```

---

## Key Concepts

### Intent

Every activity has an **intent** - the "why":

```typescript
{
  goal: "Allow users to retrieve their profile",
  acceptanceCriteria: [
    "User can retrieve their own profile",
    "User cannot retrieve other users' profiles",
    "Returns 404 for non-existent users"
  ],
  constraints: ["Must use existing authentication"],
  assumptions: ["User is authenticated"]
}
```

### Validators

Validators are **objective test cases** synthesized from intent:

```typescript
{
  description: "User cannot retrieve other profiles",
  input: { userId: 456, requesterId: 123 },
  expectedOutput: { error: "Unauthorized" },
  expectedBehavior: "Rejects requests for other users' profiles"
}
```

These run **continuously** on every code change, detecting when intent is violated.

### Component Provenance

Every code component knows:
- Which activity created it
- What intent it serves
- What validators prove it works
- When it was last validated

### Failure Detection

When validators fail, the system:
1. Identifies which activity created the code
2. Marks that activity as failed (retroactively if needed)
3. Updates Thompson Sampling effectiveness scores
4. Learns to avoid similar patterns

---

## How It Works

### Activity Lifecycle

```
1. Activity starts with intent
   ↓
2. Code is created/modified
   ↓
3. Validators synthesized from intent (LLM)
   ↓
4. Validators run immediately
   ↓
5. Pass → Activity succeeds (for now)
   Fail → Activity marked as failed
```

### Continuous Validation

```
1. Code changes (git commit)
   ↓
2. Changed components detected
   ↓
3. Validators run against new code
   ↓
4. Pass → Status unchanged
   Fail → Original activity marked as failed
         Thompson Sampling updated
```

### Learning Loop

```
Activities execute → Validators run → Failures detected
                                          ↓
                              Thompson Sampling learns
                                          ↓
                              Future recommendations improve
```

---

## Current Status

**Phase 1** (In Progress): Intent capture + validator synthesis
- [ ] Add intent field to Activity data model
- [ ] Implement intent capture from templates
- [ ] Implement LLM-based validator synthesis
- [ ] Store validators with component provenance

**Phase 2** (Next): Continuous validation
- [ ] Validator execution engine
- [ ] Hook into Activity.complete()
- [ ] Hook into git commits
- [ ] Failure detection from validators

**Phase 3** (Future): Intent flow tracking
- [ ] Intent propagation tracking
- [ ] Corruption analysis
- [ ] Flow visualization
- [ ] Monitoring dashboard

---

## Key Metrics

- **Intent Capture Rate**: 100% (every activity has intent)
- **Validator Coverage**: 3-5 validators per component
- **Failure Detection Rate**: >90%
- **False Positive Rate**: <5%
- **Time to Detection**: <1 day (target: immediate on commit)
- **Thompson Sampling Accuracy**: +30% (target)

---

## Documentation

### Architecture & Design
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) - Core system architecture
- [`INTENT_VALIDATION_IMPLEMENTATION_PLAN.txt`](./INTENT_VALIDATION_IMPLEMENTATION_PLAN.txt) - Implementation details

### Implementation Guides
- [`ACTIVITY_SYSTEM_ISSUES_INDEX.md`](./ACTIVITY_SYSTEM_ISSUES_INDEX.md) - Complete documentation index
- Component-specific docs in each `repos/` subdirectory

### Historical Context
- [`PASSIVE_DETECTION_SUMMARY.md`](./PASSIVE_DETECTION_SUMMARY.md) - Earlier exploration of failure detection
- [`ACTIVITY_SYSTEM_RECTIFICATION_PLAN.md`](./ACTIVITY_SYSTEM_RECTIFICATION_PLAN.md) - Evolution of the design

---

## Development Setup

### Prerequisites
- Node.js 18+
- Python 3.10+
- Docker (for devbob containers)

### Quick Start

```bash
# Install dependencies
npm install
pip install -r requirements.txt

# Configure
cp .env.devbob.example .env.devbob
# Edit .env.devbob with your settings

# Run tests
npm test
pytest

# Start development
npm run dev
```

---

## Contributing

This system is **self-improving by design**. Contributions should:

1. **Preserve intent** - Changes must maintain or enhance intent tracking
2. **Add validation** - New features need synthesized validators
3. **Enable learning** - Changes should feed into Thompson Sampling
4. **Maintain traceability** - Keep intent flow visible

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for design principles.

---

## Why This Approach?

Traditional development:
- Write code
- Manually test
- Hope it works
- Fix bugs later

**This system**:
- Capture intent first
- Generate validators from intent
- Continuously validate
- Learn from outcomes
- Self-correct automatically

The system **learns what works** and **automatically improves**.

---

## Questions?

- **Architecture**: See [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- **Implementation**: See [`INTENT_VALIDATION_IMPLEMENTATION_PLAN.txt`](./INTENT_VALIDATION_IMPLEMENTATION_PLAN.txt)
- **Navigation**: See [`ACTIVITY_SYSTEM_ISSUES_INDEX.md`](./ACTIVITY_SYSTEM_ISSUES_INDEX.md)

---

**Note**: We're building this system **with itself** - using activities to improve the activity system. The architecture described here is not a "future plan" - it's what the system fundamentally is. We're implementing it incrementally because that's how systems grow.
