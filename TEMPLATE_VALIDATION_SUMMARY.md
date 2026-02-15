# Activity Template Validation: add-feature-complete

## Validation Results ✅

### JSON Syntax
- ✅ Valid JSON (jq empty passed)

### Task Count
- ✅ Task count: **4 tasks** (within 3-7 range, optimal 3-5 range)

### Required Properties
- ✅ All tasks have validation
- ✅ All tasks have retry configuration
- ✅ All tasks have proper dependencies

### Task Structure
```json
[
  {
    "id": "design-feature",
    "dependencies": []
  },
  {
    "id": "implement-feature",
    "dependencies": ["design-feature"]
  },
  {
    "id": "test-feature",
    "dependencies": ["implement-feature"]
  },
  {
    "id": "document-and-annotate",
    "dependencies": ["test-feature"]
  }
]
```

**Dependency Graph**: Linear (design → implement → test → document)

### Token Budgets
| Task | Max Tokens | Retry Attempts |
|------|------------|----------------|
| design-feature | 16,000 | 2 |
| implement-feature | 16,000 | 3 |
| test-feature | 14,000 | 3 |
| document-and-annotate | 14,000 | 2 |

**Total Budget**: 60,000 tokens

### Template Metadata
- **ID**: add-feature-complete
- **Name**: Add Feature Complete
- **Category**: feature
- **Metabob Integration**: ✅ Enabled
- **Learning Mode**: ✅ Enabled
- **Standalone**: ✅ Yes

## Task Breakdown

### Task 1: design-feature
**Purpose**: Analyze codebase patterns and design feature architecture

**Key Features**:
- Uses Metabob tools (`metabob_search_codebase_issues`, `metabob_get_priority_issues`)
- Analyzes existing patterns before designing
- Performs change impact analysis
- Creates comprehensive FEATURE_DESIGN.md

**Validation**:
- Required files: `FEATURE_DESIGN.md`
- Required patterns: 13 section headers
- Forbidden patterns: TODO, TBD, FIXME, placeholders
- Commands: None

**Retry**: progressive-context (2 attempts)

### Task 2: implement-feature
**Purpose**: Implement feature following design with proper types and error handling

**Key Features**:
- Checks quality issues with Metabob
- Analyzes change impact before modifying files
- Enforces TypeScript best practices (no `any`)
- Removes debug code (console.log)
- Validates with typecheck and lint

**Validation**:
- Required files: `*.ts`, `*.js`, `*.tsx`, `*.jsx`
- Required patterns: exports, type definitions
- Forbidden patterns: console.log, any, TODO, FIXME, debugger
- Commands: typecheck, lint

**Retry**: progressive-context (3 attempts)

### Task 3: test-feature
**Purpose**: Write comprehensive unit and integration tests

**Key Features**:
- Tests success paths, error scenarios, edge cases
- Follows existing test patterns
- Uses proper mocking
- No skipped tests allowed
- Runs tests to verify

**Validation**:
- Required files: `*.test.{ts,js,tsx,jsx}`, `*.spec.{ts,js,tsx,jsx}`
- Required patterns: describe, it, expect, test categories
- Forbidden patterns: it.skip, describe.skip, xit, xdescribe, TODO
- Commands: run-tests

**Retry**: progressive-context (3 attempts)

### Task 4: document-and-annotate
**Purpose**: Create documentation and annotate with Metabob

**Key Features**:
- Documents all public APIs with examples
- Uses `metabob_annotate_component` for key components
- Uses `metabob_suggest_related_changes` to find related work
- Creates feature summary
- Provides runnable examples

**Validation**:
- Required files: `*.md`
- Required patterns: Documentation sections, code examples
- Forbidden patterns: TODO, TBD, FIXME, placeholders
- Commands: None

**Retry**: progressive-context (2 attempts)

## Metabob Integration

The template uses Metabob throughout the workflow:

### Task 1 (Design)
- `metabob_search_codebase_issues` - Find similar features
- `metabob_get_priority_issues` - Check for existing issues
- Pattern analysis for design decisions

### Task 2 (Implementation)
- `metabob_search_codebase_issues` - Avoid known quality issues
- `metabob_analyze_change_impact` - Understand dependencies

### Task 4 (Documentation)
- `metabob_annotate_component` - Document design decisions
- `metabob_suggest_related_changes` - Find related files

## Quality Gates

### Integration Checks
**Pre-checks**:
- `git status` - Check working directory state

**Post-checks**:
- Typecheck (optional)
- Tests (optional)
- Lint (optional)

**Quality Gates**:
- Syntax check (optional)
- Tests pass (optional)

*All checks are optional to support different project setups*

## Composition

**Standalone**: Yes (can run independently)

**Composes With**:
- `add-integration-tests` - Add E2E tests after feature
- `add-database-migration` - Add schema changes before feature
- `add-rest-endpoint` - Add REST endpoints as part of feature

## Example Usage

### User Authentication
```typescript
activity({
  activityId: "add-feature-complete",
  variables: {
    feature_name: "user-authentication",
    feature_description: "Complete user authentication system with JWT tokens, login/logout, session management, and password hashing",
    requirements: "Support email/password login, JWT token generation, refresh tokens, secure password hashing with bcrypt, session timeout after 24 hours",
    acceptance_criteria: "Users can login with email/password, receive JWT token, access protected routes with token, logout invalidates tokens, passwords are never stored in plain text"
  },
  reason: "Implement complete authentication feature"
})
```

### File Upload
```typescript
activity({
  activityId: "add-feature-complete",
  variables: {
    feature_name: "file-upload",
    feature_description: "File upload system supporting images and documents with validation, cloud storage, and retrieval",
    requirements: "Support jpg, png, pdf formats up to 10MB, validate file types, store in cloud (S3/GCS), return download URLs, handle upload errors gracefully",
    acceptance_criteria: "Files upload successfully, invalid files rejected with clear errors, files stored securely, download URLs work, failed uploads don't leave orphaned files"
  },
  reason: "Implement file upload feature with validation"
})
```

## Learning Configuration

**Capture Strategy**: detailed

**Feedback Points**: All 4 tasks have metrics and improvement hints

**Tracked Metrics**:
- Patterns analyzed
- Design completeness
- Files created
- Type errors
- Test coverage
- Documentation quality
- Annotation quality

## Summary

✅ **All validation checks passed**

The `add-feature-complete` template is:
- Syntactically valid JSON
- Has optimal task count (4 tasks)
- Has proper linear dependencies
- Has comprehensive validation for all tasks
- Has retry configuration for all tasks
- Uses appropriate token budgets (8k-16k per task)
- Integrates Metabob throughout the workflow
- Includes learning and composition metadata
- Provides concrete examples

**Ready for registration and testing.**

---

*Generated: 2026-02-14*
