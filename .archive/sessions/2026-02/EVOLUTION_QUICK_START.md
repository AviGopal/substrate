# Activity System Evolution - Quick Start

**Purpose**: Transform static templates into intelligent, self-improving system  
**Timeline**: 8 weeks (MVP in 4 weeks)  
**Expected ROI**: 80% cost reduction on routine tasks

---

## The Vision in One Diagram

```
CURRENT STATE:                    TARGET STATE:
┌─────────────┐                   ┌─────────────┐
│  OpenCode   │                   │  OpenCode   │ ← Executes templates
└──────┬──────┘                   └──────┬──────┘
       │                                  │ 
       │ Load static template             │ 1. Request activity
       ▼                                  │ 2. Backend chooses best variant
┌─────────────┐                          │ 3. Execute with context
│   Backend   │                          │ 4. Report outcome + steps taken
└─────────────┘                          ▼
                                  ┌─────────────┐
❌ No learning                     │   Backend   │ ← Intelligent system
❌ No optimization                 │             │   • Selects best variant
❌ Same mistakes                   │             │   • Learns from outcomes
❌ High LLM cost                   │             │   • Creates new variants
                                  │             │   • A/B tests improvements
                                  └─────────────┘
                                  
                                  ✅ Learns what works
                                  ✅ Optimizes over time
                                  ✅ Context-aware selection
                                  ✅ 80% cost reduction
```

---

## The Four Phases

### Phase 1: Data Collection (Foundation) - Week 1-2
**Goal**: Capture execution outcomes for learning

**What to build**:
- OpenCode reports success/failure after each execution
- Backend stores outcomes in database
- Variant metrics auto-update (success rate, avg duration, cost)

**Success metric**: Every execution recorded, can query "What's the success rate?"

---

### Phase 2: Variant Selection (Intelligence) - Week 3-4
**Goal**: Backend chooses optimal variant based on data

**What to build**:
- Remove OpenCode template caching (every request → backend)
- VariantSelector algorithm (95% best variant, 5% random for learning)
- Context-aware scoring (language match, project type, recent patterns)

**Success metric**: Backend serves different variants, high-performers selected more

---

### Phase 3: Auto-Evolution (Self-Improvement) - Week 5-6
**Goal**: System creates new variants from successful patterns

**What to build**:
- Track when execution diverges from template
- Detect patterns (3+ similar divergences)
- Auto-create new variant from pattern
- Genealogy tracking (variant ancestry)

**Success metric**: System creates 1+ variants automatically, genealogy correct

---

### Phase 4: Impulse Integration (Context Intelligence) - Week 7-8
**Goal**: Templates remember which context led to success

**What to build**:
- Templates specify impulse requirements
- Track which impulses were accessed during execution
- Learn impulse effectiveness (90% success with errorContext)
- Remove unused impulses from templates

**Success metric**: Can identify high-value impulses, optimize templates

---

## Cost Savings Example

### Current Model
```
Task: "Add REST endpoint"

Agent: 
1. Reasons through requirements ← LLM
2. Designs implementation ← LLM
3. Writes code ← LLM
4. Writes tests ← LLM
5. Creates docs ← LLM

Total: ~50,000 tokens × $0.01/1k = $0.50 per task
× 1000 tasks = $500
```

### Target Model (After Evolution)
```
Task: "Add REST endpoint"

Backend: "Use add-rest-endpoint-v3 (85% success rate)"

Agent:
1. Executes proven template ← Template ($0)
2. Handles edge cases ← LLM (5,000 tokens)
3. Reports outcome ← Backend learns

Total: ~5,000 tokens × $0.01/1k = $0.05 per task
× 1000 tasks = $50

Savings: $450 (90% reduction)
```

---

## Implementation Priorities

### Must Have (Critical Path)
1. **Phase 1**: Outcome reporting and storage
2. **Phase 2**: Variant selection algorithm

**Why**: Without these, no learning or intelligence possible

