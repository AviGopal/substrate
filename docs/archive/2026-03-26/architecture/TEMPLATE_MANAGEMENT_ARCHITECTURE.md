# Template Management Architecture: Trust Boundaries & Variant Evolution

**Date:** 2026-02-19  
**Critical Issue Identified:** Templates should NOT be managed by OpenCode  
**Architectural Principle:** Trust boundaries must match system boundaries

---

## **The Problem: OpenCode Has Too Much Power**

### **Current (Incorrect) Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│ metabob-opencode (LLM Execution Environment)                │
│                                                              │
│ • register_activity_template tool ✅                        │
│ • Writes to Storage["activity-template", id] ✅             │
│ • NO delete/unregister tool ❌                              │
│ • NO update tool ❌                                          │
│                                                              │
│ Storage: ~/.local/share/opencode/storage/activity-template/ │
│ • Templates stored as JSON files                            │
│ • Directly accessible by LLM agent!                         │
└─────────────────────────────────────────────────────────────┘
```

**Critical Flaw**: 
> "We shouldn't have metabob-opencode directly manage templates like this. We are giving too much trust to arbitrary LLM executions and templates are shared across the project."

### **Why This Is Dangerous**

1. **LLM agents are untrusted executors**
   - Can hallucinate malicious templates
   - Can overwrite working templates
   - Can inject backdoors into shared templates
   - No approval process

2. **Templates are shared infrastructure**
   - Used by entire project
   - Used by other agents
   - Impact system reliability
   - Affect all users/sessions

3. **No variant management**
   - "Update" overwrites (destructive)
   - No A/B testing of fixes
   - No rollback capability
   - Broken templates kill entire workflows

4. **Trust boundary violation**
   ```
   Untrusted (LLM) → Writes directly to → Trusted (Template Registry)
   ```

---

## **Correct Architecture: Backend-Managed Variants**

### **Separation of Concerns**

```
┌────────────────────────────────────────────────────────────────┐
│ metabob-opencode (Untrusted - LLM Execution)                   │
│                                                                 │
│ Tools (Read-Only Template Access):                             │
│ • search_activities (query backend) ✅                          │
│ • get_activity_template (read-only) ✅                          │
│ • activity (execute template) ✅                                │
│                                                                 │
│ Tools (Propose Changes - NOT Direct Writes):                   │
│ • propose_template_variant (suggest fix) ✅ NEW                 │
│ • report_template_bug (flag issue) ✅ NEW                       │
│                                                                 │
│ NO DIRECT WRITES TO TEMPLATE REGISTRY ❌                        │
└────────────────────────────────────────────────────────────────┘
                            ↓ Proposals
┌────────────────────────────────────────────────────────────────┐
│ metabob-cli (Trusted - MCP Orchestrator)                       │
│                                                                 │
│ MCP Tools (Can Create Variants):                               │
│ • create_template_variant (with approval)                      │
│ • flag_template_broken (mark for replacement)                  │
│ • approve_variant (human/automated review)                     │
└────────────────────────────────────────────────────────────────┘
                            ↓ Approved Changes
┌────────────────────────────────────────────────────────────────┐
│ metabob-rpc-api (Source of Truth - Backend)                    │
│                                                                 │
│ Template Variant Management:                                   │
│ • POST /templates → Create new template (first variant)        │
│ • POST /templates/:id/variants → Create variant                │
│ • Thompson Sampling → Select best variant                      │
│ • Automatic deprecation → Bad variants fade out                │
│                                                                 │
│ Storage: Database (SQLite/PostgreSQL)                          │
│ • Templates with version history                               │
│ • Variants with lineage tracking                               │
│ • Execution metrics (success rate, cost)                       │
│ • Learning data (alpha/beta for Thompson Sampling)             │
└────────────────────────────────────────────────────────────────┘
```

---

## **The Variant Evolution Pattern**

### **Scenario: Template Has a Bug**

**Current (Broken) Approach**:
```
1. LLM detects bug in template
2. LLM "fixes" template with register_activity_template
3. Old template overwritten
4. If fix is wrong → entire system broken
5. No rollback possible
```

**Correct (Variant) Approach**:
```
1. LLM detects bug in template
2. LLM proposes variant: propose_template_variant({
     templateId: "broken-template",
     reason: "Task 2 references undefined variable",
     changes: { /* JSON diff */ }
   })
