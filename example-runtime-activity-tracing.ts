/**
 * Example: Runtime Activity Tracing
 *
 * Demonstrates how to instrument application code to track execution
 * as activities with impulse transformations, enabling learning from
 * runtime behavior.
 */

import type { Impulse, ActivityExecution, ImpulseResolution } from './repos/minibob/src/types';

/**
 * Wrapper that turns any function into a traced resolver
 */
function withResolver<TIn, TOut>(
  resolverId: string,
  tier: 'deterministic' | 'pattern' | 'llm',
  fn: (input: TIn) => Promise<TOut>
) {
  return async (input: TIn, activityContext: ActivityContext): Promise<TOut> => {
    const startTime = Date.now();
    const inputImpulse = createImpulseFromValue(input, `${resolverId}_input`);

    try {
      const result = await fn(input);
      const outputImpulse = createImpulseFromValue(result, `${resolverId}_output`);

      // Record resolver execution
      activityContext.recordResolution({
        impulse_id: inputImpulse.id,
        resolver_id: resolverId,
        resolver_tier: tier,
        vessel_id: activityContext.vesselId,
        latency_ms: Date.now() - startTime,
        cost_usd: 0, // Could track compute cost
        success: true
      });

      activityContext.trackImpulseTransform(inputImpulse, outputImpulse, resolverId);

      return result;
    } catch (error) {
      activityContext.recordResolution({
        impulse_id: inputImpulse.id,
        resolver_id: resolverId,
        resolver_tier: tier,
        vessel_id: activityContext.vesselId,
        latency_ms: Date.now() - startTime,
        cost_usd: 0,
        success: false,
        error: String(error)
      });
      throw error;
    }
  };
}

/**
 * Activity context tracks all resolutions within a single activity
 */
class ActivityContext {
  private resolutions: ImpulseResolution[] = [];
  private impulseTransforms: Array<{ from: Impulse; to: Impulse; resolver: string }> = [];

  constructor(
    public activityId: string,
    public vesselId: string,
    public startTime: number
  ) {}

  recordResolution(resolution: ImpulseResolution) {
    this.resolutions.push(resolution);
  }

  trackImpulseTransform(from: Impulse, to: Impulse, resolver: string) {
    this.impulseTransforms.push({ from, to, resolver });
  }

  async finish(success: boolean): Promise<ActivityExecution> {
    return {
      id: this.activityId,
      activity_template_id: 'runtime_activity',
      vessel_id: this.vesselId,
      impulse_resolutions: this.resolutions,
      duration_ms: Date.now() - this.startTime,
      total_cost_usd: this.resolutions.reduce((sum, r) => sum + (r.cost_usd || 0), 0),
      success,
      // Additional fields would include task results, state transitions, etc.
    } as any;
  }
}

/**
 * Top-level wrapper for defining runtime activities
 */
