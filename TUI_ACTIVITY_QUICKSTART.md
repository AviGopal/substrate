# TUI Activity Execution - Quick Start Guide

## What is it?

Execute activities directly from your TUI session using a simple `%` prefix - like running bash scripts but for structured workflows!

## Basic Usage

### Syntax

```
%<activity-name> <what you want to do>
```

### Examples

```bash
# Add a new feature
%add-feature-complete Add user authentication

# Fix a bug
%fix-bug-complete Fix the login error

# Refactor code
%refactor-with-tests Clean up database connection code

# Run any activity
%hello-world-minimal
```

## Discovery with Autocomplete

Not sure which activity to use? Start typing and see suggestions:

```bash
# Type this:
%add

# Get suggestions:
  → add-feature-complete
  → add-rest-endpoint-feature
  → add-comprehensive-logging

# Type more to narrow down:
%add-feature

# Matches:
  → add-feature-complete (best match!)
```

## How It Works

1. **You type**: `%add-feature-complete Add user auth`
2. **System validates**: Checks if activity exists
3. **Memory agent analyzes**: Looks at your recent work
4. **Variables inferred**: Guesses what files, description, etc.
5. **Activity executes**: Full workflow runs automatically

## What Gets Inferred?

The memory agent is smart! It looks at:

- Files you recently edited
- Errors you're debugging
- Your conversation history
- Metabob code quality issues
- Recent git activity

Then it fills in activity variables like:
- `featureName`, `description`
- `files` to modify
- `bugDescription`, `errorMessage`
- Whatever the activity template needs!

## Fuzzy Matching

Typos? No problem!

```bash
# You type:
%add-feat Something

# System suggests:
Did you mean:
  - %add-feature-complete
  - %add-rest-endpoint-feature
```

## Common Activities

```bash
# Feature development
%add-feature-complete <feature description>

# Bug fixing
%fix-bug-complete <bug description>

# Refactoring
%refactor-with-tests <what to refactor>

# Testing
%add-comprehensive-tests <what to test>

# Documentation
%create-documentation <what to document>

# Infrastructure
%create-subagent <agent description>
%create-activity-template <template description>
```

## Pro Tips

1. **Be descriptive**: More detail = better variable inference
   - ❌ `%add-feature-complete Add auth`
   - ✅ `%add-feature-complete Add JWT authentication for user login`

2. **Use autocomplete**: Start typing to discover activities
   - `%add` → see all "add" activities
   - `%fix` → see all "fix" activities

3. **Trust the memory agent**: It's good at guessing what you need
   - Recently edited `src/auth.ts`? It'll include that file
   - Just got a TypeError? It'll grab that error context

4. **Check for exact matches**: Activity names are case-sensitive
   - ✅ `%hello-world-minimal`
   - ❌ `%Hello-World-Minimal`

## When to Use This vs Regular Chat

**Use `%activity-name`:**
- Multi-step structured workflows
- When you know which activity to run
- Need consistent quality (tests, commits, docs)
- Repetitive tasks

**Use regular chat:**
- Quick questions
- Exploration and research
- One-off changes
- Unclear what activity fits

## Example Session

```bash
# You're working on authentication
$ edit src/auth.ts
# ... make some changes ...

# Realize you need tests
You: %add-comprehensive-tests Test authentication flow

System: Executing add-comprehensive-tests
  Variables inferred:
    - files: ["src/auth.ts"]
    - testTarget: "authentication flow"
    - coverage: "unit and integration"
  
  [Activity runs]
  ✓ Created test-auth-unit.ts
  ✓ Created test-auth-integration.ts
  ✓ All tests passing (12/12)
  ✓ Coverage: 95%

# Now commit your work
You: %commit-organized-changes Commit with organized message

System: Executing commit-organized-changes
  Variables inferred:
    - dryRun: false
    - files: ["src/auth.ts", "test-auth-unit.ts", "test-auth-integration.ts"]
  
  [Activity runs]
  ✓ Created 3 atomic commits:
    - feat: Add JWT authentication
    - test: Add auth unit tests
    - test: Add auth integration tests
```

## Troubleshooting

**Activity not found?**
- Check spelling with autocomplete
- Try fuzzy search: `%add-feat` → suggestions

**Variables wrong?**
- Add more detail in your description
- Mention specific files or error messages
- The memory agent learns from context

**Activity failed?**
- Check activity error logs
- Retry with more specific description
- Use `activity_error_inspector` tool to debug

## Next Steps

1. Try it: `%hello-world-minimal`
2. Explore: Type `%` and see what's available
3. Read: Check `TUI_ACTIVITY_EXECUTION.md` for details
4. Create: Build your own activities for common tasks!

---

**Questions?** The memory agent is always watching and learning. The more you use it, the better it gets at inferring what you need!
