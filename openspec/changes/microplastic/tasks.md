# microplastic Task List

## Overview

This task list is organized into 12 phases, each ending in a testable state. Phases can be worked on by different agents in parallel where dependencies allow.

**Estimated Total LOC:** ~3,500 new lines
**Estimated Duration:** 6-8 weeks

---

## Phase 1: Project Scaffold

**Goal:** Create the basic project structure with build tooling.

**Testable State:** `bun run build` succeeds, `bun run test` runs (empty suite).

### Tasks

- [ ] 1.1 Create `repos/microplastic/` directory structure
  - `src/` - source code
  - `templates/` - bootstrap templates
  - `tests/` - test files
  - `.microplastic/` - runtime data (gitignored)

- [ ] 1.2 Initialize `package.json` with dependencies
  - `@metabob/minibob` (workspace dependency)
  - `ink` (React for terminal)
  - `zod` (validation)
  - `sade` (CLI parsing)
  - `bun-types` (dev dependency)

- [ ] 1.3 Create `tsconfig.json` with strict settings
  - Path aliases: `@/` for `src/`
  - Target: ESNext
  - Module: ESNext
  - Strict: true

- [ ] 1.4 Create `bunfig.toml` for Bun configuration

- [ ] 1.5 Create entry point `src/index.ts` with CLI skeleton
  - Parse `microplastic [goal]` or `microplastic` (interactive)
  - Handle `--version`, `--help` flags

- [ ] 1.6 Create `README.md` with usage instructions

- [ ] 1.7 Add to root workspace `package.json`

**Exit Criteria:**
```bash
cd repos/microplastic
bun install
bun run build  # No errors
bun run test   # 0 tests, 0 failures
bun run src/index.ts --version  # Prints version
```

---

## Phase 2: Vessel Core

**Goal:** Implement VesselProvider interface and ImpulseStore.

**Testable State:** Can create vessels, register resolvers, resolve impulses.

### Tasks

- [ ] 2.1 Create `src/vessel/interface.ts` - VesselProvider interface
  - All methods from vessel-interface.md spec

- [ ] 2.2 Create `src/vessel/context.ts` - VesselContext type
  - ImpulseStore reference
  - Config
  - Event emitter
  - Logger

- [ ] 2.3 Create `src/impulse/store.ts` - ImpulseStore implementation
  - Create, get, update, delete impulses
  - Resolver registration
  - Resolver routing by pointer type

- [ ] 2.4 Create `src/impulse/types.ts` - Import types from minibob
  - Re-export Impulse, ImpulsePointer, etc.

- [ ] 2.5 Create `src/vessel/minibob.ts` - MiniBobVessel adapter
  - Wraps @metabob/minibob as VesselProvider
  - Implements canResolve for file, memo
  - Implements resolve for local pointers

- [ ] 2.6 Create `src/vessel/registry.ts` - VesselRegistry
  - Register vessels
  - Initialize in order
  - Shutdown in reverse order

- [ ] 2.7 Create tests for vessel system
  - `tests/vessel/store.test.ts`
  - `tests/vessel/registry.test.ts`

**Exit Criteria:**
```bash
bun test tests/vessel/
# All tests pass
# Can create impulse, resolve via registered vessel
```

---

## Phase 3: TUI Narrative

**Goal:** Implement the narrative TUI using Ink.

**Testable State:** Can render goal submission and thinking state.

### Tasks

- [ ] 3.1 Create `src/tui/vessel.ts` - TUIVessel implementation
  - Implements VesselProvider
  - Resolves ui_component, narrative pointer types

- [ ] 3.2 Create `src/tui/components/App.tsx` - Root component
  - Layout container
  - Keyboard handling

- [ ] 3.3 Create `src/tui/components/GoalInput.tsx` - Input field
  - Text input with history
  - Submit on Enter

- [ ] 3.4 Create `src/tui/components/Narrative.tsx` - Narrative display
  - Thinking state
  - Action state
  - Progress bar

- [ ] 3.5 Create `src/tui/components/StatusBar.tsx` - Bottom status
  - Duration
  - Cost
  - Task progress

- [ ] 3.6 Create `src/tui/state.ts` - TUI state management
  - Current goal
  - Current state (thinking, executing, complete)
  - Progress

- [ ] 3.7 Create `src/tui/renderer.ts` - NarrativeRenderer
  - Subscribe to impulse events
  - Update TUI state

