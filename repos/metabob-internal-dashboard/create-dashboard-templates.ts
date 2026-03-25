#!/usr/bin/env bun
/**
 * Create Dashboard Activity Templates
 *
 * This script registers activity templates for the internal dashboard.
 * Templates use UI tools to render dashboard components and are selected
 * via Thompson Sampling based on query similarity.
 *
 * Run with: bun run create-dashboard-templates.ts
 */

const API_URL = process.env.ACTIVITY_API_URL || 'http://activity.metabob.local'

interface TemplateTask {
  id: string
  subagent: string
  description: string
  dependencies: string[]
  prompt: {
    template: string
    maxTokens?: number
    variables?: Array<{ name: string; description: string }>
  }
  validation?: {
    requiredFiles?: string[]
    requiredPatterns?: Array<{ pattern: string; file?: string }>
    forbiddenPatterns?: Array<{ pattern: string; file?: string }>
  }
  retry?: {
    maxAttempts: number
    strategy: string
  }
}

interface CreateTemplateRequest {
  variant_id: string
  activity_id: string
  variant_name: string
  description: string
  category: 'feature' | 'bugfix' | 'refactor' | 'tool' | 'infrastructure'
  task_steps: TemplateTask[]
  scope: 'global' | 'org' | 'project'
  public: boolean
}

// =============================================================================
// DASHBOARD ACTIVITY TEMPLATES
// =============================================================================

