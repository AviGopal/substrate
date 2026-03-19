# MiniBob Integration - Executive Summary
## Transform OpenCode into UI Frontend with MiniBob as Library

**Date**: 2026-03-18
**Status**: ✅ Ready for Implementation

---

## 🎯 Goal

Transform **metabob-opencode** from a monolithic activity execution system into a lightweight **UI frontend** that delegates core activity execution to **MiniBob** as a reusable library.

```
BEFORE:                          AFTER:
OpenCode (50K LOC)              OpenCode (46K LOC - UI focused)
├── Activity execution          └── MiniBob Library (3K LOC)
├── Template management             ├── Activity execution
├── Impulse system                  ├── Template management
├── MCP integration                 ├── Impulse system
└── UI/TUI                          ├── MCP integration
                                    └── → metabob-activity-api
```

---

## 📊 Key Metrics

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| **OpenCode LOC** | 50,000 | 46,000 | -8% (4,000 LOC removed) |
| **Activity Logic** | 4,200 LOC | 200 LOC (adapter) | -95% reduction |
| **Code Duplication** | High (2 systems) | Low (single source) | Eliminated |
| **Maintainability** | Complex | Simple | Clear separation |
| **Reusability** | OpenCode only | MiniBob + OpenCode | Universal library |

---

## 🏗️ Architecture Transformation

### Current State: Monolithic

```
┌─────────────────────────────────────────────┐
│         metabob-opencode (50K LOC)          │
│                                             │
│  ┌────────────────────────────────────────┐ │
│  │    Activity Execution (~4K LOC)        │ │
│  │  - TrailblazingExecutor                │ │
│  │  - ActivityCoordination                │ │
│  │  - TemplateRepository                  │ │
│  │  - MetricsClient                       │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  ┌────────────────────────────────────────┐ │
│  │    Impulse System (~2K LOC)            │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  ┌────────────────────────────────────────┐ │
│  │    UI/TUI                              │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
           ↓
  metabob-activity-api
```

### Target State: Library-Based

```
┌─────────────────────────────────────────────┐
│    metabob-opencode (46K LOC - UI Only)     │
│                                             │
│  ┌────────────────────────────────────────┐ │
│  │    UI/TUI Layer                        │ │
│  │  - Session display                     │ │
│  │  - Progress monitoring                 │ │
│  │  - User interaction                    │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  ┌────────────────────────────────────────┐ │
│  │    MiniBobAdapter (200 LOC)            │ │
│  │  - Translates calls                    │ │
│  │  - Bridges impulses                    │ │
│  │  - Forwards events                     │ │
│  └────────────────────────────────────────┘ │
│           ↓                                 │
│  ┌────────────────────────────────────────┐ │
│  │    @metabob/minibob (3K LOC)           │ │
│  │                                        │ │
│  │  ┌──────────────────────────────────┐  │ │
│  │  │  ActivityExecutor                │  │ │
│  │  │  - Template loading              │  │ │
│  │  │  - Task execution                │  │ │
│  │  │  - Nested activities             │  │ │
│  │  └──────────────────────────────────┘  │ │
│  │                                        │ │
│  │  ┌──────────────────────────────────┐  │ │
│  │  │  Impulse System                  │  │ │
│  │  │  - 4 core types                  │  │ │
│  │  │  - Lazy loading                  │  │ │
│  │  └──────────────────────────────────┘  │ │
│  │                                        │ │
│  │  ┌──────────────────────────────────┐  │ │
│  │  │  MCP Client                      │  │ │
│  │  │  - Backend communication         │  │ │
│  │  └──────────────────────────────────┘  │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
           ↓
  metabob-activity-api
```

---

## 🚀 Benefits

### 1. **Reduced Complexity**
- **-4,000 LOC**: Remove duplicate activity execution logic
- **Single source of truth**: MiniBob handles all activity execution
- **Cleaner codebase**: OpenCode focuses on UI/UX

### 2. **Better Separation of Concerns**
- **OpenCode**: UI, user experience, session management
- **MiniBob**: Activity execution, impulse system, MCP integration
- **Clear boundaries**: Easy to test, maintain, extend

### 3. **Reusability**
- **MiniBob as library**: Can be used by any tool (OpenCode, CLI, Docker, etc.)
- **Standalone vessel**: MiniBob can run independently
- **Universal execution engine**: Same logic everywhere

### 4. **MCP-First Architecture**
- **Backend-first**: Templates loaded from metabob-activity-api by default
- **Automatic tracking**: Execution metrics reported automatically
- **Variant support**: Template variants tracked correctly
- **Learning loop**: Thompson Sampling flows naturally