- [ ] 3.8 Create tests for TUI
  - `tests/tui/narrative.test.ts` (snapshot tests)

**Exit Criteria:**
```bash
bun run src/index.ts
# Shows welcome message
# Can type goal and see "Thinking..."
```

---

## Phase 4: Thompson Selection

**Goal:** Integrate Thompson Sampling for template selection.

**Testable State:** Goals route to best-matching template or improvisation.

### Tasks

- [ ] 4.1 Create `src/selection/client.ts` - Activity API client
  - GET /v2/activities/recommend
  - Handle offline gracefully

- [ ] 4.2 Create `src/selection/thompson.ts` - Local Thompson state
  - Store alpha/beta per template
  - Sample from Beta distribution
  - Update on outcome

- [ ] 4.3 Create `src/selection/selector.ts` - TemplateSelector
  - Query backend for recommendations
  - Fall back to local state if offline
  - Return ranked templates

- [ ] 4.4 Integrate with goal processor
  - After goal enrichment, call selector
  - Pass selection to executor

- [ ] 4.5 Create `src/selection/offline.ts` - Offline mode
  - Cache templates locally
  - Use local Thompson state

- [ ] 4.6 Create tests for selection
  - `tests/selection/thompson.test.ts`
  - `tests/selection/selector.test.ts`

**Exit Criteria:**
```bash
bun test tests/selection/
# Thompson sampling selects templates correctly
# Offline mode works
```

---

## Phase 5: Ribosome Integration

**Goal:** Extract templates from successful improvisations.

**Testable State:** Successful improvisation creates new template.

### Tasks

- [ ] 5.1 Create `src/ribosome/extractor.ts` - TraceExtractor
  - Analyze execution trace
  - Identify variable points
  - Generate task definitions

- [ ] 5.2 Create `src/ribosome/template-generator.ts` - Generate templates
  - Create valid ActivityTemplate from trace
  - Include metadata tracking

- [ ] 5.3 Create `src/ribosome/cache.ts` - TemplateCache
  - Store extracted templates locally
  - Track execution statistics

- [ ] 5.4 Create `src/ribosome/promotion.ts` - PromotionManager
  - Check promotion criteria
  - Register to backend when threshold met

- [ ] 5.5 Integrate with goal processor
  - After successful improvisation, extract
  - Cache extracted template
  - Update TUI with "New Capability" message

- [ ] 5.6 Create tests for ribosome
  - `tests/ribosome/extractor.test.ts`
  - `tests/ribosome/generator.test.ts`

**Exit Criteria:**
```bash
# Run improvisation goal
bun run src/index.ts "Implement a new feature"
# On success, verify template created in .microplastic/templates/
```

---

## Phase 6: Failure Recovery

**Goal:** Handle failures gracefully with variant creation.

**Testable State:** Failed execution offers recovery options.

### Tasks

- [ ] 6.1 Create `src/failure/analyzer.ts` - FailureAnalyzer
  - Analyze execution trace for failure point
  - Identify root cause
  - Suggest fixes

- [ ] 6.2 Create `src/failure/recovery.ts` - RecoveryManager
  - Present options to user
  - Handle retry/variant/investigate/abandon

- [ ] 6.3 Create `src/failure/variant.ts` - VariantCreator
  - Create variant template from failure
  - Track lineage

- [ ] 6.4 Create `src/tui/components/RecoveryOptions.tsx`
  - Display recovery options
  - Handle selection

- [ ] 6.5 Integrate with goal processor
  - On failure, invoke FailureAnalyzer
  - Present recovery options via TUI

- [ ] 6.6 Create tests for failure handling
  - `tests/failure/analyzer.test.ts`
  - `tests/failure/recovery.test.ts`

**Exit Criteria:**
```bash
# Run goal that will fail validation
# Verify recovery options appear
# Select "Create variant" and verify variant template created
```

---

## Phase 7: Analysis Vessel

**Goal:** Integrate metabob-mcp as analysis resolver.

**Testable State:** CPG queries resolve via MCP vessel.

### Tasks

- [ ] 7.1 Create `src/vessel/mcp.ts` - MCPVessel implementation
  - Implements VesselProvider
  - Resolves cpg_query, embedding_search pointer types

- [ ] 7.2 Create `src/analysis/cpg.ts` - CPG client
  - Query metabob-mcp for graph data
  - Cache results

