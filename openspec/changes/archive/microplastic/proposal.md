# microplastic: Composite Vessel Agent-IDE

## Executive Summary

**microplastic** is a terminal-based agent-IDE that gains capabilities through use. Unlike traditional IDEs that ship with fixed feature sets, microplastic starts minimal and evolves as it succeeds at tasks.

**Three Vessels, One Process:**
- `@metabob/minibob` - Execution engine: activities, improvisation, ribosome
- `@metabob/tui` - Narrative engine: presents work as story, not logs
- `@metabob/mcp` - Analysis resolver: CPG, embeddings, problem detection

**Key Insight:** The vessels share a single impulse state space. When minibob executes an activity that needs code analysis, mcp resolves the impulse. When the narrative needs to show progress, tui receives UI impulses. No orchestration layer - just impulses flowing between resolvers.

## Why This Matters

### Problem: Static Tool + Dynamic Work

Traditional IDEs and agents have the same capabilities on day 1 as day 1000. The user must configure, extend, and maintain them. The tool doesn't learn from its own successes.

### Solution: Gain-of-Function Architecture

microplastic records every execution. When improvisation succeeds, ribosome extracts a reusable template. Thompson Sampling ranks templates by historical success. The system literally gains new capabilities as it works.

### The Narrative Difference

Other terminal agents show logs: tool calls, tokens, costs. microplastic shows narrative: what the agent is thinking, what it's trying, whether it's confident or uncertain. The TUI is a storytelling engine, not a status display.

## What Changes

- **New repository**: `repos/microplastic/` - Bun + TypeScript terminal application
- **Vessel composition**: Three vessel providers in single process
- **Shared impulse space**: All vessels read/write same impulse store
- **TUI as vessel**: UI components are impulse types, resolved by renderer
- **Bootstrap templates**: Primordial templates that cannot be modified

## Capabilities

### New Capabilities

- `vessel-composition`: Multiple vessels in single process sharing impulse state
- `narrative-tui`: Terminal UI that presents execution as story, not logs
- `gain-of-function`: Capabilities emerge from successful executions via ribosome
- `bootstrap-templates`: Immutable primordial templates that define core behaviors
- `slash-commands`: Power user shortcuts for common operations

### Modified Capabilities

- `minibob-library`: Exposed as embeddable library, not just standalone server
- `mcp-analysis`: Analysis tools available as impulse resolvers
- `thompson-sampling`: Template selection integrated into goal processor

## Impact

**Code Changes:**
- New `repos/microplastic/` repository with ~3,000 LOC
- `repos/minibob/src/lib.ts` exposed for library embedding
- `repos/metabob-mcp/` modified to export resolver functions

**Dependencies:**
- Requires minibob as library dependency
- Requires metabob-mcp as library dependency
- Uses Ink for terminal rendering
- Uses Thompson Sampling from activity-api (HTTP)

**Not Changed:**
- metabob-activity-api (already provides Thompson Sampling)
- metabob-analysis-api (mcp uses this as backend)
- SurrealDB schema (uses existing tables)

## Success Criteria

1. **Works on first run** - Zero configuration, detects workspace, runs goals
2. **Gains capabilities** - After 10 successful executions, at least 3 new templates extracted
3. **Narrative is readable** - User understands what's happening without reading logs
4. **Power users have escape hatches** - Slash commands for direct control

## Aligned With

- `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` - Impulses as universal data
- `openspec/meta/ontology-foundation.md` - Three-state model (vessel/becoming/instance)
- `openspec/changes/metabob-mcp-vessel-spec/spec.md` - MCP as bridge vessel
