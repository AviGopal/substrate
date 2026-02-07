# Unified Proto Architecture - Visual Summary

## Current State (Broken)

```
┌─────────────────┐   ┌──────────────────┐   ┌─────────────────┐
│ metabob-opencode│   │ metabob-rpc-api  │   │  metabob-cli    │
│                 │   │                  │   │                 │
│ OpenCodeTemplate│   │  Custom Python   │   │  Custom types   │
│ (TypeScript)    │   │  Dict schemas    │   │                 │
└────────┬────────┘   └────────┬─────────┘   └────────┬────────┘
         │                     │                       │
         ▼                     ▼                       ▼
    ┌────────────────────────────────────────────────────┐
    │         🔥 THREE DIFFERENT FORMATS 🔥              │
    │                                                    │
    │  ActivitySchemaAdapter (250+ LOC conversion hell) │
    └────────────────────────────────────────────────────┘
                          ▼
                  Serialization bugs
                  Empty task_steps
                  Evolution breaks
```

## Target State (Unified)

```
┌──────────────────────────────────────────────────────────────┐
│                    metabob-proto                             │
│                                                              │
│  variant.proto (core schema - ALL apps use this)            │
│  execution.proto (OpenCode extensions)                      │
│  optimization.proto (RPC API extensions)                    │
│  admin.proto (CLI extensions)                               │
└──────────────────┬───────────────────────────────────────────┘
                   │
            buf generate (codegen)
                   │
                   ▼
    ┌──────────────────────────────────────┐
    │  @metabob/proto-gen (published pkg)  │
    │                                      │
    │  - TypeScript types                  │
    │  - Python types                      │
    │  - Go types (future)                 │
    └──────┬──────────┬───────────┬────────┘
           │          │           │
           ▼          ▼           ▼
    ┌──────────┐ ┌────────┐ ┌─────────┐
    │ OpenCode │ │ RPC API│ │   CLI   │
    │          │ │        │ │         │
    │ import { │ │ from   │ │ from    │
    │ Activity │ │ proto  │ │ proto   │
    │ Variant  │ │ import │ │ import  │
    │ } from   │ │ ...    │ │ ...     │
    │ @metabob │ │        │ │         │
    └──────────┘ └────────┘ └─────────┘
    
    ✅ Single source of truth
    ✅ No adapters
    ✅ No conversion bugs
    ✅ Guaranteed compatibility
```

## Extension System

```
┌─────────────────────────────────────────────────────────┐
│              Core ActivityVariant (ALL APPS)            │
│                                                         │
│  - variant_id, activity_id, task_steps                 │
│  - genealogy, status, timestamps                       │
│  - variables, prompt_strategy                          │
├─────────────────────────────────────────────────────────┤
│                    EXTENSIONS                           │
├─────────────────────────────────────────────────────────┤
│  execution_config: ExecutionConfig (OpenCode)          │
│    ├─ context_requirements  (session memory hints)     │
│    ├─ integration (pre/post checks, quality gates)     │
│    ├─ metabob (learning, annotations)                  │
│    └─ impulse_management (creation, cleanup rules)     │
├─────────────────────────────────────────────────────────┤
│  optimization_config: OptimizationConfig (RPC API)     │
│    ├─ thompson_sampling (MAB parameters)               │
│    ├─ traffic_allocation (min/max traffic)             │
│    ├─ performance_thresholds (auto-deprecate)          │
│    └─ auto_promotion (testing → active rules)          │
├─────────────────────────────────────────────────────────┤
│  admin_config: AdminConfig (CLI)                       │
│    ├─ authoring (author, contributors, tags)           │
│    ├─ validation (required fields, custom checks)      │
│    ├─ documentation (examples, failure modes)          │
│    └─ deployment (strategy, rollback, notifications)   │
└─────────────────────────────────────────────────────────┘

Each app uses what it needs, ignores the rest
```

## Data Flow Alignment (Your Goal)

