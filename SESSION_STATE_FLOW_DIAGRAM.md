# Session Memory State Flow: Visual Diagrams

**Date**: 2026-02-24  
**Purpose**: Visual representation of how session memory and impulses flow through lifecycle hooks

---

## Diagram 1: Current Architecture - Transfer-Based Flow

```mermaid
graph TD
    A[User Message: 'Fix auth bug'] -->|Arrives at| B[Parent Session<br/>ses_abc123]
    B -->|Trigger| C[Pre-Turn Lifecycle Hook<br/>Priority: 10]
    
    C -->|executeActivityInline| D[Create Child Session<br/>ses_child_mem]
    D -->|Execute Template| E[manage-session-memory]
    
    E -->|Task 1| F[Memory Agent Analyzes<br/>Sub-session: ses_task1]
    E -->|Task 2| G[Create Impulses<br/>Sub-session: ses_task2]
    
    F -->|Output| H[Intent Analysis]
    G -->|impulse_create| I[SessionMemory<br/>ses_task2]
    
    I -->|Store| J["Impulse: file:auth.ts<br/>scope: activity<br/>sessionID: ses_task2"]
    
    J -->|Collect from all sessions| K[executeActivityInline<br/>Returns]
    K -->|Return impulses| L[Lifecycle Hook Handler]
    
    L -->|Transfer Loop| M[For each impulse]
    M -->|Convert| N["scope: session<br/>sessionID: ses_abc123"]
    N -->|Add to parent| O[SessionMemory<br/>ses_abc123]
    
    O -->|Now visible| P[Main Agent Executes]
    P -->|impulse_list| Q[Sees transferred impulses]
    P -->|impulse_load| R[Loads content]
    R -->|Enriched context| S[Agent Response]
    
    style B fill:#e1f5ff
    style D fill:#fff3cd
    style I fill:#fff3cd
    style O fill:#e1f5ff
    style L fill:#f8d7da
    style M fill:#f8d7da
    style N fill:#f8d7da
```

### Legend
- **Blue**: Parent session storage
- **Yellow**: Child session storage
- **Red**: Transfer/conversion logic

---

## Diagram 2: State Slice Ownership (Current)

```mermaid
graph LR
    subgraph "Parent Session (ses_primary)"
        A[SessionMemory Store]
        A1[impulses: EMPTY]
        A2[totalBudget: 50000]
        A3[usedTokens: 0]
    end
    
    subgraph "Child Session (ses_child)"
        B[SessionMemory Store]
        B1["impulses: {<br/>  file:auth.ts: {...}<br/>  metabob:priority: {...}<br/>}"]
        B2[totalBudget: 5000]
        B3[usedTokens: 4200]
    end
    
    subgraph "After Transfer"
        C[SessionMemory Store]
        C1["impulses: {<br/>  file:auth.ts: {...}<br/>  metabob:priority: {...}<br/>}"]
        C2[totalBudget: 50000]
        C3[usedTokens: 4200]
    end
    
    A --> |executeActivityInline| B
    B --> |Transfer + Convert Scope| C
    
    style A fill:#e1f5ff
    style B fill:#fff3cd
    style C fill:#d4edda
```

---

## Diagram 3: Planned Architecture - Unified State

```mermaid
graph TD
    A[User Message: 'Fix auth bug'] -->|Arrives at| B[Parent Session<br/>ses_abc123]
    B -->|Trigger| C[Pre-Turn Lifecycle Hook<br/>Priority: 10]
    
    C -->|executeActivityInline<br/>NO child session| D[Execute in Parent<br/>ses_abc123]
    D -->|Execute Template| E[manage-session-memory]
    
    E -->|Task 1| F[Memory Agent Analyzes<br/>Same session: ses_abc123]
    E -->|Task 2| G[Create Impulses<br/>Same session: ses_abc123]
    
    F -->|Output| H[Intent Analysis]
    G -->|impulse_create| I[SessionMemory<br/>ses_abc123]
    
    I -->|Store| J["Impulse: file:auth.ts<br/>scope: session<br/>sessionID: ses_abc123"]
    
    J -->|Already in parent| K[executeActivityInline<br/>Returns]
    K -->|✅ NO transfer needed| L[Lifecycle Hook Handler]
    
    L -->|Impulses already visible| M[Main Agent Executes]
    M -->|impulse_list| N[Sees impulses immediately]
    M -->|impulse_load| O[Loads content]
    O -->|Enriched context| P[Agent Response]
    
    style B fill:#d4edda
    style I fill:#d4edda
    style K fill:#d4edda
    style L fill:#d1ecf1
```

### Legend
- **Green**: Single source of truth (parent session)
- **Blue**: No transfer needed

