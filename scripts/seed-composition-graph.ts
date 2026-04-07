#!/usr/bin/env bun
/**
 * Seed Composition Graph
 *
 * Populates the activity composition graph with foundational programming patterns.
 * These compositions define how activities orchestrate to achieve common goals.
 *
 * Run: bun scripts/seed-composition-graph.ts
 */

const ACTIVITY_API = process.env.ACTIVITY_API_ENDPOINT || 'http://activity.metabob.local';

// =============================================================================
// Shape Definitions
// =============================================================================

/**
 * Standard impulse shapes used across the system.
 * Shapes describe structural types, not values.
 */
const SHAPES = {
  // Goal shapes
  GOAL_TEXT: 'goal:text',
  GOAL_BUGFIX: 'goal:bugfix',
  GOAL_FEATURE: 'goal:feature',
  GOAL_REFACTOR: 'goal:refactor',
  GOAL_TEST: 'goal:test',

  // Code state shapes
  CODE_TYPESCRIPT: 'code:typescript',
  CODE_PYTHON: 'code:python',
  CODE_MODIFIED: 'code:modified',
  CODE_CREATED: 'code:created',

  // Validation shapes
  TYPESCRIPT_COMPILES: 'typescript:compiles',
  TYPESCRIPT_ERROR: 'typescript:error',
  TYPESCRIPT_TYPE_ERROR: 'typescript:type-error',
  LINT_PASSES: 'lint:passes',
  LINT_ERROR: 'lint:error',

  // Test shapes
  TEST_PASSING: 'test:passing',
  TEST_FAILING: 'test:failing',
  TEST_CREATED: 'test:created',

  // Build shapes
  BUILD_SUCCESS: 'build:success',
  BUILD_FAILURE: 'build:failure',

  // Git shapes
  GIT_CLEAN: 'git:clean',
  GIT_STAGED: 'git:staged',
  GIT_COMMITTED: 'git:committed',

  // Analysis shapes
  ERROR_ANALYZED: 'error:analyzed',
  FIX_IDENTIFIED: 'fix:identified',
  IMPLEMENTATION_PLAN: 'implementation:plan',

  // Context shapes
  CONTEXT_CODEBASE: 'context:codebase',
  CONTEXT_ERROR_LOG: 'context:error-log',
  CONTEXT_REQUIREMENTS: 'context:requirements',
} as const;

// =============================================================================
// Activity Templates
// =============================================================================

interface ActivityTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  input_shapes: string[];
  output_shapes: string[];
  tasks: Array<{
    id: string;
    description: string;
    tool?: string;
    validation?: { patterns: string[] };
  }>;
}

/**
 * Foundational leaf activities (don't call other activities)
 * Using valid categories: feature, bugfix, refactor, tool, infrastructure, meta
 */
const LEAF_ACTIVITIES: ActivityTemplate[] = [
  {
    id: 'analyze:error',
    name: 'Analyze Error',
    description: 'Analyze an error message to understand root cause',
    category: 'tool',  // Analysis is a tool capability
    input_shapes: [SHAPES.CONTEXT_ERROR_LOG],
    output_shapes: [SHAPES.ERROR_ANALYZED, SHAPES.FIX_IDENTIFIED],
    tasks: [
      { id: 'read-error', description: 'Read and parse the error message' },
      { id: 'trace-source', description: 'Trace error to source location' },
      { id: 'identify-cause', description: 'Identify root cause' },
    ],
  },
  {
    id: 'code:implement',
    name: 'Implement Code',
    description: 'Write code to implement a fix or feature',
    category: 'feature',  // Code implementation is feature work
    input_shapes: [SHAPES.FIX_IDENTIFIED],
    output_shapes: [SHAPES.CODE_MODIFIED],
    tasks: [
      { id: 'plan-changes', description: 'Plan the code changes needed' },
      { id: 'implement', description: 'Implement the changes' },
    ],
  },
  {
    id: 'validate:typescript',
    name: 'Validate TypeScript',
    description: 'Run TypeScript compiler to check for errors',
    category: 'tool',  // Validation is a tool
    input_shapes: [SHAPES.CODE_MODIFIED],
    output_shapes: [SHAPES.TYPESCRIPT_COMPILES, SHAPES.TYPESCRIPT_ERROR],
    tasks: [
      {
        id: 'run-tsc',
        description: 'Run tsc --noEmit',
        tool: 'bash',
        validation: { patterns: ['error TS'] },
      },
    ],
  },
  {
    id: 'validate:lint',
    name: 'Validate Lint',
    description: 'Run linter to check code style',
    category: 'tool',  // Validation is a tool
    input_shapes: [SHAPES.CODE_MODIFIED],
    output_shapes: [SHAPES.LINT_PASSES, SHAPES.LINT_ERROR],
    tasks: [
      { id: 'run-lint', description: 'Run eslint', tool: 'bash' },
    ],
  },
  {
    id: 'test:run',
    name: 'Run Tests',
    description: 'Execute test suite',
    category: 'tool',  // Test runner is a tool
    input_shapes: [SHAPES.CODE_MODIFIED],
    output_shapes: [SHAPES.TEST_PASSING, SHAPES.TEST_FAILING],
    tasks: [
      { id: 'run-tests', description: 'Run test suite', tool: 'bash' },
    ],
  },
  {
    id: 'git:stage',
    name: 'Stage Changes',
    description: 'Stage modified files for commit',
    category: 'tool',  // Git is a tool
    input_shapes: [SHAPES.CODE_MODIFIED],
    output_shapes: [SHAPES.GIT_STAGED],
    tasks: [
      { id: 'git-add', description: 'Stage changed files', tool: 'bash' },
    ],
  },
  {
    id: 'git:commit',
    name: 'Commit Changes',
    description: 'Create a git commit',
    category: 'tool',  // Git is a tool
    input_shapes: [SHAPES.GIT_STAGED],
    output_shapes: [SHAPES.GIT_COMMITTED],
    tasks: [
      { id: 'git-commit', description: 'Create commit with message', tool: 'bash' },
    ],
  },
];