```
┌─────────────────────────────────────────────────────────────┐
│          Instruction Sequence (Task Prompts)                │
└───────┬─────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────┐
│  Task 1: "Analyze docs by date"                             │
│    execution_config:                                         │
│      impulse_refs: ["documentationFiles"]                   │
│      output_impulses: ["doc-analysis"]                      │
├──────────────────────────────────────────────────────────────┤
│          Data Sequence (Tracked Operations)                  │
│                                                              │
│  1. Load impulse: documentationFiles (2500 tokens)          │
│  2. filter_markdown_files() → 45 files (120ms)              │
│  3. get_file_timestamps() → timestamp_map (80ms)             │
│  4. categorize_by_age() → 4 categories (200ms)              │
│  5. Create impulse: doc-analysis (1200 tokens)              │
│                                                              │
│  Metrics:                                                    │
│    - Total duration: 400ms                                   │
│    - Success: true                                           │
│    - Data operations: 3                                      │
│    - Code components: [filter.ts, timestamp.ts, sort.ts]    │
└──────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────┐
│  Task 2: "Percolate content"                                │
│    execution_config:                                         │
│      impulse_refs: ["doc-analysis"]  ← from Task 1          │
│      output_impulses: ["percolation-plan"]                  │
├──────────────────────────────────────────────────────────────┤
│          Data Sequence (Tracked Operations)                  │
│                                                              │
│  1. Load impulse: doc-analysis (1200 tokens)                │
│  2. identify_foundational_docs() → 3 docs (150ms)           │
│  3. extract_recent_details() → 12 sections (300ms)          │
│  4. merge_content() → updated_docs (500ms)                  │
│  5. Create impulse: percolation-plan (1500 tokens)          │
│                                                              │
│  Metrics:                                                    │
│    - Total duration: 950ms                                   │
│    - Success: true                                           │
│    - Data operations: 3                                      │
│    - Code components: [identify.ts, extract.ts, merge.ts]   │
└──────────────────────────────────────────────────────────────┘

✅ Instructions aligned with data operations
✅ Each task tracks: inputs, transformations, outputs
✅ Metrics correlate: which operations → task success
✅ Iterative refinement: improve slow/failing operations
```

## Iterative Refinement Loop

```
┌─────────────────────────────────────────────────────────┐
│  1. Execute Activity (variant A)                        │
│     - Track data operations per task                    │
│     - Measure: duration, success, quality               │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  2. Analyze Metrics                                     │
│     - Task 1: categorize_by_age() → 60% success        │
│     - Task 2: merge_content() → 95% success            │
│     - Bottleneck identified: categorize_by_age()       │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  3. Evolve Activity (create variant B)                 │
│     - Refine categorize_by_age() logic                 │
│     - Add fallback strategy                            │
│     - Update prompt for edge cases                     │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  4. A/B Test (MAB selects variants)                    │
│     - Variant A: 60% success                           │
│     - Variant B: 85% success                           │
│     - Thompson Sampling favors B                       │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  5. Promote Winner                                      │
│     - Variant B becomes ACTIVE                         │
│     - Variant A deprecated                             │
│     - Learning captured in metrics                     │
└─────────────────────────────────────────────────────────┘
                 │
                 └──────────────────────┐
                                       │
                 ┌─────────────────────┘
                 ▼
        (Repeat for continuous improvement)

✅ Data-driven evolution
✅ Instruction/data alignment enables targeted improvements
✅ Automated via MAB + metrics
```

## Migration Path (4 Weeks)

```
Week 1: Proto Foundation
┌──────────────────────────────────┐
│ ✅ Create extension protos       │
│ ✅ Set up buf codegen            │
│ ✅ Publish @metabob/proto-gen    │
└──────────────────────────────────┘

Week 2: Backend (metabob-rpc-api)
┌──────────────────────────────────┐
│ ✅ Install proto-gen             │
│ ✅ Replace custom schemas        │
│ ✅ Fix serialization bugs        │
│ ✅ task_steps arrays populated   │
└──────────────────────────────────┘

Week 3: CLI + OpenCode
┌──────────────────────────────────┐
│ ✅ CLI uses proto validation     │
│ ✅ Delete ActivitySchemaAdapter  │
│ ✅ OpenCode uses proto types     │
│ ✅ ExecutionConfig implemented   │
└──────────────────────────────────┘

Week 4: Testing & Validation
┌──────────────────────────────────┐
│ ✅ jiggle-documentation migrated │
│ ✅ End-to-end execution works    │
│ ✅ Evolution creates proto vars  │
│ ✅ Data flow tracking verified   │
└──────────────────────────────────┘
```

---

**Bottom Line**: 
- **Single proto format** across all repos
- **Application-specific extensions** for unique needs
- **Data flow tracking** enables instruction/data alignment
- **No adapters** = no bugs
- **4 weeks** to fix years of fragmentation