---

## Diagram 4: Session Hierarchy (Current)

```mermaid
graph TD
    A["Parent Session<br/>ses_primary<br/>────────────<br/>SessionMemory:<br/>- impulses: {}<br/>- allocations: N/A<br/>- executionGraph: N/A"]
    
    A -->|Creates| B["Child Session<br/>ses_child_mem<br/>────────────<br/>SessionMemory:<br/>- impulses: {...}<br/>- budget: 5000"]
    
    B -->|Task 1 spawns| C["Sub-Session<br/>ses_task1<br/>────────────<br/>Memory Agent<br/>Intent Analysis"]
    
    B -->|Task 2 spawns| D["Sub-Session<br/>ses_task2<br/>────────────<br/>General Agent<br/>Impulse Creation"]
    
    D -->|Creates| E["Impulse<br/>file:auth.ts<br/>────────────<br/>scope: activity<br/>sessionID: ses_task2"]
    
    E -.->|Collected| F["executeActivityInline<br/>Returns"]
    
    F -.->|Transfer| G["Parent Session<br/>ses_primary<br/>────────────<br/>SessionMemory:<br/>- impulses: {file:auth.ts}<br/>- scope: session<br/>- sessionID: ses_primary"]
    
    style A fill:#e1f5ff
    style B fill:#fff3cd
    style C fill:#f0f0f0
    style D fill:#f0f0f0
    style E fill:#fff3cd
    style G fill:#d4edda
```

---

## Diagram 5: Execution Graph (Planned)

```mermaid
graph TD
    subgraph "Session: ses_abc123"
        A["Root Node<br/>────────────<br/>type: message<br/>messageID: msg_001<br/>budgetAllocated: 50000"]
        
        A -->|Child| B["Lifecycle Hook<br/>────────────<br/>type: lifecycle-hook<br/>hookName: memory-management<br/>budgetAllocated: 5000<br/>budgetUsed: 4200<br/>impulses: [file:auth.ts]"]
        
        A -->|Child| C["Main Agent<br/>────────────<br/>type: message<br/>messageID: msg_002<br/>budgetAllocated: 45000<br/>budgetUsed: 12000<br/>impulses: [bash:tests]"]
        
        C -->|Child| D["Activity<br/>────────────<br/>type: activity<br/>activityID: act_xyz<br/>templateId: fix-bug-complete<br/>budgetAllocated: 15000<br/>budgetUsed: 11500<br/>impulses: [metabob:priority]"]
    end
    
    subgraph "Shared Impulse Store"
        E["SessionMemory.impulses:<br/>────────────<br/>file:auth.ts (owner: lifecycle:memory-management)<br/>bash:tests (owner: msg_002)<br/>metabob:priority (owner: act_xyz)"]
    end
    
    B -.->|Creates| E
    C -.->|Creates| E
    D -.->|Creates| E
    
    style A fill:#e1f5ff
    style B fill:#d4edda
    style C fill:#e1f5ff
    style D fill:#fff3cd
    style E fill:#f8d7da
```

---

## Diagram 6: Scope Conversion Rules

```mermaid
flowchart LR
    A["Impulse Created<br/>────────────<br/>Location: Child Session<br/>scope: activity<br/>sessionID: ses_child"] -->|Transfer Logic| B{Scope Conversion}
    
    B -->|Set| C["scope = 'session'"]
    B -->|Set| D["sessionID = parent"]
    
    C --> E["Impulse Transferred<br/>────────────<br/>Location: Parent Session<br/>scope: session<br/>sessionID: ses_parent"]
    D --> E
    
    E -->|Now visible| F["Main Agent<br/>────────────<br/>impulse_list()<br/>impulse_load()"]
    
    style A fill:#fff3cd
    style B fill:#f8d7da
    style E fill:#d4edda
    style F fill:#e1f5ff
```

---

## Diagram 7: Budget Allocation (Planned)

```mermaid
graph TD
    A["Session Budget<br/>────────────<br/>Total: 50000 tokens"]
    
    A -->|Allocate| B["Lifecycle: memory-management<br/>────────────<br/>Allocated: 5000<br/>Used: 4200<br/>Status: released"]
    
    A -->|Allocate| C["Activity: act_xyz<br/>────────────<br/>Allocated: 15000<br/>Used: 12000<br/>Status: active"]
    
    A -->|Allocate| D["Main Agent<br/>────────────<br/>Allocated: 30000<br/>Used: 18000<br/>Status: active"]
    
    B -.->|Owns| E["Impulse: file:auth.ts<br/>────────────<br/>budget: 5000<br/>tokenCount: 4200"]
    
    C -.->|Owns| F["Impulse: metabob:priority<br/>────────────<br/>budget: 3000<br/>tokenCount: 2800"]
    
    D -.->|Owns| G["Impulse: bash:tests<br/>────────────<br/>budget: 1000<br/>tokenCount: 950"]
    
    style A fill:#e1f5ff
    style B fill:#d4edda
    style C fill:#fff3cd
    style D fill:#e1f5ff
    style E fill:#d4edda
    style F fill:#fff3cd
    style G fill:#e1f5ff
```

