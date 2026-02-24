# Multi-Repo Safe Self-Development Architecture

**Date:** 2026-02-22  
**Status:** ✅ Comprehensive Design  
**Principle:** **Develop all repos safely using dedicated devbob containers per codebase**

---

## Executive Summary

We have a **monorepo structure** (`repos/*`) containing multiple independent repositories, each with their own remote. We need to develop ALL of them safely using isolated devbob containers, with each container responsible for managing its specific codebase.

---

## Repository Structure

### Host: metabob-devbob (Orchestrator)

```
metabob-devbob/
├── repos/
│   ├── cpg-inference/         (No container - Python lib, mounted read-only)
│   ├── metabob-cli/          → devbob-cli (port 3002)
│   ├── metabob-dashboard/    → devbob-dashboard (port 3004)
│   ├── metabob-opencode/     → devbob-opencode (port 3003)
│   ├── metabob-proto/        → devbob-clean (testing/validation)
│   ├── metabob-rpc-api/      → devbob-rpc-api (port 3001)
│   └── platform/             → devbob-clean (can be added later)
├── templates/                 (Activity templates)
├── docker-compose.yaml        (Container definitions)
└── .git/                      (Orchestrator repo: metabob-devbob)
```

### Repository → Remote Mapping

| Repository | Remote URL | Purpose | Devbob Container |
|------------|-----------|---------|------------------|
| **cpg-inference** | metabob-devbob.git | Python library for CPG | None (mounted read-only) |
| **metabob-cli** | metabobproject/metabob-cli | CLI tool | `devbob-cli` (3002) |
| **metabob-dashboard** | metabobproject/web.git | Frontend dashboard | `devbob-dashboard` (3004) |
| **metabob-opencode** | avigopal/opencode | Core OpenCode system | `devbob-opencode` (3003) |
| **metabob-proto** | metabob-devbob.git | Bootstrap templates | `devbob-clean` (3000) |
| **metabob-rpc-api** | metabobproject/metabob-rpc-api | Backend API | `devbob-rpc-api` (3001) |
| **platform** | MetabobProject/platform.git | Platform code | `devbob-clean` (3000) |

---

