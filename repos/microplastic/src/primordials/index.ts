/**
 * Primordial Templates
 *
 * Level 0 templates that are embedded in the codebase.
 * These are the foundational templates from which all others emerge.
 *
 * Two categories:
 * 1. Basic operations (develop-feature, fix-bug, run-tests)
 * 2. Bootstrap/self-hosting (genesis, trailblazer, ribosome, vessel-extend)
 */

import type { ActivityTemplate } from "@metabob/minibob";

// Import bootstrap templates (self-hosting capabilities)
import {
  BOOTSTRAP_TEMPLATES,
  genesisFromGoal,
  trailblazerFromFailures,
  ribosomeExtract,
  vesselExtend,
  isBootstrapTemplate,
} from "./bootstrap.ts";

// =============================================================================
// DEVELOP FEATURE TEMPLATE
// =============================================================================

/**
 * Template for developing a new feature in microplastic itself.
 * This is the bootstrap template - microplastic uses this to develop itself.
 */
export const developFeature: ActivityTemplate = {
  id: "primordial:develop-feature",
  name: "Develop Feature",
  description: "Develop a new feature in the microplastic codebase",
  category: "feature",
  variables: [
    {
      name: "goal",
      type: "string",
      description: "The feature to implement",
      required: true,
    },
    {
      name: "workdir",
      type: "string",
      description: "Working directory",
      required: true,
    },
  ],
  tasks: [
    {
      id: "understand",
      description: "Understand the codebase and requirements",
      prompt: {
        template: `You are developing a feature for microplastic, a composite vessel agent-IDE.

Goal: {goal}
Working directory: {workdir}

First, understand what's needed:
1. Read relevant existing code to understand the patterns
2. Identify which modules are affected
3. Plan your implementation approach

Start by reading the CLAUDE.md file and any relevant source files.`,
        variables: [
          { name: "goal", type: "string", required: true },
          { name: "workdir", type: "string", required: true },
        ],
      },
      validation: {},
      retry: { maxAttempts: 1, strategy: "simple" },
    },
    {
      id: "implement",
      description: "Implement the feature",
      prompt: {
        template: `Now implement the feature:

Goal: {goal}

Based on your understanding:
1. Create or modify the necessary files
2. Follow existing patterns in the codebase
3. Add proper TypeScript types
4. Keep changes minimal and focused

Use the edit and write tools to make changes.`,
        variables: [{ name: "goal", type: "string", required: true }],
      },
      validation: {
        requiredPatterns: ["export"],
      },
      retry: { maxAttempts: 2, strategy: "simple" },
    },
    {
      id: "test",
      description: "Verify the implementation",
      prompt: {
        template: `Verify your implementation:

1. Run the type checker: bun run typecheck
2. Run the tests: bun test
3. If there are failures, fix them

Make sure everything passes before completing.`,
        variables: [],
      },
      validation: {},
      retry: { maxAttempts: 3, strategy: "simple" },
    },
  ],
  metadata: {
    // Primordial = bootstrap template, low priority
    // Should be outcompeted by learned templates over time
    primordial: true,
    level: 0,
    // Low initial confidence - learned templates should win
    initialAlpha: 1,
    initialBeta: 1,
  } as ActivityTemplate["metadata"],
};

// =============================================================================
// FIX BUG TEMPLATE
// =============================================================================

/**
 * Template for fixing bugs
 */
export const fixBug: ActivityTemplate = {
  id: "primordial:fix-bug",
  name: "Fix Bug",
  description: "Fix a bug in the codebase",
  category: "bugfix",
  variables: [
    {
      name: "goal",
      type: "string",
      description: "Description of the bug to fix",
      required: true,
    },
    {
      name: "workdir",
      type: "string",
      description: "Working directory",
      required: true,
    },
  ],
  tasks: [
    {
      id: "diagnose",
      description: "Diagnose the bug",
      prompt: {
        template: `You are fixing a bug:

Bug: {goal}
Working directory: {workdir}

First, diagnose the issue:
1. Read relevant source files
2. Understand the current behavior
3. Identify the root cause

Look for error messages, incorrect logic, or missing handling.`,
        variables: [
          { name: "goal", type: "string", required: true },
          { name: "workdir", type: "string", required: true },
        ],
      },
      validation: {},
      retry: { maxAttempts: 1, strategy: "simple" },
    },
    {
      id: "fix",
      description: "Apply the fix",
      prompt: {
        template: `Apply your fix:

Bug: {goal}

Based on your diagnosis:
1. Make the minimal change needed to fix the bug
2. Don't refactor or change unrelated code
3. Ensure the fix is correct

Use the edit tool to make targeted changes.`,
        variables: [{ name: "goal", type: "string", required: true }],
      },
      validation: {},
      retry: { maxAttempts: 2, strategy: "simple" },
    },
    {
      id: "verify",
      description: "Verify the fix",
      prompt: {
        template: `Verify your fix works:

1. Run the tests: bun test
2. If specific tests cover this bug, run them
3. Make sure no other tests break

Confirm the fix is complete.`,
        variables: [],
      },
      validation: {},
      retry: { maxAttempts: 2, strategy: "simple" },
    },
  ],
  metadata: {
    primordial: true,
    level: 0,
    initialAlpha: 1,
    initialBeta: 1,
  } as ActivityTemplate["metadata"],
};

// =============================================================================
// RUN TESTS TEMPLATE
// =============================================================================

/**
 * Simple template for running tests
 */
export const runTests: ActivityTemplate = {
  id: "primordial:run-tests",
  name: "Run Tests",
  description: "Run the test suite",
  category: "tool",
  variables: [
    {
      name: "pattern",
      type: "string",
      description: "Test file pattern (optional)",
      required: false,
    },
  ],
  tasks: [
    {
      id: "run",
      description: "Run the tests",
      prompt: {
        template: `Run the tests:

Pattern: {pattern}

Execute: bun test {pattern}

Report the results.`,
        variables: [{ name: "pattern", type: "string", required: false }],
      },
      validation: {},
      retry: { maxAttempts: 1, strategy: "simple" },
    },
  ],
  metadata: {
    primordial: true,
    level: 0,
    initialAlpha: 1,
    initialBeta: 1,
  } as ActivityTemplate["metadata"],
};

// =============================================================================
// ALL PRIMORDIALS
// =============================================================================

/**
 * Basic operation templates
 */
export const BASIC_TEMPLATES: ActivityTemplate[] = [
  developFeature,
  fixBug,
  runTests,
];

/**
 * All primordial templates (basic + bootstrap)
 */
export const PRIMORDIAL_TEMPLATES: ActivityTemplate[] = [
  ...BASIC_TEMPLATES,
  ...BOOTSTRAP_TEMPLATES,
];

/**
 * Get a primordial template by ID
 */
export function getPrimordialTemplate(id: string): ActivityTemplate | undefined {
  return PRIMORDIAL_TEMPLATES.find((t) => t.id === id);
}

/**
 * Check if an ID is a primordial template
 */
export function isPrimordialTemplate(id: string): boolean {
  return id.startsWith("primordial:") || id.startsWith("bootstrap:");
}

// Re-export bootstrap templates for direct access
export {
  BOOTSTRAP_TEMPLATES,
  genesisFromGoal,
  trailblazerFromFailures,
  ribosomeExtract,
  vesselExtend,
  isBootstrapTemplate,
};
