# Phase 1: Step Library System - Detailed Design

## Overview

Build the **atomic step library** that enables dynamic workflow composition. This is the foundation for the entire self-improvement system.

---

## What is a "Step"?

A **step** is an atomic, reusable operation with:
- **Input contract**: What data it needs
- **Output contract**: What data it produces
- **Execution logic**: How to perform the operation
- **Metadata**: Name, description, category, tags

**Examples of Steps**:
- `read-file`: Read file contents → returns string
- `write-file`: Write string to file → returns success
- `run-command`: Execute shell command → returns output
- `analyze-code`: Analyze code structure → returns AST
- `generate-code`: Generate code from spec → returns code string
- `run-tests`: Execute test suite → returns pass/fail
- `commit-changes`: Git commit → returns commit hash

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Step Library                             │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Step Schema  │  │ Step Registry│  │ Step Executor│         │
│  │   (Zod)      │  │  (Storage)   │  │  (Runtime)   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Step Catalog │  │ Step Search  │  │ Step Tester  │         │
│  │ (50+ steps)  │  │  (Query)     │  │ (Validation) │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step Schema

```typescript
interface Step {
  // Identity
  id: string                    // Unique identifier (e.g., "read-file-v1")
  name: string                  // Human-readable name
  version: string               // Semantic version
  
  // Metadata
  description: string           // What this step does
  category: StepCategory        // filesystem | code | test | git | llm | data
  tags: string[]               // Searchable tags
  
  // Contracts
  input: {
    schema: ZodSchema           // Input validation
    example: unknown            // Example input
  }
  output: {
    schema: ZodSchema           // Output validation
    example: unknown            // Example output
  }
  
  // Execution
  executor: StepExecutor        // How to run this step
  timeout: number               // Max execution time (ms)
  retryable: boolean           // Can be retried on failure
  
  // Cost estimation
  estimatedTokens: number      // Approximate token usage
  estimatedDuration: number    // Approximate duration (ms)
  
  // Dependencies
  requires: string[]           // Required tools/capabilities
  
  // Quality
  testSuite: StepTest[]        // Validation tests
  successRate: number          // Historical success rate
  
  // Provenance
  createdAt: number
  updatedAt: number
  createdBy: "human" | "llm"
}

type StepExecutor = (input: unknown, context: ExecutionContext) => Promise<StepResult>

interface StepResult {
  success: boolean
  output?: unknown
  error?: string
  duration: number
  tokensUsed?: number
}

interface ExecutionContext {
  sessionId: string
  workingDir: string
  tools: ToolRegistry
  impulses: Record<string, Impulse>
}
```

---

## File Structure

```
repos/metabob-opencode/packages/opencode/src/step/
├── step.ts                    # Step schema and types
├── step-registry.ts           # Storage and retrieval
├── step-executor.ts           # Runtime execution
├── step-catalog.ts            # Built-in step library
├── step-search.ts             # Query and filter
├── step-tester.ts             # Validation framework
└── catalog/
    ├── filesystem-steps.ts    # File operations
    ├── code-steps.ts          # Code generation/analysis
    ├── test-steps.ts          # Testing operations
    ├── git-steps.ts           # Version control
    ├── llm-steps.ts           # LLM operations
    └── data-steps.ts          # Data transformation
```

---

## Step Catalog (Initial 50 Steps)

### Filesystem (10 steps)
1. `read-file` - Read file contents
2. `write-file` - Write contents to file
3. `append-file` - Append to file
4. `delete-file` - Delete file
5. `list-directory` - List directory contents
6. `create-directory` - Create directory
7. `copy-file` - Copy file
8. `move-file` - Move/rename file
9. `file-exists` - Check file existence
10. `get-file-info` - Get file metadata

### Code (10 steps)
11. `parse-typescript` - Parse TS to AST
12. `parse-python` - Parse Python to AST
13. `generate-typescript` - Generate TS code
14. `generate-python` - Generate Python code
15. `lint-code` - Run linter
16. `format-code` - Format code
17. `extract-function` - Extract function refactoring
18. `rename-symbol` - Rename symbol refactoring
19. `analyze-dependencies` - Analyze imports/exports
20. `find-references` - Find symbol references

### Test (10 steps)
21. `run-jest-tests` - Run Jest tests
22. `run-pytest-tests` - Run pytest tests
23. `run-test-file` - Run specific test file
24. `generate-test` - Generate test from code
25. `calculate-coverage` - Calculate test coverage
26. `run-typecheck` - Run TypeScript type checking
27. `run-linter` - Run linter checks
28. `run-integration-test` - Run integration tests
29. `setup-test-env` - Set up test environment
30. `teardown-test-env` - Tear down test environment

