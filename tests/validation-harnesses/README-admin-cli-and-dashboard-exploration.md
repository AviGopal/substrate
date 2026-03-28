# Validation Harness: admin-cli-and-dashboard-exploration

This validation harness tests the complete admin CLI and dashboard exploration workflow.

## Overview

The harness validates:
1. **CLI Commands** - Organization, user, template, and boredom management
2. **Database Records** - SurrealDB record creation and schema compliance
3. **Dashboard Navigation** - Browser automation and authentication
4. **Activity History** - Data flow from devbob → RPC API → Dashboard UI
5. **API Calls** - Successful /analytics/* and /auth/* endpoint calls
6. **Data Aggregation** - Raw DB records match dashboard UI display

## Files

- `admin-cli-and-dashboard-exploration-harness.ts` - Main validation harness
- `admin-cli-test-cases.json` - Test case definitions with expected outputs
- `README-admin-cli-and-dashboard-exploration.md` - This file

## Prerequisites

### Services Running
- SurrealDB at `localhost:8000`
- metabob-rpc-api at `localhost:8080`
- metabob-dashboard at `http://app.metabob.local`
- Redis cache at `localhost:6379`

### Data Requirements
- At least one organization in database
- At least one activity_template in database
- At least one activity_content record from devbob execution

### Configuration
- Schema migration `008-boredom-eligibility.surql` applied
- Dashboard in local mode OR test user created

## Usage

### Run All Tests

```bash
cd tests/validation-harnesses
npm install
npx ts-node admin-cli-and-dashboard-exploration-harness.ts
```

### Run Specific Test

```typescript
import { runValidation } from './admin-cli-and-dashboard-exploration-harness';

const result = await runValidation({
  testCase: 'cli-org-creation',
  orgId: 'test-org',
  name: 'Test Organization'
});

console.log(result.pass ? '✅ PASS' : '❌ FAIL');
```

## Test Cases

### 1. CLI Organization Creation
Tests: `admin org create` command  
Validates: DB record creation with correct schema

### 2. CLI User Creation
Tests: `admin user create` command  
Validates: bcrypt password hashing, DB record creation

### 3. CLI Boredom Configuration
Tests: `admin template set-boredom` command  
Validates: Boredom eligibility and priority settings

### 4. Dashboard Navigation
Tests: Playwright browser automation  
Validates: Dashboard load, authentication handling

### 5. Activity History Verification
Tests: Data flow from devbob to dashboard  
Validates: DB records, API responses, UI display

### 6. Boredom System Statistics
Tests: `admin boredom stats` command  
Validates: Accurate statistics reporting

## Success Criteria

✅ **CLI Commands**: All commands execute without errors (exit code 0)  
✅ **Database Records**: Records match expected schema and values  
✅ **Dashboard Load**: No authentication errors in local mode  
✅ **Activity History**: Real data from devbob executions visible  
✅ **Screenshots**: Complete workflow demonstrated visually  
✅ **API Calls**: Successful /analytics/* and /auth/* calls  
✅ **Data Aggregation**: DB records match dashboard UI display

## Related Files

- Enforcement Summary: `../../ENFORCEMENT_admin-cli-and-dashboard-exploration.md`
- Trace Analysis: `../../TRACE_ANALYSIS_admin-cli-and-dashboard-exploration.md`
- CLI Implementation: `../../repos/metabob-rpc-api/server/cli.py`
- User Operations: `../../repos/metabob-rpc-api/server/db/operations/user_ops.py`
- Boredom Schema: `../../repos/metabob-rpc-api/sql/migrations/008-boredom-eligibility.surql`
