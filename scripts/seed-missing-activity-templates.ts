#!/usr/bin/env bun

/**
 * Seed missing activity templates identified in goal resolution assessment
 *
 * This script creates templates for common development patterns that had 0% match rate:
 * - meta.debug.* - Debugging and failure analysis
 * - meta.learning.* - Pattern discovery and template extraction
 * - utility.exploration.* - Codebase exploration
 * - tool.instrumentation.* - Runtime instrumentation
 * - Refactoring activities
 */

const API_URL = process.env.ACTIVITY_API_ENDPOINT || 'http://activity.metabob.local';
// Use record format for org_id consistency with JWT $auth.org_id
const ORG_ID = 'organizations:metabob_internal';

interface ActivityTemplate {
  variant_id: string;
  activity_id: string;
  variant_name: string;
  tags: string[];
  description: string;
  input_schema?: {
    required: Array<{ shape: string; description: string }>;
    optional?: Array<{ shape: string; description: string }>;
  };
  output_schema?: {
    produces: Array<{ shape: string; description: string }>;
  };
  task_steps: Array<{
    id: string;
    subagent: string;
    description: string;
    dependencies: string[];
    prompt: {
      template: string;
      variables?: Array<{ name: string; shape: string; description: string }>;
      maxTokens?: number;
    };
    validation?: {
      requiredFiles?: string[];
      requiredPatterns?: string[];
      forbiddenPatterns?: string[];
    };
  }>;
  scope: 'global' | 'org' | 'project';
  org_id?: string;
}

