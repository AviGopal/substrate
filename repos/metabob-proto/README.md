# metabob-proto

Canonical data model definitions for the Metabob ecosystem using Protocol Buffers.

## Purpose

This repository serves as the **single source of truth** for all data models across:
- `metabob-rpc-api` (Python/Pydantic backend)
- `metabob-opencode` (TypeScript frontend)
- `metabob-cli` (Python MCP server)
- SurrealDB database schema

## Directory Structure

```
metabob-proto/
├── proto/                          # Protocol Buffer definitions
│   └── metabob/
│       ├── common/                 # Shared types
│       │   └── types.proto         # Genealogy, timestamps, enums
│       ├── activity/               # Activity system
│       │   ├── variant.proto       # ActivityVariant, TaskStep, PerformanceMetrics
│       │   └── execution.proto     # Activity, Selection, Conversion, Execution, Experiment
│       ├── learning/               # Learning/recommendation system
│       │   └── consumer.proto      # ConsumerProfile, ActivityImpression
│       ├── session/                # Session management
│       │   └── session.proto       # Session
│       ├── auth/                   # Authentication & organization
│       │   └── organization.proto  # Organization, User, ApiKey, Project, Subscription, AuditLog
│       └── metrics/                # Analytics & metrics
│           └── events.proto        # MetricEvent, DailyMetrics, SchemaVersion
├── activities/                     # Bootstrap activity templates
│   └── bootstrap/
│       ├── code-analysis.json
│       ├── bug-fix.json
│       ├── feature-impl.json
│       ├── refactor.json
│       ├── activity-create.json    # Meta-activity: create activities
│       ├── activity-debug.json     # Meta-activity: debug activities
│       └── activity-evolve.json    # Meta-activity: evolve activities
├── scripts/
│   ├── generate_surreal_schema.py  # Generate SurrealDB schema from proto
│   └── seed_activities.py          # DEPRECATED - use sql/seed-paradigm-templates.ts instead
└── gen/                            # Generated code (gitignored)
    ├── python/                     # Generated Python code
    └── typescript/                 # Generated TypeScript code
```

## Proto Annotations

Proto messages can include SurrealDB-specific annotations in comments:

```protobuf
// SurrealDB Table: activity_variants
// Indexes: variant_id (unique), activity_id, status
message ActivityVariant {
  // ... fields
}
```

## Schema Generation

Generate SurrealDB schema from proto definitions:

```bash
# Output to stdout
python scripts/generate_surreal_schema.py

# Write to file
python scripts/generate_surreal_schema.py --output schema/schema.surql

# Apply directly to database
python scripts/generate_surreal_schema.py --apply \
  --surreal-url http://localhost:8000 \
  --namespace metabob \
  --database devbob
```

## Code Generation

### Python (Pydantic models)

```bash
# Using betterproto for idiomatic Python
pip install betterproto[compiler]
protoc -I=proto --python_betterproto_out=gen/python proto/metabob/**/*.proto
```

### TypeScript

```bash
# Using ts-proto
npm install ts-proto
protoc -I=proto --plugin=protoc-gen-ts_proto=./node_modules/.bin/protoc-gen-ts_proto \
  --ts_proto_out=gen/typescript proto/metabob/**/*.proto
```

## Database Tables

### Paradigm Core Tables (as of 2026-04)

The system now uses **4 core tables** implementing the impulse/activity/vessel paradigm:

| Table | Description |
|-------|-------------|
| `impulse` | All data with pointer + shape + metadata (lazy-loaded) |
| `activity` | All state transitions (templates, tools, compositions) |
| `execution` | All execution traces linking input impulses to output impulses |
| `vessel` | Execution environments with resolver capabilities |

See `repos/deployment/PARADIGM_TABLES.md` for complete reference.

### Authentication & Organization
| Table | Proto Message | Description |
|-------|--------------|-------------|
| `organizations` | `Organization` | Multi-tenant organizations |
| `users` | `User` | Organization members |
| `api_keys` | `ApiKey` | Authentication credentials (deprecated - now in vessel) |
| `projects` | `Project` | Code projects |
| `subscriptions` | `Subscription` | Billing subscriptions |
| `audit_logs` | `AuditLog` | Security audit trail |

### Supporting Tables
| Table | Description |
|-------|-------------|
| `activity_composition_graph` | Parent-child activity relationships |
| `impulse_relevance_metrics` | Learning: impulse usage scores |
| `tool_usage` | Learning: tool execution patterns |
| `execution_sequences` | Learning: activity execution order |

## Key Concepts

### Genealogy Tracking

All mutable entities use content-addressable hashing for lineage:

```protobuf
message Genealogy {
  string content_hash = 1;           // SHA-256 of content
  optional string parent_hash = 2;   // Parent's hash
  repeated string lineage = 3;       // Ancestor chain
  EvolutionType evolution_type = 4;  // root/derived/merged/refined/split
  string evolution_note = 5;         // Human description
}
```

### Evolution Types

- **root**: Original/seed entity (bootstrap)
- **derived**: Single-parent evolution
- **merged**: Combined from multiple parents
- **refined**: Same structure, improved content
- **split**: Focused extraction from parent

### Entity Status

Standard lifecycle for database entities:

- **draft**: Work in progress
- **testing**: Active A/B testing
- **active**: Production ready
- **deprecated**: Phased out

## Bootstrap Activities

The `activities/bootstrap/` directory contains seed activities for:

1. **Core Development**
   - `code-analysis.json` - Analyze codebase structure
   - `bug-fix.json` - Systematic bug fixing
   - `feature-impl.json` - Feature implementation
   - `refactor.json` - Code refactoring

2. **Meta-Activities** (self-improvement)
   - `activity-create.json` - Create new activities
   - `activity-debug.json` - Debug failing activities
   - `activity-evolve.json` - Evolve/improve activities

## Integration

### metabob-rpc-api

The backend uses proto definitions via:
1. Generated Pydantic models in `server/models/proto_*.py`
2. Proto-generated schema applied to SurrealDB

### metabob-cli

The MCP server uses proto definitions via:
1. Shared activity variant models
2. Common types for genealogy tracking

### Database Initialization

The `scripts/init-db.py` script in the main devbob repo:
1. Generates schema from proto definitions
2. Seeds bootstrap activities
3. Runs on container startup via `db-init` service

## Development

### Adding a New Model

1. Create/update `.proto` file in `proto/metabob/`
2. Add SurrealDB annotations if it needs a table
3. Run schema generator to verify
4. Update downstream services to use new types

### Modifying Existing Models

1. Update `.proto` definition
2. Regenerate code for all consumers
3. Run database migration if schema changed
4. Test across all services

## License

Proprietary - Metabob Project
