# Red Team Activities (Inverse Bias)

Security testing activities with **inverse success criteria**: they succeed when they find vulnerabilities.

## Principle: Inverse Bias Learning

Normal activities:
- Success = task completed correctly
- Thompson Sampling boosts templates that succeed

Red team activities:
- Success = finding vulnerabilities (system failed the test)
- Thompson Sampling boosts templates that find flaws
- Creates remediation tasks for target vessels

## The Virtuous Cycle

```
1. inspect finds vulnerability
   → inspect template boosted (good at finding)
   → creates fix task for target vessel

2. target vessel fixes vulnerability
   → fix template boosted (good at fixing)
   → marks vulnerability as fixed

3. inspect re-tests
   → confirms fix works
   → updates security posture

4. inspect explores new attack vector
   → repeat cycle
```

**Result**: Both vessels improve through adversarial co-evolution.

## Activities

### `inspect-unauthorized-access.json`
**Target**: respect vessel authentication/authorization
**Attack Vectors**:
- No authentication (missing auth headers)
- Fake vessel identity (spoofed identity headers)
- Expired JWT tokens

**Success Criteria**: Finding ways to access secrets without proper authorization

**Gradient Scores** (estimated):
- Determinism: 90/100 (bash/curl for all testing)
- LLM Size: 100/100 (Haiku sufficient)
- Token Efficiency: 85/100 (2000-3000 tokens)
- Execution Speed: 90/100 (<15 seconds)

**Creates**: `fix-task-unauthorized-access.json` with remediation steps

---

### `inspect-secret-leakage.json`
**Target**: All secret storage locations
**Attack Vectors**:
- Secrets in application logs
- Secrets in environment variables
- Secrets in git commit history

**Success Criteria**: Finding secrets exposed in unsafe locations

**Gradient Scores** (estimated):
- Determinism: 95/100 (grep/regex pattern matching)
- LLM Size: 100/100 (Haiku sufficient)
- Token Efficiency: 80/100 (3000-4000 tokens)
- Execution Speed: 85/100 (15-30 seconds with git scan)

**Creates**: `fix-task-secret-leakage.json` with urgent rotation and scrubbing steps

---

### `inspect-weak-encryption.json`
**Target**: respect vessel cryptographic implementation
**Attack Vectors**:
- Plaintext storage (unencrypted secrets in DB)
- Weak TLS versions (TLS 1.0, 1.1)
- Weak cipher suites (DES, RC4, MD5)
- Hardcoded encryption keys
- Missing key rotation

**Success Criteria**: Finding cryptographic weaknesses

**Gradient Scores** (estimated):
- Determinism: 85/100 (openssl + curl testing)
- LLM Size: 100/100 (Haiku sufficient)
- Token Efficiency: 85/100 (2500-3500 tokens)
- Execution Speed: 80/100 (20-40 seconds with TLS testing)

**Creates**: `fix-task-crypto.json` with compliance-driven remediation

---

## Activity Structure

All red team activities follow this pattern:

```json
{
  "activity_id": "inspect-*",
  "learning_mode": "inverse",
  "success_when": "vulnerability_found",
  "tasks": [
    {
      "id": "test-attack-vector-1",
      "prompt": {
        "template": "Attempt exploit...\nif [ $SUCCESS ]; then\n  echo 'FOUND: true' > /tmp/vulnerability-found.txt\n  cat > /tmp/vulnerability-*.json <<EOF\n  {...vulnerability details...}\nEOF\nfi"
      }
    },
    {
      "id": "compile-report",
      "prompt": {
        "template": "Aggregate findings, create fix tasks"
      }
    }
  ],
  "outcome_scoring": {
    "type": "inverse",
    "score_formula": "vulnerabilities_found * severity_weight"
  }
}
```

## Key Features

### 1. Inverse Success Criteria
- Finding vulnerabilities = success
- `FOUND: true` when exploits work
- Validation checks for vulnerability files

### 2. Structured Vulnerability Reports
```json
{
  "type": "unauthorized_access" | "secret_leakage" | "weak_encryption",
  "severity": "critical" | "high" | "medium" | "low",
  "attack_vector": "specific_test_that_found_it",
  "description": "Human-readable explanation",
  "evidence": { "data": "from test" },
  "remediation": ["step 1", "step 2"]
}
```

### 3. Automatic Fix Task Creation
```json
{
  "task_id": "fix_<uuid>",
  "priority": "critical",
  "created_by": "inspect-<activity>",
  "assigned_to": "respect",
  "goal": "Fix vulnerability XYZ",
  "remediation_steps": [...],
  "verification": "Re-run inspect activity"
}
```

