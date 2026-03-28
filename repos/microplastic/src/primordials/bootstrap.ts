/**
 * Bootstrap Templates
 *
 * These are the self-hosting templates that enable the vessel to:
 * 1. Create new activities from goals (genesis)
 * 2. Create improved variants from failures (trailblazer)
 * 3. Extend its own capabilities (vessel-extend)
 *
 * Together with ribosome (extract-template-from-trace), these form
 * the "compiler written in its own language" - the minimal set
 * needed for true self-hosting.
 */

import type { ActivityTemplate } from "@metabob/minibob";

// =============================================================================
// GENESIS: CREATE ACTIVITY FROM GOAL
// =============================================================================

/**
 * The generative act - creates new activity templates from goals.
 * This is how the vessel gains new capabilities.
 * Automatically fetches example templates from the backend as learning material.
 */
export const genesisFromGoal: ActivityTemplate = {
  id: "primordial:genesis-from-goal",
  name: "Genesis: Create Activity from Goal",
  description:
    "Creates a new activity template from a goal description. Automatically fetches example templates from the backend as learning material.",
  category: "tool",
  variables: [
    {
      name: "goal",
      type: "string",
      description: "The goal or capability to achieve",
      required: true,
    },
    {
      name: "category",
      type: "string",
      description: "Category: feature, bugfix, refactor, tool, infrastructure",
      required: false,
    },
  ],
  // Note: Impulses are resolved at runtime based on task.impulseReferences
  // The executor loads impulses from the backend when tasks reference them
  tasks: [
    {
      id: "load-examples",
      description: "Analyze example templates loaded via impulses",
      impulseReferences: ["example-templates", "top-performing-templates"],
      prompt: {
        template: `Analyze the example templates that have been loaded for you.

Goal: {goal}
Category: {category}

**The following impulses contain example templates:**
- {impulse:example-templates} - Templates similar to your goal
- {impulse:top-performing-templates} - High success-rate templates

**For each template, analyze:**
1. Template structure (id, name, tasks)
2. How tasks are organized and what they accomplish
3. Variable patterns used (required vs optional, types, defaults)
4. Validation patterns used (requiredFiles, requiredPatterns)
5. What makes the prompts effective
6. Dependencies between tasks

**Output a summary of:**
- Common patterns across templates
- Best practices observed
- Task structure approaches that work well
- Validation strategies

These patterns will inform how we structure the new template.`,
        variables: [
          { name: "goal", type: "string", required: true },
          { name: "category", type: "string", required: false },
        ],
      },
      validation: {},
      retry: { maxAttempts: 2, strategy: "simple" },
    },
    {
      id: "analyze-goal",
      description: "Analyze the goal to understand what capability is needed",
      dependencies: ["load-examples"],
      prompt: {
        template: `Analyze this goal to understand what activity is needed.

Goal: {goal}
Category: {category}

**Use the example templates loaded earlier as reference for structure.**

Identify:
1. **Core capability**: What should this activity accomplish?
2. **Input requirements**: What data/context does it need?
3. **Output expectations**: What should it produce?
4. **Key steps**: What logical steps are involved? (refer to similar examples)
5. **Failure modes**: What could go wrong?
6. **Validation**: How do we know it worked?

Think about what tools would be needed (bash, read, write, edit, git).
Provide structured analysis.`,
        variables: [
          { name: "goal", type: "string", required: true },
          { name: "category", type: "string", required: false },
        ],
      },
      validation: {},
      retry: { maxAttempts: 2, strategy: "simple" },
    },
    {
      id: "design-template",
      description: "Design the activity template structure",
      dependencies: ["analyze-goal"],
      prompt: {
        template: `Design an activity template based on the goal analysis and example templates.

Goal: {goal}

**Learn from the example templates** - use similar task structures, variable patterns, and validation approaches.

Create a template with:
1. A unique, descriptive ID (kebab-case)
2. Clear name and description
3. Required and optional variables
4. Tasks with clear prompts and validation (model after examples)
5. Input/output schemas for composition

Output the complete template as JSON:
\`\`\`json
{
  "id": "...",
  "name": "...",
  "description": "...",
  "category": "{category}",
  "variables": [...],
  "input_schema": { "required": [...], "optional": [...] },
  "output_schema": { "produces": [...] },
  "tasks": [...],
  "metadata": { "generatedFrom": "genesis" }
}
\`\`\``,
        variables: [
          { name: "goal", type: "string", required: true },
          { name: "category", type: "string", required: false },
        ],
      },
      validation: {
        requiredPatterns: ["```json", '"id":', '"tasks":'],
      },
      retry: { maxAttempts: 2, strategy: "progressive-context" },
    },
    {
      id: "register-template",
      description: "Register the template with the backend via tool",
      dependencies: ["design-template"],
      outputImpulses: ["generated-template"],
      prompt: {
        template: `The template has been designed. Now register it with the backend using the register_activity_template tool.

**Extract the JSON template from the design-template step.**

The tool will automatically:
- Transform to API format (id -> variant_id, tasks -> task_steps, etc.)
- Set scope to 'global'
- Initialize Thompson Sampling metrics
- Return the registered template ID

**If no register_activity_template tool is available**, write the template to a JSON file at:
\`.microplastic/templates/generated/<template-id>.json\`

This allows local testing before backend registration.

Report the outcome (registered or saved locally).`,
        variables: [],
      },
      validation: {},
      retry: { maxAttempts: 2, strategy: "simple" },
    },
  ],
  metadata: {
    primordial: true,
    bootstrap: true,
    level: 0,
    description: "The generative act - creates new activity templates from goals",
    initialAlpha: 1,
    initialBeta: 1,
  } as ActivityTemplate["metadata"],
};

