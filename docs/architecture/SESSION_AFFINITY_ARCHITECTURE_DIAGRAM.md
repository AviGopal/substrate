# Session-Variant Affinity: Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     metabob-opencode                            │
│                  (Agent Platform + Execution)                   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Activity Execution Flow                        │  │
│  │                                                          │  │
│  │  1. Execute activity with trailblazing                  │  │
│  │  2. Task fails → Create improved variant                │  │
│  │  3. Register variant with backend                       │  │
│  │  4. Record affinity with backend                        │  │
│  │  5. Continue execution with new variant                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Template Selection Flow                        │  │
│  │                                                          │  │
│  │  1. Need variant for template                           │  │
│  │  2. Call backend selection API                          │  │
│  │  3. Receive selected variant                            │  │
│  │  4. Execute with selected variant                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│                  ▲                              ▲               │
│                  │ API Calls                    │ API Calls     │
│                  ▼                              ▼               │
└─────────────────────────────────────────────────────────────────┘
                   │                              │
                   │ POST /templates              │ POST /sessions/{id}/templates/select
                   │ POST /sessions/{id}/variant-affinity
                   │                              │
                   ▼                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    metabob-rpc-api                              │
│               (Backend + State + Selection Logic)               │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │        Variant Registration (Content-Addressable)        │  │
│  │                                                          │  │
│  │  POST /templates                                        │  │
│  │  ├─ Generate content hash                               │  │
│  │  ├─ variant_id = template_id + content_hash            │  │
│  │  ├─ Check if variant exists                            │  │
│  │  │   ├─ Exists: Return existing (idempotent) ✅        │  │
│  │  │   └─ New: Create variant ✅                          │  │
│  │  └─ Return variant_id                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │          Affinity Management (Session State)             │  │
│  │                                                          │  │
│  │  POST /sessions/{id}/variant-affinity                   │  │
│  │  ├─ Store: session:variant:affinity:{session_id}       │  │
│  │  └─ Redis: {template_id: variant_id}                   │  │
│  │                                                          │  │
│  │  GET /sessions/{id}/variant-affinity                    │  │
│  │  ├─ Query: session:variant:affinity:{session_id}       │  │
│  │  └─ Return: {template_id: variant_id}                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │     Variant Selection (Centralized Selection Logic)     │  │
│  │                                                          │  │
│  │  POST /sessions/{id}/templates/select                   │  │
│  │  ├─ Input: template_id, ignore_affinity                │  │
│  │  ├─ Check affinity (unless ignored)                    │  │
│  │  │   ├─ Affinity exists: Return affinity variant ✅    │  │
│  │  │   └─ No affinity: Thompson Sampling ✅              │  │
│  │  └─ Return: variant_id + selected_via                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Redis Storage                          │  │
│  │                                                          │  │
│  │  activity:template:{variant_id}        → Variant data   │  │
│  │  activity:metrics:{variant_id}         → Thompson α/β   │  │
│  │  session:variant:affinity:{session_id} → Affinity map   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Trailblazing Creates Variant