### 4. High Determinism
- All testing via bash/curl/grep/openssl
- No LLM reasoning for vulnerability detection
- Pattern matching for secrets (regex)
- HTTP status codes for access control

### 5. Severity-Weighted Scoring
```typescript
score = vulnerabilities_found * severity_weight

severity_weights = {
  critical: 10,
  high: 7,
  medium: 4,
  low: 1
}
```

## Thompson Sampling Integration

The backend's Thompson Sampling algorithm handles inverse bias:

```typescript
function updateBayesianPriors(outcome: ActivityOutcome) {
  if (outcome.learning_mode === "inverse") {
    if (outcome.metrics.vulnerabilities_found > 0) {
      // Boost template - good at finding flaws
      incrementSuccesses(outcome.activity_id)

      // Create fix tasks
      createRemediationTasks(outcome)
    }
  } else {
    // Normal bias: success = things work
    if (outcome.success) {
      incrementSuccesses(outcome.activity_id)
    }
  }
}
```

## Usage in Boredom System

Red team activities run autonomously via boredom queue:

```json
{
  "id": "boredom-redteam-001",
  "templateId": "inspect-unauthorized-access",
  "priority": "high",
  "schedule": "daily",
  "variables": {
    "RESPECT_ENDPOINT": "http://respect:8082",
    "TEST_SECRET_ID": "test_secret_001"
  }
}
```

## Compliance Mapping

### PCI DSS 4.0
- **Requirement 3.5.1**: Strong cryptography (inspect-weak-encryption)
- **Requirement 8.2**: Unique authentication (inspect-unauthorized-access)
- **Requirement 10.2**: Audit logging (all inspect activities)

### OWASP Top 10
- **A02:2021 - Cryptographic Failures** (inspect-weak-encryption)
- **A01:2021 - Broken Access Control** (inspect-unauthorized-access)
- **A05:2021 - Security Misconfiguration** (inspect-secret-leakage)

### NIST Cybersecurity Framework
- **ID.RA-3**: Internal vulnerabilities identified (all inspect activities)
- **PR.DS-1**: Data-at-rest protection (inspect-weak-encryption)
- **PR.AC-4**: Access permissions managed (inspect-unauthorized-access)

## Expanding the Test Suite

To add new red team activities:

1. **Identify attack vector**: What could go wrong?
2. **Define inverse success**: When does the test "succeed"?
3. **Make it deterministic**: Use bash/curl, not LLM reasoning
4. **Structure the report**: JSON with severity, evidence, remediation
5. **Create fix tasks**: What should the target vessel do?
6. **Mark learning mode**: `"learning_mode": "inverse"`

### Example: Test Secret Rotation Failure

```json
{
  "activity_id": "inspect-rotation-failure",
  "learning_mode": "inverse",
  "success_when": "rotation_breaks_system",
  "tasks": [
    {
      "id": "trigger-rotation",
      "prompt": {
        "template": "Force secret rotation:\ncurl -X POST $ENDPOINT/mcp/tools/call \\\n  -d '{\"tool\": \"secret_rotate\", \"arguments\": {...}}'\n\n# Check if dependents break\nif [ dependent_services_down ]; then\n  echo 'FOUND: true' > /tmp/vulnerability-found.txt\nfi"
      }
    }
  ]
}
```

## Security Considerations

### Safe Red Teaming
- ✅ Test in isolated environments
- ✅ Use non-production secrets for testing
- ✅ Rate limit attack attempts
- ✅ Log all test executions
- ❌ Don't test in production without approval
- ❌ Don't use real API keys in tests
- ❌ Don't perform destructive operations

### Ethical Guidelines
- Only test systems you own or have permission to test
- Document all findings before disclosure
- Give target vessels time to fix before re-testing
- Never exfiltrate real secrets or data
- Respect rate limits and quotas

## Future Enhancements

Potential additions:
- `inspect-audit-tampering`: Try to modify or delete audit logs
- `inspect-rate-limiting`: Test for DoS via excessive requests
- `inspect-sql-injection`: Test secret queries for injection
- `inspect-timing-attacks`: Use timing to detect secret existence
- `inspect-privilege-escalation`: Try to access higher-privilege secrets
- `inspect-secret-enumeration`: Try to list all secret IDs

Each would follow the same inverse bias pattern: success = finding a vulnerability.
