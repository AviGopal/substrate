#!/usr/bin/env bun
import { Storage } from './repos/metabob-opencode/packages/opencode/src/storage/storage'

// Test Case 1: Template Auto-Registration Config
const case1 = {
  id: 'validation-activity-lifecycle-tools-automation-case-1',
  type: 'memo' as const,
  pointer: {
    type: 'memo' as const,
    content: JSON.stringify({
      testName: "Template Auto-Registration Config",
      input: "Check config for template_auto_registration",
      expectedOutput: {
        configExists: true,
        hasAutoRegistration: true,
        defaultEnabled: true,
        defaultStrategy: "on-create"
      }
    }),
    source: 'validation-harness' as const,
  },
  budget: 500,
  priority: 'medium' as const,
  loaded: false,
  scope: 'activity' as const,
  createdAt: Date.now(),
}

// Test Case 2: Lifecycle Automation Config
const case2 = {
  id: 'validation-activity-lifecycle-tools-automation-case-2',
  type: 'memo' as const,
  pointer: {
    type: 'memo' as const,
    content: JSON.stringify({
      testName: "Lifecycle Automation Config",
      input: "Check config for template_lifecycle_automation",
      expectedOutput: {
        hasLifecycleAutomation: true,
        hasAutoDebugField: true,
        hasAutoEvolveField: true,
        hasFailureThresholdField: true,
        hasStalenessThresholdField: true
      }
    }),
    source: 'validation-harness' as const,
  },
  budget: 500,
  priority: 'medium' as const,
  loaded: false,
  scope: 'activity' as const,
  createdAt: Date.now(),
}

// Test Case 3: Boredom Template Mapping
const case3 = {
  id: 'validation-activity-lifecycle-tools-automation-case-3',
  type: 'memo' as const,
  pointer: {
    type: 'memo' as const,
    content: JSON.stringify({
      testName: "Boredom Template Mapping",
      input: "Verify activity type to meta-template mapping",
      expectedOutput: {
        improveTemplate: "evolve-activity-self-contained",
        debugTemplate: "debug-activity-self-contained",
        optimizeTemplate: "optimize-activity-self-contained"
      }
    }),
    source: 'validation-harness' as const,
  },
  budget: 500,
  priority: 'medium' as const,
  loaded: false,
  scope: 'activity' as const,
  createdAt: Date.now(),
}

// Test Case 4: Bootstrap Meta-Templates
const case4 = {
  id: 'validation-activity-lifecycle-tools-automation-case-4',
  type: 'memo' as const,
  pointer: {
    type: 'memo' as const,
    content: JSON.stringify({
      testName: "Bootstrap Meta-Templates Exist",
      input: "Check for evolve-activity-self-contained and debug-activity-self-contained",
      expectedOutput: {
        evolveTemplateExists: true,
        debugTemplateExists: true
      }
    }),
    source: 'validation-harness' as const,
  },
  budget: 500,
  priority: 'medium' as const,
  loaded: false,
  scope: 'activity' as const,
  createdAt: Date.now(),
}

// Test Case 5: MCP Abstraction
const case5 = {
  id: 'validation-activity-lifecycle-tools-automation-case-5',
  type: 'memo' as const,
  pointer: {
    type: 'memo' as const,
    content: JSON.stringify({
      testName: "MCP Abstraction Compliance",
      input: "Verify all lifecycle operations use MCP tools",
      expectedOutput: {
        usesMetabobRegisterTemplate: true,
        usesMetabobFetchBoredomActivities: true,
        usesActivityErrorInspector: true,
        noDirectHTTP: true
      }
    }),
    source: 'validation-harness' as const,
  },
  budget: 500,
  priority: 'medium' as const,
  loaded: false,
  scope: 'activity' as const,
  createdAt: Date.now(),
}

// Harness Impulse
const harnessImpulse = {
  id: 'harness-activity-lifecycle-tools-automation',
  type: 'file' as const,
  pointer: {
    type: 'file' as const,
    path: 'repos/metabob-opencode/packages/opencode/tests/validation-harnesses/activity-lifecycle-tools-automation-harness.ts',
    source: 'validation-harness' as const,
  },
  budget: 2000,
  priority: 'high' as const,
  loaded: false,
  scope: 'activity' as const,
  createdAt: Date.now(),
}

// Save all impulses
await Storage.write(['impulse-activity', case1.id], case1)
await Storage.write(['impulse-activity', case2.id], case2)
await Storage.write(['impulse-activity', case3.id], case3)
await Storage.write(['impulse-activity', case4.id], case4)
await Storage.write(['impulse-activity', case5.id], case5)
await Storage.write(['impulse-activity', harnessImpulse.id], harnessImpulse)

console.log('✅ Created validation impulses:')
console.log('  1.', case1.id)
console.log('  2.', case2.id)
console.log('  3.', case3.id)
console.log('  4.', case4.id)
console.log('  5.', case5.id)
console.log('')
console.log('✅ Created harness impulse:', harnessImpulse.id)