/**
 * Orchestrating activities (compose leaf activities)
 */
const ORCHESTRATING_ACTIVITIES: ActivityTemplate[] = [
  {
    id: 'goal:fix-bug',
    name: 'Fix Bug',
    description: 'Orchestrates bug fix: analyze → implement → validate → test',
    category: 'bugfix',
    input_shapes: [SHAPES.GOAL_BUGFIX, SHAPES.CONTEXT_ERROR_LOG],
    output_shapes: [SHAPES.TEST_PASSING, SHAPES.TYPESCRIPT_COMPILES],
    tasks: [
      { id: 'step-1', description: 'Analyze the error', tool: 'execute_activity' },
      { id: 'step-2', description: 'Implement fix', tool: 'execute_activity' },
      { id: 'step-3', description: 'Validate TypeScript', tool: 'execute_activity' },
      { id: 'step-4', description: 'Run tests', tool: 'execute_activity' },
    ],
  },
  {
    id: 'goal:implement-feature',
    name: 'Implement Feature',
    description: 'Orchestrates feature: plan → implement → validate → test',
    category: 'feature',
    input_shapes: [SHAPES.GOAL_FEATURE, SHAPES.CONTEXT_REQUIREMENTS],
    output_shapes: [SHAPES.TEST_PASSING, SHAPES.TYPESCRIPT_COMPILES],
    tasks: [
      { id: 'step-1', description: 'Plan implementation', tool: 'execute_activity' },
      { id: 'step-2', description: 'Implement feature', tool: 'execute_activity' },
      { id: 'step-3', description: 'Validate TypeScript', tool: 'execute_activity' },
      { id: 'step-4', description: 'Run tests', tool: 'execute_activity' },
    ],
  },
  {
    id: 'goal:validate-and-commit',
    name: 'Validate and Commit',
    description: 'Orchestrates: validate → lint → test → stage → commit',
    category: 'infrastructure',  // Git workflow is infrastructure
    input_shapes: [SHAPES.CODE_MODIFIED],
    output_shapes: [SHAPES.GIT_COMMITTED],
    tasks: [
      { id: 'step-1', description: 'Validate TypeScript', tool: 'execute_activity' },
      { id: 'step-2', description: 'Run linter', tool: 'execute_activity' },
      { id: 'step-3', description: 'Run tests', tool: 'execute_activity' },
      { id: 'step-4', description: 'Stage changes', tool: 'execute_activity' },
      { id: 'step-5', description: 'Create commit', tool: 'execute_activity' },
    ],
  },
];

// =============================================================================
// Composition Edges
// =============================================================================

interface CompositionEdge {
  parent_activity_id: string;
  child_activity_id: string;
  input_impulse_shapes: string[];
  output_impulse_shapes: string[];
  success: boolean;
  execution_count?: number;
}

/**
 * Composition edges defining activity orchestration patterns
 */
