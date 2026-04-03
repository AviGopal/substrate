/**
 * Cost tracking routes
 * Query activity execution costs from metabob-activity-api's execution table
 *
 * Architecture (Vessel Alignment):
 * - metabob-activity-api records execution traces with cost_usd
 * - user-vessel queries these traces for billing dashboards
 * - Single source of truth: activity_execution_traces table
 */

import { Hono } from 'hono';
import type { UserVesselConfig } from '../types';
import { requireAuth, getAuth } from '../middleware/auth';
import { getRootDb, getAllRecords } from '../db/surreal';

export function costRoutes(config: UserVesselConfig) {
  const app = new Hono();

  // ============================================================================
  // GET /v2/costs/org/:id
  // Get total costs for an organization with optional filters
  // Queries from activity_execution_traces table (source of truth)
  // ============================================================================

  app.get('/org/:id', requireAuth(config), async (c) => {
    try {
      const auth = getAuth(c);
      const orgId = c.req.param('id');

      // Ensure user can only query their own org
      if (orgId !== auth.org_id) {
        return c.json({
          success: false,
          error: 'Access denied to this organization'
        }, 403);
      }

      const startDate = c.req.query('start_date');
      const endDate = c.req.query('end_date');

      const db = await getRootDb(config);

      let whereClause = 'WHERE org_id = $org_id';
      const params: Record<string, any> = { org_id: orgId };

      if (startDate) {
        whereClause += ' AND executed_at >= $start_date';
        params.start_date = startDate;
      }

      if (endDate) {
        whereClause += ' AND executed_at <= $end_date';
        params.end_date = endDate;
      }

      const result = await db.query(`
        SELECT
          count() AS total_executions,
          math::sum(cost_usd) AS total_cost_usd,
          math::sum(tokens_input + tokens_output) AS total_llm_tokens,
          math::sum(cost_usd) AS total_llm_cost_usd,
          math::avg(duration_ms) AS avg_duration_ms,
          count(IF status = 'success' THEN 1 ELSE NONE END) AS successful_executions,
          count(IF status != 'success' THEN 1 ELSE NONE END) AS failed_executions
        FROM activity_execution_traces
        ${whereClause}
        GROUP ALL
      `, params);

      const records = getAllRecords<any>(result);
      const summary = records.length > 0 ? records[0] : {
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
  // Queries from activity_execution_traces table (source of truth)
  // ============================================================================

  app.get('/org/:id/projects', requireAuth(config), async (c) => {
    try {
      const auth = getAuth(c);
      const orgId = c.req.param('id');

      if (orgId !== auth.org_id) {
        return c.json({
          success: false,
          error: 'Access denied to this organization'
        }, 403);
      }

      const startDate = c.req.query('start_date');
      const endDate = c.req.query('end_date');

      const db = await getRootDb(config);

      let whereClause = 'WHERE org_id = $org_id AND project_id IS NOT NONE';
      const params: Record<string, any> = { org_id: orgId };

      if (startDate) {
        whereClause += ' AND executed_at >= $start_date';
        params.start_date = startDate;
      }

      if (endDate) {
        whereClause += ' AND executed_at <= $end_date';
        params.end_date = endDate;
      }

      const result = await db.query(`
        SELECT
          project_id,
          count() AS total_executions,
          math::sum(cost_usd) AS total_cost_usd,
          math::sum(tokens_input + tokens_output) AS total_llm_tokens,
          math::sum(cost_usd) AS total_llm_cost_usd,
          math::avg(duration_ms) AS avg_duration_ms,
          count(IF status = 'success' THEN 1 ELSE NONE END) AS successful_executions,
          count(IF status != 'success' THEN 1 ELSE NONE END) AS failed_executions
        FROM activity_execution_traces
        ${whereClause}
        GROUP BY project_id
        ORDER BY total_cost_usd DESC
      `, params);

      const projects = getAllRecords<any>(result);

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
  // Get costs broken down by goal context
  // Queries from activity_execution_traces table, using execution_trace.goalContext
  // ============================================================================

  app.get('/org/:id/goals', requireAuth(config), async (c) => {
    try {
      const auth = getAuth(c);
      const orgId = c.req.param('id');

      if (orgId !== auth.org_id) {
        return c.json({
          success: false,
          error: 'Access denied to this organization'
        }, 403);
      }

      const startDate = c.req.query('start_date');
      const endDate = c.req.query('end_date');

      const db = await getRootDb(config);

      // Goal context is stored in execution_trace.goalContext.goal or metadata.goalDescription
      let whereClause = 'WHERE org_id = $org_id AND (execution_trace.goalContext.goal IS NOT NONE OR metadata.goalDescription IS NOT NONE)';
      const params: Record<string, any> = { org_id: orgId };

      if (startDate) {
        whereClause += ' AND executed_at >= $start_date';
        params.start_date = startDate;
      }

      if (endDate) {
        whereClause += ' AND executed_at <= $end_date';
        params.end_date = endDate;
      }

      // Use COALESCE-like logic to extract goal description from multiple possible locations
      const result = await db.query(`
        SELECT
          (execution_trace.goalContext.goal OR metadata.goalDescription OR 'Unknown Goal') AS goal_description,
          count() AS total_executions,
          math::sum(cost_usd) AS total_cost_usd,
          math::sum(tokens_input + tokens_output) AS total_llm_tokens,
          math::sum(cost_usd) AS total_llm_cost_usd,
          math::avg(duration_ms) AS avg_duration_ms,
          count(IF status = 'success' THEN 1 ELSE NONE END) AS successful_executions,
          count(IF status != 'success' THEN 1 ELSE NONE END) AS failed_executions
        FROM activity_execution_traces
        ${whereClause}
        GROUP BY goal_description
        ORDER BY total_cost_usd DESC
      `, params);

      const goals = getAllRecords<any>(result);

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
  // Queries from activity_execution_traces table (source of truth)
  // ============================================================================

  app.get('/org/:id/timeline', requireAuth(config), async (c) => {
    try {
      const auth = getAuth(c);
      const orgId = c.req.param('id');

      if (orgId !== auth.org_id) {
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

      const db = await getRootDb(config);

      let whereClause = 'WHERE org_id = $org_id';
      const params: Record<string, any> = { org_id: orgId };

      if (startDate) {
        whereClause += ' AND executed_at >= $start_date';
        params.start_date = startDate;
      }

      if (endDate) {
        whereClause += ' AND executed_at <= $end_date';
        params.end_date = endDate;
      }

      // Determine time grouping function based on granularity
      let timeGroup: string;
      switch (granularity) {
        case 'hour':
          timeGroup = 'time::floor(executed_at, 1h)';
          break;
        case 'day':
          timeGroup = 'time::floor(executed_at, 1d)';
          break;
        case 'week':
          timeGroup = 'time::floor(executed_at, 1w)';
          break;
        case 'month':
          timeGroup = 'time::floor(executed_at, 30d)'; // Approximate month
          break;
        default:
          timeGroup = 'time::floor(executed_at, 1d)';
      }

      const result = await db.query(`
        SELECT
          ${timeGroup} AS period,
          count() AS total_executions,
          math::sum(cost_usd) AS total_cost_usd,
          math::sum(tokens_input + tokens_output) AS total_llm_tokens,
          math::sum(cost_usd) AS total_llm_cost_usd,
          math::avg(duration_ms) AS avg_duration_ms,
          count(IF status = 'success' THEN 1 ELSE NONE END) AS successful_executions,
          count(IF status != 'success' THEN 1 ELSE NONE END) AS failed_executions
        FROM activity_execution_traces
        ${whereClause}
        GROUP BY period
        ORDER BY period ASC
      `, params);

      const timeline = getAllRecords<any>(result);

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

  // ============================================================================
  // GET /v2/costs/org/:id/activities
  // Get costs broken down by activity
  // Queries from activity_execution_traces table (source of truth)
  // ============================================================================

  app.get('/org/:id/activities', requireAuth(config), async (c) => {
    try {
      const auth = getAuth(c);
      const orgId = c.req.param('id');

      if (orgId !== auth.org_id) {
        return c.json({
          success: false,
          error: 'Access denied to this organization'
        }, 403);
      }

      const startDate = c.req.query('start_date');
      const endDate = c.req.query('end_date');
      const limit = parseInt(c.req.query('limit') || '20', 10);

      const db = await getRootDb(config);

      let whereClause = 'WHERE org_id = $org_id';
      const params: Record<string, any> = { org_id: orgId, limit };

      if (startDate) {
        whereClause += ' AND executed_at >= $start_date';
        params.start_date = startDate;
      }

      if (endDate) {
        whereClause += ' AND executed_at <= $end_date';
        params.end_date = endDate;
      }

      const result = await db.query(`
        SELECT
          activity_id,
          count() AS total_executions,
          math::sum(cost_usd) AS total_cost_usd,
          math::sum(tokens_input + tokens_output) AS total_llm_tokens,
          math::avg(duration_ms) AS avg_duration_ms,
          count(IF status = 'success' THEN 1 ELSE NONE END) AS successful_executions,
          count(IF status != 'success' THEN 1 ELSE NONE END) AS failed_executions,
          math::mean(IF status = 'success' THEN 1.0 ELSE 0.0 END) AS success_rate
        FROM activity_execution_traces
        ${whereClause}
        GROUP BY activity_id
        ORDER BY total_cost_usd DESC
        LIMIT $limit
      `, params);

      const activities = getAllRecords<any>(result);

      return c.json({
        success: true,
        data: {
          org_id: orgId,
          period: {
            start: startDate || null,
            end: endDate || null
          },
          activities
        }
      });
    } catch (error) {
      console.error('[CostTracking] Activities query error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to query activity costs'
      }, 500);
    }
  });

  return app;
}

export default costRoutes;