### Should Have (High Value)
3. **Phase 3**: Auto-variant creation
4. **Phase 4**: Impulse learning

**Why**: Self-improvement and context optimization

### Could Have Later
- Analytics dashboard
- Manual template creation tools
- Advanced A/B testing

---

## Key Technical Decisions

### 1. Remove OpenCode Caching
**Current**: Templates cached locally, same template every time  
**Target**: Every request → Backend, different variant possible

**File**: `packages/opencode/src/session/template-loader.ts`
```typescript
// REMOVE:
const cached = TemplateCache.get(id)
if (cached) return cached

// DO:
return await MetabobCLI.getActivityTemplate(id)  // Fresh every time
```

### 2. Multi-Armed Bandit Algorithm
**Strategy**: Balance exploitation (best variant) vs exploration (learning)

```python
if random() < 0.95:
    return highest_scored_variant  # Exploit
else:
    return random_variant  # Explore
```

### 3. Proto Schema as Source of Truth
**Why**: Single schema prevents field name mismatches  
**How**: Backend uses proto, metabob-cli maps to/from proto

---

## Success Metrics Summary

| Phase | Metric | Target |
|-------|--------|--------|
| Phase 1 | Outcome capture rate | 100% |
| Phase 1 | Data completeness | No missing fields |
| Phase 2 | Variant selection working | Different variants served |
| Phase 2 | Exploration rate | 5% of requests |
| Phase 3 | Auto-variants created | 1+ per week |
| Phase 3 | Genealogy tracking | 100% accurate |
| Phase 4 | Impulse usage tracked | 100% of executions |
| Phase 4 | Impulse optimization | Remove 20% unused impulses |

---

## Risks and Mitigation

### Risk 1: Schema Mismatch
**Mitigation**: Proto as single source, automated validation tests

### Risk 2: Performance Degradation
**Mitigation**: Cache variant scores (5 min TTL), timeout fallback

### Risk 3: Bad Auto-Variants
**Mitigation**: Manual review, sandbox testing, gradual rollout

### Risk 4: Data Quality
**Mitigation**: Payload validation, retry logic, monitoring

---

## Quick Reference: Files to Modify

### OpenCode (Executor)
- `tool/activity.ts` - Add outcome reporting
- `session/template-loader.ts` - Remove caching
- `metabob.ts` - MCP communication

### Backend (Repository)
- `server/v2_activities.py` - New endpoints
- `server/variant_selector.py` - Selection algorithm (NEW)
- `server/variant_evolver.py` - Evolution logic (NEW)
- `sql/schema.surql` - Database schema

### CLI (Mediator)
- `mcp/tools.py` - Outcome reporting tool
- `mcp/activity_manager.py` - Execution tracking

### Proto (Schema)
- `metabob/activity.proto` - Add impulse provenance

---

## Next Steps

### This Week
1. Review EVOLUTION_TARGET_STATE.md (full design)
2. Get architectural approval
3. Set up project tracking
4. Create feature branch: `feature/activity-evolution`

### Week 1-2: Foundation
1. Implement outcome reporting (OpenCode)
2. Add POST /executions endpoint (Backend)
3. Create database schema
4. Test end-to-end data flow

### Week 3-4: Intelligence
1. Remove OpenCode caching
2. Implement VariantSelector
3. Test variant selection
4. Validate A/B testing

---

## Questions?

**Q: Why remove caching?**  
A: Backend needs to control which variant is served. Caching defeats dynamic selection.

**Q: How do we prevent bad auto-variants?**  
A: Manual review before activation, sandbox testing, gradual rollout (1% traffic first).

**Q: What if variant selection is slow?**  
A: Cache scores (5 min), pre-compute for top variants, timeout fallback to default.

**Q: How long to see ROI?**  
A: Phase 1-2 (4 weeks) enables intelligent selection. Cost savings start immediately after.

---

**For full details**: See EVOLUTION_TARGET_STATE.md (comprehensive design document)

**Status**: Ready for implementation  
**Next**: Team review and approval