const dashboardTemplates: CreateTemplateRequest[] = [
  // ---------------------------------------------------------------------------
  // SHOW SYSTEM HEALTH
  // ---------------------------------------------------------------------------
  {
    variant_id: 'dashboard-show-health-v1',
    activity_id: 'dashboard-show-health',
    variant_name: 'Show System Health Dashboard',
    description: 'Display system health status including API, database, and service health',
    category: 'feature',
    scope: 'global',
    public: true,
    task_steps: [
      {
        id: 'query-health',
        subagent: 'default',
        description: 'Query system health endpoints',
        dependencies: [],
        prompt: {
          template: `Query the Activity API health endpoint and display a system health dashboard.

1. Use query_activity_api tool to GET /health
2. Create a UI component showing health status using create_ui_component

Format the response as a dashboard with:
- Overall status badge (success/warning/error)
- Individual service health items
- Any relevant metrics or timestamps`,
          maxTokens: 4000,
        },
        retry: { maxAttempts: 2, strategy: 'exponential' },
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // SHOW ACTIVITY TEMPLATES
  // ---------------------------------------------------------------------------
  {
    variant_id: 'dashboard-show-templates-v1',
    activity_id: 'dashboard-show-templates',
    variant_name: 'Show Activity Templates List',
    description: 'Display all registered activity templates with their metrics',
    category: 'feature',
    scope: 'global',
    public: true,
    task_steps: [
      {
        id: 'fetch-templates',
        subagent: 'default',
        description: 'Fetch and display activity templates',
        dependencies: [],
        prompt: {
          template: `Fetch and display activity templates from the Activity API.

1. Use query_activity_api tool to GET /v2/activities/templates
2. Create a UI component with a data table showing templates

The table should include columns:
- Name (variant_name)
- Category
- Success Rate (from metrics if available)
- Total Executions
- Scope

Use create_ui_component with a data-table primitive.`,
          maxTokens: 4000,
        },
        retry: { maxAttempts: 2, strategy: 'exponential' },
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // SHOW EXECUTION METRICS
  // ---------------------------------------------------------------------------
  {
    variant_id: 'dashboard-show-metrics-v1',
    activity_id: 'dashboard-show-metrics',
    variant_name: 'Show Execution Metrics',
    description: 'Display execution metrics including success rates, costs, and performance',
    category: 'feature',
    scope: 'global',
    public: true,
    task_steps: [
      {
        id: 'fetch-metrics',
        subagent: 'default',
        description: 'Fetch and visualize execution metrics',
        dependencies: [],
        prompt: {
          template: `Fetch execution metrics and display them as a dashboard.

1. Use query_activity_api to GET /v2/activities/templates (includes metrics)
2. Create UI components showing:
   - Overall success rate chart
   - Cost breakdown
   - Performance trends

Use create_ui_component with:
- A container with vertical layout
- Badge for overall health
- Charts for trends (bar or line chart)
- Key metrics as text with appropriate styling`,
          maxTokens: 4000,
        },
        retry: { maxAttempts: 2, strategy: 'exponential' },
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // SHOW RECENT EXECUTIONS
  // ---------------------------------------------------------------------------
  {
    variant_id: 'dashboard-show-executions-v1',
    activity_id: 'dashboard-show-executions',
    variant_name: 'Show Recent Executions',
    description: 'Display recent activity executions with their status and details',
    category: 'feature',
    scope: 'global',
    public: true,
    task_steps: [
      {
        id: 'fetch-executions',
        subagent: 'default',
        description: 'Fetch and display recent executions',
        dependencies: [],
        prompt: {
          template: `Fetch and display recent activity executions.

1. Use query_activity_api to GET /v2/activities/execution-traces?limit=20
2. Create a data table showing recent executions

Columns should include:
- Template Name
- Status (success/failure badge)
- Duration
- Cost
- Timestamp

Use create_ui_component with a data-table primitive.
Add filtering options if data supports it.`,
          maxTokens: 4000,
        },
        retry: { maxAttempts: 2, strategy: 'exponential' },
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // SHOW THOMPSON SAMPLING STATE
  // ---------------------------------------------------------------------------
  {
    variant_id: 'dashboard-show-thompson-v1',
    activity_id: 'dashboard-show-thompson',
    variant_name: 'Show Thompson Sampling State',
    description: 'Display Thompson Sampling alpha/beta values and selection probabilities',
    category: 'feature',
    scope: 'global',
    public: true,
    task_steps: [
      {
        id: 'fetch-thompson',
        subagent: 'default',
        description: 'Fetch and visualize Thompson Sampling state',
        dependencies: [],
        prompt: {
          template: `Display the Thompson Sampling learning state for activity templates.

1. Use query_activity_api to GET /v2/activities/templates (includes thompson_alpha/beta in metrics)
2. Create a visualization showing:
   - Alpha/Beta values per variant
   - Calculated success probability (alpha / (alpha + beta))
   - Selection confidence

Use create_ui_component with:
- A table showing variant_id, alpha, beta, probability
- Progress bars or charts for visual comparison
- Explanation text about what the values mean`,
          maxTokens: 4000,
        },
        retry: { maxAttempts: 2, strategy: 'exponential' },
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // SHOW COMPOSITION GRAPH
  // ---------------------------------------------------------------------------
  {
    variant_id: 'dashboard-show-composition-v1',
    activity_id: 'dashboard-show-composition',
    variant_name: 'Show Activity Composition Graph',
    description: 'Display the activity composition graph showing parent-child relationships',
    category: 'feature',
    scope: 'global',
    public: true,
    task_steps: [
      {
        id: 'fetch-composition',
        subagent: 'default',
        description: 'Fetch and visualize composition graph',
        dependencies: [],
        prompt: {
          template: `Fetch and display the activity composition graph.

1. Use query_activity_api to GET /v2/activities/composition/graph?limit=50
2. Create a visualization showing activity relationships

Display:
- Parent-child activity relationships
- Edge weights (success correlation)
- Execution counts

Use create_ui_component with:
- A graph primitive if available, otherwise a table
- Color coding for success rates
- Interactive elements if supported`,
          maxTokens: 4000,
        },
        retry: { maxAttempts: 2, strategy: 'exponential' },
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // GENERIC DASHBOARD QUERY
  // ---------------------------------------------------------------------------
  {
    variant_id: 'dashboard-generic-query-v1',
    activity_id: 'dashboard-generic-query',
    variant_name: 'Generic Dashboard Query Handler',
    description: 'Handle general dashboard queries by analyzing intent and fetching relevant data',
    category: 'feature',
    scope: 'global',
    public: true,
    task_steps: [
      {
        id: 'analyze-and-respond',
        subagent: 'default',
        description: 'Analyze query and create appropriate response',
        dependencies: [],
        prompt: {
          template: `You are the dashboard assistant. Analyze the user query and respond appropriately.

User Query: {{query}}

Available tools:
- query_activity_api: Query backend API endpoints
- create_ui_component: Create UI components to display data
- update_ui_component: Update existing components
- delete_ui_component: Remove components
- clear_ui_components: Clear all components

Common endpoints:
- GET /health - System health
- GET /v2/activities/templates - Activity templates and metrics
- GET /v2/activities/composition/graph - Composition relationships
- GET /v2/activities/tool-usage - Tool usage patterns
- GET /v2/activities/execution-sequences - Execution sequences

Analyze the query, determine what data is needed, fetch it, and create an appropriate UI response.`,
          maxTokens: 4000,
          variables: [
            { name: 'query', description: 'The user query to handle' },
          ],
        },
        retry: { maxAttempts: 2, strategy: 'exponential' },
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // SHOW POD STATUS
  // ---------------------------------------------------------------------------
  {
    variant_id: 'dashboard-show-pods-v1',
    activity_id: 'dashboard-show-pods',
    variant_name: 'Show Kubernetes Pod Status',
    description: 'Display Kubernetes pod status for activity-system namespace',
    category: 'infrastructure',
    scope: 'global',
    public: true,
    task_steps: [
      {
        id: 'show-pod-info',
        subagent: 'default',
        description: 'Display pod status information',
        dependencies: [],
        prompt: {
          template: `Display Kubernetes pod status information.

Since we cannot directly query Kubernetes from the dashboard, show a helpful UI that:
1. Explains that pod status requires kubectl access
2. Provides the kubectl command to run:
   kubectl get pods -n activity-system
3. Shows a placeholder for pod status that would be populated by external monitoring

Use create_ui_component with:
- An informational container
- Code block with the kubectl command
- Placeholder for status data`,
          maxTokens: 4000,
        },
        retry: { maxAttempts: 2, strategy: 'exponential' },
      },
    ],
  },
]

// =============================================================================
// REGISTRATION FUNCTIONS
// =============================================================================

async function registerTemplate(template: CreateTemplateRequest): Promise<boolean> {
  console.log(`Registering template: ${template.variant_id}`)

  try {
    const response = await fetch(`${API_URL}/v2/activities/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(template),
    })

    const result = await response.json()

    if (response.status === 201) {
      console.log(`  ✓ Created: ${template.variant_id}`)
      return true
    } else if (response.status === 409) {
      console.log(`  ○ Already exists: ${template.variant_id}`)
      return true
    } else {
      console.error(`  ✗ Failed: ${template.variant_id}`, result)
      return false
    }
  } catch (error) {
    console.error(`  ✗ Error: ${template.variant_id}`, error)
    return false
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Creating Dashboard Activity Templates')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`API URL: ${API_URL}`)
  console.log('')

  // Check API health first
  try {
    const healthResponse = await fetch(`${API_URL}/health`)
    if (!healthResponse.ok) {
      console.error('Activity API is not healthy. Ensure the cluster is running.')
      console.log('Run: helmfile -f helm/activity-system-minimal.yaml.gotmpl sync')
      process.exit(1)
    }
    const health = await healthResponse.json()
    console.log('API Health:', health.status)
    console.log('')
  } catch (error) {
    console.error('Cannot connect to Activity API at', API_URL)
    console.log('Ensure:')
    console.log('  1. Kubernetes cluster is running')
    console.log('  2. Activity system is deployed')
    console.log('  3. /etc/hosts has: 127.0.0.1 api.minibob.local')
    process.exit(1)
  }

  // Register all templates
  let success = 0
  let failed = 0

  for (const template of dashboardTemplates) {
    const result = await registerTemplate(template)
    if (result) {
      success++
    } else {
      failed++
    }
  }

  console.log('')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`  Results: ${success} succeeded, ${failed} failed`)
  console.log('═══════════════════════════════════════════════════════════')

  if (failed > 0) {
    process.exit(1)
  }
}

main().catch(console.error)