const COMPOSITION_EDGES: CompositionEdge[] = [
  // goal:fix-bug orchestration
  {
    parent_activity_id: 'goal:fix-bug',
    child_activity_id: 'analyze:error',
    input_impulse_shapes: [SHAPES.CONTEXT_ERROR_LOG],
    output_impulse_shapes: [SHAPES.ERROR_ANALYZED, SHAPES.FIX_IDENTIFIED],
    success: true,
    execution_count: 10,
  },
  {
    parent_activity_id: 'goal:fix-bug',
    child_activity_id: 'code:implement',
    input_impulse_shapes: [SHAPES.FIX_IDENTIFIED],
    output_impulse_shapes: [SHAPES.CODE_MODIFIED],
    success: true,
    execution_count: 10,
  },
  {
    parent_activity_id: 'goal:fix-bug',
    child_activity_id: 'validate:typescript',
    input_impulse_shapes: [SHAPES.CODE_MODIFIED],
    output_impulse_shapes: [SHAPES.TYPESCRIPT_COMPILES],
    success: true,
    execution_count: 8,
  },
  {
    parent_activity_id: 'goal:fix-bug',
    child_activity_id: 'test:run',
    input_impulse_shapes: [SHAPES.TYPESCRIPT_COMPILES],
    output_impulse_shapes: [SHAPES.TEST_PASSING],
    success: true,
    execution_count: 7,
  },

  // goal:implement-feature orchestration
  {
    parent_activity_id: 'goal:implement-feature',
    child_activity_id: 'code:implement',
    input_impulse_shapes: [SHAPES.IMPLEMENTATION_PLAN],
    output_impulse_shapes: [SHAPES.CODE_MODIFIED],
    success: true,
    execution_count: 8,
  },
  {
    parent_activity_id: 'goal:implement-feature',
    child_activity_id: 'validate:typescript',
    input_impulse_shapes: [SHAPES.CODE_MODIFIED],
    output_impulse_shapes: [SHAPES.TYPESCRIPT_COMPILES],
    success: true,
    execution_count: 7,
  },
  {
    parent_activity_id: 'goal:implement-feature',
    child_activity_id: 'test:run',
    input_impulse_shapes: [SHAPES.TYPESCRIPT_COMPILES],
    output_impulse_shapes: [SHAPES.TEST_PASSING],
    success: true,
    execution_count: 6,
  },

  // goal:validate-and-commit orchestration
  {
    parent_activity_id: 'goal:validate-and-commit',
    child_activity_id: 'validate:typescript',
    input_impulse_shapes: [SHAPES.CODE_MODIFIED],
    output_impulse_shapes: [SHAPES.TYPESCRIPT_COMPILES],
    success: true,
    execution_count: 15,
  },
  {
    parent_activity_id: 'goal:validate-and-commit',
    child_activity_id: 'validate:lint',
    input_impulse_shapes: [SHAPES.TYPESCRIPT_COMPILES],
    output_impulse_shapes: [SHAPES.LINT_PASSES],
    success: true,
    execution_count: 14,
  },
  {
    parent_activity_id: 'goal:validate-and-commit',
    child_activity_id: 'test:run',
    input_impulse_shapes: [SHAPES.LINT_PASSES],
    output_impulse_shapes: [SHAPES.TEST_PASSING],
    success: true,
    execution_count: 12,
  },
  {
    parent_activity_id: 'goal:validate-and-commit',
    child_activity_id: 'git:stage',
    input_impulse_shapes: [SHAPES.TEST_PASSING],
    output_impulse_shapes: [SHAPES.GIT_STAGED],
    success: true,
    execution_count: 12,
  },
  {
    parent_activity_id: 'goal:validate-and-commit',
    child_activity_id: 'git:commit',
    input_impulse_shapes: [SHAPES.GIT_STAGED],
    output_impulse_shapes: [SHAPES.GIT_COMMITTED],
    success: true,
    execution_count: 11,
  },

  // Cross-orchestration edges (activities calling each other)
  {
    parent_activity_id: 'validate:typescript',
    child_activity_id: 'analyze:error',
    input_impulse_shapes: [SHAPES.TYPESCRIPT_ERROR],
    output_impulse_shapes: [SHAPES.ERROR_ANALYZED],
    success: true,
    execution_count: 5,
  },
];

// =============================================================================
// API Functions
// =============================================================================

