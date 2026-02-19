# Context Architecture - Quick Reference

**Use this**: When you need quick answers about how context management works

---

## Q: How is intent captured?

**A**: Three ways:

1. **User Message** → Session Memory Agent analyzes → Intent classification + suggested impulses
2. **Activity `reason`** → Stored in activity record → Persisted to SurrealDB
3. **Impulse `description`** → Created with intent metadata → Injected into context

**Example**:
```typescript
// Activity level
activity({
  reason: "Fix auth bug - password reset fails for SSO users"
})

// Impulse level (automatic from memory agent)
impulse: {
  description: "Load login code to analyze SSO integration issue"
}
```

---

## Q: How does session memory agent work?

**A**: 4-layer system:

```
User Message → Intent Analysis (Haiku, <3s) → Impulse Creation → Context Injection
```

**Configuration**: `opencode.json`
```jsonc
{
  "sessionMemory": {
    "enabled": true,
    "model": { "modelID": "claude-3-5-haiku-20241022" },
    "defaultBudget": 2000,
    "maxImpulses": 5
  }
}
```

**What it does**:
- Analyzes user intent (code_fix, feature_request, refactor, etc.)
- Suggests relevant context (files, Metabob issues, history)
- Creates impulses automatically (no user intervention)
- Injects into system prompt when relevant

---

## Q: Where is impulse data stored?

**A**: Three places:

1. **In-Memory** (session state): Active impulses during session
2. **SurrealDB** (persistent): Usage tracking, learning loop
3. **Metabob** (semantic): Annotations, issues, CPG data

**SurrealDB Schema**:
- `impulse_registry`: Metadata (type, pointer, budget, success_rate, intent)
- `impulse_usage`: Junction table (which impulses in which steps)

**Key Fields**:
```sql
-- Intent capture
created_for: string  -- "Fix auth bug for SSO users"
tags: array          -- ["bug-fix", "auth", "sso"]

-- Learning loop
usage_count: int     -- How many times loaded
success_rate: float  -- Percentage of successful uses
```

---

## Q: How does Metabob-CLI interact?

**A**: Via MCP (Model Context Protocol):

```
OpenCode → MCP Client → Metabob MCP Server → Metabob Backend
```

**Key Tools**:
- `metabob_search_codebase_issues`: Find issues by query
- `metabob_annotate_component`: Document WHY code exists
- `metabob_analyze_change_impact`: Understand blast radius
- `metabob_list_file_components`: Get annotations for file

**Context Ranking**: Prioritizes issues by:
- 1.0 - Mentioned in prompt
- 0.9 - Recently modified
- 0.7 - HIGH severity
- 0.6 - High co-change score

---

## Q: How are annotations processed?

**A**: Lifecycle:

```
Code Change → Annotation Created → Stored in Metabob → Retrieved when relevant → Injected as impulse
```

**Schema**:
```typescript
{
  file_path: "src/auth/login.ts",
  component_name: "LoginHandler.authenticate",
  component_type: "method",
  reason: "WHY + alternatives + constraints + patterns"
}
```

**Injection Format**:
```xml
<annotations>
  <file path="src/auth/login.ts">
    <component name="LoginHandler.authenticate">
      Design: JWT stateless auth
      Why: API requires statelessness
      Alternatives: Session cookies (rejected)
    </component>
  </file>
</annotations>
```

---

## Q: How to keep git clean of docs?

**A**: Annotation-based documentation strategy:

**✅ DO**:
- Store design decisions as **annotations** (Metabob, not git)
- Generate docs **on-demand** from annotations (gitignored)
- Keep minimal docs in git (README, ARCHITECTURE, API)
- Use **impulses** to reference external docs

**❌ DON'T**:
- Commit generated documentation
- Commit session summaries (use SurrealDB)
- Commit execution logs (use SurrealDB)
- Duplicate implementation details in markdown

**.gitignore**:
```
docs/generated/      # Generated from annotations
SESSION_SUMMARY_*.md # Stored in DB
activity-*.json      # Stored in DB
impulse-data/        # Stored in DB
```

**Generate Docs** (CI/CD):
```bash
npm run docs:generate
# Reads annotations from Metabob
# Writes to docs/generated/ (gitignored)
# Serves via static site (always up-to-date)
```

---

## Q: How does the learning loop work?

**A**: SurrealDB tracks impulse effectiveness:

**Metrics**:
- `usage_count`: How many times impulse was loaded
- `success_when_used`: How many times step succeeded with this impulse
- `success_rate`: success_when_used / usage_count

**Query** (most effective impulses):
```sql
SELECT impulse_id, impulse_type, success_rate 
FROM impulse_registry 
WHERE usage_count > 5 
ORDER BY success_rate DESC
```

**Future**: Recommend impulses based on success rates for similar work

---

## Q: Complete configuration example?

**A**: `opencode.json`:

```jsonc
{
  // Session Memory (automatic context)
  "sessionMemory": {
    "enabled": true,
    "timeout": 3000,
    "model": {
      "providerID": "anthropic",
      "modelID": "claude-3-5-haiku-20241022"
    },
    "defaultBudget": 2000,
    "maxImpulses": 5,
    "inject_annotations": true
  },
  
  // Metabob Integration (annotations, issues, CPG)
  "mcp": {
    "metabob": {
      "enabled": true,
      "url": "http://localhost:3000",
      "maxIssues": 10,
      "minSeverity": "MEDIUM"
    }
  },
  
  // Backend API (impulse tracking)
  "backend": {
    "url": "https://api.metabob.com",
    "impulseTracking": true
  }
}
```

---

## Q: Data flow overview?

**A**: End-to-end:

```
User Message
  ↓
Session Memory Agent (intent analysis)
  ↓
Impulse Creation (with intent metadata)
  ↓
Session State (in-memory) + SurrealDB (persistent)
  ↓
Metabob MCP (annotations, issues, CPG)
  ↓
ImpulseFormatter (resolves pointers, applies budgets)
  ↓
Context Injection (system prompt)
  ↓
Main Agent (receives context)
  ↓
Code Changes + Annotations
  ↓
Backend API (tracks usage)
  ↓
SurrealDB (updates success rates)
  ↓
Learning Loop (recommendations for future sessions)
```

---

## Q: Key design principles?

**A**: 

1. **Intent is First-Class**: Captured everywhere (user message, activity reason, impulse description)
2. **Storage is Distributed**: Ephemeral (session), persistent (SurrealDB), semantic (Metabob)
3. **Documentation is Code-Adjacent**: Annotations, not files (always in sync)
4. **Learning Loop is Automated**: Success rates tracked, recommendations generated
5. **Context is Lazy**: Loaded only when relevant, within budget

---

## Q: How to create an annotation?

**A**: Use Metabob MCP tool:

```typescript
metabob_annotate_component({
  file_path: "src/payment/stripe.ts",
  component_name: "StripePaymentProcessor",
  component_type: "class",
  reason: `
    Handles Stripe payment processing.
    
    Design: Uses Stripe SDK v12 (latest stable)
    Why: v11 has security vulnerability (CVE-2024-1234)
    Alternatives: PayPal (rejected - poor subscription support)
    Constraints: Must handle webhook retries
    Performance: Idempotency keys prevent duplicate charges
    Security: Webhook signature verification required
    Related: BillingManager uses similar idempotency pattern
  `
})
```

---

## Q: How to create an impulse with intent?

**A**: Use impulse_create tool:

```typescript
impulse_create({
  id: "imp_auth_context",
  type: "file",
  pointer: {
    type: "file",
    path: "src/auth/login.ts"
  },
  budget: 2000,
  priority: "high",
  metadata: {
    created_for: "Fix password reset bug for SSO users",  // ← INTENT
    tags: ["bug-fix", "auth", "sso"]
  }
})
```

---

## Q: How to query impulse effectiveness?

**A**: SurrealDB queries:

**Most effective impulses**:
```sql
SELECT impulse_id, impulse_type, usage_count, success_rate 
FROM impulse_registry 
WHERE usage_count > 5 AND status = 'active'
ORDER BY success_rate DESC
LIMIT 20
```

**Impulses that correlate with success**:
```sql
SELECT 
    iu.impulse_id,
    ir.impulse_type,
    count() as usage_count,
    (SUM(CASE WHEN iu.step_succeeded THEN 1.0 ELSE 0.0 END) / count()) as success_rate
FROM impulse_usage iu
JOIN impulse_registry ir ON iu.impulse_id = ir.impulse_id
GROUP BY iu.impulse_id
HAVING usage_count > 5
ORDER BY success_rate DESC
```

**Co-occurring impulses** (used together):
```sql
SELECT 
    iu1.impulse_id as impulse_a,
    iu2.impulse_id as impulse_b,
    count(DISTINCT iu1.execution_id) as co_occurrence_count
FROM impulse_usage iu1
JOIN impulse_usage iu2 ON iu1.execution_id = iu2.execution_id
WHERE iu1.impulse_id < iu2.impulse_id
GROUP BY iu1.impulse_id, iu2.impulse_id
HAVING co_occurrence_count > 5
ORDER BY co_occurrence_count DESC
```

---

## Q: What files to reference?

**A**: Key locations:

**Intent & Impulses**:
- `repos/metabob-opencode/packages/opencode/src/session/memory-agent.ts`
- `repos/metabob-opencode/packages/opencode/src/session/session-state.ts`

**SurrealDB Schema**:
- `sql/migrations/005-impulse-tables.surql`

**Metabob Integration**:
- `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`
- `repos/metabob-opencode/packages/plugin-metabob/src/index.ts`

**Context Injection**:
- `repos/metabob-opencode/packages/opencode/src/session/impulse-formatter.ts`

---

**For detailed explanations**, see `CONTEXT_ARCHITECTURE_COMPREHENSIVE_GUIDE.md`