// =============================================================================
// TRAILBLAZER: CREATE VARIANT FROM FAILURES
// =============================================================================

/**
 * The learning act - analyzes failure patterns and creates improved variants.
 */
export const trailblazerFromFailures: ActivityTemplate = {
  id: "primordial:trailblazer-from-failures",
  name: "Trailblazer: Create Variant from Failures",
  description:
    "Analyzes failure patterns in execution traces and creates an improved variant template.",
  category: "tool",
  variables: [
    {
      name: "templateId",
      type: "string",
      description: "The ID of the failing template",
      required: true,
    },
    {
      name: "failureCount",
      type: "number",
      description: "Number of recent failures to analyze",
      required: false,
    },
  ],
  // Note: Impulses are resolved at runtime based on task.impulseReferences
  tasks: [
    {
      id: "load-failures",
      description: "Analyze the failing template and traces loaded via impulses",
      impulseReferences: ["failing-template", "failed-traces", "successful-traces"],
      prompt: {
        template: `Analyze the failing activity template and its execution traces.

Template ID: {templateId}

**Loaded impulses:**
- {impulse:failing-template} - The template definition
- {impulse:failed-traces} - Recent failed executions
- {impulse:successful-traces} - Successful executions for comparison

**Report:**
1. Template structure (tasks, variables, validation)
2. Summary of each failed execution (which task, why)
3. Comparison with successful traces - what's different?`,
        variables: [
          { name: "templateId", type: "string", required: true },
        ],
      },
      validation: {},
      retry: { maxAttempts: 2, strategy: "simple" },
    },
    {
      id: "categorize-failures",
      description: "Categorize the failure patterns",
      prompt: {
        template: `Analyze the failure traces and categorize the failure patterns.

For each failure, identify:
1. Which task failed
2. Failure type (tool error, validation mismatch, token overflow, LLM confusion, etc.)
3. Root cause
4. Frequency

Group failures by pattern and identify the most impactful pattern to fix.`,
        variables: [],
      },
      validation: {
        requiredPatterns: ["Pattern", "cause"],
      },
      retry: { maxAttempts: 2, strategy: "simple" },
    },
    {
      id: "design-fixes",
      description: "Design fixes for the failure patterns",
      prompt: {
        template: `Design specific fixes for each failure pattern.

Consider:
1. Prompt improvements - clearer instructions
2. Variable changes - missing inputs, better defaults
3. Task restructuring - split complex tasks
4. Validation adjustments - relax over-strict patterns
5. Retry strategy changes
6. Context management - reduce token usage

Be specific about what to change.`,
        variables: [],
      },
      validation: {
        requiredPatterns: ["Fix", "Change"],
      },
      retry: { maxAttempts: 2, strategy: "simple" },
    },
    {
      id: "implement-variant",
      description: "Implement the improved variant",
      prompt: {
        template: `Create an improved variant of the template with the designed fixes.

Template ID: {templateId}

Create a new template that:
1. Has ID: original-id-v2 (or appropriate version)
2. Includes variant_of field linking to original
3. Applies all designed fixes
4. Maintains same input/output schema

Output the variant template JSON.`,
        variables: [{ name: "templateId", type: "string", required: true }],
      },
      validation: {
        requiredPatterns: ["```json", "variant"],
      },
      retry: { maxAttempts: 2, strategy: "progressive-context" },
    },
    {
      id: "register-variant",
      description: "Register the variant with the backend via tool",
      outputImpulses: ["generated-variant"],
      prompt: {
        template: `Register the improved variant template using the register_activity_template tool.

**Extract the JSON template from implement-variant.**

The tool will:
1. Store the variant in the backend
2. Initialize Thompson Sampling
3. Link it to the original template

Future executions will probabilistically select between original and variant.

**If no tool available**, write to:
\`.microplastic/templates/variants/{templateId}-v2.json\`

Report outcome.`,
        variables: [{ name: "templateId", type: "string", required: true }],
      },
      validation: {},
      retry: { maxAttempts: 2, strategy: "simple" },
    },
  ],
  metadata: {
    primordial: true,
    bootstrap: true,
    level: 0,
    description: "The learning act - creates improved variants from failure analysis",
    initialAlpha: 1,
    initialBeta: 1,
  } as ActivityTemplate["metadata"],
};

