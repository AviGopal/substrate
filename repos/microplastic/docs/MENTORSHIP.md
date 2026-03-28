# Mentorship: Developing with microplastic

This guide transfers knowledge about how to effectively use microplastic for software development. microplastic is a **composite vessel agent-IDE** that gains capabilities through use.

## Core Concepts

### The Impulse-Activity Model

Everything in microplastic flows through **impulses** and **activities**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        THE FUNDAMENTAL CYCLE                            │
└─────────────────────────────────────────────────────────────────────────┘

     ┌──────────┐                                    ┌──────────┐
     │  Input   │                                    │  Output  │
     │ Impulses │─────────────▶ ACTIVITY ──────────▶│ Impulses │
     └──────────┘                                    └──────────┘
           │                         │                     │
           │                         │                     │
           ▼                         ▼                     ▼
    Context from              State Transition        New context
    previous work             (the actual work)       for next work


    IMPULSES = Data with metadata (files, traces, context)
    ACTIVITIES = Constrained transformations (templates with tasks)
```

**Key insight**: You don't write code directly. You describe goals, and microplastic finds or creates activities to achieve them. Your job is to:
1. Provide clear goals
2. Review and guide the execution
3. Help the system learn from successes and failures

---

## Working on the Codebase

### Starting a Development Session

```bash
# Navigate to your project
cd /path/to/project

# Run microplastic with a goal
microplastic "implement user authentication"

# Or use verbose mode to see more details
microplastic -v "implement user authentication"

# Dry-run to see what would happen
microplastic -d "implement user authentication"
```

### The Goal Execution Flow

When you provide a goal:

```
1. UNDERSTAND
   └── microplastic analyzes your goal
   └── Searches for matching templates (Thompson Sampling)
   └── Selects best template OR decides to improvise

2. EXECUTE
   └── Runs template tasks sequentially
   └── Each task uses LLM with tools (read, write, edit, bash)
   └── Captures execution trace for learning

3. LEARN
   └── Records success/failure
   └── Updates template statistics (α/β for Thompson Sampling)
   └── Potentially extracts new template via ribosome
```

### How to Write Good Goals

**Good goals are specific and actionable:**

```bash
# ✓ Good - specific, clear outcome
microplastic "fix the TypeScript error in src/auth/login.ts line 45"
microplastic "add a logout button to the header component"
microplastic "write tests for the UserService class"

# ✗ Bad - vague, no clear outcome
microplastic "make the code better"
microplastic "fix bugs"
microplastic "do some refactoring"
```

**Include context when helpful:**

```bash
# Provide files as context
microplastic "fix the bug described in this error log" --impulse file:logs/error.log

# Reference specific areas
microplastic "add validation to the form in src/components/SignupForm.tsx"
```

---

## Running Tests

### Basic Test Execution

```bash
# Run all tests
microplastic "run tests"

# Run specific test file
microplastic "run tests for src/auth"

# Run and fix failing tests
microplastic "run tests and fix any failures"
```

### Test-Driven Development Workflow

```bash
# 1. Write tests first
microplastic "write tests for a UserValidator class that validates email and password"

# 2. Run tests (they should fail)
microplastic "run tests for UserValidator"

# 3. Implement to make tests pass
microplastic "implement UserValidator to make the tests pass"

# 4. Refactor if needed
microplastic "refactor UserValidator for better readability"
```

### Debugging Test Failures

When tests fail, microplastic can analyze and fix:

```bash
# Let microplastic diagnose and fix
microplastic "the auth tests are failing, diagnose and fix"

# Or be more specific
microplastic "fix the timeout error in tests/auth/login.test.ts"
```

---

## Solving Problems

### The Problem-Solving Cycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     PROBLEM-SOLVING WITH MICROPLASTIC                   │
└─────────────────────────────────────────────────────────────────────────┘

    1. DESCRIBE THE PROBLEM
       │
       ▼
    ┌─────────────────┐
    │ "The login form │     ◄── Be specific about symptoms
    │  crashes when   │
    │  email is empty"│
    └────────┬────────┘
             │
             ▼
    2. LET MICROPLASTIC INVESTIGATE
       │
       ├── Reads relevant files
       ├── Analyzes code flow
       └── Identifies root cause
             │
             ▼
    3. REVIEW THE DIAGNOSIS
       │
       ├── Does it make sense?
       ├── Is anything missing?
       └── Guide if needed: "also check the validation hook"
             │
             ▼
    4. APPLY THE FIX
       │
       ├── microplastic modifies code
       └── Runs tests to verify
             │
             ▼
    5. LEARN FROM IT
       │
       ├── Execution trace captured
       └── Similar problems will be solved faster next time
```

### When Execution Fails

Failures are learning opportunities. When microplastic fails:

