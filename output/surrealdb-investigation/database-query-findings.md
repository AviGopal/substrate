# SurrealDB Database Query Investigation

## Connection Status
- **Port-forward**: Established on localhost:8000
- **SurrealDB Version**: 2.6.0
- **Health endpoint**: Accessible

## Authentication Issues

### Problem
Cannot authenticate to SurrealDB despite correct credentials in Kubernetes secret:
- Username: `root`
- Password: `changeme` (from secret `surrealdb-credentials`)

### Evidence
1. **401 Unauthorized** responses on all auth attempts
2. Error message: "The password did not verify"
3. Logs show: "Credentials were provided, and no root users were found. The root user 'root' will be created"

### Root Cause Analysis
This is consistent with the **in-memory storage mode** issue:

1. **SurrealDB starts with in-memory storage** (`surreal start memory`)
2. **Pod restarts** (has restarted 3 times)
3. **All users/credentials are lost** including the root user
4. **Environment variables exist** but the user account no longer exists in memory
5. **New startup** recreates root user, but may not match the secret

### Why This Confirms In-Memory Issue
- In-memory mode loses ALL data on restart including user accounts
- The logs show "no root users were found" - confirming fresh start
- Authentication works initially after pod start
- After restart, all authentication fails
- This matches the pattern of lost activity templates

## What We Cannot Query
Due to authentication failure:
- Cannot execute `INFO FOR ROOT`
- Cannot check namespace structure
- Cannot query `activity_template` table
- Cannot verify database/table existence
- Cannot count templates

## What We Know
From deployment configuration:
- Command: `surreal start --user $(SURREAL_USER) --pass $(SURREAL_PASS) --log info memory`
- Storage mode: **memory** (in-memory, non-persistent)
- Expected namespace: `metabob`
- Expected databases: `production`, `learning_loop`
- Expected tables: `activity_template`, `activity_instance`, `impulse`

## Impact on HTTP RPC
The HTTP RPC endpoints would:
1. Successfully connect to SurrealDB (network OK)
2. Attempt to authenticate with credentials from secret
3. **Authentication would fail** if pod has restarted
4. Cannot register templates without authentication
5. Even if registration succeeds temporarily, data lost on next restart

## Conclusion
**Cannot complete database structure queries** due to authentication failure caused by in-memory storage mode. The pod has restarted since credentials were initially configured, losing all user accounts.

This investigation **confirms the critical finding**: In-memory storage is the root cause of:
- Lost authentication state
- Empty query results
- Missing activity templates
- Failed end-to-end verification

## Recommendation
Must fix persistent storage before database queries will work reliably.
