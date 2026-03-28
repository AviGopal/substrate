# Phase 1: Repository Access Architecture Diagram

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Kubernetes Cluster                            │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    Namespace: activity-system                   │  │
│  │                                                                 │  │
│  │  ┌─────────────────────────────────────────────────────────┐   │  │
│  │  │ MiniBob Pod 1                                           │   │  │
│  │  │                                                         │   │  │
│  │  │  ┌───────────────────────────────────────────────────┐  │   │  │
│  │  │  │ Init Container: clone-repos                       │  │   │  │
│  │  │  │ Image: alpine/git:latest                          │  │   │  │
│  │  │  │                                                    │  │   │  │
│  │  │  │ 1. Mount secret: devbob-git-credentials           │  │   │  │
│  │  │  │ 2. Copy .gitconfig → /root/.gitconfig            │  │   │  │
│  │  │  │ 3. Copy .git-credentials → /root/.git-credentials │  │   │  │
│  │  │  │ 4. Clone repos to /repos                          │  │   │  │
│  │  │  │                                                    │  │   │  │
│  │  │  │ Volumes:                                           │  │   │  │
│  │  │  │  - repos-pvc → /repos (RW)                         │  │   │  │
│  │  │  │  - git-credentials → /git-config (RO)             │  │   │  │
│  │  │  └────────────────────────────────────────────────────┘  │   │  │
│  │  │                          ↓                              │   │  │
│  │  │  ┌───────────────────────────────────────────────────┐  │   │  │
│  │  │  │ Main Container: devbob                            │  │   │  │
│  │  │  │ Image: devbob:latest                              │  │   │  │
│  │  │  │                                                    │  │   │  │
│  │  │  │ Environment:                                       │  │   │  │
│  │  │  │  - REPOS_PATH=/repos                              │  │   │  │
│  │  │  │  - HOME=/workspace                                │  │   │  │
│  │  │  │  - GIT_USER_NAME=MiniBob Agent                    │  │   │  │
│  │  │  │  - GIT_USER_EMAIL=minibob@metabob.local           │  │   │  │
│  │  │  │                                                    │  │   │  │
│  │  │  │ Volumes:                                           │  │   │  │
│  │  │  │  - workspace-pvc → /workspace (RWO)               │  │   │  │
│  │  │  │  - repos-pvc → /repos (RWX) ────────────┐         │  │   │  │
│  │  │  │                                          │         │  │   │  │
│  │  │  │ Git Tool:                                │         │  │   │  │
│  │  │  │  - Defaults cwd to /repos                │         │  │   │  │
│  │  │  │  - Uses /root/.gitconfig                 │         │  │   │  │
│  │  │  └──────────────────────────────────────────┼─────────┘  │   │  │
│  │  └─────────────────────────────────────────────┼─────────────┘   │  │
│  │                                                 │                 │  │
│  │  ┌─────────────────────────────────────────────┼─────────────┐   │  │
│  │  │ MiniBob Pod 2                                │             │   │  │
│  │  │                                              │             │   │  │
│  │  │  ┌───────────────────────────────────────────┼─────────┐  │   │  │
│  │  │  │ Main Container: devbob                    │         │  │   │  │
│  │  │  │                                            │         │  │   │  │
│  │  │  │ Volumes:                                   │         │  │   │  │
│  │  │  │  - workspace-pvc → /workspace (RWO)       │         │  │   │  │
│  │  │  │  - repos-pvc → /repos (RWX) ──────────────┤         │  │   │  │
│  │  │  │                                            │         │  │   │  │
│  │  │  │ Git Tool:                                  │         │  │   │  │
│  │  │  │  - Defaults cwd to /repos                  │         │  │   │  │
│  │  │  │  - Uses /root/.gitconfig                   │         │  │   │  │
│  │  │  └────────────────────────────────────────────┼─────────┘  │   │  │
│  │  └─────────────────────────────────────────────┼─────────────┘   │  │
│  │                                                 │                 │  │
│  │                                                 ▼                 │  │
│  │  ┌─────────────────────────────────────────────────────────────┐ │  │
│  │  │ PersistentVolume: repos-pvc                                 │ │  │
│  │  │ - Access Mode: ReadWriteMany                                │ │  │
│  │  │ - Size: 20Gi                                                │ │  │
│  │  │ - Storage Class: (default)                                  │ │  │
│  │  │                                                             │ │  │
│  │  │ /repos/                                                     │ │  │
│  │  │   └── metabob-devbob/                                       │ │  │
│  │  │       ├── .git/                                             │ │  │
│  │  │       ├── helm/                                             │ │  │
│  │  │       ├── repos/                                            │ │  │
│  │  │       │   └── minibob/                                      │ │  │
│  │  │       │       └── src/                                      │ │  │
│  │  │       │           └── tools.ts (git tool)                   │ │  │
│  │  │       └── ...                                               │ │  │
│  │  └─────────────────────────────────────────────────────────────┘ │  │
│  │                                                                   │  │
│  │  ┌─────────────────────────────────────────────────────────────┐ │  │
│  │  │ Secret: devbob-git-credentials                              │ │  │
│  │  │ - Type: Opaque                                              │ │  │
│  │  │ - Keys:                                                     │ │  │
│  │  │   - .gitconfig (user.name, user.email, credential.helper)  │ │  │
│  │  │   - .git-credentials (https://TOKEN@github.com)            │ │  │
│  │  │   - id_rsa (optional SSH private key)                      │ │  │
│  │  └─────────────────────────────────────────────────────────────┘ │  │
│  │                                                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

## Component Interaction Flow

```
1. DEPLOYMENT
   ┌─────────────┐
   │ Helm Deploy │
   └──────┬──────┘
          │
          ├─── Create PVC: repos-pvc (ReadWriteMany, 20Gi)
          ├─── Create Secret: git-credentials (.gitconfig, .git-credentials)
          └─── Create Deployment: devbob (with init container)

2. INIT CONTAINER EXECUTION
   ┌──────────────────┐
   │ Pod Starts       │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │ Init: clone-repos│
   └────────┬─────────┘
            │
            ├─── Mount: /git-config ← secret (git-credentials)
            ├─── Mount: /repos ← PVC (repos-pvc)
            │
            ├─── Copy: /git-config/.gitconfig → /root/.gitconfig
            ├─── Copy: /git-config/.git-credentials → /root/.git-credentials
            │
            ├─── For each repo in values.yaml:
            │    │
            │    ├─── Check: /repos/{path}/.git exists?
            │    │    │
            │    │    ├─── No: git clone {url} /repos/{path}
            │    │    └─── Yes: cd /repos/{path} && git pull
            │
            └─── Complete: Signal main container can start

3. MAIN CONTAINER EXECUTION
   ┌──────────────────┐
   │ Container: devbob│
   └────────┬─────────┘
            │
            ├─── Mount: /workspace ← PVC (workspace-pvc, per-pod)
            ├─── Mount: /repos ← PVC (repos-pvc, shared)
            │
            ├─── Set Environment:
            │    - REPOS_PATH=/repos
            │    - GIT_USER_NAME=MiniBob Agent
            │    - GIT_USER_EMAIL=minibob@metabob.local
            │
            └─── Start MiniBob Server

4. GIT TOOL INVOCATION
   ┌──────────────────┐
   │ Activity calls   │
   │ git tool         │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────────────────────┐
   │ tools.git({ command: "status" }) │
   └──────────────┬───────────────────┘
                  │
                  ├─── Determine cwd:
                  │    - params.cwd provided? → Use it
                  │    - REPOS_PATH set? → Use /repos
                  │    - Otherwise → Use workingDirectory
                  │
                  ├─── Set env:
                  │    - GIT_CONFIG_GLOBAL=/root/.gitconfig
                  │
                  └─── Execute: git {command} in {cwd}
```

## Data Flow Diagram

```
┌────────────────────────────────────────────────────────────────┐
│ values.yaml (Configuration)                                    │
├────────────────────────────────────────────────────────────────┤
│ repositories:                                                  │
│   git:                                                         │
│     username: "MiniBob Agent"                                  │
│     email: "minibob@metabob.local"                             │
│     token: "${GITHUB_TOKEN}"                                   │
│   repos:                                                       │
│     - url: "https://github.com/metabob/metabob-devbob.git"    │
│       branch: "main"                                           │
│       path: "metabob-devbob"                                   │
└─────────────────────┬──────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ Helm Template Processing                                        │
├─────────────────────────────────────────────────────────────────┤
│ 1. secret-git.yaml → Secret with git config                    │
│ 2. pvc-repos.yaml → PersistentVolumeClaim                       │
│ 3. deployment.yaml → Deployment with init container            │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ Kubernetes Resources Created                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌──────────────────┐                   │
│  │ Secret          │    │ PVC              │                   │
│  │ git-credentials │    │ repos-pvc        │                   │
│  │                 │    │ ReadWriteMany    │                   │
│  │ .gitconfig      │    │ 20Gi             │                   │
│  │ .git-credentials│    └────────┬─────────┘                   │
│  └────────┬────────┘             │                             │
│           │                      │                             │
│           │     ┌────────────────┴─────────────────┐           │
│           │     │                                  │           │
│           │     ▼                                  ▼           │
│           │  ┌─────────────────┐      ┌─────────────────────┐ │
│           │  │ Init Container  │      │ Main Container      │ │
│           └─►│ clone-repos     │      │ devbob              │ │
│              │                 │      │                     │ │
│              │ /git-config ←───┤      │ /repos ←────────────┤ │
│              │ /repos ←────────┤      │ /workspace          │ │
│              │                 │      │                     │ │
│              │ git clone       │      │ git tool            │ │
│              └─────────────────┘      └─────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ Runtime State                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  /repos/metabob-devbob/     ← Shared across all pods           │
│    ├── .git/                                                    │
│    ├── helm/                                                    │
│    ├── repos/                                                   │
│    │   └── minibob/                                             │
│    │       ├── src/                                             │
│    │       │   └── tools.ts  ← Git tool uses /repos as default │
│    │       └── templates/                                       │
│    │           └── test-git-repo-access.json                    │
│    └── ...                                                      │
│                                                                 │
│  /root/.gitconfig           ← Copied from secret               │
│  /root/.git-credentials     ← Copied from secret               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Storage Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Storage Classes (K8s)                                         │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────┐          ┌────────────────┐              │
│  │ standard       │          │ nfs-client     │              │
│  │ (default)      │          │ (optional)     │              │
│  └────────┬───────┘          └────────┬───────┘              │
│           │                           │                      │
│           └───────────┬───────────────┘                      │
│                       │                                      │
│                       ▼                                      │
│  ┌───────────────────────────────────────────────────┐      │
│  │ PersistentVolume (dynamically provisioned)        │      │
│  │ - Capacity: 20Gi                                  │      │
│  │ - Access Mode: ReadWriteMany                      │      │
│  │ - Reclaim Policy: Retain (production)             │      │
│  │ - Volume Mode: Filesystem                         │      │
│  └────────────────────────┬──────────────────────────┘      │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ PersistentVolumeClaim: repos-pvc                            │
├─────────────────────────────────────────────────────────────┤
│ - Namespace: activity-system                                │
│ - Access Mode: ReadWriteMany                                │
│ - Requested Storage: 20Gi                                   │
│ - Status: Bound                                             │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ├──────► Pod 1: /repos (read/write)
                   ├──────► Pod 2: /repos (read/write)
                   └──────► Pod N: /repos (read/write)
```

## Security Model

```
┌─────────────────────────────────────────────────────────────┐
│ Secret: devbob-git-credentials                              │
├─────────────────────────────────────────────────────────────┤
│ Type: Opaque                                                │
│ Namespace: activity-system                                  │
│                                                             │
│ Data:                                                       │
│   .gitconfig: |                                             │
│     [user]                                                  │
│       name = MiniBob Agent                                  │
│       email = minibob@metabob.local                         │
│     [credential]                                            │
│       helper = store                                        │
│                                                             │
│   .git-credentials: |                                       │
│     https://${GITHUB_TOKEN}@github.com                      │
│                                                             │
│   id_rsa: |  (optional)                                     │
│     -----BEGIN OPENSSH PRIVATE KEY-----                     │
│     ...                                                     │
│     -----END OPENSSH PRIVATE KEY-----                       │
└─────────────────────────────────────────────────────────────┘
                   │
                   │ Mounted to init container only
                   │ (not main container)
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ Init Container: clone-repos                                 │
├─────────────────────────────────────────────────────────────┤
│ Volume Mount:                                               │
│   - name: git-credentials                                   │
│     mountPath: /git-config                                  │
│     readOnly: true                                          │
│     defaultMode: 0600  ← Only owner can read/write          │
│                                                             │
│ Actions:                                                    │
│   1. cp /git-config/.gitconfig /root/.gitconfig             │
│   2. cp /git-config/.git-credentials /root/.git-credentials │
│   3. chmod 600 /root/.git-credentials                       │
│   4. git clone (uses credentials)                           │
└─────────────────────────────────────────────────────────────┘
                   │
                   │ Credentials copied to container filesystem
                   │ (not persisted in PVC)
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ Main Container: devbob                                      │
├─────────────────────────────────────────────────────────────┤
│ Filesystem:                                                 │
│   /root/.gitconfig        ← From init container copy        │
│   /root/.git-credentials  ← From init container copy        │
│                                                             │
│ Environment:                                                │
│   GIT_CONFIG_GLOBAL=/root/.gitconfig                        │
│                                                             │
│ Security:                                                   │
│   - Credentials in files (not env vars)                     │
│   - Not persisted to PVC                                    │
│   - Lost on pod restart (re-copied by init container)       │
└─────────────────────────────────────────────────────────────┘
```

## Evolution Path

```
Phase 1 (Current)         Phase 2 (Future)          Phase 3 (Future)
┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│ Shared Repos │          │ Branch Mgmt  │          │ Commit Auto  │
├──────────────┤   ──►    ├──────────────┤   ──►    ├──────────────┤
│ ✓ PVC        │          │ - Auto branch│          │ - Auto commit│
│ ✓ Git creds  │          │ - Isolation  │          │ - Messages   │
│ ✓ Clone      │          │ - Cleanup    │          │ - Attribution│
│ ✓ Operations │          │              │          │              │
└──────────────┘          └──────────────┘          └──────────────┘

Phase 4 (Future)          Phase 5 (Future)
┌──────────────┐          ┌──────────────┐
│ PR Integration│          │ Multi-Repo   │
├──────────────┤   ──►    ├──────────────┤
│ - GitHub API │          │ - Cross-repo │
│ - Auto PR    │          │ - Dependency │
│ - Review     │          │ - Refactor   │
└──────────────┘          └──────────────┘
```

## Key Architectural Decisions

1. **Init Container Pattern**
   - ✅ Separates setup from runtime
   - ✅ One-time credential handling
   - ✅ Automatic updates on restart

2. **ReadWriteMany PVC**
   - ✅ Shared across all MiniBob pods
   - ✅ Collaborative work on same repos
   - ✅ Persistent across pod restarts

3. **Secret-Based Credentials**
   - ✅ Secure storage in K8s
   - ✅ Not exposed to main container
   - ✅ Easy rotation via Helm upgrade

4. **Environment-Aware Tool**
   - ✅ Works in K8s and local dev
   - ✅ No code changes needed
   - ✅ Configurable via env vars

5. **Comprehensive Testing**
   - ✅ Activity-based validation
   - ✅ Automated test suite
   - ✅ Manual verification commands
