#!/usr/bin/env bun
import { readFileSync } from 'fs';

const traceData = {
  "specificationName": "Instance Invariant Storage for Impulses and Activities",
  "summary": "Storage for impulses and activities must be invariant across different OpenCode and Metabob-CLI instances when using the same metabob_api_key and project_id pair",
  "vesselFlow": "metabob-opencode → metabob-cli (MCP) → metabob-rpc-api (REST) → SurrealDB",
  "components": [
    {
      "file": "repos/metabob-opencode/packages/opencode/src/storage/storage.ts",
      "component": "Storage namespace",
      "role": "Local storage layer (cache)",
      "currentBehavior": "Stores data in local filesystem at ~/.local/share/opencode/storage/ using key-based paths. Keys are validated for security but do NOT include api_key or project_id in path structure. Uses Instance.directory as storage root context.",
      "desiredBehavior": "Should be cache layer only. Local storage keys must include project_id to prevent cross-project contamination. Backend sync is required for instance invariance.",
      "gap": "CRITICAL: Storage keys use ['activity', activityId] without project_id scoping. This causes instance-local storage that is not shared across instances. Need project_id in key path.",
      "evidence": "Line 662: await Storage.write(['activity', activity.id], cleanedActivity) - no project_id in key"
    },
    {
      "file": "repos/metabob-opencode/packages/opencode/src/session/activity.ts",
      "component": "Activity.save()",
      "role": "Activity persistence entry point",
      "currentBehavior": "Saves activity to local storage via Storage.write(['activity', id], data). Attempts backend sync via MCP metabob_activity_save if available (lines 664-700). Uses Instance.project.id for backend sync but NOT for local storage key.",
      "desiredBehavior": "Must save to both local cache (with project_id scoped key) AND backend (via MCP). Backend sync should be mandatory, not optional.",
      "gap": "PARTIAL: Backend sync is present but optional (only if MCP client available and tool exists). Local storage key lacks project_id scope. Backend sync failure is silent.",
      "evidence": "Lines 662-700: Local write uses ['activity', id] without project_id. Backend sync only happens if metabobClient exists and hasActivitySave is true."
    },
    {
      "file": "repos/metabob-opencode/packages/opencode/src/session/activity.ts",
      "component": "Activity.get()",
      "role": "Activity retrieval",
      "currentBehavior": "Reads from local storage only: Storage.read<Info>(['activity', id]). No backend fallback if local cache miss.",
      "desiredBehavior": "Should check local cache first, then fallback to backend (via MCP metabob_activity_get) if cache miss. This enables cross-instance access.",
      "gap": "MISSING: No backend fallback. Instance A creates activity → Instance B cannot retrieve it because it only checks local storage.",
      "evidence": "Line 486: activity = await Storage.read<Info>(['activity', id]) - no MCP backend call on cache miss"
    },
    {
      "file": "repos/metabob-opencode/packages/opencode/src/project/instance.ts",
      "component": "Instance context",
      "role": "Project identification",
      "currentBehavior": "Provides Instance.project.id (git root commit hash) as project identifier. Used in backend sync calls but not in local storage keys.",
      "desiredBehavior": "project_id should be used consistently in both local storage keys and backend API calls. This ensures data scoping.",
      "gap": "PARTIAL: Instance.project.id is used for backend sync but not for local storage key scoping. Creates inconsistency between local and backend storage.",
      "evidence": "activity.ts line 674: const projectId = Instance.project.id (used for MCP call but not local storage key)"
    },
    {
      "file": "repos/metabob-opencode/packages/opencode/src/session/impulse-learning.ts",
      "component": "ImpulseLearning.persistMappingRecord()",
      "role": "Impulse learning data persistence",
      "currentBehavior": "Saves to local storage: Storage.write(['learning', 'impulse-mappings', recordId], record). No project_id scoping, no backend sync.",
      "desiredBehavior": "Should save with project_id scope and sync to backend for cross-instance learning.",
      "gap": "MISSING: No project_id in storage key, no backend sync. Learning data is instance-local only.",
      "evidence": "Lines 454-457: await Storage.write(['learning', 'impulse-mappings', record.metadata.recordId], record)"
    }
  ]
};

const impulseContent = `# Instance Invariant Storage for Impulses and Activities - Trace Analysis

## Specification Summary
${traceData.summary}

## Vessel Flow Architecture
${traceData.vesselFlow}

## Component Analysis

${traceData.components.map((c: any) => `
### ${c.component} (${c.file})

**Role:** ${c.role}

**Current Behavior:**
${c.currentBehavior}

**Desired Behavior:**
${c.desiredBehavior}

**Gap:**
${c.gap}

**Evidence:**
${c.evidence}
`).join('\n')}

---

**Generated:** ${new Date().toISOString()}
**Specification:** Instance Invariant Storage for Impulses and Activities
`;

console.log(JSON.stringify({
  id: "trace-Instance Invariant Storage for Impulses and Activities",
  type: "templateDefinition",
  content: impulseContent,
  metadata: traceData,
  budget: 5000
}, null, 2));