const MISSING_TEMPLATES: ActivityTemplate[] = [
  // 1. Debug: Analyze Failure
  {
    variant_id: 'meta.debug.analyze-execution-failure-v1',
    activity_id: 'meta.debug.analyze-execution-failure',
    variant_name: 'Analyze Execution Failure',
    tags: ['meta.debug', 'meta', 'utility.analysis'],
    description: 'Analyzes a failed activity execution trace to identify root cause, missing context, or incorrect assumptions. Recommends fixes or missing impulses.',
    task_steps: [
      {
        id: 'analyze-error',
        subagent: 'general-purpose',
        dependencies: [],
        description: 'Extract and categorize the error from execution trace',
        prompt: {
          template: `Analyze the failed execution trace and identify:
1. **Error Type**: What kind of error occurred? (missing file, API error, validation failure, timeout, etc.)
2. **Failure Point**: Which task step failed?
3. **Error Message**: Extract the exact error message
4. **Context**: What was the activity trying to do?

Execution Trace:
{{activityExecutionTrace}}

{{#if error}}
Error Details:
{{error}}
{{/if}}

Provide a structured analysis in JSON format.`,
          variables: [
            { name: 'activityExecutionTrace', shape: 'activityExecutionTrace', description: 'Failed execution' },
            { name: 'error', shape: 'error', description: 'Error information' },
          ],
          maxTokens: 2000,
        },
      },
      {
        id: 'identify-root-cause',
        subagent: 'general-purpose',
        dependencies: ['analyze-error'],
        description: 'Determine root cause and recommend fixes',
        prompt: {
          template: `Based on the error analysis, identify the root cause and recommend specific fixes.

Consider:
1. **Missing Impulses**: Was required context not loaded?
2. **Incorrect Assumptions**: Did the activity assume something that wasn't true?
3. **Environmental Issues**: File not found, permission denied, service unavailable?
4. **Logic Errors**: Bug in the activity template itself?

Error Analysis:
{{error_analysis}}

{{#if activityTemplate}}
Activity Template:
{{activityTemplate}}
{{/if}}

Provide:
- Root cause explanation
- Recommended fixes (code changes, impulse additions, template improvements)
- Confidence level (high/medium/low)`,
          variables: [
            { name: 'error_analysis', shape: 'analysis_report', description: 'From previous step' },
            { name: 'activityTemplate', shape: 'activityTemplate', description: 'Template definition' },
          ],
          maxTokens: 3000,
        },
      },
    ],
    scope: 'global',
  },

  // 2. Debug: Discover Missing Impulses
  {
    variant_id: 'meta.debug.discover-missing-impulses-v2',
    activity_id: 'meta.debug.discover-missing-impulses',
    variant_name: 'Discover Missing Impulses',
    tags: ['meta.debug', 'meta.learning', 'meta'],
    description: 'Compares a failed execution against successful executions of the same activity to identify which impulses were present in successes but missing in the failure.',
    task_steps: [
      {
        id: 'query-successful-executions',
        subagent: 'Bash',
        dependencies: [],
        description: 'Fetch successful executions of the same activity',
        prompt: {
          template: `Query the activity API to fetch 5-10 successful executions of activity: {{activity_id}}

Use:
curl -X POST http://activity.metabob.local/v2/activities/execution-traces \
  -H "Content-Type: application/json" \
  -H "x-org-id: ${ORG_ID}" \
  -d '{
    "activity_id": "{{activity_id}}",
    "status": "completed",
    "limit": 10
  }'

Store the results for comparison.`,
          variables: [
            { name: 'activity_id', shape: 'activity_id', description: 'Activity to query' },
          ],
          maxTokens: 1000,
        },
      },
      {
        id: 'compare-impulse-sets',
        subagent: 'general-purpose',
        dependencies: ['query-successful-executions'],
        description: 'Compare impulses used in successes vs failure',
        prompt: {
          template: `Compare the impulses loaded in successful vs failed executions:

**Failed Execution**:
{{failed_trace}}

**Successful Executions**:
{{successful_traces}}

Identify:
1. Impulses present in ALL successes but missing in failure → **Critical**
2. Impulses present in MOST successes but missing in failure → **Recommended**
3. Impulses present in failure but NOT in successes → **Potentially Harmful**

Return a ranked list with reasoning.`,
          variables: [
            { name: 'failed_trace', shape: 'activityExecutionTrace', description: 'Failed execution' },
            { name: 'successful_traces', shape: 'execution_traces_list', description: 'Successful executions' },
          ],
          maxTokens: 4000,
        },
      },
    ],
    scope: 'global',
  },

  // 3. Learning: Extract Template from Trace
  {
    variant_id: 'meta.learning.extract-activity-template-v1',
    activity_id: 'meta.learning.extract-activity-template',
    variant_name: 'Extract Activity Template (Ribosome)',
    tags: ['meta.learning', 'meta.develop', 'meta'],
    description: 'Extracts a reusable activity template from a successful execution trace. Implements the ribosome pattern for self-development.',
    task_steps: [
      {
        id: 'extract-task-steps',
        subagent: 'general-purpose',
        dependencies: [],
        description: 'Break execution into discrete task steps',
        prompt: {
          template: `Analyze this successful execution and break it into reusable task steps:

Execution Trace:
{{activityExecutionTrace}}

{{#if goal_text}}
Original Goal:
{{goal_text}}
{{/if}}

For each distinct operation:
1. Identify the step ID (short kebab-case name)
2. Write a clear description (what the step does)
3. Extract the prompt template (generalize specific values as {{variables}})
4. List required variables and their shapes
5. Define validation criteria (required files, patterns)

Return a structured JSON array of task steps.`,
          variables: [
            { name: 'activityExecutionTrace', shape: 'activityExecutionTrace', description: 'Successful execution' },
            { name: 'goal_text', shape: 'goal_text', description: 'Original goal' },
          ],
          maxTokens: 6000,
        },
      },
      {
        id: 'define-schemas',
        subagent: 'general-purpose',
        dependencies: ['extract-task-steps'],
        description: 'Define input and output schemas',
        prompt: {
          template: `Based on the task steps, define the activity's input and output schemas.

Task Steps:
{{task_steps}}

Determine:
1. **Required Inputs**: Which impulse shapes MUST be present?
2. **Optional Inputs**: Which impulse shapes improve results but aren't required?
3. **Outputs**: What impulse shapes does this activity produce?

Consider the state transitions and what this activity actually does.

Return input_schema and output_schema in the standard format.`,
          variables: [
            { name: 'task_steps', shape: 'task_steps_json', description: 'Extracted task steps' },
          ],
          maxTokens: 2000,
        },
      },
      {
        id: 'assign-tags',
        subagent: 'general-purpose',
        dependencies: ['define-schemas'],
        description: 'Assign hierarchical tags based on activity purpose',
        prompt: {
          template: `Assign appropriate tags to this activity template.

Activity Purpose:
{{description}}

Task Steps:
{{task_steps}}

Choose 2-4 tags from hierarchical system:
- feature.* (creates/modifies functionality)
- bugfix (fixes errors)
- meta.debug.* (debugging/analysis)
- meta.learning.* (pattern discovery, template extraction)
- meta.refactor.* (restructuring)
- meta.develop.* (self-development)
- utility.code.* (code operations)
- utility.exploration.* (codebase exploration)
- tool.* (tooling and infrastructure)

Return tags in order of specificity (most specific first).`,
          variables: [
            { name: 'description', shape: 'text', description: 'Activity description' },
            { name: 'task_steps', shape: 'task_steps_json', description: 'Task steps' },
          ],
          maxTokens: 1000,
        },
      },
    ],
    scope: 'global',
  },

  // 4. Exploration: Explore Codebase Structure
  {
    variant_id: 'utility.exploration.analyze-codebase-structure-v1',
    activity_id: 'utility.exploration.analyze-codebase-structure',
    variant_name: 'Analyze Codebase Structure',
    tags: ['tool', 'utility.exploration', 'utility.code.analysis'],
    description: 'Explores a codebase to understand its structure, identify entry points, map dependencies, and document architecture.',
    task_steps: [
      {
        id: 'scan-directory-structure',
        subagent: 'Explore',
        dependencies: [],
        description: 'Scan directory structure and identify key files',
        prompt: {
          template: `Explore the codebase structure at: {{directory_path}}

Use tools to:
1. List top-level directories
2. Identify configuration files (package.json, tsconfig.json, etc.)
3. Find entry points (index.ts, main.ts, server.ts)
4. Locate test directories
5. Find documentation files

{{#if focus_areas}}
Focus on these areas: {{focus_areas}}
{{/if}}

Provide a structured summary of the codebase layout.`,
          variables: [
            { name: 'directory_path', shape: 'directory_path', description: 'Root directory' },
            { name: 'focus_areas', shape: 'focus_areas', description: 'Areas to focus on' },
          ],
          maxTokens: 4000,
        },
        validation: {
          requiredPatterns: ['directory_structure', 'entry_points'],
        },
      },
      {
        id: 'analyze-dependencies',
        subagent: 'Explore',
        dependencies: ['scan-directory-structure'],
        description: 'Map module dependencies and imports',
        prompt: {
          template: `Analyze the dependency structure:

Codebase Structure:
{{codebase_structure}}

1. Read package.json for external dependencies
2. Scan import statements in main files
3. Identify internal module relationships
4. Find circular dependencies (if any)

Create a dependency graph showing how modules relate.`,
          variables: [
            { name: 'codebase_structure', shape: 'codebase_structure', description: 'From previous step' },
          ],
          maxTokens: 3000,
        },
      },
      {
        id: 'document-architecture',
        subagent: 'general-purpose',
        dependencies: ['analyze-dependencies'],
        description: 'Document architectural patterns and design decisions',
        prompt: {
          template: `Based on the codebase exploration, document:

1. **Architecture Pattern**: MVC, microservices, monolith, etc.
2. **Key Technologies**: Frameworks, libraries, databases
3. **Data Flow**: How data moves through the system
4. **API Design**: REST, GraphQL, RPC, etc.
5. **Testing Strategy**: Unit tests, integration tests
6. **Deployment**: How the code is deployed

Provide a concise architectural overview.`,
          variables: [
            { name: 'codebase_structure', shape: 'codebase_structure', description: 'Structure info' },
            { name: 'dependency_graph', shape: 'dependency_graph', description: 'Dependencies' },
          ],
          maxTokens: 2000,
        },
      },
    ],
    scope: 'global',
  },

  // 5. Refactoring: Simplify and Optimize
  {
    variant_id: 'meta.refactor.simplify-code-v1',
    activity_id: 'meta.refactor.simplify-code',
    variant_name: 'Simplify and Optimize Code',
    tags: ['meta.refactor', 'meta', 'utility.code.quality'],
    description: 'Refactors code to improve readability, reduce complexity, and optimize performance while maintaining functionality.',
    task_steps: [
      {
        id: 'analyze-code-smells',
        subagent: 'general-purpose',
        dependencies: [],
        description: 'Identify code smells and improvement opportunities',
        prompt: {
          template: `Analyze this code for improvement opportunities:

File: {{file_path}}
{{source_code}}

{{#if refactoring_goals}}
Focus on: {{refactoring_goals}}
{{/if}}

Identify:
1. **Complexity**: Long functions, deep nesting, high cyclomatic complexity
2. **Duplication**: Repeated code patterns
3. **Naming**: Unclear variable/function names
4. **Structure**: Poorly organized code
5. **Performance**: Inefficient operations

Prioritize improvements by impact.`,
          variables: [
            { name: 'file_path', shape: 'file_path', description: 'File path' },
            { name: 'source_code', shape: 'source_code', description: 'Code to analyze' },
            { name: 'refactoring_goals', shape: 'refactoring_goals', description: 'Specific goals' },
          ],
          maxTokens: 3000,
        },
      },
      {
        id: 'refactor-code',
        subagent: 'general-purpose',
        dependencies: ['analyze-code-smells'],
        description: 'Apply refactoring transformations',
        prompt: {
          template: `Refactor the code based on the analysis:

Code Smells Identified:
{{code_smells}}

Original Code:
{{source_code}}

Apply refactoring:
1. Extract functions for complex logic
2. Reduce nesting with early returns
3. Rename variables for clarity
4. Remove duplication
5. Optimize performance bottlenecks

Preserve behavior - don't change functionality!

{{#if test_suite}}
Tests must still pass:
{{test_suite}}
{{/if}}

Return the refactored code.`,
          variables: [
            { name: 'code_smells', shape: 'analysis_report', description: 'From analysis step' },
            { name: 'source_code', shape: 'source_code', description: 'Original code' },
            { name: 'test_suite', shape: 'test_suite', description: 'Tests to preserve' },
          ],
          maxTokens: 6000,
        },
        validation: {
          forbiddenPatterns: ['TODO:', 'FIXME:', '// broken'],
        },
      },
    ],
    scope: 'global',
  },
];

