/**
 * Cost tracking routes
 * Record and query activity execution costs
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { getSurrealDB } from '../db/surrealdb';
import type { AuthContext, ActivityCost, CostSummary } from '../types';
import { apiKeyAuthMiddleware } from '../middleware/apiKeyAuth';

type Variables = {
  auth: AuthContext;
};

const app = new Hono<{ Variables: Variables }>();

// Apply auth middleware to all cost routes
app.use('*', apiKeyAuthMiddleware);

// ============================================================================
// POST /v2/costs/record
// Record a new activity execution cost
// ============================================================================

const recordCostSchema = z.object({
  execution_id: z.string().min(1),
  api_key_id: z.string().min(1),
  project_id: z.string().optional(),
  goal_description: z.string().optional(),
  activity_template_id: z.string().min(1),
  instance_id: z.string().min(1),
  cost_usd: z.number().min(0),
  llm_tokens_used: z.number().int().min(0),
  llm_cost_usd: z.number().min(0),
  duration_ms: z.number().int().min(0),
  status: z.enum(['completed', 'failed']),
  started_at: z.string(),
  completed_at: z.string()
});

app.post('/record', async (c) => {
  try {
    const auth = c.get('auth') as AuthContext;
    const body = await c.req.json();
    const data = recordCostSchema.parse(body);

    const db = await getSurrealDB();

    // Insert cost record
    await db.query(`
      CREATE activity_costs CONTENT {
        execution_id: $execution_id,
        org_id: $org_id,
        user_id: $user_id,
        api_key_id: $api_key_id,
        project_id: $project_id,
        goal_description: $goal_description,
        activity_template_id: $activity_template_id,
        instance_id: $instance_id,
        cost_usd: $cost_usd,
        llm_tokens_used: $llm_tokens_used,
        llm_cost_usd: $llm_cost_usd,
        duration_ms: $duration_ms,
        status: $status,
        started_at: $started_at,
        completed_at: $completed_at
      }
    `, {
      execution_id: data.execution_id,
      org_id: auth.orgId,
      user_id: auth.userId,
      api_key_id: data.api_key_id,
      project_id: data.project_id || null,
      goal_description: data.goal_description || null,
      activity_template_id: data.activity_template_id,
      instance_id: data.instance_id,
      cost_usd: data.cost_usd,
      llm_tokens_used: data.llm_tokens_used,
      llm_cost_usd: data.llm_cost_usd,
      duration_ms: data.duration_ms,
      status: data.status,
      started_at: data.started_at,
      completed_at: data.completed_at
    });

    console.log('[CostTracking] Recorded cost:', {
      execution_id: data.execution_id,
      org_id: auth.orgId,
      cost_usd: data.cost_usd
    });

    return c.json({
      success: true,
      message: 'Cost recorded successfully'
    });
  } catch (error) {
    console.error('[CostTracking] Record error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to record cost'
    }, 500);
  }
});

// ============================================================================
// GET /v2/costs/org/:id
// Get total costs for an organization with optional filters
// ============================================================================

app.get('/org/:id', async (c) => {
  try {
    const auth = c.get('auth') as AuthContext;
    const orgId = c.req.param('id');

    // Ensure user can only query their own org
    if (orgId !== auth.orgId) {
      return c.json({
        success: false,
        error: 'Access denied to this organization'
      }, 403);
    }

    const startDate = c.req.query('start_date');
    const endDate = c.req.query('end_date');

    const db = await getSurrealDB();

    let whereClause = 'WHERE org_id = $org_id';
    const params: Record<string, any> = { org_id: orgId };

    if (startDate) {
      whereClause += ' AND started_at >= $start_date';
      params.start_date = startDate;
    }

    if (endDate) {
      whereClause += ' AND started_at <= $end_date';
      params.end_date = endDate;
    }

    const result = await db.query<any[]>(`
      SELECT
        count() AS total_executions,
        math::sum(cost_usd) AS total_cost_usd,
        math::sum(llm_tokens_used) AS total_llm_tokens,
        math::sum(llm_cost_usd) AS total_llm_cost_usd,
        math::avg(duration_ms) AS avg_duration_ms,
        count(status = 'completed') AS successful_executions,
        count(status = 'failed') AS failed_executions
      FROM activity_costs
      ${whereClause}
      GROUP ALL
    `, params);

    const summary = result && result[0] && result[0].length > 0 ? result[0][0] : {
      total_executions: 0,
      total_cost_usd: 0,
      total_llm_tokens: 0,
      total_llm_cost_usd: 0,
      avg_duration_ms: 0,
      successful_executions: 0,
      failed_executions: 0
    };

    return c.json({
      success: true,
      data: {
        org_id: orgId,
        period: {
          start: startDate || null,
          end: endDate || null
        },
        summary
      }
    });
  } catch (error) {
    console.error('[CostTracking] Org query error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to query costs'
    }, 500);
  }
});

// ============================================================================
// GET /v2/costs/org/:id/projects
// Get costs broken down by project
// ============================================================================

app.get('/org/:id/projects', async (c) => {
  try {
    const auth = c.get('auth') as AuthContext;
    const orgId = c.req.param('id');

    if (orgId !== auth.orgId) {
      return c.json({
        success: false,
        error: 'Access denied to this organization'
      }, 403);
    }

    const startDate = c.req.query('start_date');
    const endDate = c.req.query('end_date');

    const db = await getSurrealDB();

    let whereClause = 'WHERE org_id = $org_id AND project_id IS NOT NULL';
    const params: Record<string, any> = { org_id: orgId };

    if (startDate) {
      whereClause += ' AND started_at >= $start_date';
      params.start_date = startDate;
    }

    if (endDate) {
      whereClause += ' AND started_at <= $end_date';
      params.end_date = endDate;
    }

    const result = await db.query<any[]>(`
      SELECT
        project_id,
        count() AS total_executions,
        math::sum(cost_usd) AS total_cost_usd,
        math::sum(llm_tokens_used) AS total_llm_tokens,
        math::sum(llm_cost_usd) AS total_llm_cost_usd,
        math::avg(duration_ms) AS avg_duration_ms,
        count(status = 'completed') AS successful_executions,
        count(status = 'failed') AS failed_executions
      FROM activity_costs
      ${whereClause}
      GROUP BY project_id
      ORDER BY total_cost_usd DESC
    `, params);

    const projects = result && result[0] ? result[0] : [];

    return c.json({
      success: true,
      data: {
        org_id: orgId,
        period: {
          start: startDate || null,
          end: endDate || null
        },
        projects
      }
    });
  } catch (error) {
    console.error('[CostTracking] Projects query error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to query project costs'
    }, 500);
  }
});

// ============================================================================
// GET /v2/costs/org/:id/goals
// Get costs broken down by goal description
// ============================================================================

app.get('/org/:id/goals', async (c) => {
  try {
    const auth = c.get('auth') as AuthContext;
    const orgId = c.req.param('id');

    if (orgId !== auth.orgId) {
      return c.json({
        success: false,
        error: 'Access denied to this organization'
      }, 403);
    }

    const startDate = c.req.query('start_date');
    const endDate = c.req.query('end_date');

    const db = await getSurrealDB();

    let whereClause = 'WHERE org_id = $org_id AND goal_description IS NOT NULL';
    const params: Record<string, any> = { org_id: orgId };

    if (startDate) {
      whereClause += ' AND started_at >= $start_date';
      params.start_date = startDate;
    }

    if (endDate) {
      whereClause += ' AND started_at <= $end_date';
      params.end_date = endDate;
    }

    const result = await db.query<any[]>(`
      SELECT
        goal_description,
        count() AS total_executions,
        math::sum(cost_usd) AS total_cost_usd,
        math::sum(llm_tokens_used) AS total_llm_tokens,
        math::sum(llm_cost_usd) AS total_llm_cost_usd,
        math::avg(duration_ms) AS avg_duration_ms,
        count(status = 'completed') AS successful_executions,
        count(status = 'failed') AS failed_executions
      FROM activity_costs
      ${whereClause}
      GROUP BY goal_description
      ORDER BY total_cost_usd DESC
    `, params);

    const goals = result && result[0] ? result[0] : [];

    return c.json({
      success: true,
      data: {
        org_id: orgId,
        period: {
          start: startDate || null,
          end: endDate || null
        },
        goals
      }
    });
  } catch (error) {
    console.error('[CostTracking] Goals query error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to query goal costs'
    }, 500);
  }
});

// ============================================================================
// GET /v2/costs/org/:id/timeline
// Get costs over time with configurable granularity
// ============================================================================

app.get('/org/:id/timeline', async (c) => {
  try {
    const auth = c.get('auth') as AuthContext;
    const orgId = c.req.param('id');

    if (orgId !== auth.orgId) {
      return c.json({
        success: false,
        error: 'Access denied to this organization'
      }, 403);
    }

    const startDate = c.req.query('start_date');
    const endDate = c.req.query('end_date');
    const granularity = c.req.query('granularity') || 'day'; // hour, day, week, month

    if (!['hour', 'day', 'week', 'month'].includes(granularity)) {
      return c.json({
        success: false,
        error: 'Invalid granularity. Must be one of: hour, day, week, month'
      }, 400);
    }

    const db = await getSurrealDB();

    let whereClause = 'WHERE org_id = $org_id';
    const params: Record<string, any> = { org_id: orgId };

    if (startDate) {
      whereClause += ' AND started_at >= $start_date';
      params.start_date = startDate;
    }

    if (endDate) {
      whereClause += ' AND started_at <= $end_date';
      params.end_date = endDate;
    }

    // Determine time grouping function based on granularity
    let timeGroup: string;
    switch (granularity) {
      case 'hour':
        timeGroup = 'time::floor(started_at, 1h)';
        break;
      case 'day':
        timeGroup = 'time::floor(started_at, 1d)';
        break;
      case 'week':
        timeGroup = 'time::floor(started_at, 1w)';
        break;
      case 'month':
        timeGroup = 'time::floor(started_at, 30d)'; // Approximate month
        break;
      default:
        timeGroup = 'time::floor(started_at, 1d)';
    }

    const result = await db.query<any[]>(`
      SELECT
        ${timeGroup} AS period,
        count() AS total_executions,
        math::sum(cost_usd) AS total_cost_usd,
        math::sum(llm_tokens_used) AS total_llm_tokens,
        math::sum(llm_cost_usd) AS total_llm_cost_usd,
        math::avg(duration_ms) AS avg_duration_ms,
        count(status = 'completed') AS successful_executions,
        count(status = 'failed') AS failed_executions
      FROM activity_costs
      ${whereClause}
      GROUP BY period
      ORDER BY period ASC
    `, params);

    const timeline = result && result[0] ? result[0] : [];

    return c.json({
      success: true,
      data: {
        org_id: orgId,
        granularity,
        period: {
          start: startDate || null,
          end: endDate || null
        },
        timeline
      }
    });
  } catch (error) {
    console.error('[CostTracking] Timeline query error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to query cost timeline'
    }, 500);
  }
});

export default app;