3. Backend creates variant:
   - base-template (broken, alpha=1, beta=5)
   - variant-1 (proposed fix, alpha=1, beta=1)
4. Thompson Sampling tries both:
   - 80% of time: base-template (fails fast)
   - 20% of time: variant-1 (testing fix)
5. Variant-1 succeeds 5 times:
   - variant-1: alpha=6, beta=1 (success rate: 85%)
   - base-template: alpha=1, beta=10 (success rate: 9%)
6. Thompson Sampling shifts:
   - 95% of time: variant-1 (proven better)
   - 5% of time: base-template (still exploring)
7. Eventually base-template retired (no more trials)
```

### **Key Benefits**

✅ **No destructive updates** - Old template still available  
✅ **Automatic A/B testing** - Variant promotion is based on measured success rates, not LLM reasoning  
✅ **Gradual migration** - Not "big bang" switch  
✅ **Rollback implicit** - Bad variants fade out naturally  
✅ **No human approval needed** - Metrics decide  

> **Quote from user**: "If the reason the template was fixed was because of a bug that prevents execution it should already be on its way out as soon as a working variant gets created."

**Exactly!** The broken template will naturally lose to the working variant through Thompson Sampling. No manual intervention required.

---

## **Template Lifecycle Management**

### **Phase 1: Creation (Trusted Process)**

```
Human/Bootstrap → metabob-cli → Backend
```

**Safeguards**:
- Human creates initial template
- Or: Bootstrap template (part of system source)
- Registered via trusted CLI tool
- Backend validates schema
- Stored as base variant (generation 0)

### **Phase 2: Execution & Learning**

```
Agent requests template → Backend selects variant → Agent executes → Reports results
```

**Thompson Sampling**:
- Each execution updates alpha (success) or beta (failure)
- Selection probability = Beta(alpha, beta) distribution
- Better variants naturally selected more often

### **Phase 3: Evolution (Propose → Test → Adopt)**

```
Agent detects issue → Proposes variant → Backend creates variant → Thompson Sampling tests
```

**No direct writes** - Only proposals that create variants

### **Phase 4: Deprecation (Automatic)**

```
Variant consistently fails → Probability drops → Eventually not selected → Archived
```

**Natural selection** - Bad variants die, good variants thrive

---

## **API Redesign**

### **❌ Remove from OpenCode**

```typescript
// DANGEROUS - Direct write access
register_activity_template({ file_path, register_with_metabob })
```

### **✅ Add to OpenCode (Read-Only + Proposals)**

```typescript
// Safe - Read only
search_activities({ query, category, limit })
get_activity_template({ id })
activity({ templateId, variables, reason })

// Safe - Proposal only (no direct write)
propose_template_variant({
  templateId: "broken-template",
  reason: "Task 2 references undefined variable {{foo}}",
  changes: {
    tasks: [
      {
        id: "task-2",
        prompt: {
          impulses: [
            {
              id: "foo",
              type: "activityOutput",
              pointer: { type: "activityOutput", activityId: "{{activityId}}", taskId: "task-1" }
            }
          ]
        }
      }
    ]
  },
  testPlan: "Execute with dummy variables to verify no undefined references"
})

// Safe - Report only (no direct action)
report_template_bug({
  templateId: "broken-template",
  taskId: "task-2",
  error: "Variable 'foo' is not defined",
  context: { /* execution context */ }
})
```

### **✅ Add to metabob-cli (Trusted Orchestrator)**

```typescript
// MCP tool - Can create variants (with safeguards)
create_template_variant({
  templateId: string,
  reason: string,
  changes: TemplateDiff,
  source: "agent-proposed" | "human-created" | "automated-fix"
})

