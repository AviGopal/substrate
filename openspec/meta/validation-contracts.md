# Validation Contracts: OpenSpec Format Requirements

**Purpose:** Define what every OpenSpec document must include for executability
**Status:** DESIGN SPECIFICATION (not yet enforced)
**Last Updated:** 2026-03-23

## Overview

For the closed-loop to work (OpenSpec ↔ MiniBob), specifications must be machine-readable, verifiable, and executable. This document defines the contract that all OpenSpec documents must satisfy.

**Key Principle:** A spec is only useful if it can be compiled to an activity template and validated against runtime behavior.

## Required Sections

Every OpenSpec document MUST include these sections:

### 1. Metadata (Required)

**Purpose:** Identify the spec and track versions.

**Format:**
```markdown
---
spec_id: unique-identifier
spec_version: 1.0
created_at: 2026-03-23T10:00:00Z
updated_at: 2026-03-23T10:00:00Z
status: draft | active | deprecated
category: feature | bugfix | refactor | infrastructure | analysis
---
```

**Required Fields:**
- `spec_id`: Unique identifier (kebab-case, no spaces)
- `spec_version`: Semantic version (major.minor format)
- `created_at`: ISO 8601 timestamp
- `status`: Current lifecycle state
- `category`: Aligns with activity categories

**Optional Fields:**
- `updated_at`: Last modification timestamp
- `author`: Who created the spec
- `related_specs`: Dependencies on other specs
- `compiled_template_id`: Link to compiled activity template

**Example:**
```markdown
---
spec_id: user-authentication
spec_version: 1.0
created_at: 2026-03-23T10:00:00Z
status: active
category: feature
---
```

---

### 2. Functional Requirements (Required)

**Purpose:** Define WHAT must be built/changed.

**Format:** Markdown checklist with clear, testable requirements.

```markdown
## Functional Requirements

- [ ] Create User model in src/models/user.ts with password hashing (bcrypt)
- [ ] Add POST /login endpoint returning JWT token
- [ ] Implement authentication middleware for protected routes
- [ ] Add password reset flow with email verification
```

