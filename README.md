# Metabob DevBob - Self-Improving Development System

**An autonomous AI development system built on the impulse-activity foundation with Thompson Sampling for continuous learning.**

## Overview

Metabob DevBob is an experimental development environment that demonstrates:

- **Impulse-Activity Architecture** - Universal data (impulses) processed through constrained state transitions (activities)
- **Learning Loop** - Thompson Sampling for activity selection with Bayesian relevance scoring
- **Vessel Pattern** - Execution environments that bundle activities + resolvers + lifecycle hooks
- **Ribosome Extraction** - Successful executions automatically become reusable templates

## Architecture Foundation

> **Canonical Reference**: [`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`](docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md)

### Core Concepts

**Impulses** - Data in any form (text, structured data, signals, commands) with metadata for reasoning:
```typescript
{
  id: "error-log",
  pointer: { type: "file", path: "error.log" },
  shape: { domain: "debugging", intent: "analyze" },
  budget: 2000  // Token budget
}
```

**Activities** - Constrained state transitions linking input impulses to output impulses:
```typescript
{
  id: "fix-bug",
  tasks: [
    { id: "analyze", inputImpulses: ["error-log"], outputImpulses: ["diagnosis"] },
    { id: "fix", inputImpulses: ["diagnosis"], outputImpulses: ["patch"] }
  ]
}
```

**Vessels** - Bundles of activities + resolvers that provide capabilities where data lives:
- MiniBob: Autonomous development vessel
- Microplastic: TUI vessel for guided development
- Analysis API: Code analysis vessel

## Key Components

### 1. MiniBob (`repos/minibob`)
Lightweight autonomous vessel (~3,000 LOC TypeScript/Bun):
- Execute activities with LLM + tools
- Capture execution traces with state snapshots
- Resolve LOCAL impulse types (memo, file)
- Delegate to backend for other impulse types

### 2. metabob-activity-api (`repos/metabob-activity-api`)
TypeScript/Bun/Hono backend:
- Store execution traces persistently
- Thompson Sampling for template selection
- Pattern recognition and learning
- Impulse relevance tracking
- Tag-based filtering and recommendation

### 3. Activity Dashboard (`repos/activity-dashboard`)
React 19/Bun real-time observability:
- Template performance metrics
- Live execution monitoring
- Learning loop visualization

### 4. Helm Deployment (`helm/`)
Kubernetes orchestration:
- SurrealDB 3.x (persistent storage)
- Redis/Valkey (live selection cache)
- Istio (service mesh)

## Learning Loop

The system learns through execution:

1. **Recommend** - Thompson Sampling selects activity variant
2. **Execute** - Activity runs, producing execution trace
3. **Record** - Trace stored with success/failure, cost, duration
4. **Learn** - Alpha/beta parameters updated for future selection
5. **Extract** - Successful patterns become new templates (Ribosome)

### Tag-Based Filtering

Activities use hierarchical tags for efficient discovery:
```
feature.auth.jwt
feature.api.rest
bugfix.validation.input
```

Tag prefixes enable broad queries: `feature.*` matches all feature activities.

## Quick Start

### Prerequisites
1. Kubernetes cluster with Istio
2. Docker Desktop or minikube
3. Helm 3.x, kubectl

### Deploy

```bash
cd helm
helmfile -f activity-system-minimal.yaml.gotmpl sync
```

### Verify

```bash
kubectl get pods -n activity-system
curl http://api.minibob.local/health
```

## Project Structure

```
.
├── docs/
│   └── architecture/          # Architecture documentation
│       └── IMPULSE_ACTIVITY_FOUNDATION.md  # Canonical reference
├── helm/
│   ├── charts/                # Helm charts for each component
│   └── activity-system-minimal.yaml.gotmpl  # Main deployment
├── repos/
│   ├── minibob/               # Autonomous development vessel
│   ├── metabob-activity-api/  # Learning backend
│   ├── activity-dashboard/    # Observability UI
│   └── microplastic/          # TUI vessel
├── openspec/
│   └── changes/               # OpenSpec change proposals
├── CLAUDE.md                  # Claude Code instructions
└── README.md                  # This file
```

## Documentation

### Architecture
- [`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`](docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md) - Canonical system definition
- `COMPOSITION_AND_CONTROL_FLOW.md` - Activity composition patterns
- `ACTIVITY_BASED_IMPROVISATION.md` - VM-as-executor philosophy
- `DEPLOYMENT_GUIDE.md` - Kubernetes deployment procedures

### Multi-Tenant & RBAC
- `docs/MULTI_TENANT_ARCHITECTURE.md` - Tenancy model
- `docs/RBAC_GUIDE.md` - PERMISSIONS patterns
- `docs/AUTH_JWT_CLAIMS.md` - JWT token structure

## Key Design Principles

1. **Impulses Are Universal Data** - Everything is an impulse with metadata
2. **Activities Constrain Search** - Without activities, infinite options; with activities, ranked finite options
3. **Resolvers Live Where Data Lives** - Don't centralize resolution
4. **Metadata First, Content Later** - Reasoners see metadata; resolvers load content
5. **Record Everything** - Every execution is traced for learning
6. **Learn From Traces** - Thompson Sampling, relevance scores, ribosome extraction
7. **Reserve Improvisation** - When nothing matches, try something new but record it
8. **LLMs Are Tools, Not Controllers** - Use LLMs for reasoning; deterministic resolvers for everything else

## Status

- Learning loop: Operational with Thompson Sampling
- Tag filtering: M4-M5 complete (tag-based recommendations)
- MiniBob: Instance authentication with org_id tracking
- Dashboard: Convergence overview with explainability

## License

[License information]

## Contributing

[Contribution guidelines]