1. **Don't immediately retry** - First understand what went wrong
2. **Check the narrative** - The TUI shows what was attempted
3. **Provide guidance** - "The previous attempt failed because X, try Y instead"
4. **Let it recover** - microplastic can create variants and try alternatives

```bash
# After a failure, provide context
microplastic "the previous fix broke the tests, revert and try a different approach"

# Or guide toward a specific solution
microplastic "don't modify the database schema, instead add validation at the API layer"
```

---

## Finding Better Templates

### How Template Selection Works

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         THOMPSON SAMPLING                               │
└─────────────────────────────────────────────────────────────────────────┘

    Each template has success statistics: α (successes), β (failures)

    Template A: α=10, β=2  → ~83% success rate, high confidence
    Template B: α=3, β=1   → ~75% success rate, low confidence
    Template C: α=1, β=1   → 50% (prior), very low confidence

    Thompson Sampling:
    1. Sample from each template's Beta distribution
    2. Select template with highest sampled value
    3. This balances EXPLOITATION (use what works) with
       EXPLORATION (try uncertain options)

    Result: Good templates are used more, but new templates get chances
```

### Viewing Available Templates

```bash
# List all templates
microplastic templates

# Output shows:
# - Primordials (Level 0) - bootstrap templates
# - Learned templates (Level 1+) - extracted from successful executions
```

### When to Improvise vs Use Templates

- **Use templates**: For recurring tasks (tests, common bugs, standard features)
- **Improvise**: For novel problems, one-off tasks, exploration

```bash
# Force improvisation (skip template matching)
microplastic --improvise "create a completely new architecture for X"

# Prefer templates (lower improvisation threshold)
microplastic --prefer-templates "add user authentication"
```

---

## Creating Templates from Traces (Ribosome)

### The Ribosome Pattern

When microplastic successfully completes a goal (especially via improvisation), the **ribosome** can extract a reusable template:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            RIBOSOME FLOW                                │
└─────────────────────────────────────────────────────────────────────────┘

    SUCCESSFUL EXECUTION
           │
           ▼
    ┌─────────────────┐
    │ Execution Trace │     Contains: tasks, tool calls, prompts, results
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │    Ribosome     │     Analyzes trace to identify:
    │    Extractor    │     - Task boundaries
    │                 │     - Variable patterns
    │                 │     - Validation criteria
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │    Template     │     Generates template with:
    │    Generator    │     - Parameterized prompts
    │                 │     - Inferred validation
    │                 │     - Retry configuration
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │    Backend      │     Stores template for future use
    │    (activity-   │     Thompson Sampling starts with α=1, β=1
    │     api)        │
    └─────────────────┘
```

### Promoting Good Patterns

When you notice microplastic doing something well repeatedly:

```bash
# After a successful execution, check if it can be templated
microplastic "extract a template from the last execution for 'adding API endpoints'"

# Or let it happen automatically - successful improvisations
# are candidates for template extraction
```

### Template Quality Signals

Good templates have:
- **High success rate** (α >> β)
- **Consistent execution time**
- **Clear task boundaries**
- **Parameterizable variables**

Poor templates should be deprecated - Thompson Sampling will naturally deprioritize them as β increases.

---

## Configuring Boredom Activities

### What is Boredom Mode?

When you're not actively using microplastic, it can work autonomously on **boredom activities** - low-priority improvement tasks:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           BOREDOM MODE                                  │
└─────────────────────────────────────────────────────────────────────────┘

    USER ACTIVE                              USER IDLE (5+ min)
    ───────────                              ──────────────────
         │                                         │
         ▼                                         ▼
    ┌─────────────┐                         ┌─────────────┐
    │  Normal     │                         │  Boredom    │
    │  Execution  │                         │  Executor   │
    └─────────────┘                         └─────────────┘
         │                                         │
         │                                         ├── Run tests
         │                                         ├── Fix linting
         │                                         ├── Update deps
         │                                         ├── Improve docs
         │                                         └── Refactor
```

### Setting Up Boredom Activities

Create a `.microplastic/boredom.json` configuration:

```json
{
  "enabled": true,
  "idleThresholdMs": 300000,
  "activities": [
    {
      "id": "run-tests",
      "priority": 1,
      "goal": "run tests and report any failures",
      "schedule": "on_idle"
    },
    {
      "id": "fix-lint",
      "priority": 2,
      "goal": "fix any linting errors in the codebase",
      "schedule": "daily"
    },
    {
      "id": "update-docs",
      "priority": 3,
      "goal": "update documentation for any changed files",
      "schedule": "weekly",
      "maxDuration": 600000
    }
  ],
  "constraints": {
    "maxConcurrent": 1,
    "maxCostPerDay": 1.00,
    "allowedPaths": ["src/", "tests/", "docs/"],
    "forbiddenPaths": [".env", "secrets/"]
  }
}
```

### Boredom Activity Ideas

```yaml
# Code Quality
- "run tests and fix any failures"
- "fix TypeScript strict mode errors"
- "remove unused imports and variables"
- "add missing type annotations"