### Git (10 steps)
31. `git-status` - Get git status
32. `git-diff` - Get git diff
33. `git-add` - Stage files
34. `git-commit` - Create commit
35. `git-push` - Push to remote
36. `git-pull` - Pull from remote
37. `git-branch` - Create/list branches
38. `git-checkout` - Checkout branch
39. `git-log` - Get commit history
40. `git-reset` - Reset changes

### LLM (10 steps)
41. `llm-generate` - Generate text from prompt
42. `llm-analyze` - Analyze input text
43. `llm-refactor` - Suggest refactoring
44. `llm-debug` - Suggest bug fixes
45. `llm-explain` - Explain code
46. `llm-optimize` - Suggest optimizations
47. `llm-test-gen` - Generate tests
48. `llm-doc-gen` - Generate documentation
49. `llm-code-review` - Review code quality
50. `llm-summarize` - Summarize text

### Data (10 steps)
51. `transform-json` - Transform JSON data
52. `validate-schema` - Validate against schema
53. `merge-objects` - Merge data objects
54. `filter-array` - Filter array items
55. `map-array` - Map array transformation
56. `aggregate-data` - Aggregate data
57. `parse-csv` - Parse CSV data
58. `generate-csv` - Generate CSV data
59. `hash-data` - Hash data for comparison
60. `compress-data` - Compress data

---

## Implementation Plan

### Task 1: Core Infrastructure (2 days)

**1.1 Step Schema** (`step.ts`)
- Define Step interface with Zod schema
- Define StepExecutor function type
- Define ExecutionContext interface
- Define StepResult interface
- Export types and validation schemas

**1.2 Step Registry** (`step-registry.ts`)
- Storage layer (localStorage + backend sync)
- CRUD operations (create, read, update, delete)
- Version management
- Search and filter
- Import/export functionality

**1.3 Step Executor** (`step-executor.ts`)
- Runtime execution engine
- Input validation (Zod schema)
- Output validation (Zod schema)
- Error handling and retry logic
- Timeout management
- Token/duration tracking

---

### Task 2: Step Catalog (1 day)

**2.1 Filesystem Steps** (`catalog/filesystem-steps.ts`)
- Implement 10 filesystem operations
- Each step includes: schema, executor, tests
- Use existing file tools (read, write, list)

**2.2 Code Steps** (`catalog/code-steps.ts`)
- Implement 10 code operations
- Use tree-sitter for parsing
- Use LLM for generation

**2.3 Test Steps** (`catalog/test-steps.ts`)
- Implement 10 test operations
- Use bash tool for test execution

**2.4 Git Steps** (`catalog/git-steps.ts`)
- Implement 10 git operations
- Use bash tool for git commands

**2.5 LLM Steps** (`catalog/llm-steps.ts`)
- Implement 10 LLM operations
- Use session LLM invocation

**2.6 Data Steps** (`catalog/data-steps.ts`)
- Implement 10 data operations
- Pure TypeScript transformations

---

### Task 3: Testing & Validation (1 day)

**3.1 Step Tester** (`step-tester.ts`)
- Test runner for step validation
- Input/output contract verification
- Integration testing
- Performance benchmarking

**3.2 Integration Tests**
- Test each step in catalog
- Test step chaining (output → input)
- Test error handling
- Test timeout behavior

---

### Task 4: Documentation (0.5 days)

**4.1 API Documentation**
- Document Step schema
- Document each catalog step
- Provide usage examples
- Document extension patterns

**4.2 Developer Guide**
- How to create new steps
- How to test steps
- How to publish steps to registry
- Best practices

---

## Activity Template: `create-step-library-system`

