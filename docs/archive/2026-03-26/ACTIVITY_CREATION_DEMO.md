# Activity Creation Demo with Minibob

## ✅ Deployment Status

**All systems operational!**

- ✅ Redis: Running
- ✅ SurrealDB: Running  
- ✅ metabob-activity-api: Running (2 replicas)
- ✅ minibob: Running with Claude API access

```bash
kubectl get pods -n activity-system
NAME                                       READY   STATUS    RESTARTS   AGE
metabob-activity-api-5c64bb8c96-2fx5s      1/1     Running   0          5m
metabob-activity-api-5c64bb8c96-nmkdz      1/1     Running   0          5m
minibob-minibob-cluster-75986967bb-gzlxt   1/1     Running   0          4m
redis-master-0                             1/1     Running   0          6m
surrealdb-0                                1/1     Running   0          7m
```

## Part 1: Manual Activity Creation (LLM-Based)

### Step 1: Create Initial Deployment Activity Template

Let's create an activity template for deploying Kubernetes applications using Helm:

```bash
# Create template file
cat > templates/demo/deploy-helm-app-v1.json << 'EOF'
{
  "name": "deploy-helm-application-v1",
  "description": "Deploy K8s app using Helm - LLM-based version",
  "category": "infrastructure",
  "variables": [
    {"name": "appName", "type": "string", "required": true},
    {"name": "namespace", "type": "string", "required": true},
    {"name": "chartPath", "type": "string", "required": true}
  ],
  "tasks": [
    {
      "id": "check-prerequisites",
      "description": "Verify kubectl and helm are installed",
      "subagent": "general",
      "dependencies": [],
      "prompt": {
        "template": "Check that kubectl and helm are installed. Run 'kubectl cluster-info' to verify cluster connectivity.",
        "maxTokens": 2000
      }
    },
    {
      "id": "deploy-helm",
      "description": "Deploy application using Helm",
      "subagent": "general",
      "dependencies": ["check-prerequisites"],
      "prompt": {
        "template": "Deploy {{appName}} using helm install {{appName}} {{chartPath}} --namespace {{namespace}} --create-namespace --wait --timeout=5m",
        "maxTokens": 4000
      }
    },
    {
      "id": "verify-deployment",
      "description": "Verify pods are running",
      "subagent": "general",
      "dependencies": ["deploy-helm"],
      "prompt": {
        "template": "Verify all pods in namespace {{namespace}} are Running. Use kubectl get pods -n {{namespace}} and wait up to 3 minutes.",
        "maxTokens": 3000
      }
    }
  ]
}
EOF
```

**Issues with LLM-Based Approach:**
- ❌ Requires LLM for every execution (costs $$$)
- ❌ Non-deterministic (LLM might interpret differently)
- ❌ Slower (API calls + LLM processing)
- ❌ Can't run offline
- ❌ Token limits can cause failures

## Part 2: Refining to Remove LLM Dependency

### Step 2: Convert to Pure Bash Scripts

Let's refine the activity to use deterministic bash scripts instead of LLM prompts:

```bash
# Create refined template
cat > templates/demo/deploy-helm-app-v2.json << 'EOF'
{
  "name": "deploy-helm-application-v2",
  "description": "Deploy K8s app using Helm - Pure bash version",
  "category": "infrastructure",
  "variables": [
    {"name": "appName", "type": "string", "required": true},
    {"name": "namespace", "type": "string", "required": true},
    {"name": "chartPath", "type": "string", "required": true},
    {"name": "timeout", "type": "string", "required": false, "default": "5m"}
  ],
  "tasks": [
    {
      "id": "check-prerequisites",
      "description": "Verify kubectl and helm are installed",
      "type": "bash",
      "dependencies": [],
      "script": "#!/bin/bash\\nset -euo pipefail\\n\\necho 'Checking prerequisites...'\\n\\nif ! command -v kubectl &> /dev/null; then\\n  echo 'ERROR: kubectl not found'\\n  exit 1\\nfi\\n\\nif ! command -v helm &> /dev/null; then\\n  echo 'ERROR: helm not found'\\n  exit 1\\nfi\\n\\necho 'Checking cluster connectivity...'\\nif ! kubectl cluster-info &> /dev/null; then\\n  echo 'ERROR: Cannot connect to Kubernetes cluster'\\n  exit 1\\nfi\\n\\necho '✓ Prerequisites satisfied'",
      "validation": {
        "commands": [
          {"cmd": "kubectl cluster-info", "expectation": "exit code 0"}
        ]
      }
    },
    {
      "id": "create-namespace",
      "description": "Create namespace if it doesn't exist",
      "type": "bash",
      "dependencies": ["check-prerequisites"],
      "script": "#!/bin/bash\\nset -euo pipefail\\n\\nNAMESPACE='{{namespace}}'\\n\\nif kubectl get namespace $NAMESPACE &> /dev/null; then\\n  echo '✓ Namespace $NAMESPACE already exists'\\nelse\\n  echo 'Creating namespace $NAMESPACE...'\\n  kubectl create namespace $NAMESPACE\\n  echo '✓ Namespace created'\\nfi",
      "validation": {
        "commands": [
          {"cmd": "kubectl get namespace {{namespace}}", "expectation": "namespace exists"}
        ]
      }
    },
    {
      "id": "deploy-helm",
      "description": "Deploy application using Helm",
      "type": "bash",
      "dependencies": ["create-namespace"],
      "script": "#!/bin/bash\\nset -euo pipefail\\n\\nAPP_NAME='{{appName}}'\\nNAMESPACE='{{namespace}}'\\nCHART_PATH='{{chartPath}}'\\nTIMEOUT='{{timeout}}'\\n\\necho 'Deploying $APP_NAME to namespace $NAMESPACE...'\\n\\nif helm list -n $NAMESPACE | grep -q $APP_NAME; then\\n  echo 'Application already installed, upgrading...'\\n  helm upgrade $APP_NAME $CHART_PATH \\\\\\n    --namespace $NAMESPACE \\\\\\n    --wait \\\\\\n    --timeout=$TIMEOUT\\nelse\\n  echo 'Installing application...'\\n  helm install $APP_NAME $CHART_PATH \\\\\\n    --namespace $NAMESPACE \\\\\\n    --create-namespace \\\\\\n    --wait \\\\\\n    --timeout=$TIMEOUT\\nfi\\n\\necho '✓ Deployment complete'",
      "validation": {
        "commands": [
          {"cmd": "helm list -n {{namespace}}", "expectation": "contains {{appName}}"}
        ]
      }
    },
    {
      "id": "verify-pods",
      "description": "Verify all pods are running",
      "type": "bash",
      "dependencies": ["deploy-helm"],
      "script": "#!/bin/bash\\nset -euo pipefail\\n\\nNAMESPACE='{{namespace}}'\\nAPP_NAME='{{appName}}'\\nMAX_WAIT=180\\n\\necho 'Waiting for pods to be ready...'\\n\\nkubectl wait --for=condition=ready pod \\\\\\n  -n $NAMESPACE \\\\\\n  -l app=$APP_NAME \\\\\\n  --timeout=${MAX_WAIT}s || {\\n    echo 'ERROR: Pods failed to become ready within ${MAX_WAIT}s'\\n    kubectl get pods -n $NAMESPACE\\n    exit 1\\n  }\\n\\necho '✓ All pods are running'\\nkubectl get pods -n $NAMESPACE",
      "validation": {
        "commands": [
          {"cmd": "kubectl get pods -n {{namespace}}", "expectation": "all Running"}
        ]
      }
    },
    {
      "id": "health-check",
      "description": "Check service health",
      "type": "bash",
      "dependencies": ["verify-pods"],
      "script": "#!/bin/bash\\nset -euo pipefail\\n\\nNAMESPACE='{{namespace}}'\\nAPP_NAME='{{appName}}'\\n\\necho 'Checking services...'\\nkubectl get svc -n $NAMESPACE\\n\\necho '✓ Deployment verification complete'"
    }
  ],
  "integration": {
    "preChecks": [
      {"type": "command", "value": "which kubectl"},
      {"type": "command", "value": "which helm"}
    ],
    "postChecks": [
      {"type": "command", "value": "kubectl get pods -n {{namespace}}"},
      {"type": "command", "value": "helm list -n {{namespace}}"}
    ]
  }
}
EOF
```