```
┌─────────────────┐
│   Session A     │
│  (OpenCode)     │
└────────┬────────┘
         │
         │ 1. Execute activity "add-feature-complete"
         │    Task fails with error
         │
         ▼
┌─────────────────────────────────────────────────┐
│  TrailblazingExecutor                           │
│  ├─ Generate recovery prompt                    │
│  ├─ Retry with recovery                         │
│  ├─ Success! Task completes                     │
│  └─ Create improved variant                     │
└────────┬────────────────────────────────────────┘
         │
         │ 2. Register variant
         │    POST /templates
         │    {
         │      name: "add-feature-complete",
         │      task_steps: [...modified...]
         │    }
         │
         ▼
┌─────────────────────────────────────────────────┐
│  Backend: create_template()                     │
│  ├─ template_id = "add-feature-complete"        │
│  ├─ content_hash = hash(task_steps + desc)      │
│  ├─ variant_id = template_id + content_hash     │
│  │   → "add-feature-complete-e5f6g7h8"          │
│  ├─ Store in Redis                              │
│  └─ Return: variant_id                          │
└────────┬────────────────────────────────────────┘
         │
         │ 3. Record affinity
         │    POST /sessions/session_abc123/variant-affinity
         │    {
         │      template_id: "add-feature-complete",
         │      variant_id: "add-feature-complete-e5f6g7h8",
         │      reason: "Created by trailblazing"
         │    }
         │
         ▼
┌─────────────────────────────────────────────────┐
│  Backend: record_session_variant_affinity()     │
│  ├─ key = "session:variant:affinity:session_abc"│
│  ├─ Redis HSET:                                 │
│  │   {"add-feature-complete":                   │
│  │    "add-feature-complete-e5f6g7h8"}          │
│  └─ TTL: 7 days                                 │
└────────┬────────────────────────────────────────┘
         │
         │ 4. Continue execution
         │    Use new variant: "add-feature-complete-e5f6g7h8"
         │
         ▼
┌─────────────────┐
│   Session A     │
│  ✅ Task complete│
│  ✅ Affinity set │
└─────────────────┘
```

---

## Data Flow: Session Uses Affinity

```
┌─────────────────┐
│   Session A     │
│  (Next Day)     │
└────────┬────────┘
         │
         │ 1. Execute activity "add-feature-complete"
         │    (Same template, new execution)
         │
         ▼
┌─────────────────────────────────────────────────┐
│  TemplateSelector.select()                      │
│  └─ Delegate to backend selection API           │
└────────┬────────────────────────────────────────┘
         │
         │ 2. Request variant selection
         │    POST /sessions/session_abc123/templates/select
         │    {
         │      template_id: "add-feature-complete"
         │    }
         │
         ▼
┌─────────────────────────────────────────────────┐
│  Backend: select_variant_for_session()          │
│  ├─ Check affinity for session_abc123           │
│  │   Query: session:variant:affinity:session_abc│
│  │   Found: "add-feature-complete-e5f6g7h8" ✅  │
│  ├─ Load variant data                           │
│  └─ Return: {                                   │
│      variant_id: "add-feature-complete-e5f6..", │
│      selected_via: "affinity",                  │
│      variant: {...}                             │
│    }                                            │
└────────┬────────────────────────────────────────┘
         │
         │ 3. Execute with affinity variant
         │    Uses: "add-feature-complete-e5f6g7h8"
         │
         ▼
┌─────────────────┐
│   Session A     │
│  ✅ Uses improved│
│     variant      │
│  ✅ No regression│
└─────────────────┘
```

---

## Data Flow: Other Sessions Use Thompson Sampling

```
┌─────────────────┐
│   Session B     │
│  (New Session)  │
└────────┬────────┘
         │
         │ 1. Execute activity "add-feature-complete"
         │    (First time, no affinity)
         │
         ▼
┌─────────────────────────────────────────────────┐
│  TemplateSelector.select()                      │
│  └─ Delegate to backend selection API           │
└────────┬────────────────────────────────────────┘
         │
         │ 2. Request variant selection
         │    POST /sessions/session_xyz789/templates/select
         │    {
         │      template_id: "add-feature-complete"
         │    }
         │
         ▼
┌─────────────────────────────────────────────────┐
│  Backend: select_variant_for_session()          │
│  ├─ Check affinity for session_xyz789           │
│  │   Query: session:variant:affinity:session_xyz│
│  │   Not found ❌                                │
│  ├─ Fall back to Thompson Sampling              │
│  │   List variants:                             │
│  │   - "add-feature-complete-a1b2c3d4" (gen 0)  │
│  │   - "add-feature-complete-e5f6g7h8" (gen 1)  │
│  │   Load metrics (alpha/beta)                  │
│  │   Sample from Beta distribution              │
│  │   Select variant with highest sample         │
│  │   → Might get gen 0 or gen 1 (probabilistic) │
│  └─ Return: {                                   │
│      variant_id: "...",                         │
│      selected_via: "thompson_sampling",         │
│      variant: {...}                             │
│    }                                            │
└────────┬────────────────────────────────────────┘
         │
         │ 3. Execute with Thompson-selected variant
         │    Gradual discovery of better variant
         │
         ▼
┌─────────────────┐
│   Session B     │
│  ✅ Explores     │
│     variants     │
│  ✅ Contributes  │
│     to learning  │
└─────────────────┘
```