// MCP tool - Flag for replacement
flag_template_broken({
  templateId: string,
  evidence: {
    executionId: string,
    error: string,
    failureRate: number
  }
})

// MCP tool - Human review
approve_variant({
  variantId: string,
  reviewer: "human" | "automated-test",
  notes: string
})
```

### **✅ Backend (metabob-rpc-api) API**

```http
# Create new template (trusted source only)
POST /v2/activities/templates
Authorization: API_KEY (requires elevated permission)

# Create variant (allows LLM proposals via CLI)
POST /v2/activities/templates/:id/variants
{
  "reason": "Fix undefined variable",
  "changes": { /* template diff */ },
  "source": "agent-proposed",
  "metadata": { "proposedBy": "session-abc" }
}

# Select variant (Thompson Sampling)
POST /v2/activities/templates/:id/select-variant
→ Returns: { variantId, confidence, reasoning }

# Report execution result
POST /v2/activities/executions
{
  "templateId": "...",
  "variantId": "...",
  "success": true/false,
  "cost": 0.02,
  "duration": 5000
}
→ Backend updates alpha/beta

# List variants (for debugging)
GET /v2/activities/templates/:id/variants
→ Returns: [{ id, generation, successRate, executionCount }]
```

---

## **Trust Model**

### **Untrusted (LLM Agents in OpenCode)**

**Can do**:
- ✅ Read templates
- ✅ Execute templates
- ✅ Propose variants
- ✅ Report bugs
- ✅ Suggest improvements

**Cannot do**:
- ❌ Write/update templates directly
- ❌ Delete templates
- ❌ Override variant selection
- ❌ Manipulate execution metrics

### **Trusted (CLI Orchestrator)**

**Can do**:
- ✅ Create template variants
- ✅ Flag templates as broken
- ✅ Approve variants (with review)
- ✅ Query detailed metrics

**Cannot do**:
- ❌ Delete templates (only deprecate)
- ❌ Override Thompson Sampling

### **Source of Truth (Backend)**

**Responsibilities**:
- ✅ Store all templates and variants
- ✅ Manage Thompson Sampling
- ✅ Track execution metrics
- ✅ Enforce schema validation
- ✅ Maintain lineage/genealogy
- ✅ Archive deprecated variants

---

## **Migration Path**

### **Phase 1: Deprecate Direct Writes (Immediate)**

1. Mark `register_activity_template` as deprecated in OpenCode
2. Add warning: "This tool will be removed. Use propose_template_variant instead"
3. Document correct workflow

### **Phase 2: Implement Variant Proposal (Week 1)**

1. Add `propose_template_variant` tool to OpenCode
2. Add `create_template_variant` MCP tool to CLI
3. Update backend API to support variant creation
4. Maintain backward compatibility temporarily

### **Phase 3: Remove Direct Writes (Week 2)**

1. Remove `register_activity_template` from OpenCode tool registry
2. Move template registration to CLI only
3. OpenCode can only propose, not create

### **Phase 4: Migrate Existing Templates (Week 2-3)**

1. Move templates from OpenCode local storage to backend
2. Initialize each with generation=0 variant
3. Set initial alpha=1, beta=1 for Thompson Sampling

---

## **Example Workflow: Fix Validation Templates**

### **Current (Broken)**

```bash
# Agent directly overwrites template
register_activity_template({
  file_path: "validate-backend-storage.json"  # Overwrites existing!
})
```

### **Correct (Variant-Based)**

```bash
# Step 1: Agent detects issues
activity({ templateId: "validate-backend-activity-storage", ... })
→ Fails: "Variable 'prepareOutput' not defined"

