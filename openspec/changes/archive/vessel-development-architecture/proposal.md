# Vessel Development Architecture

## Problem Statement

MiniBob is a vessel that develops vessels. When MiniBob operates in a development context (able to modify vessel code and activities), it needs:

1. **Local template caching** for rapid iteration before backend promotion
2. **Hook-driven promotion** that automatically registers successful templates
3. **Vessel definition structure** to declare development capabilities
4. **Both code AND activity modification** since either could be wrong

Currently:
- Templates go directly to backend (no local iteration)
- No distinction between production and development contexts
- Hooks exist but don't handle promotion flows
- No vessel-scoped template cache

## Solution Overview

### Core Insight

Vessels can register lifecycle hooks. The minibob vessel providing activity modification / vessel development activities registers hooks that:
- On successful activity execution → automatically register template to backend
- Local cache exists only for iteration during development
- Success = registered (no manual promotion step)

### Architecture

```
Development Context                     Production Context
───────────────────                     ──────────────────
.minibob/vessels/<vessel>/templates/    Backend (SurrealDB)
        ↑                                      ↑
   iterate locally                    hook registers on success
        │                                      │
        └── activity executes ─────────────────┘
```

### Key Components

| Component | Purpose | Location |
|-----------|---------|----------|
| Template Cache | Local iteration storage | `.minibob/vessels/*/templates/` |
| Vessel Definition | Declare development mode | `.minibob/vessels/*/vessel.json` |
| Promotion Hooks | Auto-register on success | `lifecycle-hooks.ts` |
| Template Validator | Pre-registration checks | New module |

## Interface Boundaries

### 1. MiniBob ↔ Local Filesystem

```
.minibob/
└── vessels/
    └── <vessel-id>/
        ├── vessel.json           # Vessel definition
        ├── templates/            # Local template cache
        │   ├── <template-id>.json
        │   └── _meta/            # Cache metadata
        ├── traces/               # Execution traces (before upload)
        └── state/                # Session state
```

**Write Permissions:**
| Component | Can Write | Validation |
|-----------|-----------|------------|
| Activity Executor | Templates, Traces | After successful execution |
| Lifecycle Hooks | Templates (via promotion) | Success threshold met |
| Template Validator | Metadata only | Schema validation |

### 2. MiniBob ↔ Activity Backend (MCP)

| Endpoint | Purpose | When Called |
|----------|---------|-------------|
| `POST /v2/activities/templates` | Register template | Hook-driven on success |
| `GET /v2/activities/templates/:id` | Fetch template | Cache miss |
| `POST /v2/activities/execution-traces` | Store trace | After execution |
| `POST /v2/activities/recommend` | Thompson Sampling | Goal processing |

### 3. Lifecycle Hooks ↔ Template Registration

```
Post-Execution Success Hook:
├─ Check: Is this a development vessel?
├─ Check: Does template meet promotion threshold?
├─ Validate: Template structure and dependencies
├─ Register: POST /v2/activities/templates
└─ Update: Local cache metadata (registered: true)
```

## Data Flow

### Template Creation Flow (Development Mode)

```
1. EXECUTION
   Activity executes in development vessel
   ↓
2. TRACE CAPTURE
   ExecutionTrace captured with full state
   ↓
3. LOCAL CACHE (if new template)
   Store in .minibob/vessels/<id>/templates/
   Mark as unregistered
   ↓
4. SUCCESS CHECK
   Post-execution hook evaluates:
   - Success rate >= threshold (default 80%)
   - Minimum executions reached (default 3)
   ↓
5. PROMOTION (automatic via hook)
   If threshold met:
   - Validate template structure
   - POST to backend
   - Update cache metadata
```

### Template Loading Flow

```
loadTemplate(templateId, vesselId):
  1. Check local cache: .minibob/vessels/<id>/templates/
  2. If cache hit AND fresh: return cached
  3. If cache miss: fetch from backend via MCP
  4. Cache fetched template locally
  5. Return template
```

## Common Patterns (Colocation Targets)

### Pattern 1: Template Lifecycle
All template state transitions should be colocated:
- `template-cache.ts`: load, save, invalidate
- `template-validator.ts`: validate structure, dependencies, variables
- `template-promoter.ts`: threshold check, backend registration

### Pattern 2: Vessel Identity
All vessel state management should be colocated:
- `vessel-definition.ts`: load, save, update vessel.json
- `vessel-registry.ts`: already exists, extend for development mode
- `vessel-state.ts`: session state, execution history

### Pattern 3: Hook Registration
All promotion-related hooks should be colocated:
- `promotion-hooks.ts`: onSuccess → register, onThreshold → promote
- Separate from general lifecycle-hooks.ts for clarity

### Pattern 4: Development Mode Detection
Single source of truth for "is this a development context":
- Check for `.minibob/vessels/` directory
- Check vessel.json `development.enabled: true`
- Propagate to executor, hooks, cache

## Existing Components Analysis

### Works Well (No Changes Needed)
- **Template Execution** (`activity.ts`): Full executor with state capture
- **Trace Capture**: Complete ExecutionTrace with state transitions
- **MCP Integration** (`mcp.ts`): All backend endpoints implemented
- **Vessel Registry** (`vessel-registry.ts`): Local registration working
- **Thompson Sampling**: Backend implementation complete

### Needs Implementation
| Component | Complexity | Priority |
|-----------|------------|----------|
| Template Cache System | Medium | HIGH |
| Vessel Definition Loader | Low | HIGH |
| Promotion Hooks | Low | HIGH |
| Template Validator | Medium | MEDIUM |

### Needs Modification
| Component | Change | Priority |
|-----------|--------|----------|
| `activity.ts` loadTemplate | Add cache-first strategy | MEDIUM |
| `lifecycle-hooks.ts` | Add promotion hook types | MEDIUM |
| `vessel-registry.ts` | Add execution tracking for promotion | MEDIUM |

## Database Schema Impact

### Existing Tables (No Changes)
- `activity_registry`: Already has all needed fields
- `activity_execution_traces`: Already captures full traces
- `variant_performance_metrics`: Thompson Sampling params exist

### New Fields Needed
None - existing schema supports this architecture. The `genealogy` field on `activity_registry` already tracks:
- `extracted_from`: Source execution ID
- `variant_of`: Parent template ID
- `generatedFrom`: "execution" | "manual"

## Success Criteria

1. **Local iteration works**: Can modify template, re-execute, without backend calls
2. **Auto-promotion works**: Successful templates automatically register
3. **Threshold enforcement**: Only templates meeting success rate get promoted
4. **Development detection**: System knows when it's in development context
5. **MiniBob self-development**: Can use minibob to implement these features

## Non-Goals

- Complex versioning (variants handle this)
- Manual promotion workflow (hooks automate it)
- Offline-first architecture (cache is for iteration, not resilience)
- Template deletion from backend (immutable, variants replace)