---

## Architectural Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                     ARCHITECTURAL BOUNDARIES                    │
└─────────────────────────────────────────────────────────────────┘

metabob-opencode:
  ✅ OWNS: Execution, orchestration, tool calling
  ✅ DOES: Call backend APIs, track sessionId
  ❌ DOES NOT: Store affinity locally, implement selection logic

metabob-rpc-api:
  ✅ OWNS: State, Thompson Sampling, selection logic
  ✅ DOES: Store affinity, select variants, manage templates
  ❌ DOES NOT: Execute activities, orchestrate agents

metabob-cli:
  ✅ OWNS: MCP tools, code quality, stateless gateway
  ✅ DOES: Provide MCP interface to backend
  ❌ DOES NOT: Track execution, store affinity, orchestrate activities

┌─────────────────────────────────────────────────────────────────┐
│                     SEPARATION RESPECTED ✅                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Affinity Lifecycle

```
Time    Event                           Redis State
────────────────────────────────────────────────────────────────────
T0      Session A starts                session:variant:affinity:A = {}

T1      Activity fails                  (no change)
        Trailblazing creates variant

T2      Variant registered              activity:template:add-feature-v2
        Backend stores variant          (variant stored)

T3      Affinity recorded               session:variant:affinity:A = {
        Backend stores affinity           "add-feature": "add-feature-v2"
                                        }
                                        TTL: 7 days

T4      Session A next execution        Backend checks affinity
        Backend finds affinity          Found: "add-feature-v2"
        Returns affinity variant        ✅ Affinity variant used

T5      Session B execution             Backend checks affinity
        Backend finds NO affinity       Not found for Session B
        Falls back to Thompson          ✅ Thompson Sampling used

...     (6 days later)

T6      Session A execution             Backend checks affinity
        Affinity still exists           Found: "add-feature-v2"
        Returns affinity variant        ✅ Affinity variant used

T7      (8 days later)                  session:variant:affinity:A = {}
        Affinity TTL expires            (Redis auto-deletes)

T8      Session A execution             Backend checks affinity
        Affinity expired                Not found (expired)
        Falls back to Thompson          ✅ Thompson Sampling used
        (Session A now explores)
```

---

## Key Design Decisions

### 1. Content-Addressable Variants ✅
- Same content → same variant_id (idempotent)
- Different content → different variant_id (auto-variant)
- No explicit variant API calls needed

### 2. Backend Selection API ✅
- Backend owns ALL selection logic (affinity + Thompson)
- OpenCode delegates to backend (pure client)
- No logic duplication

### 3. Session-Scoped Affinity ✅
- Affinity is per-session (not per-activity)
- Each session can have different preferences
- Sessions isolated from each other

### 4. TTL-Based Expiration ✅
- Affinity expires after 7 days (configurable)
- Sessions eventually explore other variants
- Prevents permanent affinity lock-in

### 5. Override Mechanism ✅
- `ignore_affinity` parameter available
- Agents can force Thompson Sampling
- Useful for experimentation

---

## Compliance Checklist

✅ Backend owns all state (affinity in Redis)
✅ Backend owns all selection logic
✅ OpenCode is pure client (execution only)
✅ CLI is stateless (no changes)
✅ No logic duplication
✅ MCP gateway pattern preserved
✅ Backward compatible
✅ Plugin architecture respected
✅ Clear separation of concerns
✅ Testable and debuggable

**VERDICT: ✅ ARCHITECTURALLY SOUND**