// =============================================================================
// RIBOSOME: EXTRACT TEMPLATE FROM TRACE
// =============================================================================

/**
 * The extraction act - extracts reusable templates from successful executions.
 */
export const ribosomeExtract: ActivityTemplate = {
  id: "primordial:ribosome-extract",
  name: "Ribosome: Extract Template from Trace",
  description:
    "Extracts a reusable activity template from a successful execution trace.",
  category: "tool",
  variables: [
    {
      name: "traceId",
      type: "string",
      description: "The execution trace ID to extract from",
      required: true,
    },
    {
      name: "goal",
      type: "string",
      description: "The original goal (optional)",
      required: false,
    },
  ],
  // Note: Impulses are resolved at runtime based on task.impulseReferences
  tasks: [
    {
      id: "load-trace",
      description: "Analyze the execution trace loaded via impulse",
      impulseReferences: ["execution-trace", "similar-templates"],
      prompt: {
        template: `Analyze the execution trace to understand the successful pattern.

**Loaded impulses:**
- {impulse:execution-trace} - The execution trace to extract from
- {impulse:similar-templates} - Similar templates for structural reference

**Report:**
1. What was the goal?
2. What steps were taken?
3. What tools were used and in what order?
4. What made it successful?
5. How do similar templates structure their tasks?`,
        variables: [
          { name: "traceId", type: "string", required: true },
        ],
      },
      validation: {},
      retry: { maxAttempts: 2, strategy: "simple" },
    },
    {
      id: "analyze-pattern",
      description: "Analyze the successful pattern",
      prompt: {
        template: `Analyze the execution trace to understand the successful pattern.

Identify:
1. High-level steps taken
2. Tools used and in what order
3. Context needed at each step
4. What made it successful
5. What can be generalized vs specific`,
        variables: [],
      },
      validation: {
        requiredPatterns: ["step", "tool"],
      },
      retry: { maxAttempts: 2, strategy: "simple" },
    },
    {
      id: "extract-template",
      description: "Extract the reusable template",
      prompt: {
        template: `Generate a reusable activity template from the trace analysis.

Original goal: {goal}

Create a template that:
1. Has a clear, descriptive ID
2. Parameterizes specific values as variables
3. Has appropriate validation
4. Is generalized for similar problems
5. Includes input/output schemas

Output the complete template JSON.`,
        variables: [{ name: "goal", type: "string", required: false }],
      },
      validation: {
        requiredPatterns: ["```json", '"id":', '"tasks":'],
      },
      retry: { maxAttempts: 2, strategy: "progressive-context" },
    },
    {
      id: "register-template",
      description: "Register the extracted template via tool",
      outputImpulses: ["extracted-template"],
      prompt: {
        template: `Register the extracted template using the register_activity_template tool.

**Extract the JSON template from the previous step.**

The tool will:
- Transform to API format
- Store in the backend
- Initialize Thompson Sampling

**If no tool available**, write to:
\`.microplastic/templates/extracted/{template-id}.json\`

Report outcome.`,
        variables: [],
      },
      validation: {},
      retry: { maxAttempts: 2, strategy: "simple" },
    },
  ],
  metadata: {
    primordial: true,
    bootstrap: true,
    level: 0,
    description: "The extraction act - creates templates from successful executions",
    initialAlpha: 1,
    initialBeta: 1,
  } as ActivityTemplate["metadata"],
};

