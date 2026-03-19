# Comprehensive System Overview: Vessels, Activities, and Autonomous Improvement

**Generated**: March 19, 2026  
**Purpose**: Answer fundamental questions about what this system is, where it came from, and where it's going

---

## Quick Answers

### Where are these activities from?
**Created during real development sessions over ~2 months (Feb-Mar 2026)**. Developers extracted repeating workflows into reusable templates, stored in `~/.local/share/opencode/storage/activity-template/`.

### What do they do?
**Structured workflows for development tasks**:
- `fix-bug-complete` - Systematic debugging (reproduce, analyze, fix, test, commit)
- `build-and-test-*` - Build features, run tests, deploy to K8s
- `evolve-activity-*` - Improve underperforming activity templates
- 87 total templates covering: bugfix, feature, refactor, infrastructure, tooling

### When have they been used?
**Continuously during development** (~50-100 executions):
- Every database migration, K8s deployment, feature addition
- Building the activity system itself (meta-development)
- Testing vessel independence (OpenCode vs MiniBob)

### What was the goal?
**Build a self-improving AI system** that:
1. Executes structured workflows (activities)
2. Learns from every execution (metrics + Thompson Sampling)
3. Autonomously improves itself when idle (boredom system)
4. Transcends any particular implementation (vessel-agnostic)

### Did we achieve it?
**Foundation: YES. Autonomy: PARTIALLY. Emergence: NOT YET.**
- ✅ Activity execution works (OpenCode + MiniBob)
- ✅ Metrics collection operational
- ✅ Dashboard deployed and populated (TODAY)
- ⏳ Learning loop designed but needs execution data
- ⏳ Boredom system designed but not autonomous yet
- 🔮 Emergent patterns require more execution history

### What are we currently doing?
**TODAY**: Populated Activity Dashboard with 87 templates (visible at http://dashboard.minibob.local)  
**NEXT**: Execute activities to generate metrics, prove learning loop works

### How do we develop vessels?
**4-Step Process**:
1. **Interact** - Work with codebase normally
2. **Decompose** - Extract dataflows, intents, activities, validators
3. **Align** - Ensure instructional state matches functional state (ripple development)
4. **Incorporate** - Add lifecycle hooks, tools, activity registry, data bridges

### How do we autonomously improve?
**Boredom System** (designed, not yet deployed):
1. Detect idle (5+ min no user activity)
2. Fetch improvement opportunities (low success rate templates)
3. Calculate improvement gradient (0.0-1.0, higher = more urgent)
4. Execute highest priority activity (`improve-activity-template`, `debug-failed-activity`, etc.)
5. Measure results, update metrics
6. Repeat continuously

---

## See Full Document

The complete overview covers:
- Detailed activity anatomy and lifecycle
- Template creation timeline and sources
- Ontology of becoming (vessel/process/instance)
- Vessel development workflow with examples
- Boredom system architecture
- Current gaps and next steps

**File**: `/home/avi/documents/work/exp-repo/metabob-devbob/COMPREHENSIVE_SYSTEM_OVERVIEW.md`