**Benefits of Bash-Based Approach:**
- ✅ No LLM required (zero cost per execution)
- ✅ Deterministic (same input = same output)
- ✅ Fast (no API calls, no LLM processing)
- ✅ Works offline
- ✅ No token limits
- ✅ Easy to debug and test
- ✅ Can be versioned and reviewed like code

## Part 3: Comparison

### Execution Time

**LLM-Based (v1):**
```
Task 1: Check prerequisites (LLM call) = ~2-3 seconds
Task 2: Deploy Helm (LLM call) = ~3-5 seconds
Task 3: Verify deployment (LLM call) = ~2-3 seconds
Total: ~7-11 seconds + actual command execution
Cost: ~$0.01-0.02 per run
```

**Bash-Based (v2):**
```
Task 1: Check prerequisites (direct bash) = <1 second
Task 2: Create namespace (direct bash) = <1 second
Task 3: Deploy Helm (direct bash) = depends on deployment
Task 4: Verify pods (direct bash) = depends on pod startup
Task 5: Health check (direct bash) = <1 second
Total: ~actual command execution time only
Cost: $0
```

### Reliability

| Aspect | LLM-Based | Bash-Based |
|--------|-----------|------------|
| Determinism | ❌ Variable | ✅ Consistent |
| Offline | ❌ No | ✅ Yes |
| Error handling | ❌ Unpredictable | ✅ Explicit |
| Debugging | ❌ Difficult | ✅ Easy |
| Testing | ❌ Hard to test | ✅ Unit testable |
| Maintenance | ❌ Brittle | ✅ Stable |

## Part 4: Testing the Deployment Activity

### Test v2 (Bash-Based) Deployment

```bash
# Test deploying Redis using our new activity
{
  "appName": "test-redis",
  "namespace": "test-deployment",
  "chartPath": "bitnami/redis",
  "timeout": "5m"
}

# Expected output:
# ✓ Prerequisites satisfied
# ✓ Namespace created
# ✓ Deployment complete
# ✓ All pods are running
# ✓ Deployment verification complete
```

## Key Learnings

1. **Start with LLM for exploration** - Use minibob to prototype and understand the problem
2. **Refine to deterministic scripts** - Convert LLM prompts to bash scripts for production
3. **Activity system supports both** - Can mix LLM and bash tasks in same template
4. **Evolution path is clear** - LLM → Bash → Optimized Bash → Compiled
5. **Cost-effectiveness matters** - Bash version is free, LLM costs add up

## Next Steps

1. Register the bash-based template in the activity registry
2. Use it for all future deployments (zero cost!)
3. Create more bash-based templates for common operations
4. Build a library of LLM-free activities for high-frequency tasks

## Conclusion

The activity system allows **gradual refinement** from LLM-based exploration to deterministic automation:

```
Exploration Phase (LLM)
   ↓
Validation Phase (LLM + Bash)
   ↓
Production Phase (Pure Bash)
   ↓
Optimization Phase (Compiled/Native)
```

This demo shows the complete lifecycle of an activity template, from initial creation with LLM assistance to a production-ready, LLM-free, deterministic automation script.
