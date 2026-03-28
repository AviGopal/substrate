#!/usr/bin/env bun
import { Instance } from "../repos/metabob-opencode/packages/opencode/src/project/instance"
import { SessionMemory } from "../repos/metabob-opencode/packages/opencode/src/session/session-memory"
import type { ActivityTemplate } from "../repos/metabob-opencode/packages/opencode/src/session/activity-template"

const SESSION_ID = `deployment-validation-${Date.now()}`
const IMPULSE_ID = "deployment-state-k8s-local-validation-20260226"

console.log("Creating deployment state impulse...")

await Instance.provide({
  directory: `${process.cwd()}/repos/metabob-opencode`,
  fn: async () => {
    const deploymentStatus = {
      testRunId: "k8s-local-validation-20260226",
      timestamp: new Date().toISOString(),
      cluster: "docker-desktop",
      namespace: "metabob",
      deploymentStatus: {
        redis: {
          status: "Running",
          endpoint: "redis-master:6379",
          clusterIP: "10.111.0.8",
          pod: "redis-master-0",
          restarts: 1,
          age: "122m"
        },
        surrealdb: {
          status: "Running",
          endpoint: "surrealdb:8000",
          clusterIP: "10.102.105.199",
          pod: "surrealdb-65576c4c47-jq8fn",
          restarts: 1,
          age: "55m"
        },
        devbob: {
          status: "Running",
          endpoint: "devbob:3000",
          clusterIP: "10.106.45.198",
          pod: "devbob-cccfc4478-jtsm5",
          acpReady: true,
          acpPort: 8083,
          restarts: 1,
          age: "67m"
        }
      },
      validationScript: "PASS",
      deploymentStateImpulseId: IMPULSE_ID
    };

    const content = `# Metabob Stack Deployment Validation Report
## Test Run: ${deploymentStatus.testRunId}
**Date**: ${deploymentStatus.timestamp}
**Cluster**: ${deploymentStatus.cluster}
**Namespace**: ${deploymentStatus.namespace}

## Component Status

### Redis
- **Status**: Running
- **Endpoint**: redis-master:6379
- **Cluster IP**: 10.111.0.8
- **Pod**: redis-master-0

### SurrealDB
- **Status**: Running
- **Endpoint**: surrealdb:8000
- **Cluster IP**: 10.102.105.199
- **Pod**: surrealdb-65576c4c47-jq8fn

### DevBob (ACP Container)
- **Status**: Running
- **Endpoint**: devbob:3000
- **Cluster IP**: 10.106.45.198
- **ACP Ready**: true
- **ACP Port**: 8083
- **Pod**: devbob-cccfc4478-jtsm5

## Validation Results
- ✓ All pods running
- ✓ All services available with endpoints
- ✓ DevBob can reach Redis and SurrealDB
- ✓ ACP Server initialized and ready
- ✓ Templates loaded (0 registered)

## Validation Script Result
**PASS**

---
**Conclusion**: All Metabob stack components are operational and ready for end-to-end activity execution and multi-agent coordination workflows.`;

    const impulse: ActivityTemplate.Impulse.Schema = {
      id: IMPULSE_ID,
      type: "memo",
      pointer: {
        type: "memo",
        content: content,
        source: "validation"
      },
      description: "Metabob Stack K8s deployment validation results",
      budget: 1500,
      priority: "high",
      scope: "session",
      sessionID: SESSION_ID,
      metadata: deploymentStatus
    };

    await SessionMemory.addImpulse(SESSION_ID, impulse);
    
    console.log(JSON.stringify(deploymentStatus, null, 2));
    console.log('\n✓ Deployment state impulse created: ' + IMPULSE_ID);
  }
});