## Architecture: Multi-Repo Safe Development

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          HOST: metabob-devbob                                │
│                     (Orchestrator - manages all repos)                       │
│                                                                              │
│  repos/                                                                      │
│  ├─ metabob-cli/         ←→ GitHub: metabobproject/metabob-cli             │
│  ├─ metabob-dashboard/   ←→ GitHub: metabobproject/web.git                 │
│  ├─ metabob-opencode/    ←→ GitHub: avigopal/opencode                      │
│  ├─ metabob-proto/       ←→ GitHub: metabob-devbob.git (same as host)      │
│  ├─ metabob-rpc-api/     ←→ GitHub: metabobproject/metabob-rpc-api         │
│  └─ platform/            ←→ GitHub: MetabobProject/platform.git            │
│                                                                              │
│  Activities Available:                                                       │
│  • develop-with-devbob-container (single repo)                              │
│  • develop-multi-repo-feature (cross-repo changes)                          │
│  • sync-all-repos (sync entire monorepo)                                    │
│  • validate-cross-repo-changes (multi-repo validation)                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                              ↕ ACP Delegation
┌─────────────────────────────────────────────────────────────────────────────┐
│                       DEVBOB CONTAINERS (4 active)                           │
│                                                                              │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐   │
│  │ devbob-rpc-api     │  │ devbob-cli         │  │ devbob-opencode    │   │
│  │ Port: 3001         │  │ Port: 3002         │  │ Port: 3003         │   │
│  │ Manages:           │  │ Manages:           │  │ Manages:           │   │
│  │ metabob-rpc-api/   │  │ metabob-cli/       │  │ metabob-opencode/  │   │
│  │ Mount: /workspace  │  │ Mount: /workspace  │  │ Mount: /workspace  │   │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘   │
│                                                                              │
│  ┌────────────────────┐  ┌────────────────────┐                            │
│  │ devbob-dashboard   │  │ devbob-clean       │                            │
│  │ Port: 3004         │  │ Port: 3000         │                            │
│  │ Manages:           │  │ Manages:           │                            │
│  │ metabob-dashboard/ │  │ Any repo (testing) │                            │
│  │ Mount: /workspace  │  │ Mount: empty       │                            │
│  └────────────────────┘  └────────────────────┘                            │
│                                                                              │
│  Each container:                                                             │
│  • OpenCode installed with activity system                                  │
│  • Metabob backend connected                                                │
│  • Git configured with credentials                                          │
│  • Can push to respective remote                                            │
│  • Isolated environment (can't break host)                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                              ↕ Git Push/Pull
┌─────────────────────────────────────────────────────────────────────────────┐
│                       REMOTE REPOSITORIES (GitHub)                           │
│                                                                              │
│  • metabobproject/metabob-cli                                               │
│  • metabobproject/web (dashboard)                                           │
│  • avigopal/opencode                                                        │
│  • metabobproject/metabob-rpc-api                                           │
│  • MetabobProject/platform                                                  │
│  • metabob-labs/metabob-devbob (host + proto)                              │
│                                                                              │
│  Role: Independent remotes for each repository                              │
│  • Each repo has its own git history                                        │
│  • Container pushes validated changes to its remote                         │
│  • Host pulls validated changes from remotes                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Container → Repository Mapping

### Active Containers (devbob-dev profile)

**1. devbob-rpc-api (port 3001)**
- **Manages:** `repos/metabob-rpc-api/`
- **Remote:** `git@github.com:metabobproject/metabob-rpc-api`
- **Role:** Backend API codebase manager
- **Mount:** `./repos/metabob-rpc-api:/workspace`
- **ACP Target:** `docker://devbob-rpc-api`

**2. devbob-cli (port 3002)**
- **Manages:** `repos/metabob-cli/`
- **Remote:** `git@github.com:metabobproject/metabob-cli`
- **Role:** CLI codebase manager
- **Mount:** `./repos/metabob-cli:/workspace`
- **ACP Target:** `docker://devbob-cli`

**3. devbob-opencode (port 3003)**
- **Manages:** `repos/metabob-opencode/`
- **Remote:** `git@github.com:avigopal/opencode`
- **Role:** OpenCode codebase manager
- **Mount:** `./repos/metabob-opencode:/workspace`
- **ACP Target:** `docker://devbob-opencode`

**4. devbob-dashboard (port 3004)**
- **Manages:** `repos/metabob-dashboard/`
- **Remote:** `git@github.com:metabobproject/web.git`
- **Role:** Frontend dashboard codebase manager
- **Mount:** `./repos/metabob-dashboard:/workspace`
- **ACP Target:** `docker://devbob-dashboard`

### Testing Container (devbob profile)

**5. devbob-clean (port 3000)**
- **Manages:** Any repository (on-demand)
- **Remote:** Any
- **Role:** Clean testing/validation environment
- **Mount:** Empty workspace (clones on demand)
- **ACP Target:** `docker://devbob-clean`

---

## Multi-Repo Development Workflows

### Workflow 1: Single Repo Development

**Use Case:** Develop feature in one repository (e.g., add API endpoint)

```typescript
// Develop in metabob-rpc-api repository
activity({
  templateId: 'develop-with-devbob-container',
  variables: {
    targetRepository: 'metabob-rpc-api',  // NEW: Specify repo
    containerTarget: 'docker://devbob-rpc-api',  // Dedicated container
    specificationName: 'user-profile-endpoint',
    specificationDescription: 'Add GET /api/users/:id endpoint',
    expectedBehavior: 'Returns user profile as JSON',
    validationStrategy: 'Test: GET /api/users/123 returns 200 with user data',
    workingBranch: 'self-dev/user-profile-endpoint'
  },
  reason: 'Safely develop user profile endpoint in dedicated rpc-api container'
})

// Flow:
// 1. Host pushes current state of repos/metabob-rpc-api/ → GitHub
// 2. Host delegates to devbob-rpc-api container
// 3. Container (already has repo mounted at /workspace)
// 4. Container runs trace-enforce-validate-loop
// 5. Container validates with harness
// 6. Container pushes validated changes → GitHub (metabobproject/metabob-rpc-api)
// 7. Host pulls validated changes ← GitHub
// 8. Host verifies changes work
```

---

### Workflow 2: Cross-Repo Feature Development

**Use Case:** Feature requires changes to multiple repos (e.g., API + Dashboard)

```typescript
// Develop cross-repo feature (API + Dashboard)
activity({
  templateId: 'develop-multi-repo-feature',
  variables: {
    featureName: 'user-authentication',
    repositories: [
      {
        name: 'metabob-rpc-api',
        container: 'docker://devbob-rpc-api',
        specificationDescription: 'Add JWT authentication endpoints',
        targetFiles: ['server/auth.py', 'server/middleware.py']
      },
      {
        name: 'metabob-dashboard',
        container: 'docker://devbob-dashboard',
        specificationDescription: 'Add login UI with JWT integration',
        targetFiles: ['src/auth/LoginPage.tsx', 'src/api/client.ts']
      }
    ],
    coordinationStrategy: 'sequential',  // or 'parallel'
    sharedSpecification: 'JWT tokens with 1hr expiry, refresh token support',
    workingBranch: 'self-dev/user-authentication'
  },
  reason: 'Develop user authentication across API and Dashboard repos'
})

// Flow (Sequential):
// 1. Sync all repos to remotes
// 2. Delegate to devbob-rpc-api:
//    - Develop API endpoints
//    - Validate API tests pass
//    - Push to metabobproject/metabob-rpc-api
// 3. Delegate to devbob-dashboard:
//    - Develop UI components
//    - Validate E2E tests pass
//    - Push to metabobproject/web.git
// 4. Pull both repos to host
// 5. Validate cross-repo integration
// 6. Create integration test harness
```

---

### Workflow 3: Sync All Repos

**Use Case:** Backup all repos to remotes before risky operation

```typescript
// Sync entire monorepo
activity({
  templateId: 'sync-all-repos',
  variables: {
    direction: 'push',  // 'push', 'pull', or 'both'
    repositories: [
      'metabob-cli',
      'metabob-dashboard',
      'metabob-opencode',
      'metabob-rpc-api',
      'platform'
    ],
    commitMessage: 'WIP: Sync all repos before major refactoring',
    skipIfClean: true  // Skip repos with no uncommitted changes
  },
  reason: 'Backup all repos to remotes before risky multi-repo refactoring'
})

// Flow:
// 1. For each repository:
//    - Check git status
//    - Commit if needed
//    - Push to remote
//    - Verify push successful
// 2. Return sync status for all repos
```

---

### Workflow 4: Validate Cross-Repo Changes

**Use Case:** Validate that changes across multiple repos work together

```typescript
// Validate cross-repo changes in clean environments
activity({
  templateId: 'validate-cross-repo-changes',
  variables: {
    repositories: [
      {
        name: 'metabob-rpc-api',
        commitSHA: 'HEAD',
        container: 'docker://devbob-rpc-api'
      },
      {
        name: 'metabob-dashboard',
        commitSHA: 'HEAD',
        container: 'docker://devbob-dashboard'
      }
    ],
    integrationTests: [
      'test:integration',  // Run integration test suite
      'test:e2e'           // Run E2E tests
    ],
    validationStrategy: 'Start backend, start frontend, run E2E tests'
  },
  reason: 'Validate API and Dashboard changes work together'
})

// Flow:
// 1. Delegate to devbob-rpc-api: Start API server
// 2. Delegate to devbob-dashboard: Start dashboard, point to API
// 3. Run integration tests
// 4. Collect results from both containers
// 5. Return pass/fail status
```

---

## Extended Activity Specifications

### Activity: `develop-with-devbob-container` (Extended)

**New Variables:**
- `targetRepository` (string, required) - Which repo in repos/* to develop
- `containerTarget` (string, optional) - Auto-selected based on targetRepository

**Repository → Container Mapping:**
```typescript
const REPO_CONTAINER_MAP = {
  'metabob-rpc-api': 'docker://devbob-rpc-api',
  'metabob-cli': 'docker://devbob-cli',
  'metabob-opencode': 'docker://devbob-opencode',
  'metabob-dashboard': 'docker://devbob-dashboard',
  'metabob-proto': 'docker://devbob-clean',
  'platform': 'docker://devbob-clean',
  'cpg-inference': null  // No container, direct host development
}
```

**Enhanced Flow:**
1. Determine target repository
2. Select appropriate container (auto or manual)
3. Sync repository to remote
4. Delegate to container
5. Container develops and validates
6. Container pushes to **repository's remote** (not metabob-devbob)
7. Host pulls from **repository's remote**
8. Verify changes work on host

---

### Activity: `develop-multi-repo-feature` (NEW)

**Purpose:** Coordinate development across multiple repositories

**Variables:**
- `featureName` (string, required)
- `repositories` (array, required) - List of repo specs:
  - `name` (string) - Repo name
  - `container` (string) - Container target
  - `specificationDescription` (string) - What to develop in this repo
  - `targetFiles` (array, optional) - Files to modify
- `coordinationStrategy` (enum: "sequential" | "parallel") - How to coordinate
- `sharedSpecification` (string, required) - Common specification for all repos
- `workingBranch` (string, required) - Branch name for all repos

**Tasks (7):**
1. **Sync all repositories to remotes**
   - Commit and push each repo
   - Verify all synced

2. **Create shared specification impulse**
   - Document cross-repo requirements
   - Share with all containers

3. **Develop in first repository (or parallel)**
   - Delegate to first container
   - Run trace-enforce-validate-loop
   - Validate and push

4. **Develop in second repository (or parallel)**
   - Delegate to second container
   - Run trace-enforce-validate-loop
   - Validate and push

5. **Pull all repositories to host**
   - Pull each repo from its remote
   - Verify no conflicts

6. **Validate cross-repo integration**
   - Run integration tests
   - Verify repos work together

7. **Create integration test harness**
   - Document cross-repo validation
   - Return success/failure

**Outputs:**
- All repos developed and validated
- Integration test harness created
- Cross-repo coordination documented

---

### Activity: `sync-all-repos` (NEW)

**Purpose:** Bidirectional sync for entire monorepo

**Variables:**
- `direction` (enum: "push" | "pull" | "both", required)
- `repositories` (array, optional) - Defaults to all repos
- `commitMessage` (string, optional) - Message if committing
- `skipIfClean` (boolean, default: true) - Skip repos with no changes

**Tasks (3):**
1. **Check status of all repositories**
   - For each repo: git status
   - Identify repos needing sync

2. **Sync repositories**
   - If push: commit and push each
   - If pull: pull each from remote
   - Handle conflicts if any

3. **Verify sync complete**
   - All repos in sync with remotes
   - Create sync status impulse

**Outputs:**
- Sync status per repository
- Any conflicts detected
- Commit SHAs for each repo

---

### Activity: `validate-cross-repo-changes` (NEW)

**Purpose:** Validate changes across multiple repos work together

**Variables:**
- `repositories` (array, required) - Repos to validate with commit SHAs
- `integrationTests` (array, required) - Test commands to run
- `validationStrategy` (string, required) - How to validate integration

**Tasks (5):**
1. **Start services in containers**
   - Delegate to each container: start service
   - Wait for services healthy

2. **Run integration tests**
   - Execute test commands
   - Collect results

3. **Collect container logs**
   - Get logs from all containers
   - Identify errors

4. **Aggregate results**
   - Combine results from all repos
   - Determine pass/fail

5. **Return validation status**
   - Return pass/fail with details
   - Include logs and errors

**Outputs:**
- Validation status (pass/fail)
- Integration test results
- Container logs

---

## Safety Guarantees (Multi-Repo)

### 1. Repository Isolation

**Each repository has:**
- Dedicated container (or shared devbob-clean)
- Independent git remote
- Independent git history
- Independent validation

**Benefits:**
- Breaking one repo doesn't affect others
- Can develop in parallel
- Independent rollback per repo

---

### 2. Container Isolation

**Each container:**
- Isolated environment (can't affect host)
- Can be restarted independently
- Has own file system
- Can't break other containers

**Benefits:**
- Container failure doesn't break host
- Container failure doesn't break other containers
- Fast recovery (restart container)

---

### 3. Git Synchronization Per Repo

**Each repository:**
- Syncs to its own remote
- Independent branching strategy
- Can revert independently

**Benefits:**
- Full git history per repo
- Independent rollback
- Review changes per repo

---

### 4. Validation Per Repo + Integration

**Two levels of validation:**
- **Repo-level:** Each repo validated independently
- **Integration-level:** Cross-repo validation

**Benefits:**
- Catch repo-specific issues early
- Catch integration issues before merging
- Multi-layer safety net

---

## Container Management

### Starting Containers

**Start all dev containers:**
```bash
docker-compose --profile stable --profile devbob-dev up -d
```

**Start specific container:**
```bash
docker-compose up -d devbob-opencode
```

### Checking Container Status

```bash
# All devbob containers
docker ps --filter "name=devbob"

# Specific container
docker exec devbob-opencode opencode --version
```

### Container Health

**All containers have health checks:**
- ACP endpoint: `http://localhost:<port>/config`
- Checked every 30 seconds
- 5 retries before unhealthy

**Check health:**
```bash
docker ps --filter "name=devbob" --format "{{.Names}}\t{{.Status}}"
```

---

## Repository-Specific Considerations

### metabob-opencode (Self-Development Critical)

**Special Care:**
- This is OpenCode developing itself
- Always validate in devbob-opencode FIRST
- Never modify host opencode directly for risky changes
- Use devbob-clean as fallback if devbob-opencode breaks

**Safety Flow:**
```
Host (metabob-devbob runs old OpenCode)
  ↓
devbob-opencode (develops new OpenCode)
  ↓
Validate new OpenCode works
  ↓
Push to avigopal/opencode
  ↓
Host pulls validated new OpenCode
  ↓
Host updates to new OpenCode
```

---

### metabob-rpc-api (Backend Service)

**Special Care:**
- Backend API server runs from this repo
- Changes affect running service
- Validate before deploying

**Safety Flow:**
```
devbob-rpc-api develops changes
  ↓
Validate tests pass
  ↓
Push to metabobproject/metabob-rpc-api
  ↓
Host pulls changes
  ↓
Rebuild api-server-dev container
  ↓
Restart service
```

---

### metabob-dashboard (Frontend)

**Special Care:**
- Frontend depends on API structure
- Validate against API server
- Test E2E flows

**Safety Flow:**
```
devbob-dashboard develops UI
  ↓
Validate against API (devbob-rpc-api)
  ↓
Run E2E tests
  ↓
Push to metabobproject/web.git
  ↓
Host pulls changes
```

---

## Recovery Scenarios (Multi-Repo)

### Scenario 1: One Repo Broken on Host

```bash
# Example: metabob-opencode broken
cd repos/metabob-opencode
git log --oneline -10
git reset --hard <last-good-commit>

# Or pull from remote
git pull origin main

# Or develop fix in container
activity({
  templateId: 'develop-with-devbob-container',
  variables: {
    targetRepository: 'metabob-opencode',
    specificationName: 'fix-broken-feature',
    ...
  }
})
```

---

### Scenario 2: Container Broken

```bash
# Restart specific container
docker-compose restart devbob-opencode

# Or fresh start
docker-compose stop devbob-opencode
docker-compose up -d devbob-opencode
```

---

### Scenario 3: All Repos Need Rollback

```bash
# Sync all repos to last known good state
activity({
  templateId: 'sync-all-repos',
  variables: {
    direction: 'pull',
    repositories: ['metabob-cli', 'metabob-dashboard', 'metabob-opencode', 'metabob-rpc-api']
  },
  reason: 'Rollback all repos to last good state'
})
```

---

## Implementation Priority

### Phase 1: Extend Single-Repo Activities (Immediate)

**Update:**
1. `develop-with-devbob-container` - Add `targetRepository` and auto-select container
2. `sync-with-remote-repos` - Support repo-specific remotes

**Test:**
- Develop in metabob-rpc-api via devbob-rpc-api
- Develop in metabob-opencode via devbob-opencode
- Verify each repo pushes to correct remote

---

### Phase 2: Multi-Repo Coordination (Short-term)

**Create:**
3. `develop-multi-repo-feature` - Cross-repo development
4. `sync-all-repos` - Monorepo-wide sync
5. `validate-cross-repo-changes` - Integration validation

**Test:**
- API + Dashboard feature (cross-repo)
- Sync all repos before major change
- Validate integration

---

### Phase 3: Production Usage (Long-term)

**Add to Bootstrap:**
- All multi-repo activities available
- Documentation for each repo
- Best practices per codebase

**Usage:**
- 100% of development uses safe workflow
- All repos synced regularly
- Cross-repo validation standard

---

## Success Criteria

**Multi-repo safe development achieved when:**

1. ✅ All repos mapped to containers
2. ✅ Activities support targetRepository parameter
3. ⏳ Single-repo development tested for each repo
4. ⏳ Cross-repo development tested (API + Dashboard)
5. ⏳ Sync-all-repos working
6. ⏳ 0 host breakages across all repos
7. ⏳ <5 minutes recovery per repo

---

## Conclusion

**Multi-repo safe development = dedicated containers + independent remotes + cross-repo coordination**

**Architecture:**
- 7 repositories in repos/*
- 4 dedicated devbob containers (rpc-api, cli, opencode, dashboard)
- 1 clean container (testing/validation)
- Independent git remotes per repo
- Activity-based coordination

**Safety:**
- Repository isolation (breaking one doesn't affect others)
- Container isolation (can restart independently)
- Git synchronization per repo (independent rollback)
- Multi-layer validation (repo + integration)

**Next Steps:**
1. Extend activities for multi-repo support
2. Test single-repo development per container
3. Test cross-repo coordination
4. Add to bootstrap templates

---

**Status:** ✅ Architecture complete  
**Next:** Extend activity templates for multi-repo  
**Goal:** 100% safe development across all repos in repos/*