- [ ] 7.3 Create `src/analysis/embeddings.ts` - Embedding client
  - Semantic search via MCP

- [ ] 7.4 Create `src/impulse/types-mcp.ts` - MCP pointer types
  - cpg_query pointer
  - embedding_search pointer

- [ ] 7.5 Integrate MCP vessel into registry
  - Initialize after MiniBob
  - Register resolvers

- [ ] 7.6 Update workspace detection to use analysis
  - Use CPG for framework detection
  - Use embeddings for similar code search

- [ ] 7.7 Create tests for MCP integration
  - `tests/vessel/mcp.test.ts`
  - `tests/analysis/cpg.test.ts`

**Exit Criteria:**
```bash
bun test tests/vessel/mcp.test.ts
# CPG queries resolve correctly
# Workspace detection uses analysis
```

---

## Phase 8: Bootstrap Templates

**Goal:** Implement the bootstrap template hierarchy.

**Testable State:** All Level 0-4 templates load and are usable.

### Tasks

- [ ] 8.1 Create `templates/level-0/create-activity-template.json`
  - Primordial template, immutable

- [ ] 8.2 Create `templates/level-0/execute-goal.json`
  - Primordial template, immutable

- [ ] 8.3 Create `templates/level-0/validate-template.json`
  - Primordial template, immutable

- [ ] 8.4 Create `templates/level-1/extract-from-trace.json`
  - Meta template (ribosome)

- [ ] 8.5 Create `templates/level-1/create-variant.json`
  - Meta template

- [ ] 8.6 Create `templates/level-2/` spec generation templates
  - generate-implementation-spec.json
  - generate-test-spec.json

- [ ] 8.7 Create `templates/level-3/` core development templates
  - implement-feature.json
  - fix-bug.json
  - refactor-code.json
  - add-tests.json

- [ ] 8.8 Create `templates/level-4/` TUI choreography templates
  - update-narrative.json
  - request-clarification.json

- [ ] 8.9 Create `src/templates/loader.ts` - TemplateLoader
  - Load templates by level
  - Enforce immutability for Level 0

- [ ] 8.10 Create tests for template loading
  - `tests/templates/loader.test.ts`
  - `tests/templates/validation.test.ts`

**Exit Criteria:**
```bash
bun test tests/templates/
# All templates valid
# Level 0 templates cannot be overridden
```

---

## Phase 9: System Prompts

**Goal:** Create system prompts for LLM interactions.

**Testable State:** LLM interactions use consistent, effective prompts.

### Tasks

- [ ] 9.1 Create `src/prompts/goal-enrichment.ts`
  - System prompt for understanding goals

- [ ] 9.2 Create `src/prompts/task-execution.ts`
  - System prompt for executing tasks

- [ ] 9.3 Create `src/prompts/improvisation.ts`
  - System prompt for exploration mode

- [ ] 9.4 Create `src/prompts/verification.ts`
  - System prompt for goal verification

- [ ] 9.5 Create `src/prompts/narrative.ts`
  - System prompt for narrative generation

- [ ] 9.6 Create `src/prompts/index.ts` - Prompt registry
  - Export all prompts
  - Handle variable substitution

- [ ] 9.7 Create tests for prompts
  - `tests/prompts/enrichment.test.ts`
  - Verify variable substitution

**Exit Criteria:**
```bash
bun test tests/prompts/
# All prompts render correctly
# No undefined variable references
```

---

## Phase 10: Power User Features

**Goal:** Implement slash commands and keyboard shortcuts.

**Testable State:** All slash commands work.

### Tasks

- [ ] 10.1 Create `src/commands/parser.ts` - Command parser
  - Parse `/command arg1 arg2`
  - Handle unknown commands

- [ ] 10.2 Create `src/commands/help.ts` - /help command

- [ ] 10.3 Create `src/commands/templates.ts` - /templates command
  - List templates by level
  - Show success rates

- [ ] 10.4 Create `src/commands/history.ts` - /history command
  - Show recent executions
  - Totals

- [ ] 10.5 Create `src/commands/debug.ts` - /debug command
  - Toggle verbose mode

- [ ] 10.6 Create `src/commands/abort.ts` - /abort command
  - Stop current execution

- [ ] 10.7 Create `src/commands/config.ts` - /config command
  - Show/edit configuration

- [ ] 10.8 Create `src/tui/keyboard.ts` - Keyboard handler
  - Ctrl+C abort
  - Arrow keys history
  - Tab completion

