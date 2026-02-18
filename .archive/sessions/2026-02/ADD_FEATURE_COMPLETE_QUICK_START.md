# add-feature-complete Quick Start

## Overview

Complete feature implementation workflow with:
- ✅ Design analysis using Metabob
- ✅ Implementation with quality checks
- ✅ Comprehensive testing
- ✅ Documentation and annotations

## Usage

```typescript
activity({
  activityId: "add-feature-complete",
  variables: {
    feature_name: "your-feature-name",
    feature_description: "What the feature does and why",
    requirements: "Functional and non-functional requirements (optional)",
    acceptance_criteria: "Measurable completion criteria (optional)"
  },
  reason: "Brief explanation"
})
```

## Task Flow

```
design-feature (16k tokens, 2 retries)
    ↓
implement-feature (16k tokens, 3 retries)
    ↓
test-feature (14k tokens, 3 retries)
    ↓
document-and-annotate (14k tokens, 2 retries)
```

**Total Budget**: ~60k tokens

## What Each Task Does

### 1. design-feature
**Creates**: `FEATURE_DESIGN.md`

- Searches for similar features with Metabob
- Analyzes existing patterns
- Designs architecture
- Plans file structure
- Identifies dependencies
- Maps error scenarios

**Output**: Complete design document with no placeholders

### 2. implement-feature
**Creates**: Feature source files (`*.ts`, `*.js`, etc.)

- Checks quality issues with Metabob
- Analyzes change impact
- Implements following design
- Uses proper TypeScript types (no `any`)
- Handles all error scenarios
- Removes debug code

**Output**: Working implementation passing typecheck

### 3. test-feature
**Creates**: Test files (`*.test.ts`, `*.spec.ts`, etc.)

- Tests success paths
- Tests error scenarios
- Tests edge cases
- Follows existing test patterns
- Mocks dependencies
- Runs tests to verify

**Output**: Comprehensive passing tests

### 4. document-and-annotate
**Creates**: Documentation files (`*.md`) and Metabob annotations

- Documents public APIs
- Provides usage examples
- Annotates key components with Metabob
- Explains design decisions
- Creates feature summary

**Output**: Complete documentation and annotations

## Validation Rules

### Design
- ✅ FEATURE_DESIGN.md exists with all sections
- ❌ No TODO, TBD, FIXME, or placeholders

### Implementation
- ✅ Source files created
- ✅ TypeScript compiles
- ❌ No console.log, any, TODO, FIXME, debugger

### Tests
- ✅ Test files exist
- ✅ Tests pass
- ❌ No skipped tests (it.skip, describe.skip)

### Documentation
- ✅ Markdown files with examples
- ❌ No placeholders

## Metabob Integration

The template uses Metabob tools to:

1. **Find similar features** before designing
2. **Check for quality issues** before implementing
3. **Analyze change impact** before modifying files
4. **Annotate components** with design decisions
5. **Suggest related changes** after implementation

## Examples

### Simple Feature
```typescript
activity({
  activityId: "add-feature-complete",
  variables: {
    feature_name: "email-validation",
    feature_description: "Email validation utility with RFC 5322 compliance"
  },
  reason: "Add email validation"
})
```

### Complex Feature with Requirements
```typescript
activity({
  activityId: "add-feature-complete",
  variables: {
    feature_name: "rate-limiter",
    feature_description: "Token bucket rate limiter with Redis backend for distributed systems",
    requirements: "Support configurable rates (req/sec), use Redis for state, handle burst traffic, provide metrics",
    acceptance_criteria: "Limits requests per configuration, works across multiple servers, recovers from Redis failures, exposes rate limit metrics"
  },
  reason: "Add distributed rate limiting"
})
```

## Retry Behavior

Each task retries on failure:

- **design-feature**: 2 attempts with progressive context
- **implement-feature**: 3 attempts with progressive context
- **test-feature**: 3 attempts with progressive context
- **document-and-annotate**: 2 attempts with progressive context

**Progressive context** = adds more guidance each retry

## Quality Checks

**Pre-activity**:
- Git status check

**Post-activity**:
- TypeScript typecheck (optional)
- Tests (optional)
- Linting (optional)

**Quality gates**:
- Syntax check (optional)
- Tests pass (optional)

*All optional to support different project setups*

## Success Criteria

Feature is complete when:
- ✅ Design document has no placeholders
- ✅ Implementation compiles without errors
- ✅ All tests pass
- ✅ Documentation has runnable examples
- ✅ Key components annotated with Metabob
- ✅ No forbidden patterns (console.log, any, TODO)

## Tips

1. **Be specific in descriptions**: Detailed descriptions help design
2. **Provide requirements**: Helps create better architecture
3. **Define acceptance criteria**: Ensures completeness
4. **Trust the process**: Each task builds on the previous
5. **Review design**: Check FEATURE_DESIGN.md before continuing

## File Outputs

After completion, expect:

```
FEATURE_DESIGN.md           # Design document
src/feature/index.ts        # Implementation
src/feature/types.ts        # Type definitions
src/feature/__tests__/      # Tests
docs/feature.md             # Documentation
FEATURE_SUMMARY.md          # Summary
```

*Actual paths depend on project structure*

## Troubleshooting

### "Design has placeholders"
- Retry will add more context
- Ensure similar features exist to learn from

### "TypeScript errors"
- Retry will fix common issues
- May need manual intervention for complex types

### "Tests failing"
- Retry will adjust tests
- Check if mocks are needed

### "Documentation incomplete"
- Retry will add missing sections
- Ensure examples are runnable

---

**Template**: add-feature-complete v1.0.0  
**Category**: feature  
**Tasks**: 4 (linear)  
**Budget**: ~60k tokens  
**Learning**: Enabled  
**Metabob**: Enabled
