## Why

The system's governance model relies on multi-scale observation — each layer detects patterns in the layer below over progressively longer timescales and adjusts conditions accordingly. Currently, the architecture documents describe this conceptually but the implementation only records execution outcomes at a single scale (activity success/failure via Thompson Sampling). There is no infrastructure for cross-timescale pattern detection, no convergence-based verification of execution claims, no template pruning or score decay to maintain information integrity, and no circuit breaker for autonomous activity. The existing documentation also does not capture the philosophical framework that emerged through design exploration — the observation hierarchy model, alignment as layer coherence, the convince governance model, and the relationship between impulses and inter-layer signaling. Without both the conceptual documentation and the observation infrastructure, higher-order layers cannot emerge from data accumulation, and the system cannot self-govern beyond single-execution Thompson Sampling.

## What Changes

- **Architecture documentation**: Create/update docs to capture the observation hierarchy model (layers 0-5+), the convince/coerce/kill governance framework applied to activities, alignment as layer coherence (not principal-agent control), impulses as inter-layer signaling mechanism, and the Eigen error-catastrophe threshold as a design constraint for template mutation rate
- **Multi-scale trace recording**: Extend execution traces to record data at multiple observation timescales — tool call patterns (ms), task sequence patterns (s), activity outcome patterns (min), composition patterns (hours), system health aggregates (days)
- **Convergence-based execution verification**: Implement redundant parallel execution via Thompson Sampling exploration — sample multiple activity variants for the same goal, compare state transitions across executions, detect structural inconsistencies (inspired by Nano's block-lattice conflict detection via impulse pointer chains)
- **Eigen threshold enforcement**: Add template pruning (remove templates below Thompson score threshold after N executions), score decay (time-windowed scoring so historically successful templates can be demoted when conditions change), and generation depth tracking (how many ribosome extractions deep is a template)
- **Circuit breaker**: Add system-level pause mechanism for autonomous boredom activity — apoptosis for the self-modification loop when observation layers detect anomalous system state
- **Fix Thompson Sampling**: Replace `alpha/(alpha+beta)` expected value with actual Beta distribution sampling to restore exploration-exploitation balance
- **Peer comparison infrastructure**: Enable anomaly detection by comparing resolver/activity behavior metrics against peers handling the same pointer types or goal categories

## Capabilities

### New Capabilities
- `multi-scale-observation`: Infrastructure for recording and querying execution data across multiple timescales — tool call patterns, task sequences, activity outcomes, composition chains, system health aggregates
- `convergence-verification`: Redundant parallel execution with structural comparison of state transitions across independent executions, using impulse pointer chains for conflict detection
- `template-lifecycle`: Template pruning below Thompson score thresholds, time-windowed score decay, generation depth tracking, and population caps to maintain information integrity (Eigen threshold)
- `circuit-breaker`: System-level pause mechanism for autonomous activity with anomaly-triggered activation and manual override
- `peer-comparison`: Cross-resolver and cross-activity anomaly detection based on behavioral metrics relative to peers

### Modified Capabilities

## Impact

- **repos/minibob**: `src/activity.ts` (multi-scale trace recording, parallel execution), `src/tools.ts` (Thompson Sampling fix), `src/boredom.ts` (circuit breaker), `src/goal-processor.ts` (convergence verification), `src/impulse.ts` (pointer chain tracking for structural conflict detection)
- **repos/metabob-activity-api**: New aggregation endpoints for multi-timescale metrics, template lifecycle endpoints (prune, decay), peer comparison queries, circuit breaker state management
- **docs/architecture/**: New and updated documentation files capturing the observation hierarchy, governance model, and design constraints
- **CLAUDE.md**: Updated to reflect the observation hierarchy framework and governance principles
- **Depends on**: `impulse-pointer-mvp` (impulse metadata and pointer chains are prerequisite for convergence verification)
- **No impact on**: `repos/metabob-mcp`, `repos/metabob-analysis-api` (zero dependencies)
