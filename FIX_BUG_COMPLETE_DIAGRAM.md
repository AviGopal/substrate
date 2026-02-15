# fix-bug-complete Activity Template - Visual Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   fix-bug-complete Template                      │
│                    4 Tasks, 56K Tokens                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Task 1: analyze-and-locate                                       │
│ ─────────────────────────────────────────────────────────────── │
│ Agent: general | Tokens: 14K | Retry: 3x (progressive-context)  │
│                                                                  │
│ Input Variables:                                                 │
│   • bug_description (required)                                   │
│   • error_message (optional)                                     │
│   • steps_to_reproduce (optional)                                │
│   • affected_files (optional)                                    │
│                                                                  │
│ Actions:                                                         │
│   1. metabob_search_codebase_issues (find similar bugs)          │
│   2. Read error messages and stack traces                        │
│   3. Trace execution path to root cause                          │
│   4. Check git history for recent changes                        │
│                                                                  │
│ Output: BUG_ANALYSIS.md                                          │
│   ✓ Root cause identified (file:line)                            │
│   ✓ Similar issues documented                                    │
│   ✓ Fix approach planned                                         │
│                                                                  │
│ Validation:                                                      │
│   Required: "## Bug Analysis", "### Root Cause", "**File**:"    │
│   Forbidden: TODO, TBD, FIXME, path/to/, PLACEHOLDER            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Task 2: implement-fix                                            │
│ ─────────────────────────────────────────────────────────────── │
│ Agent: general | Tokens: 16K | Retry: 4x (progressive-context)  │
│                                                                  │
│ Reads: BUG_ANALYSIS.md                                           │
│                                                                  │
│ Actions:                                                         │
│   1. Read BUG_ANALYSIS.md for root cause                         │
│   2. Fix root cause (not symptoms)                               │
│   3. Add defensive checks (null, validation, errors)             │
│   4. Add inline comments explaining fix                          │
│   5. Keep changes minimal and focused                            │
│                                                                  │
│ Output: FIX_IMPLEMENTATION.md + Code Changes                     │
│   ✓ Root cause fixed                                             │
│   ✓ Defensive measures added                                     │
│   ✓ Code follows conventions                                     │
│                                                                  │
│ Validation:                                                      │
│   Required: "## Fix Implementation", "### Files Modified"        │
│   Forbidden: console.log(), any, TODO, FIXME, HACK               │
│   Commands: npm run typecheck, npm run lint                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Task 3: test-fix                                                 │
│ ─────────────────────────────────────────────────────────────── │
│ Agent: test | Tokens: 14K | Retry: 3x (progressive-context)     │
│                                                                  │
│ Reads: BUG_ANALYSIS.md, FIX_IMPLEMENTATION.md                    │
│                                                                  │
│ Actions:                                                         │
│   1. Write bug reproduction test (would have failed before)      │
│   2. Write edge case tests (null, undefined, boundaries)         │
│   3. Write regression tests (prevent bug from returning)         │
│   4. Test existing functionality (no regressions)                │
│   5. Run full test suite                                         │
│                                                                  │
│ Output: Test Files + TEST_RESULTS.md                             │
│   ✓ All tests passing                                            │
│   ✓ Bug scenario covered                                         │
│   ✓ Edge cases covered                                           │
│   ✓ No regressions                                               │
│                                                                  │
│ Validation:                                                      │
│   Required: describe(), it(), expect(), "## Test Results"        │
│   Forbidden: it.skip, describe.skip, xit(), xdescribe()          │
│   Commands: npm test                                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Task 4: document-and-close                                       │
│ ─────────────────────────────────────────────────────────────── │
│ Agent: general | Tokens: 12K | Retry: 2x (simple)               │
│                                                                  │
│ Reads: BUG_ANALYSIS.md, FIX_IMPLEMENTATION.md, TEST_RESULTS.md  │
│                                                                  │
│ Actions:                                                         │
│   1. metabob_mark_problem_complete (document resolution)         │
│   2. metabob_annotate_component (explain fix in code)            │
│   3. Create comprehensive fix summary                            │
│   4. Document lessons learned                                    │
│   5. Suggest prevention measures                                 │
│                                                                  │
│ Output: BUG_FIX_SUMMARY.md + Metabob Annotations                 │
│   ✓ Metabob problem marked complete                              │
│   ✓ Components annotated                                         │
│   ✓ Summary complete                                             │
│   ✓ Lessons learned documented                                   │
│                                                                  │
│ Validation:                                                      │
│   Required: "## Bug Fix Summary", "### Lessons Learned"         │
│   Forbidden: TODO, TBD, PLACEHOLDER, [description]               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                        ┌──────────┐
                        │ Complete │
                        └──────────┘