async function createTemplate(template: ActivityTemplate): Promise<boolean> {
  try {
    const response = await fetch(`${ACTIVITY_API}/v2/activities/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: template.id,  // Required field
        name: template.name,
        description: template.description,
        category: template.category,
        input_impulse_shapes: template.input_shapes,
        output_impulse_shapes: template.output_shapes,
        tasks: template.tasks.map((t, i) => ({
          id: t.id,
          description: t.description,
          order: i + 1,
          prompt: { template: t.description, variables: [] },
          tools: t.tool ? [t.tool] : ['bash', 'read', 'write', 'edit'],
        })),
        tags: [template.category, 'seeded'],
        public: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Failed to create template ${template.id}: ${error}`);
      return false;
    }

    console.log(`✓ Created template: ${template.id}`);
    return true;
  } catch (error) {
    console.error(`Error creating template ${template.id}:`, error);
    return false;
  }
}

function generateExecutionId(): string {
  return `seed_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

async function recordComposition(edge: CompositionEdge): Promise<boolean> {
  try {
    // Record multiple times to build up metrics
    const count = edge.execution_count || 1;
    for (let i = 0; i < count; i++) {
      const response = await fetch(`${ACTIVITY_API}/v2/activities/composition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent_activity_id: edge.parent_activity_id,
          child_activity_id: edge.child_activity_id,
          execution_id: generateExecutionId(),  // Required field
          input_impulse_shapes: edge.input_impulse_shapes,
          output_impulse_shapes: edge.output_impulse_shapes,
          success: edge.success,
          duration_ms: 1000 + Math.random() * 2000,
          cost_usd: 0.001 + Math.random() * 0.01,
        }),
      });

      if (!response.ok && i === 0) {
        const error = await response.text();
        console.error(`Failed to record composition ${edge.parent_activity_id} → ${edge.child_activity_id}: ${error}`);
        return false;
      }
    }

    console.log(`✓ Recorded composition: ${edge.parent_activity_id} → ${edge.child_activity_id} (${count}x)`);
    return true;
  } catch (error) {
    console.error(`Error recording composition:`, error);
    return false;
  }
}

async function getCompositionGraph(): Promise<void> {
  try {
    const response = await fetch(`${ACTIVITY_API}/v2/activities/composition/graph?limit=50`);
    if (response.ok) {
      const graph = await response.json();
      console.log('\n📊 Composition Graph:');
      console.log(`   Nodes: ${graph.totalNodes || graph.nodes?.length || 0}`);
      console.log(`   Edges: ${graph.totalEdges || graph.edges?.length || 0}`);

      if (graph.edges && graph.edges.length > 0) {
        console.log('\n   Top edges by weight:');
        const sorted = [...graph.edges].sort((a: any, b: any) => (b.weight || 0) - (a.weight || 0));
        for (const edge of sorted.slice(0, 5)) {
          const weight = ((edge.weight || 0) * 100).toFixed(0);
          console.log(`   - ${edge.parentActivityId} → ${edge.childActivityId} (${weight}%)`);
        }
      }
    }
  } catch (error) {
    console.error('Error fetching composition graph:', error);
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log('🌱 Seeding Composition Graph\n');
  console.log(`API: ${ACTIVITY_API}\n`);

  // Check API health
  try {
    const health = await fetch(`${ACTIVITY_API}/health`);
    if (!health.ok) {
      console.error('❌ Activity API is not healthy');
      process.exit(1);
    }
    console.log('✓ Activity API is healthy\n');
  } catch (error) {
    console.error('❌ Cannot connect to Activity API:', error);
    process.exit(1);
  }

  // Create leaf activities
  console.log('📦 Creating leaf activities...');
  let created = 0;
  for (const template of LEAF_ACTIVITIES) {
    if (await createTemplate(template)) created++;
  }
  console.log(`   Created ${created}/${LEAF_ACTIVITIES.length} leaf activities\n`);

  // Create orchestrating activities
  console.log('🎭 Creating orchestrating activities...');
  created = 0;
  for (const template of ORCHESTRATING_ACTIVITIES) {
    if (await createTemplate(template)) created++;
  }
  console.log(`   Created ${created}/${ORCHESTRATING_ACTIVITIES.length} orchestrating activities\n`);

  // Record composition edges
  console.log('🔗 Recording composition edges...');
  let recorded = 0;
  for (const edge of COMPOSITION_EDGES) {
    if (await recordComposition(edge)) recorded++;
  }
  console.log(`   Recorded ${recorded}/${COMPOSITION_EDGES.length} edges\n`);

  // Show resulting graph
  await getCompositionGraph();

  console.log('\n✅ Seeding complete!');
  console.log('\nNext steps:');
  console.log('  1. Reload Obsidian plugin to see composition canvas');
  console.log('  2. Run: minibob -s "fix the type error in auth.ts"');
  console.log('  3. Watch the composition graph grow from real executions');
}

main().catch(console.error);