**Requirements for Each Item:**
- **Testable:** Can verify objectively (not subjective)
- **Specific:** Includes file paths, function names, or concrete artifacts
- **Atomic:** One requirement per line (don't combine)
- **Observable:** Can be detected in runtime behavior

**Good Examples:**
```markdown
- [ ] Add GET /hello endpoint returning {"message": "Hello, World!"}
- [ ] Create file src/utils/hash.ts with hashPassword function
- [ ] Update package.json to include bcrypt dependency
```

**Bad Examples (Too Vague):**
```markdown
- [ ] Make authentication better (not testable)
- [ ] Improve performance (not specific)
- [ ] Fix bugs (not observable)
```

---

### 3. Performance Requirements (Required)

**Purpose:** Define performance thresholds for cost, duration, quality.

**Format:** Structured metrics with thresholds.

```markdown
## Performance Requirements

### Cost
- Total implementation cost: < $0.50 (compilation + execution)
- Per-execution cost: < $0.10 (after template created)

### Duration
- Implementation time: < 10 minutes
- Runtime response time: < 200ms (p95)

### Quality
- Test coverage: > 80% for authentication module
- Code complexity: Cyclomatic complexity < 10 per function
```

**Required Metrics:**
- **Cost:** Dollar amount (LLM API costs)
- **Duration:** Milliseconds or minutes
- **Quality:** Coverage, complexity, or other measurable quality metric

**Threshold Format:**
- Use comparison operators: `<`, `>`, `<=`, `>=`, `==`
- Include units: USD, ms, minutes, percentage
- Specify percentile for latency: p50, p95, p99

**Good Examples:**
```markdown
- Login response time: < 200ms (p95)
- Password hashing: < 100ms
- Implementation cost: < $0.50
- Test coverage: > 80%
```

**Bad Examples:**
```markdown
- Fast enough (no number)
- Cheap (no threshold)
- High quality (not measurable)
```

---

### 4. Validation Rules (Required)

**Purpose:** Define HOW to verify requirements are met.

**Format:** Tests, patterns, files, or commands to check.

```markdown
## Validation Rules

### Required Files
- src/models/user.ts (User model)
- src/routes/auth.ts (Authentication routes)
- test/auth.test.ts (Test suite)

### Required Patterns
- User model must include: `bcrypt`, `hashPassword`
- Login endpoint must include: `POST /login`, `jwt.sign`
- Tests must include: `describe('authentication'`, `expect(`

### Forbidden Patterns
- No plaintext passwords: forbid `password:`, `pwd:`
- No hardcoded secrets: forbid `api_key = "`, `secret = "`

### Commands to Run
- npm test -- test/auth.test.ts (must pass)
- npm run lint src/models/user.ts (must pass)
- curl http://localhost:8080/login (must return 200 or 400)
```

**Validation Types:**

**1. File Validation:**
```markdown
### Required Files
- path/to/file.ts (description)
```

**2. Pattern Validation:**
```markdown
### Required Patterns
- File must contain: `regex pattern`

### Forbidden Patterns
- File must NOT contain: `regex pattern`
```

**3. Command Validation:**
```markdown
### Commands to Run
- command --args (expected: success/failure/specific output)
```

**4. Test Validation:**
```markdown
### Test Suites
- test/suite.test.ts (all tests must pass)
```

---

### 5. Drift Thresholds (Required)

**Purpose:** Define acceptable variance from spec.

**Format:** Percentage or absolute variance allowed.

```markdown
## Drift Thresholds

### Functional Requirements
- Allowed drift: 0% (all requirements must be met)

### Performance Requirements
- Cost variance: ± 20% acceptable
- Duration variance: ± 10% acceptable
- Quality variance: ± 5% acceptable

### Validation Rules
- Test failures: 0 allowed (all tests must pass)
- Pattern matches: 100% required (no missing patterns)
```

**Threshold Format:**
- Percentage: `± X%` (symmetric variance)
- Absolute: `+X / -Y` (asymmetric variance)
- Zero tolerance: `0%` or `0 allowed`

**Drift Classification:**
```
drift < threshold → PASS (within tolerance)
threshold ≤ drift < 2×threshold → DRIFT (warning, may need realignment)
drift ≥ 2×threshold → FAIL (critical, realignment required)
```

**Example:**
```markdown
Cost threshold: ± 20%

Actual cost: $0.40, Expected: $0.50
Drift: -20% → PASS (within threshold)

Actual cost: $0.55, Expected: $0.50
Drift: +10% → PASS (within threshold)

Actual cost: $0.65, Expected: $0.50
Drift: +30% → DRIFT (warning)

Actual cost: $0.80, Expected: $0.50
Drift: +60% → FAIL (critical)
```

---

## Optional Sections

These sections enhance the spec but aren't required for compilation.

### 6. Context (Optional but Recommended)

**Purpose:** Explain WHY this spec exists.

**Format:**
```markdown
## Context

### Problem Statement
Users currently cannot authenticate to the system. All endpoints are public.

### Goals
- Secure sensitive endpoints
- Enable user-specific data access
- Comply with security audit requirements

### Non-Goals
- OAuth integration (future work)
- Multi-factor authentication (future work)
```

---

### 7. Architecture Notes (Optional)

**Purpose:** Guide implementation approach.

**Format:**
```markdown
## Architecture Notes

### Technology Choices
- bcrypt for password hashing (industry standard)
- JWT for session tokens (stateless)
- Express middleware for route protection

### Design Decisions
- Passwords hashed with salt rounds = 10
- JWT expiry = 24 hours
- Refresh tokens not implemented (v1)

### Security Considerations
- Never log passwords or tokens
- Rate limit login endpoint (10 requests/minute)
- Validate JWT signature on every request
```

---

### 8. Dependencies (Optional)

**Purpose:** Link to related specs or requirements.

**Format:**
```markdown
## Dependencies

### Requires (must exist before this spec)
- user-database-schema.md (User table must exist)

### Blocks (must complete before these specs)
- user-profile-management.md (needs authentication first)
- admin-dashboard.md (needs authentication first)

### Related
- password-reset-flow.md (optional enhancement)
```

---

### 9. Examples (Optional but Recommended)

**Purpose:** Show concrete usage examples.

**Format:**
```markdown
## Examples

### Successful Login
```bash
curl -X POST http://localhost:8080/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "secret123"}'

# Expected Response (200 OK):
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123",
    "email": "user@example.com"
  }
}
```

### Failed Login (Invalid Credentials)
```bash
curl -X POST http://localhost:8080/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "wrongpassword"}'

# Expected Response (401 Unauthorized):
{
  "error": "Invalid credentials"
}
```
```

---

## Compilation Metadata

When a spec is compiled to an activity template, metadata is embedded.

### Format

```json
{
  "id": "implement-user-auth-from-spec",
  "category": "feature",
  "metadata": {
    "compiledFrom": "specs/user-authentication.md",
    "specId": "user-authentication",
    "specVersion": "1.0",
    "compiledAt": "2026-03-23T10:00:00Z",
    "compilationMethod": "compile-spec-to-activity",
    "compilerVersion": "1.0"
  },
  "tasks": [...]
}
```

**Fields:**
- `compiledFrom`: Path to source spec
- `specId`: From spec metadata
- `specVersion`: From spec metadata
- `compiledAt`: Timestamp of compilation
- `compilationMethod`: Meta-activity used
- `compilerVersion`: Compilation logic version

**Purpose:**
- Traceability: Link template back to spec
- Versioning: Track which spec version was compiled
- Debugging: Identify compilation issues
- Learning: Measure compilation success rates

---

## Compliance Report Format

When validation compares runtime vs spec, a compliance report is generated.

### Format

```json
{
  "reportId": "report-456",
  "specPath": "specs/user-authentication.md",
  "specId": "user-authentication",
  "specVersion": "1.0",
  "executionId": "exec-123",
  "timestamp": "2026-03-23T10:05:00Z",
  "status": "PASS" | "DRIFT" | "FAIL",

  "compliance": {
    "functional": {
      "status": "PASS" | "DRIFT" | "FAIL",
      "checks": [
        {
          "requirement": "Create User model with bcrypt",
          "met": true,
          "evidence": "File src/models/user.ts contains 'bcrypt' and 'hashPassword'"
        },
        {
          "requirement": "Add POST /login endpoint",
          "met": true,
          "evidence": "File src/routes/auth.ts contains 'POST /login' and 'jwt.sign'"
        }
      ]
    },

    "performance": {
      "status": "PASS" | "DRIFT" | "FAIL",
      "metrics": [
        {
          "name": "Implementation cost",
          "expected": {"operator": "<", "value": 0.50, "unit": "USD"},
          "actual": 0.38,
          "drift": -24,
          "status": "PASS"
        },
        {
          "name": "Implementation time",
          "expected": {"operator": "<", "value": 600000, "unit": "ms"},
          "actual": 420000,
          "drift": -30,
          "status": "PASS"
        }
      ]
    },

    "validation": {
      "status": "PASS" | "DRIFT" | "FAIL",
      "rules": [
        {
          "type": "file",
          "file": "src/models/user.ts",
          "exists": true
        },
        {
          "type": "pattern",
          "pattern": "bcrypt",
          "file": "src/models/user.ts",
          "found": true
        },
        {
          "type": "forbidden",
          "pattern": "password:",
          "file": "src/models/user.ts",
          "found": false
        },
        {
          "type": "command",
          "command": "npm test -- test/auth.test.ts",
          "exitCode": 0,
          "passed": true
        }
      ]
    }
  },

  "summary": {
    "totalRequirements": 4,
    "metRequirements": 4,
    "functionalDrift": 0,
    "performanceDrift": -27,
    "overallDrift": -13.5
  },

  "recommendations": [
    "All functional requirements met",
    "Performance under budget (good)",
    "All validation rules passed"
  ]
}
```

**Status Values:**
- `PASS`: All requirements met, drift within thresholds
- `DRIFT`: Requirements met but drift exceeds thresholds (warning)
- `FAIL`: One or more requirements not met (critical)

**Drift Calculation:**
```typescript
drift = ((actual - expected) / expected) × 100

// For "<" operator
expected = 0.50, actual = 0.38
drift = ((0.38 - 0.50) / 0.50) × 100 = -24%

// For ">" operator
expected = 80, actual = 85
drift = ((85 - 80) / 80) × 100 = +6.25%
```

---

## How Drift is Measured

### Functional Drift

**Definition:** Percentage of requirements not met.

**Calculation:**
```typescript
functionalDrift = (unmetRequirements / totalRequirements) × 100

// Example
totalRequirements = 4
metRequirements = 3
functionalDrift = ((4 - 3) / 4) × 100 = 25%
```

**Thresholds:**
```
drift = 0% → PASS (all requirements met)
drift > 0% → FAIL (some requirements not met)
```

**Note:** Functional requirements typically have 0% drift tolerance.

### Performance Drift

**Definition:** Percentage deviation from performance threshold.

**Calculation:**
```typescript
performanceDrift = ((actual - threshold) / threshold) × 100

// Example: Cost
threshold = 0.50 USD, actual = 0.65 USD
drift = ((0.65 - 0.50) / 0.50) × 100 = +30%

// Example: Duration
threshold = 200ms, actual = 230ms
drift = ((230 - 200) / 200) × 100 = +15%
```

**Thresholds (Example):**
```
drift ≤ 10% → PASS (within tolerance)
10% < drift ≤ 20% → DRIFT (warning)
drift > 20% → FAIL (critical)
```

### Overall Drift

**Definition:** Weighted average of all drift measurements.

**Calculation:**
```typescript
overallDrift = (
  (functionalDrift × functionalWeight) +
  (performanceDrift × performanceWeight) +
  (validationDrift × validationWeight)
) / (functionalWeight + performanceWeight + validationWeight)

// Default weights
functionalWeight = 3 (most important)
performanceWeight = 1
validationWeight = 2

// Example
functionalDrift = 0% (all met)
performanceDrift = +15% (slightly over budget)
validationDrift = 0% (all rules passed)

overallDrift = ((0×3) + (15×1) + (0×2)) / (3+1+2)
             = 15 / 6 = +2.5%
```

**Status Based on Overall Drift:**
```
drift ≤ 5% → PASS
5% < drift ≤ 15% → DRIFT
drift > 15% → FAIL
```

---

## Example: Complete OpenSpec

```markdown
---
spec_id: user-authentication
spec_version: 1.0
created_at: 2026-03-23T10:00:00Z
status: active
category: feature
---

# OpenSpec: User Authentication

## Context

### Problem Statement
Users currently cannot authenticate to the system. All endpoints are public.

### Goals
- Secure sensitive endpoints
- Enable user-specific data access

## Functional Requirements

- [ ] Create User model in src/models/user.ts with password hashing (bcrypt)
- [ ] Add POST /login endpoint returning JWT token
- [ ] Implement authentication middleware for protected routes
- [ ] Add tests in test/auth.test.ts

## Performance Requirements

### Cost
- Total implementation cost: < $0.50

### Duration
- Implementation time: < 10 minutes
- Login response time: < 200ms (p95)

### Quality
- Test coverage: > 80% for authentication module

## Validation Rules

### Required Files
- src/models/user.ts (User model)
- src/routes/auth.ts (Authentication routes)
- test/auth.test.ts (Test suite)

### Required Patterns
- User model must include: `bcrypt`, `hashPassword`
- Login endpoint must include: `POST /login`, `jwt.sign`

### Forbidden Patterns
- No plaintext passwords: forbid `password:`, `pwd:`

### Commands to Run
- npm test -- test/auth.test.ts (must pass)

## Drift Thresholds

### Functional Requirements
- Allowed drift: 0% (all requirements must be met)

### Performance Requirements
- Cost variance: ± 20% acceptable
- Duration variance: ± 10% acceptable
- Quality variance: ± 5% acceptable

## Examples

### Successful Login
\`\`\`bash
curl -X POST http://localhost:8080/login \
  -d '{"email": "user@example.com", "password": "secret123"}'

# Expected Response (200 OK):
{"token": "eyJ...", "user": {"id": "123", "email": "user@example.com"}}
\`\`\`
```

---

## Validation Checklist

Before a spec can be compiled, verify:

- ✅ Metadata section exists with required fields
- ✅ Functional requirements list is non-empty and testable
- ✅ Performance requirements include cost/duration/quality thresholds
- ✅ Validation rules specify files, patterns, or commands
- ✅ Drift thresholds defined for each requirement category
- ✅ All requirements use clear, objective language
- ✅ Thresholds include units and comparison operators
- ✅ No subjective requirements ("better", "faster", "cleaner")

**Compilation should FAIL if any required section is missing or malformed.**

---

## Evolution and Versioning

### When to Update a Spec

**Increment Minor Version (1.0 → 1.1):**
- Add new functional requirements
- Adjust performance thresholds (minor changes)
- Add validation rules
- Clarify existing requirements (no behavior change)

**Increment Major Version (1.0 → 2.0):**
- Remove functional requirements
- Change behavior significantly
- Replace validation approach
- Incompatible with previous version

### Spec Lifecycle States

```
draft → active → deprecated
```

**draft:** Being written, not ready for compilation
**active:** Ready for compilation and validation
**deprecated:** Replaced by newer version, keep for history

### Version Control

Store specs in git with version history:
```
specs/
  user-authentication.md (latest version)
  archive/
    user-authentication-v1.0.md
    user-authentication-v1.1.md
```

---

## References

**Related Documentation:**
- `closed-loop-architecture.md` - How specs are used in closed-loop
- `reliability-roadmap.md` - Phases to implement validation
- `meta-activities-catalog.md` - compile-spec-to-activity details
- `domain-mappings.md` - Validation domain

**Implementation (Future):**
- `repos/minibob/templates/meta/compile-spec-to-activity.json` - Spec compiler
- `repos/minibob/templates/meta/validate-spec-compliance.json` - Validator
- `repos/metabob-activity-api/src/routes/validation.ts` - Validation endpoints (not created)