async function seedTemplate(template: ActivityTemplate) {
  console.log(`\nSeeding: ${template.activity_id} - ${template.variant_name}`);
  console.log(`Tags: [${template.tags.join(', ')}]`);

  try {
    const response = await fetch(`${API_URL}/v2/activities/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-org-id': ORG_ID,
      },
      body: JSON.stringify({
        ...template,
        org_id: template.scope === 'org' ? ORG_ID : undefined,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Failed: ${response.status} - ${error}`);
      return false;
    }

    const result = await response.json();
    console.log(`✅ Created: ${result.variant_id || result.id}`);
    return true;
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('SEED MISSING ACTIVITY TEMPLATES');
  console.log('='.repeat(80));
  console.log(`API: ${API_URL}`);
  console.log(`Organization: ${ORG_ID}`);
  console.log(`Templates to seed: ${MISSING_TEMPLATES.length}`);
  console.log('='.repeat(80));

  let succeeded = 0;
  let failed = 0;

  for (const template of MISSING_TEMPLATES) {
    const success = await seedTemplate(template);
    if (success) {
      succeeded++;
    } else {
      failed++;
    }
    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n' + '='.repeat(80));
  console.log('SEEDING COMPLETE');
  console.log('='.repeat(80));
  console.log(`✅ Succeeded: ${succeeded}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Total: ${MISSING_TEMPLATES.length}`);
  console.log('='.repeat(80));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