```json
{
  "id": "create-step-library-system",
  "name": "Create Step Library System",
  "category": "infrastructure",
  "description": "Build atomic step library for dynamic workflow composition",
  "tasks": [
    {
      "id": "task-1",
      "subagent": "build",
      "description": "Implement core step infrastructure",
      "dependencies": [],
      "prompt": {
        "template": "Implement the step library core infrastructure:\n\n1. Create step.ts with Step schema (Zod)\n2. Create step-registry.ts with storage/CRUD\n3. Create step-executor.ts with runtime execution\n4. Create step-search.ts with query capabilities\n\nFiles to create:\n- repos/metabob-opencode/packages/opencode/src/step/step.ts\n- repos/metabob-opencode/packages/opencode/src/step/step-registry.ts\n- repos/metabob-opencode/packages/opencode/src/step/step-executor.ts\n- repos/metabob-opencode/packages/opencode/src/step/step-search.ts\n\nEnsure proper TypeScript types, Zod validation, and error handling.",
        "maxTokens": 16000
      },
      "validation": {
        "requiredFiles": [
          "repos/metabob-opencode/packages/opencode/src/step/step.ts",
          "repos/metabob-opencode/packages/opencode/src/step/step-registry.ts",
          "repos/metabob-opencode/packages/opencode/src/step/step-executor.ts",
          "repos/metabob-opencode/packages/opencode/src/step/step-search.ts"
        ],
        "commands": [
          {
            "command": "cd repos/metabob-opencode && npm run typecheck",
            "expectedPattern": "0 errors"
          }
        ]
      }
    },
    {
      "id": "task-2",
      "subagent": "build",
      "description": "Implement step catalog (60 atomic steps)",
      "dependencies": ["task-1"],
      "prompt": {
        "template": "Implement the step catalog with 60 atomic steps across 6 categories:\n\n1. Filesystem (10 steps) - read-file, write-file, etc.\n2. Code (10 steps) - parse-typescript, generate-code, etc.\n3. Test (10 steps) - run-jest-tests, calculate-coverage, etc.\n4. Git (10 steps) - git-commit, git-push, etc.\n5. LLM (10 steps) - llm-generate, llm-analyze, etc.\n6. Data (10 steps) - transform-json, validate-schema, etc.\n\nCreate separate files for each category in catalog/ directory.\nEach step must have: schema, executor, example, tests.\n\nSee PHASE1_STEP_LIBRARY_DESIGN.md for full step list.",
        "maxTokens": 20000
      },
      "validation": {
        "requiredFiles": [
          "repos/metabob-opencode/packages/opencode/src/step/catalog/filesystem-steps.ts",
          "repos/metabob-opencode/packages/opencode/src/step/catalog/code-steps.ts",
          "repos/metabob-opencode/packages/opencode/src/step/catalog/test-steps.ts",
          "repos/metabob-opencode/packages/opencode/src/step/catalog/git-steps.ts",
          "repos/metabob-opencode/packages/opencode/src/step/catalog/llm-steps.ts",
          "repos/metabob-opencode/packages/opencode/src/step/catalog/data-steps.ts"
        ],
        "commands": [
          {
            "command": "cd repos/metabob-opencode && npm run typecheck",
            "expectedPattern": "0 errors"
          }
        ]
      }
    },
    {
      "id": "task-3",
      "subagent": "test",
      "description": "Create comprehensive test suite",
      "dependencies": ["task-2"],
      "prompt": {
        "template": "Create comprehensive test suite for step library:\n\n1. Unit tests for each catalog step (60 tests)\n2. Integration tests for step chaining\n3. Error handling tests\n4. Performance benchmarks\n\nCreate test files:\n- test/step/step-executor.test.ts\n- test/step/step-registry.test.ts\n- test/step/catalog/*.test.ts\n\nAll tests must pass.",
        "maxTokens": 16000
      },
      "validation": {
        "commands": [
          {
            "command": "cd repos/metabob-opencode && npm test -- step",
            "expectedPattern": "PASS"
          }
        ]
      }
    },
    {
      "id": "task-4",
      "subagent": "general",
      "description": "Create documentation",
      "dependencies": ["task-3"],
      "prompt": {
        "template": "Create comprehensive documentation:\n\n1. API documentation (step schema, registry, executor)\n2. Step catalog reference (all 60 steps)\n3. Developer guide (how to create steps)\n4. Usage examples\n\nCreate markdown files:\n- STEP_LIBRARY_API.md\n- STEP_CATALOG_REFERENCE.md\n- STEP_DEVELOPMENT_GUIDE.md",
        "maxTokens": 12000
      },
      "validation": {
        "requiredFiles": [
          "STEP_LIBRARY_API.md",
          "STEP_CATALOG_REFERENCE.md",
          "STEP_DEVELOPMENT_GUIDE.md"
        ]
      }
    },
    {
      "id": "task-5",
      "subagent": "general",
      "description": "Commit changes with organized commits",
      "dependencies": ["task-4"],
      "prompt": {
        "template": "Create organized git commits:\n\n1. Core infrastructure (step schema, registry, executor)\n2. Step catalog (60 atomic steps)\n3. Test suite\n4. Documentation\n\nUse clear, descriptive commit messages.",
        "maxTokens": 4000
      },
      "validation": {
        "commands": [
          {
            "command": "git log -4 --oneline",
            "expectedPattern": "step"
          }
        ]
      }
    }
  ]
}
```

---

## Success Criteria

After executing `create-step-library-system` activity:

1. ✅ Step library infrastructure exists and compiles
2. ✅ 60 atomic steps implemented and tested
3. ✅ All tests pass (100% success rate)
4. ✅ Documentation complete
5. ✅ Changes committed to git
6. ✅ Can execute individual steps programmatically
7. ✅ Can chain steps (output → input)

---

## Next Steps

After Step Library System is complete:

1. **Build Dynamic Workflow Composer** (uses step library)
2. **Integrate with Activity System** (activities use steps)
3. **Enable Runtime Workflow Generation** (compose steps on-the-fly)

This is the foundation for full autonomy.

---

## Ready to Execute?

```bash
# Execute the activity
opencode activity execute create-step-library-system --reason "Build foundation for dynamic workflow composition and self-improvement"
```

Let's build the future. 🚀