### 5. **Performance**
- **Bun runtime**: MiniBob optimized for performance
- **Stateless execution**: Lower memory overhead
- **Parallel support**: Multiple activities via ACP
- **Faster startup**: Minimal dependencies

### 6. **Self-Development**
- **MiniBob improves itself**: Via self-improve.json activity
- **Changes benefit OpenCode**: Automatic propagation
- **Vessel-agnostic becoming**: Demonstrates ontology principles

---

## 📋 Implementation Plan

### Timeline: 4-5 Days

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| **Phase 1**: Install MiniBob | 4 hours | Dependency added, types resolved |
| **Phase 2**: Create Adapter | 1 day | MiniBobAdapter + ImpulseBridge |
| **Phase 3**: Integrate Tool | 1 day | Activity tool uses adapter |
| **Phase 4**: Remove Duplicates | 1 day | ~4,000 LOC deleted |
| **Phase 5**: Testing | 1 day | All tests pass, e2e validated |
| **Total** | **4-5 days** | **Production-ready** |

### Key Files

**New Files** (~350 LOC):
1. `src/adapters/minibob-adapter.ts` (~200 LOC)
2. `src/adapters/minibob-impulse-bridge.ts` (~150 LOC)

**Modified Files** (~10 files):
1. `package.json` - Add MiniBob dependency
2. `src/tool/activity.ts` - Use adapter instead of TrailblazingExecutor
3. `src/session/activity.ts` - Add executeViaMiniBob function
4. `src/config/config.ts` - Add feature flag

**Deleted Files** (~4,000 LOC):
1. `src/session/activity-coordination.ts` - Task execution (→ MiniBob)
2. `src/session/trailblazing-executor.ts` - Trailblazing (→ MiniBob)
3. `src/session/template-metrics-client.ts` - MCP client (→ MiniBob)
4. `src/session/activity-template-repository.ts` - Local storage (→ MiniBob MCP)
5. Duplicate impulse code

---

## 🔄 Data Flow Comparison

### Before (Complex, 7+ steps)

```
User → CLI/TUI
  ↓
Activity Tool
  ↓
TrailblazingExecutor
  ↓
ActivityCoordination
  ↓
Session.create() → Agent.execute()
  ↓
LLM API
  ↓
TemplateMetricsClient
  ↓
metabob-activity-api
```

### After (Simple, 4 steps)

```
User → CLI/TUI
  ↓
MiniBobAdapter
  ↓
@metabob/minibob/ActivityExecutor
  ↓
metabob-activity-api
  ↓
(results back to UI)
```

**Simplifications**:
- ✅ No session creation per task
- ✅ No separate agent orchestration
- ✅ Direct tool calling
- ✅ MCP-first template loading
- ✅ Automatic metrics reporting

---

## 🧪 Testing Strategy

### Unit Tests
```bash
npm run test -- adapters/__tests__/minibob-adapter.test.ts
npm run test -- adapters/__tests__/minibob-impulse-bridge.test.ts
```

### Integration Tests
```bash
npm run test -- tests/integration/minibob-integration.test.ts
```

### E2E Tests
```bash
# Test basic execution
opencode activity templates/hello-world.json

# Test nested activities
opencode activity templates/test-nested-activities.json

# Test MCP integration
opencode activity add-feature-complete --var featureName="test"
```

### Performance Tests
```bash
# Benchmark execution time
time opencode activity add-feature-complete --var featureName="benchmark"

# Compare memory usage
/usr/bin/time -v opencode activity add-feature-complete
```

---

## 🎚️ Gradual Rollout

### Feature Flag Strategy

**Environment Variable**:
```bash
# Enable MiniBob (default: false)
export USE_MINIBOB=true
opencode activity <template>
```

**Config File** (`opencode.json`):
```json
{
  "experimental": {
    "useMiniBobForActivities": true
  }
}
```

### Rollout Stages

1. **Alpha** (Week 1)
   - Enable for core team only
   - Test 5-10 activity templates
   - Monitor: execution time, memory, success rate

2. **Beta** (Week 2)
   - Enable for all developers
   - Test with real workflows
   - Monitor: error rates, user feedback

3. **Production** (Week 3)
   - Enable by default
   - Monitor metrics closely
   - Keep legacy path for rollback

4. **Legacy Removal** (Week 4)
   - Remove old code paths
   - Delete ~4,000 LOC
   - Update documentation

---

## 📈 Success Metrics