// =============================================================================
// VESSEL EXTEND: ADD NEW CAPABILITY
// =============================================================================

/**
 * The self-modification act - vessel extends its own capabilities.
 */
export const vesselExtend: ActivityTemplate = {
  id: "primordial:vessel-extend",
  name: "Vessel: Add New Capability",
  description:
    "Extends the vessel by adding a new capability (resolver, tool, hook, or activity type).",
  category: "infrastructure",
  variables: [
    {
      name: "capability",
      type: "string",
      description: "Description of the capability to add",
      required: true,
    },
    {
      name: "capabilityType",
      type: "string",
      description: "Type: resolver, tool, hook, or activity",
      required: true,
    },
    {
      name: "vesselPath",
      type: "string",
      description: "Path to the vessel source code",
      required: false,
    },
  ],
  tasks: [
    {
      id: "understand-vessel",
      description: "Understand the vessel structure",
      prompt: {
        template: `Understand the vessel structure for adding a new capability.

Vessel path: {vesselPath}
Capability: {capability}
Type: {capabilityType}

Read the vessel's entry point and existing {capabilityType}s.
Identify where they're defined and how they're registered.`,
        variables: [
          { name: "vesselPath", type: "string", required: false },
          { name: "capability", type: "string", required: true },
          { name: "capabilityType", type: "string", required: true },
        ],
      },
      validation: {},
      retry: { maxAttempts: 1, strategy: "simple" },
    },
    {
      id: "design-capability",
      description: "Design the new capability",
      prompt: {
        template: `Design the new capability.

Capability: {capability}
Type: {capabilityType}

Design:
1. Interface it fulfills
2. Implementation approach
3. Registration method
4. Configuration needed
5. Dependencies`,
        variables: [
          { name: "capability", type: "string", required: true },
          { name: "capabilityType", type: "string", required: true },
        ],
      },
      validation: {
        requiredPatterns: ["Interface", "Implementation"],
      },
      retry: { maxAttempts: 2, strategy: "simple" },
    },
    {
      id: "implement",
      description: "Implement the capability",
      prompt: {
        template: `Implement the designed capability.

Capability: {capability}
Type: {capabilityType}
Vessel path: {vesselPath}

Create or modify files following existing patterns.
Use Bun APIs, add types, include error handling.`,
        variables: [
          { name: "capability", type: "string", required: true },
          { name: "capabilityType", type: "string", required: true },
          { name: "vesselPath", type: "string", required: false },
        ],
      },
      validation: {
        requiredPatterns: ["export"],
      },
      retry: { maxAttempts: 2, strategy: "progressive-context" },
    },
    {
      id: "verify",
      description: "Verify the implementation",
      prompt: {
        template: `Verify the capability implementation.

1. Run type check: bun run typecheck
2. Run tests: bun test
3. Fix any issues

Report results.`,
        variables: [],
      },
      validation: {},
      retry: { maxAttempts: 3, strategy: "progressive-context" },
    },
  ],
  metadata: {
    primordial: true,
    bootstrap: true,
    level: 0,
    description: "The self-modification act - vessel extends its own capabilities",
    initialAlpha: 1,
    initialBeta: 1,
  } as ActivityTemplate["metadata"],
};

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * All bootstrap templates
 */
export const BOOTSTRAP_TEMPLATES: ActivityTemplate[] = [
  genesisFromGoal,
  trailblazerFromFailures,
  ribosomeExtract,
  vesselExtend,
];

/**
 * Check if a template is a bootstrap template
 */
export function isBootstrapTemplate(id: string): boolean {
  return BOOTSTRAP_TEMPLATES.some((t) => t.id === id);
}