═══════════════════════════════════════════════════════════════════

                      Metabob Integration Flow

┌─────────────┐       ┌──────────────┐       ┌─────────────────┐
│   Task 1    │  -->  │  Metabob     │  -->  │ Similar Issues  │
│   Analyze   │       │  Search      │       │ Context         │
└─────────────┘       └──────────────┘       └─────────────────┘

┌─────────────┐       ┌──────────────┐       ┌─────────────────┐
│   Task 4    │  -->  │  Metabob     │  -->  │ Problem Marked  │
│  Document   │       │  Mark + Ann. │       │ + Annotated     │
└─────────────┘       └──────────────┘       └─────────────────┘

═══════════════════════════════════════════════════════════════════

                         Quality Gates

Pre-Checks:
  ✓ git status --short (check working directory)

Post-Checks:
  ✓ npm run typecheck || tsc --noEmit (no TypeScript errors)
  ✓ npm test (all tests pass)

Quality Gates:
  ✓ No TypeScript errors
  ✓ No console.log in code
  ✓ No skipped tests
  ✓ All validation patterns present

═══════════════════════════════════════════════════════════════════

                      Template Characteristics

Category:        bugfix
Tasks:           4 (optimal range: 3-5)
Total Tokens:    56,000
Avg per Task:    14,000
Strategy:        Progressive-context retry (3-4 attempts)

Standalone:      Yes ✓
Composability:   Works with add-feature-complete, refactor-component

Learning:        Enabled with detailed capture
Metabob:         Fully integrated

═══════════════════════════════════════════════════════════════════
```

## Key Design Decisions

### 1. Task Granularity (4 Tasks)
- **Task 1**: Analysis + Root Cause (combined for context)
- **Task 2**: Implementation (focused execution)
- **Task 3**: Testing (quality assurance)
- **Task 4**: Documentation (knowledge capture)

**Why 4 instead of 3?** Testing deserves its own task because:
- Different agent (test specialist)
- Different skillset (testing patterns vs implementation)
- Can retry independently if tests fail
- Separates "did we fix it?" from "did we document it?"

### 2. Token Budget Allocation
- **Task 1** (14K): Needs room for Metabob results + analysis
- **Task 2** (16K): Largest - complex fixes need space for code + explanations
- **Task 3** (14K): Multiple test scenarios + test output
- **Task 4** (12K): Smallest - mostly documentation, straightforward

### 3. Retry Strategy
- **Tasks 1-3**: Progressive-context (3-4 attempts)
  - Complex tasks benefit from adding context on retry
  - Most likely to fail due to incomplete understanding
- **Task 4**: Simple (2 attempts)
  - Documentation is straightforward once work is done
  - Fewer attempts needed

### 4. Validation Philosophy
- **Required patterns**: Ensure structure and completeness
- **Forbidden patterns**: Prevent common mistakes (TODOs, debug code, skipped tests)
- **Commands**: Validate technical correctness (typecheck, tests)

### 5. Metabob Integration Points
- **Start** (Task 1): Search for similar issues → learn from past
- **End** (Task 4): Mark complete + annotate → teach for future

This creates a learning loop: past fixes inform current fixes, current fixes inform future fixes.