- [ ] 10.9 Create tests for commands
  - `tests/commands/parser.test.ts`
  - `tests/commands/templates.test.ts`

**Exit Criteria:**
```bash
# In microplastic
/help      # Shows all commands
/templates # Lists templates
/history   # Shows history
```

---

## Phase 11: Boredom Mode

**Goal:** Implement autonomous self-improvement when idle.

**Testable State:** System improves itself when idle.

### Tasks

- [ ] 11.1 Create `src/boredom/detector.ts` - IdleDetector
  - Detect 5+ minutes without user input

- [ ] 11.2 Create `src/boredom/goals.ts` - BoredomGoals
  - Analyze own templates for improvement
  - Identify low-success templates
  - Find patterns that could become templates

- [ ] 11.3 Create `src/boredom/executor.ts` - BoredomExecutor
  - Execute self-improvement goals
  - Low priority (yield to user)

- [ ] 11.4 Create `src/tui/components/BoredomIndicator.tsx`
  - Show when boredom mode active
  - What it's working on

- [ ] 11.5 Create `src/boredom/circuit-breaker.ts` - SafetyBreaker
  - Stop if success rate drops
  - Notify user

- [ ] 11.6 Create tests for boredom mode
  - `tests/boredom/detector.test.ts`
  - `tests/boredom/goals.test.ts`

**Exit Criteria:**
```bash
# Leave microplastic idle for 5 minutes
# Verify boredom mode activates
# Verify circuit breaker works
```

---

## Phase 12: Production Hardening

**Goal:** Prepare for production use.

**Testable State:** Robust, documented, deployable.

### Tasks

- [ ] 12.1 Create error boundaries for TUI
  - Catch rendering errors
  - Show fallback UI

- [ ] 12.2 Add logging infrastructure
  - Log levels
  - File output
  - Structured logs

- [ ] 12.3 Add metrics collection
  - Execution counts
  - Success rates
  - Costs

- [ ] 12.4 Create `src/config/schema.ts` - Configuration schema
  - Environment variables
  - Config file

- [ ] 12.5 Add rate limiting
  - Prevent runaway LLM calls
  - Per-hour cost limits

- [ ] 12.6 Create installation script
  - Download binary
  - Add to PATH

- [ ] 12.7 Write user documentation
  - Getting started
  - Command reference
  - Troubleshooting

- [ ] 12.8 Create GitHub release workflow
  - Build binaries for Linux/Mac/Windows
  - Publish to releases

- [ ] 12.9 Final integration testing
  - End-to-end scenarios
  - Performance testing
  - Memory leak check

- [ ] 12.10 Create CHANGELOG.md

**Exit Criteria:**
```bash
# Full integration test passes
# Documentation complete
# Release workflow creates artifacts
```

---

## Dependency Graph

```
Phase 1 (Scaffold)
    │
    ▼
Phase 2 (Vessel Core) ────────────────┐
    │                                  │
    ▼                                  ▼
Phase 3 (TUI)              Phase 7 (Analysis)
    │                                  │
    └─────────┬────────────────────────┘
              │
              ▼
       Phase 4 (Thompson)
              │
              ▼
       Phase 5 (Ribosome)
              │
              ▼
       Phase 6 (Failure)
              │
              ▼
       Phase 8 (Templates)
              │
              ├──────────────────────┐
              │                      │
              ▼                      ▼
       Phase 9 (Prompts)    Phase 10 (Commands)
              │                      │
              └──────────┬───────────┘
                         │
                         ▼
               Phase 11 (Boredom)
                         │
                         ▼
               Phase 12 (Production)
```

**Parallel Work Opportunities:**
- Phase 3 (TUI) and Phase 7 (Analysis) can be done in parallel after Phase 2
- Phase 9 (Prompts) and Phase 10 (Commands) can be done in parallel after Phase 8

---

## Success Criteria

| Phase | Metric |
|-------|--------|
| 1 | Project builds and runs |
| 2 | Impulse resolution works |
| 3 | TUI renders goal input |
| 4 | Templates selected via Thompson |
| 5 | Templates extracted from traces |
| 6 | Failures offer recovery |
| 7 | CPG queries resolve |
| 8 | Bootstrap templates load |
| 9 | LLM prompts effective |
| 10 | Slash commands work |
| 11 | Boredom mode activates |
| 12 | Ready for production |