---

## Diagram 8: Impulse Lifecycle (Current)

```mermaid
stateDiagram-v2
    [*] --> Created: impulse_create in child session
    Created --> Stored: SessionMemory[ses_child]
    Stored --> Collected: executeActivityInline collects
    Collected --> Converted: Scope converted (activity→session)
    Converted --> Transferred: SessionMemory[ses_parent]
    Transferred --> Visible: Main agent sees impulse
    Visible --> Loaded: impulse_load called
    Loaded --> Used: Content in context
    Used --> Unloaded: impulse_unload (if needed)
    Unloaded --> Deleted: impulse_delete (after 10 turns)
    Deleted --> [*]
    
    note right of Converted
        Transfer Logic
        - Change scope
        - Change sessionID
        - Copy to parent
    end note
```

---

## Diagram 9: Impulse Lifecycle (Planned)

```mermaid
stateDiagram-v2
    [*] --> Created: impulse_create in parent session
    Created --> Stored: SessionMemory[ses_parent]
    Stored --> Visible: Immediately visible (no transfer)
    Visible --> Loaded: impulse_load called
    Loaded --> Used: Content in context
    Used --> Unloaded: impulse_unload (if needed)
    Unloaded --> Deleted: impulse_delete (after 10 turns)
    Deleted --> [*]
    
    note right of Stored
        No Transfer Needed
        - Single source of truth
        - Consistent scope
        - Immediate visibility
    end note
```

---

## Diagram 10: Multi-Activity Composition (Planned)

```mermaid
graph TD
    A["Session: ses_primary<br/>────────────<br/>Total Budget: 50000"]
    
    A -->|Hook| B["Lifecycle: memory-management<br/>────────────<br/>Creates impulses for context"]
    
    A -->|Turn| C["Main Agent<br/>────────────<br/>Calls activity tool"]
    
    C -->|Activity 1| D["Activity: add-feature-complete<br/>────────────<br/>Creates impulses for feature"]
    
    D -->|Activity 2| E["Activity: add-tests<br/>────────────<br/>Sees parent impulses ✅"]
    
    E -->|Activity 3| F["Activity: commit-organized-changes<br/>────────────<br/>Sees all parent impulses ✅"]
    
    subgraph "Shared Impulse Store"
        G["SessionMemory.impulses:<br/>────────────<br/>Context impulses (from lifecycle)<br/>Feature impulses (from Activity 1)<br/>Test impulses (from Activity 2)<br/>Commit impulses (from Activity 3)"]
    end
    
    B -.->|Writes| G
    D -.->|Writes| G
    E -.->|Writes & Reads| G
    F -.->|Writes & Reads| G
    
    style A fill:#e1f5ff
    style B fill:#d4edda
    style C fill:#e1f5ff
    style D fill:#fff3cd
    style E fill:#fff3cd
    style F fill:#fff3cd
    style G fill:#f8d7da
```

### Key Insight
With unified state, each nested activity can:
- ✅ Read impulses created by previous activities
- ✅ Create new impulses visible to subsequent activities
- ✅ No transfer logic needed at any level

---

## Summary: Visual Comparison

| Aspect | Current (Transfer-Based) | Planned (Unified) |
|--------|-------------------------|-------------------|
| **Session Creation** | Child sessions for isolation | Execute in parent session |
| **Impulse Storage** | Child SessionMemory | Parent SessionMemory |
| **Transfer Logic** | Required (scope conversion) | Not needed |
| **Visibility** | After transfer only | Immediate |
| **Complexity** | High (3 stages) | Low (1 stage) |
| **Nested Activities** | Manual propagation | Automatic sharing |
| **Budget Tracking** | Not implemented | Tracked per activity |
| **Execution Graph** | Not implemented | Full hierarchy |

---

## References

- **Implementation Trace**: `SESSION_MEMORY_LIFECYCLE_TRACING.md`
- **Architecture Spec**: `docs/architecture/SHARED_INSTRUCTIONAL_STATE_COMPLETE_ARCHITECTURE.md`
- **Code Files**:
  - `src/session/turn-lifecycle-hooks.ts`
  - `src/tool/activity.ts`
  - `src/session/session-memory.ts`
