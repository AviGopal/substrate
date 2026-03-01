# Validation Harness: complete-architecture-separation

## Overview

This validation harness tests the three-component architecture separation:
- **metabob-opencode**: Execution + Coordination (ZERO ML implementations)
- **metabob-cli**: Data Collection + MCP Gateway (ZERO training logic)
- **metabob-rpc-api**: ML Training + Metrics + Storage (ALL learning endpoints)

## Test Cases

### Case 1: opencode has ZERO ML implementations
**Purpose**: Verify opencode contains only type definitions, no actual ML code  
**Input**: Search for ML implementation patterns (class Thompson, function performThompsonSampling, etc.)  
**Expected**: 0 actual implementations (type definitions and comments are OK)

### Case 2: CLI has ZERO training logic
**Purpose**: Verify CLI is pure MCP gateway with no training algorithms  
**Input**: Search for training logic patterns (def train, class Trainer, beta_update, etc.)  
**Expected**: 0 training logic implementations

### Case 3: RPC API has ALL learning endpoints
**Purpose**: Verify RPC API contains all ML logic  
**Input**: Search for required endpoints (Thompson Sampling, Beta Sampling, Metrics Update)  
**Expected**: All endpoints present

### Case 4: Data flow follows architecture boundaries
**Purpose**: Verify proper layering (opencode → CLI → RPC API → SurrealDB)  
**Input**: Check RPC client usage, API forwarding, no database shortcuts  
**Expected**: 
- opencode uses RPC client: true
- CLI forwards to RPC API: true
- opencode direct DB access: 0

### Case 5: thompson-sampler.ts deleted from opencode
**Purpose**: Verify old ML implementation files removed  
**Input**: Check file existence  
**Expected**: File deleted, /ml/ directory removed

### Case 6: Template storage uses SurrealDB primary + Redis cache
**Purpose**: Verify correct storage architecture  
**Input**: Check for SurrealDB usage, Redis caching, cache-miss handling  
**Expected**: All storage patterns present

### Case 7: CLI MCP tools are pure proxies to RPC API
**Purpose**: Verify CLI tools delegate to RPC API  
**Input**: Check for API delegation, no local computation  
**Expected**: 
- MCP tools delegate to RPC: true
- Local computation found: 0

## Usage

### Run All Tests
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
bun run tests/validation-harnesses/complete-architecture-separation-harness.ts
```

### Expected Output
```
================================================================================
VALIDATION HARNESS: complete-architecture-separation
================================================================================

Running: opencode has ZERO ML implementations...
  ✓ PASS: No ML implementations found in opencode

Running: CLI has ZERO training logic...
  ✓ PASS: No training logic found in CLI

Running: RPC API has ALL learning endpoints...
  ✓ PASS: All learning endpoints found in RPC API

Running: Data flow follows architecture boundaries...
  ✓ PASS: Data flow follows layered architecture

Running: thompson-sampler.ts deleted from opencode...
  ✓ PASS: thompson-sampler.ts has been deleted

Running: Template storage uses SurrealDB primary + Redis cache...
  ✓ PASS: Template storage uses SurrealDB primary + Redis cache

Running: CLI MCP tools are pure proxies to RPC API...
  ✓ PASS: CLI MCP tools are pure proxies

================================================================================
SUMMARY
================================================================================
Total:  7
Passed: 7
Failed: 0

Overall: ✓ ALL TESTS PASSED
================================================================================
```

## Impulses

### Harness Impulse
- **ID**: `harness-complete-architecture-separation`
- **Location**: `impulses/harness-complete-architecture-separation.json`
- **Type**: file pointer
- **Budget**: 2000 tokens

### Test Cases Impulse
- **ID**: `validation-complete-architecture-separation-cases-all`
- **Location**: `impulses/validation-cases/validation-complete-architecture-separation-cases-all.json`
- **Type**: memo (test case data)
- **Budget**: 2000 tokens

## Architecture

The harness uses:
1. **ripgrep (rg)** for fast code searches across repos
2. **fs/promises** for file system checks
3. **child_process** for running grep commands
4. **TypeScript/Bun** for type safety and fast execution

## Exit Codes

- `0`: All tests passed
- `1`: One or more tests failed or error occurred

## Integration

This harness can be:
- Run manually for validation
- Integrated into CI/CD pipelines
- Called from other test suites
- Used as pre-commit hook

## Maintenance

When architecture changes, update:
1. Test patterns in harness file
2. Expected outputs in test cases impulse
3. This README documentation

## Related Files

- Trace: `TRACE_complete-architecture-separation.json`
- Enforcement: `ENFORCEMENT_complete-architecture-separation.json`
- Specification: `.activity-specs/complete-architecture-separation.json`