# Step 2: Agent proposes fix
propose_template_variant({
  templateId: "validate-backend-activity-storage",
  reason: "Task 2 references undefined variable. Should use activityOutput impulse instead.",
  changes: {
    tasks: [
      {
        id: "test-template-registration",
        prompt: {
          variables: [],  // Remove variable
          impulses: [     // Add impulse
            {
              id: "prepareOutput",
              type: "activityOutput",
              pointer: {
                type: "activityOutput",
                activityId: "{{activityId}}",
                taskId: "prepare-test-template"
              }
            }
          ]
        }
      }
    ]
  }
})

# Step 3: CLI creates variant (with approval)
# MCP tool in CLI
create_template_variant({
  templateId: "validate-backend-activity-storage",
  reason: "...",
  changes: { /* from proposal */ },
  source: "agent-proposed"
})

# Step 4: Backend creates variant
POST /v2/activities/templates/validate-backend-activity-storage/variants
→ Created: variant-1 (generation 1, alpha=1, beta=1)

# Step 5: Thompson Sampling tests both
# 50% base, 50% variant-1 initially
→ base fails 5 times: alpha=1, beta=6
→ variant-1 succeeds 5 times: alpha=6, beta=1

# Step 6: variant-1 becomes dominant
# 95% variant-1, 5% base
# Base naturally deprecated through lack of selection
```

---

## **Security Implications**

### **Attack Vectors Prevented**

1. **Malicious Template Injection**
   - ❌ Before: LLM could inject backdoor templates
   - ✅ After: LLM can only propose (requires approval/testing)

2. **Template Corruption**
   - ❌ Before: LLM could overwrite working templates
   - ✅ After: Original always preserved, variant created

3. **Denial of Service**
   - ❌ Before: LLM could break all templates
   - ✅ After: Bad variants fade out, system self-heals

4. **Privilege Escalation**
   - ❌ Before: LLM has write access to shared infra
   - ✅ After: LLM proposes, trusted system decides

### **Trust Boundary Enforcement**

```
Untrusted (LLM) → Proposal → Trusted (CLI) → Validation → Backend (Storage)
```

Each boundary validates:
- CLI: Schema validation, diff reasonableness
- Backend: Schema validation, variant lineage, execution metrics

---

## **Conclusion**

> "Templates are shared across the project" - Therefore they require elevated trust

> "Templates should already be on their way out as soon as a working variant gets created" - Therefore natural selection via Thompson Sampling

**Architectural Principle**:
```
Trust Level       | Component        | Template Operations
------------------|------------------|--------------------
Untrusted         | OpenCode (LLM)   | Read, Execute, Propose
Trusted           | CLI (MCP)        | Create Variants, Approve
Source of Truth   | Backend (API)    | Store, Select, Learn
```

**The system should be antifragile**: Bad templates make the system stronger by driving creation of better variants.

**The system should be self-healing**: No human intervention required for template evolution.

**The system should be secure**: LLM agents cannot corrupt shared infrastructure.

---

## **Action Items**

### **Immediate**

- [ ] Document current architecture violation
- [ ] Create proposal for variant-based system
- [ ] Design `propose_template_variant` tool API

### **Week 1**

- [ ] Implement `propose_template_variant` in OpenCode
- [ ] Implement `create_template_variant` in CLI
- [ ] Add variant support to backend API
- [ ] Update Thompson Sampling for multi-variant selection

### **Week 2**

- [ ] Remove `register_activity_template` from OpenCode
- [ ] Migrate existing templates to backend
- [ ] Initialize Thompson Sampling state for all templates

### **Week 3**

- [ ] Monitor variant evolution in production
- [ ] Document variant creation patterns
- [ ] Build variant visualization dashboard

---

## **References**

- Thompson Sampling: Multi-armed bandit algorithm for exploration/exploitation
- Antifragility: Systems that gain from disorder (Nassim Taleb)
- Principle of Least Privilege: Grant minimum permissions necessary
- Immutable Infrastructure: Never update, always replace with new version