### Quantitative
- [ ] OpenCode LOC reduced by 4,000+ lines
- [ ] Activity execution time ≤ current (no regression)
- [ ] Memory usage ≤ current
- [ ] All existing tests pass
- [ ] Integration test coverage ≥ 90%

### Qualitative
- [ ] Code is easier to understand
- [ ] Activity execution is more reliable
- [ ] MCP integration is cleaner
- [ ] Self-improvement loop works

---

## ⚠️ Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Breaking changes** | High | Feature flag for gradual rollout |
| **Impulse incompatibility** | Medium | ImpulseBridge with custom resolvers |
| **Performance regression** | Medium | Benchmark before/after, optimize adapter |
| **Lost features** | Low | Keep OpenCode-specific code (todos, logging) |

---

## 🔍 Key Insights

### MiniBob API Surface

**ActivityExecutor**:
```typescript
class ActivityExecutor {
  constructor(config: ExecutorConfig)
  async execute(options: ExecuteOptions): Promise<ActivityExecution>
}

// Config:
// - provider: "anthropic" | "openai"
// - apiKey, model, workingDirectory
// - onSearchActivities, onCreateActivity (callbacks)
// - customTools (optional)
```

**MCPClient**:
```typescript
class MCPClient {
  async getActivityTemplate(id: string): Promise<ActivityTemplate | null>
  async searchActivityTemplates(query?: {...}): Promise<Template[]>
  async registerTemplate(template: ActivityTemplate): Promise<boolean>
  async reportExecution(execution: ActivityExecution): Promise<boolean>
}
```

**Impulse System**:
```typescript
// 4 core types: memo, file, activityOutput, custom
createImpulse(impulse: {...}): Impulse
loadImpulses(ids: string[]): Promise<Impulse[]>
formatImpulsesForContext(impulses: Impulse[]): string
```

---

## 📦 Deliverables

### Documentation
1. ✅ **MINIBOB_INTEGRATION_ANALYSIS.md** - Architectural analysis
2. ✅ **MINIBOB_IMPLEMENTATION_GUIDE.md** - Step-by-step code examples
3. ✅ **MINIBOB_INTEGRATION_SUMMARY.md** - This document

### Code
1. ⏳ MiniBobAdapter (~200 LOC)
2. ⏳ MiniBobImpulseBridge (~150 LOC)
3. ⏳ Integration tests
4. ⏳ Feature flag implementation

### Testing
1. ⏳ Unit tests (adapter, bridge)
2. ⏳ Integration tests (e2e)
3. ⏳ Performance benchmarks
4. ⏳ Rollout plan

---

## 🎯 Next Actions

1. **Review Documents** - Get team approval
2. **Create Feature Branch** - `feature/minibob-integration`
3. **Implement Phase 1** - Add MiniBob dependency (4 hours)
4. **Implement Phase 2** - Create adapter layer (1 day)
5. **Implement Phase 3** - Integrate into activity tool (1 day)
6. **Implement Phase 4** - Remove duplicate code (1 day)
7. **Implement Phase 5** - Testing and validation (1 day)
8. **Deploy** - Gradual rollout with feature flag

---

## 💡 Long-Term Vision

### Code Path Alignment

```
metabob-opencode (UI Frontend)
  ↓
@metabob/minibob (Library)
  ↓
metabob-activity-api (Backend)
```

### Benefits
- **Single source of truth**: Activity execution in one place
- **Reusable library**: MiniBob used by multiple tools
- **Clean architecture**: UI ↔ Library ↔ Backend
- **Self-improvement**: MiniBob evolves itself
- **Vessel-agnostic**: Demonstrates ontology of becoming

### Future Possibilities
- **MiniBob CLI**: Standalone activity execution
- **MiniBob Docker**: Container-based vessel
- **MiniBob Cloud**: Serverless activity execution
- **MiniBob Plugins**: Custom tool integrations

---

## 📚 References

- **MiniBob README**: `repos/minibob/README.md`
- **MiniBob Architecture**: `repos/minibob/ARCHITECTURE.md`
- **OpenCode Activity Tool**: `packages/opencode/src/tool/activity.ts`
- **OpenCode Activity Session**: `packages/opencode/src/session/activity.ts`

---

**Status**: ✅ Ready for Implementation
**Estimated Effort**: 4-5 days
**Risk Level**: Low (feature flag enables safe rollback)
**Business Value**: High (reduced complexity, improved maintainability)

---

*"Transform OpenCode into a UI frontend that leverages MiniBob as the universal activity execution library, creating a clean separation of concerns and enabling reusability across the ecosystem."*