# Documentation
- "update README with recent changes"
- "add JSDoc comments to exported functions"
- "generate API documentation"

# Maintenance
- "check for security vulnerabilities in dependencies"
- "update outdated dependencies (minor versions only)"
- "remove dead code"

# Learning
- "analyze recent execution traces and extract templates"
- "identify common failure patterns and create preventive templates"
```

### Monitoring Boredom Activity

```bash
# Check what boredom has done
microplastic history --boredom

# See boredom activity stats
microplastic status

# Pause boredom mode
microplastic boredom pause

# Resume boredom mode
microplastic boredom resume
```

---

## Graceful Recovery

### When Things Go Wrong

microplastic is designed to fail gracefully and learn from failures:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FAILURE RECOVERY FLOW                           │
└─────────────────────────────────────────────────────────────────────────┘

    EXECUTION FAILS
           │
           ▼
    ┌─────────────────┐
    │ Failure Analyzer│     Identifies:
    │                 │     - Failure category (validation, tool, logic)
    │                 │     - Root cause
    │                 │     - Suggested fixes
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ Recovery Options│
    │                 │
    │ 1. Retry        │     Same approach, maybe transient failure
    │ 2. Create Variant│    Modify template and try again
    │ 3. Revert       │     Undo changes and try different approach
    │ 4. Investigate  │     Get more details before deciding
    │ 5. Abandon      │     Stop and let user handle it
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ User Decision   │     Choose recovery path
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ Execute Recovery│     Apply chosen strategy
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │ Record Learnings│     Update template stats
    └─────────────────┘     Thompson Sampling β += 1 for failures
```

### Reverting State

When microplastic makes changes that don't work:

```bash
# Revert to last good state
microplastic "revert the last changes and try a different approach"

# Or be specific about what to revert
microplastic "revert changes to src/auth/ and use JWT instead of sessions"
```

### The Variant Pattern

When a template fails, microplastic can create a **variant** - a modified version:

```
ORIGINAL TEMPLATE (fix-null-pointer)
         │
         │ Fails on edge case
         ▼
VARIANT TEMPLATE (fix-null-pointer-v2)
         │
         │ Modified prompt: "also check for undefined"
         │ Modified validation: more lenient
         │
         ▼
    If successful, variant competes with original via Thompson Sampling
```

### Learning from Failures

Failures update the system:

1. **Template stats**: β increases, lowering template's selection probability
2. **Failure patterns**: Recorded for future recognition
3. **Variant creation**: New approaches are tried
4. **Context capture**: What went wrong is remembered

```bash
# After failure, help the system learn
microplastic "the previous approach failed because the API returns paginated results, not all at once"

# This context becomes part of the execution trace
# Future similar tasks may use this learning
```

---

## Best Practices

### 1. Start Small, Build Up

```bash
# Start with simple goals
microplastic "add a console.log to track the auth flow"

# As templates improve, tackle bigger goals
microplastic "implement OAuth2 authentication with Google"
```

### 2. Review Before Committing

```bash
# Always review what microplastic did
git diff

# Then commit with context
git add -p  # Interactive staging
git commit -m "feat(auth): add OAuth2 support

Implemented by microplastic using primordial:develop-feature template"
```

### 3. Provide Feedback

```bash
# After success
microplastic "that worked perfectly, the approach of using middleware was good"

# After partial success
microplastic "the core logic is right but it needs error handling"

# After failure
microplastic "that didn't work because X, try Y instead"
```

### 4. Let the System Learn

- Don't manually fix things microplastic could learn to fix
- Let failures happen (within reason) - they're learning signals
- Review extracted templates to ensure quality

### 5. Trust but Verify

microplastic is powerful but not infallible:
- Review generated code for security issues
- Run tests before deploying
- Check that changes align with project standards

---

## Quick Reference

```bash
# Run a goal
microplastic "your goal here"

# Dry run (see what would happen)
microplastic -d "your goal"

# Verbose mode
microplastic -v "your goal"

# List templates
microplastic templates

# View history
microplastic history

# Check status
microplastic status

# Configure boredom
vim .microplastic/boredom.json
```

---

## The Philosophy

microplastic embodies the **process-of-becoming** - continuous transformation through use:

1. **Templates are not static** - They evolve through Thompson Sampling
2. **Failures are valuable** - They're learning signals, not just errors
3. **Improvisation is creative** - When no template fits, invent one
4. **The system learns** - Every execution improves future executions

Your role as a developer is to **guide the becoming** - provide goals, review results, and help the system learn. Over time, microplastic becomes increasingly capable at your specific codebase and workflows.