async function withActivity<T>(
  activityName: string,
  vesselId: string,
  fn: (ctx: ActivityContext) => Promise<T>
): Promise<T> {
  const activityId = `${activityName}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const context = new ActivityContext(activityId, vesselId, Date.now());

  try {
    const result = await fn(context);
    const trace = await context.finish(true);
    await storeTrace(trace);
    return result;
  } catch (error) {
    const trace = await context.finish(false);
    await storeTrace(trace);
    throw error;
  }
}

/**
 * Example: Instrumenting MiniBob's activity execution
 */

// Original (untraced)
async function handleActivityExecution_ORIGINAL(goalDescription: string) {
  const templates = await fetchTemplates();
  const recommendation = await thompsonSampling(templates);
  const result = await executeActivity(recommendation);
  await storeTrace(result);
  return result;
}

// With runtime activity tracing
async function handleActivityExecution(goalDescription: string) {
  return await withActivity("minibob_handle_activity", "minibob-instance-123", async (ctx) => {
    // Each step becomes a traced resolver
    const fetchTemplatesResolver = withResolver(
      'fetch_templates',
      'deterministic',
      async (goal: string) => {
        return await fetch('https://activity.metabob.com/v2/activities/templates').then(r => r.json());
      }
    );

    const thompsonSamplingResolver = withResolver(
      'thompson_sampling',
      'pattern',
      async (input: { templates: any[]; goal: string }) => {
        return await fetch('https://activity.metabob.com/v2/activities/recommend', {
          method: 'POST',
          body: JSON.stringify({ goal: input.goal })
        }).then(r => r.json());
      }
    );

    const executeActivityResolver = withResolver(
      'execute_activity',
      'llm',
      async (template: any) => {
        // Actual activity execution with LLM
        return await executeActivityWithLLM(template);
      }
    );

    // Execute pipeline with tracing
    const templates = await fetchTemplatesResolver(goalDescription, ctx);
    const recommendation = await thompsonSamplingResolver({ templates, goal: goalDescription }, ctx);
    const result = await executeActivityResolver(recommendation, ctx);

    return result;
  });
}

/**
 * Example: Instrumenting Activity API's impulse resolution
 */

// Original (untraced)
async function resolveImpulse_ORIGINAL(impulse: Impulse) {
  if (impulse.pointer.type === 'activityTemplate') {
    return await db.query('SELECT * FROM activity_template WHERE id = $id', { id: impulse.pointer.id });
  }
  // ... other types
}

// With runtime activity tracing
async function resolveImpulse(impulse: Impulse) {
  return await withActivity("activity_api_resolve_impulse", "activity-api-instance-456", async (ctx) => {

    const dbQueryResolver = withResolver(
      'surrealdb_query',
      'deterministic',
      async (query: { sql: string; params: any }) => {
        return await db.query(query.sql, query.params);
      }
    );

    const resolverSelectionResolver = withResolver(
      'select_resolver_for_impulse',
      'pattern',
      async (impulse: Impulse) => {
        // Logic to pick the right resolver based on impulse type
        return { resolverId: 'surrealdb_query', sql: '...', params: {} };
      }
    );

    // Traced execution
    const resolverConfig = await resolverSelectionResolver(impulse, ctx);
    const result = await dbQueryResolver(resolverConfig, ctx);

    return result;
  });
}

// Helper functions (implementation details)
function createImpulseFromValue(value: any, id: string): Impulse {
  return {
    id,
    pointer: {
      type: 'memo',
      content: JSON.stringify(value)
    },
    budget: 1000,
    priority: 'medium',
    loaded: true,
    content: value,
    metadata: {
      shape: typeof value === 'object' ? Object.keys(value).join(',') : typeof value,
      size: JSON.stringify(value).length
    }
  };
}

async function storeTrace(trace: ActivityExecution) {
  // Store to activity API (same endpoint as development traces)
  await fetch('https://activity.metabob.com/v2/activities/execution-traces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'ApiKey ...' },
    body: JSON.stringify(trace)
  });
}

// Placeholder implementations
async function fetchTemplates() { return []; }
async function thompsonSampling(templates: any[]) { return templates[0]; }
async function executeActivityWithLLM(template: any) { return {}; }
const db = { query: async (sql: string, params: any) => ({}) };

/**
 * WHAT THIS ENABLES
 *
 * 1. Hot Path Detection
 *    - Query: "Which resolvers are called most frequently?"
 *    - Learn: "fetch_templates is in 87% of activities"
 *    - Action: Cache aggressively, preload on startup
 *
 * 2. Performance Profiling
 *    - Query: "Which resolvers have highest avg latency?"
 *    - Learn: "thompson_sampling takes 200ms when templates > 100"
 *    - Action: Add indexed filtering, limit candidate set
 *
 * 3. Error Pattern Recognition
 *    - Query: "Which impulse shapes cause failures?"
 *    - Learn: "file impulses with path length > 100 fail 15%"
 *    - Action: Add path validation, specialized resolver
 *
 * 4. Reuse Opportunities
 *    - Query: "Which resolver patterns repeat?"
 *    - Learn: "95% of executions use same 12 templates"
 *    - Action: Keep hot templates in cache
 *
 * 5. Optimization Targets
 *    - Query: "Which resolvers are slow AND frequent?"
 *    - Learn: "surrealdb_query is bottleneck (500ms, 60% of traces)"
 *    - Action: Connection pooling, batch writes
 */

/**
 * DASHBOARD QUERIES (same backend, new views)
 */

// Most frequently executed resolvers
const hotResolvers = `
  SELECT
    resolver_id,
    COUNT() as execution_count,
    AVG(latency_ms) as avg_latency,
    SUM(cost_usd) as total_cost
  FROM execution
  GROUP BY resolver_id
  ORDER BY execution_count DESC
  LIMIT 20
`;

// Slowest resolvers in hot paths
const bottlenecks = `
  SELECT
    resolver_id,
    AVG(latency_ms) as avg_latency,
    COUNT() as execution_count
  FROM execution
  WHERE success = true
  GROUP BY resolver_id
  HAVING execution_count > 100
  ORDER BY avg_latency DESC
  LIMIT 10
`;

// Impulse transformation chains
const impulseFlows = `
  SELECT
    from_impulse.type as input_type,
    to_impulse.type as output_type,
    resolver_id,
    COUNT() as frequency
  FROM impulse_transformation
  GROUP BY input_type, output_type, resolver_id
  ORDER BY frequency DESC
`;

// Code reuse metrics
const reuseScore = `
  SELECT
    resolver_id,
    COUNT(DISTINCT activity_id) as used_in_activities,
    COUNT() as total_calls,
    total_calls / used_in_activities as reuse_factor
  FROM execution
  GROUP BY resolver_id
  HAVING used_in_activities > 5
  ORDER BY reuse_factor DESC
`;
