#!/usr/bin/env bun
/**
 * Activity Monitor Server
 *
 * Provides a dashboard showing real-time activity executions, templates, and impulse metrics
 * from the metabob-activity-api backend.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// Configuration
const ACTIVITY_API_URL = process.env.ACTIVITY_API_URL || 'https://activity.metabob.com';
const METABOB_API_KEY = process.env.METABOB_API_KEY || '';
const PORT = parseInt(process.env.PORT || '3030', 10);

// Cache
interface CachedData {
  executions: any[];
  templates: any[];
  impulses: any[];
  scores: any[];
  compositions: any[];
  recommendations: any;
  relevance: any[];
  taskViews: any[];
  lastUpdate: number;
}

let cache: CachedData = {
  executions: [],
  templates: [],
  impulses: [],
  scores: [],
  compositions: [],
  recommendations: null,
  relevance: [],
  taskViews: [],
  lastUpdate: 0,
};

interface DataSource {
  name: string;
  shape: string;
  vessel: string;
  status: 'healthy' | 'error';
  lastFetch: string;
}

const dataSources: DataSource[] = [
  {
    name: 'executions',
    shape: 'execution_trace',
    vessel: 'metabob-activity-api',
    status: 'healthy',
    lastFetch: 'never',
  },
  {
    name: 'templates',
    shape: 'activity_template',
    vessel: 'metabob-activity-api',
    status: 'healthy',
    lastFetch: 'never',
  },
  {
    name: 'impulses',
    shape: 'impulse_resolution_metrics',
    vessel: 'metabob-activity-api',
    status: 'error',
    lastFetch: 'never',
  },
];

// Helper function to make authenticated requests
// Note: Most endpoints are publicly readable and don't require auth
async function fetchWithAuth(url: string, requireAuth: boolean = false): Promise<Response> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Only send API key if explicitly required (most read endpoints are public)
  if (requireAuth && METABOB_API_KEY) {
    headers['Authorization'] = `ApiKey ${METABOB_API_KEY}`;
  }

  return fetch(url, { headers });
}

// Update cache from backend
async function updateCache() {
  console.log('Updating cache...');

  try {
    // Fetch executions
    console.log('[IMPULSE] Resolving execution_trace from metabob-activity-api/v2/activities/executions?limit=50');
    const executionsRes = await fetchWithAuth(`${ACTIVITY_API_URL}/v2/activities/executions?limit=50`);

    if (executionsRes.ok) {
      const executionsData = await executionsRes.json();
      // Filter out auth_resolve_v1 traces - they flood the dashboard
      const allExecutions = executionsData.executions || [];
      cache.executions = allExecutions.filter((e: any) =>
        e.template_id !== 'auth_resolve_v1' && e.activity_id !== 'auth_resolve_v1'
      );
      dataSources[0].status = 'healthy';
      dataSources[0].lastFetch = new Date().toISOString();
      console.log(`[IMPULSE] Resolved ${cache.executions.length} execution_trace impulses (filtered from ${allExecutions.length})`);
    } else {
      console.error(`Failed to fetch executions: ${executionsRes.status}`);
      dataSources[0].status = 'error';
    }

    // Fetch templates (public endpoint, no auth required)
    console.log('[IMPULSE] Resolving activity_template from metabob-activity-api/v2/activities/templates');
    const templatesRes = await fetchWithAuth(`${ACTIVITY_API_URL}/v2/activities/templates`, false);

    if (templatesRes.ok) {
      const templatesData = await templatesRes.json();
      cache.templates = templatesData.templates || [];
      dataSources[1].status = 'healthy';
      dataSources[1].lastFetch = new Date().toISOString();
      console.log(`[IMPULSE] Resolved ${cache.templates.length} activity_template impulses`);

      // Derive Thompson scores from templates
      // Prefer metrics field when available (enriched data), fallback to root fields
      cache.scores = cache.templates.map((t: any) => {
        const alpha = t.metrics?.thompson_alpha || t.thompson_alpha || 1;
        const beta = t.metrics?.thompson_beta || t.thompson_beta || 1;
        return {
          activity_id: t.id,
          alpha,
          beta,
          score: alpha / (alpha + beta),
          confidence: Math.min(alpha + beta, 100),
          exploration_count: beta,
          exploitation_count: alpha - 1,
        };
      });
    } else {
      const errorText = await templatesRes.text().catch(() => 'Could not read error body');
      console.error(`Failed to fetch templates: ${templatesRes.status}`);
      console.error(`Error response: ${errorText.substring(0, 500)}`);
      console.error(`Request URL: ${ACTIVITY_API_URL}/v2/activities/templates`);
      console.error(`API Key set: ${METABOB_API_KEY ? 'YES (length ' + METABOB_API_KEY.length + ')' : 'NO'}`);
      dataSources[1].status = 'error';
    }

    // Fetch impulse metrics
    console.log('[IMPULSE] Resolving impulse_resolution_metrics from metabob-activity-api/v2/impulses/resolution-metrics?limit=20');
    const impulsesRes = await fetchWithAuth(`${ACTIVITY_API_URL}/v2/impulses/resolution-metrics?limit=20`);

    if (impulsesRes.ok) {
      const impulsesData = await impulsesRes.json();
      cache.impulses = impulsesData.metrics || [];
      dataSources[2].status = 'healthy';
      dataSources[2].lastFetch = new Date().toISOString();
      console.log(`[IMPULSE] Resolved ${cache.impulses.length} impulse_resolution_metrics impulses`);
    } else {
      console.error(`Failed to fetch impulse metrics: ${impulsesRes.status}`);
      dataSources[2].status = 'error';
    }

    // Fetch composition graph
    console.log('[IMPULSE] Resolving activity_composition_graph from metabob-activity-api/v2/activities/composition/graph?limit=100');
    const compositionsRes = await fetchWithAuth(`${ACTIVITY_API_URL}/v2/activities/composition/graph?limit=100`);

    if (compositionsRes.ok) {
      const compositionsData = await compositionsRes.json();
      cache.compositions = compositionsData.edges || [];
      console.log(`[IMPULSE] Resolved ${cache.compositions.length} composition edges`);
    } else {
      console.error(`Failed to fetch compositions: ${compositionsRes.status}`);
    }

    // Fetch impulse relevance metrics
    console.log('[IMPULSE] Resolving impulse_relevance from metabob-activity-api/v2/activities/impulse-relevance?limit=50');
    const relevanceRes = await fetchWithAuth(`${ACTIVITY_API_URL}/v2/activities/impulse-relevance?limit=50`);

    if (relevanceRes.ok) {
      const relevanceData = await relevanceRes.json();
      cache.relevance = relevanceData.metrics || [];
      console.log(`[IMPULSE] Resolved ${cache.relevance.length} relevance metrics`);
    } else {
      console.error(`Failed to fetch relevance: ${relevanceRes.status}`);
    }

    // Get recommendations for a sample goal to show weights
    console.log('[IMPULSE] Fetching recommendation weights for sample goal');
    const recommendRes = await fetchWithAuth(`${ACTIVITY_API_URL}/v2/activities/recommend`);

    if (recommendRes.ok) {
      const recommendPayload = {
        task_description: "Sample task to show recommendation weights",
        impulse_shapes: ["goal", "requirements"],
        limit: 10
      };

      const recommendResult = await fetchWithAuth(`${ACTIVITY_API_URL}/v2/activities/recommend`);
      if (recommendResult.status === 405) {
        // POST not allowed, endpoint might be GET only
        console.log('[IMPULSE] Recommend endpoint requires POST with task description');
      } else if (recommendResult.ok) {
        cache.recommendations = await recommendResult.json();
        console.log(`[IMPULSE] Resolved ${cache.recommendations?.recommendations?.length || 0} recommendations with weights`);
      }
    }

    // Extract task views from recent executions
    cache.taskViews = cache.executions.slice(0, 10).map((exec: any) => ({
      execution_id: exec.execution_id,
      activity_id: exec.activity_id,
      tasks: exec.tasks || [],
      created_at: exec.created_at,
      success: exec.success,
    }));

    cache.lastUpdate = Date.now();
    console.log(`Cache updated: ${cache.executions.length} executions, ${cache.templates.length} templates, ${cache.scores.length} scores (derived), ${cache.impulses.length} impulses, ${cache.compositions.length} compositions, ${cache.relevance.length} relevance metrics`);
  } catch (error) {
    console.error('Error updating cache:', error);
  }
}

// Enable CORS
app.use('/*', cors());

// Main dashboard page
app.get('/', (c) => {
  return c.html(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Activity Monitor - Live Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Monaco', 'Menlo', monospace;
      background: #0a0a0a;
      color: #e0e0e0;
      padding: 20px;
      line-height: 1.6;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding-bottom: 15px;
      border-bottom: 2px solid #333;
    }
    h1 { color: #10b981; font-size: 2em; }
    .status { display: flex; gap: 20px; align-items: center; }
    .live-indicator { color: #10b981; display: flex; align-items: center; gap: 8px; }
    .live-dot { width: 10px; height: 10px; background: #10b981; border-radius: 50%; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .timestamp { color: #666; }

    .grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
    .panel {
      background: #111;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 20px;
    }
    .panel-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid #333;
    }
    .panel-title { color: #10b981; font-size: 1.2em; font-weight: bold; }
    .panel-count { color: #666; font-size: 0.9em; }

    .execution-list { display: flex; flex-direction: column; gap: 10px; max-height: 500px; overflow-y: auto; }
    .execution-item {
      background: #1a1a1a;
      padding: 12px;
      border-radius: 6px;
      border-left: 3px solid #666;
    }
    .execution-item.success { border-left-color: #10b981; }
    .execution-item.failure { border-left-color: #ef4444; }
    .execution-item.running { border-left-color: #f59e0b; }

    .execution-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .execution-id { font-weight: bold; color: #10b981; }
    .execution-timestamp { color: #666; font-size: 0.85em; }
    .execution-metrics { display: flex; gap: 15px; font-size: 0.9em; color: #999; }
    .execution-status {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75em;
      font-weight: bold;
      margin-top: 8px;
    }
    .execution-status.success { background: #10b981; color: #000; }
    .execution-status.failure { background: #ef4444; color: #fff; }

    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .template-group { margin-bottom: 20px; }
    .template-group-title {
      color: #10b981;
      font-size: 0.9em;
      text-transform: uppercase;
      margin-bottom: 10px;
      padding: 5px;
      background: #1a1a1a;
      border-radius: 4px;
    }
    .template-item {
      background: #1a1a1a;
      padding: 10px;
      border-radius: 6px;
      margin-bottom: 8px;
      font-size: 0.9em;
    }
    .template-name { color: #e0e0e0; font-weight: bold; margin-bottom: 5px; }
    .template-meta { color: #666; font-size: 0.85em; display: flex; gap: 10px; }

    .score-item {
      background: #1a1a1a;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 8px;
    }
    .score-header { display: flex; justify-content: space-between; margin-bottom: 5px; }
    .score-name { color: #e0e0e0; font-weight: bold; font-size: 0.9em; }
    .score-value { color: #10b981; font-size: 1.1em; font-weight: bold; }
    .score-meta { color: #666; font-size: 0.8em; }

    .impulse-item {
      background: #1a1a1a;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 10px;
    }
    .impulse-shape { color: #10b981; font-weight: bold; margin-bottom: 5px; }
    .impulse-resolver { color: #999; font-size: 0.9em; }
    .impulse-stats { color: #666; font-size: 0.85em; margin-top: 5px; }

    .learning-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
    .learning-metric {
      background: #1a1a1a;
      padding: 15px;
      border-radius: 6px;
      border-left: 3px solid #10b981;
    }
    .metric-label { color: #999; font-size: 0.85em; margin-bottom: 5px; }
    .metric-value { color: #10b981; font-size: 1.5em; font-weight: bold; }
    .metric-detail { color: #666; font-size: 0.8em; margin-top: 5px; }

    .data-sources-grid { display: grid; gap: 10px; }
    .data-source-item {
      background: #1a1a1a;
      padding: 12px;
      border-radius: 6px;
      border-left: 3px solid #666;
    }
    .data-source-item.healthy { border-left-color: #10b981; }
    .data-source-item.error { border-left-color: #ef4444; }
    .data-source-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .data-source-shape { color: #e0e0e0; font-weight: bold; }
    .data-source-status {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75em;
      font-weight: bold;
    }
    .data-source-status.healthy { background: #10b981; color: #000; }
    .data-source-status.error { background: #ef4444; color: #fff; }
    .data-source-meta { color: #666; font-size: 0.85em; }
    .data-source-endpoint { color: #999; font-size: 0.8em; margin-top: 5px; }

    .empty-state {
      text-align: center;
      padding: 40px;
      color: #666;
    }
    .empty-icon { font-size: 3em; margin-bottom: 10px; }
    .empty-text { font-size: 1.1em; margin-bottom: 5px; }
    .empty-subtext { font-size: 0.9em; }
  </style>
</head>
<body>
  <header>
    <h1>⚡ Activity Monitor</h1>
    <div class="status">
      <div class="live-indicator">
        <div class="live-dot"></div>
        <span>Live</span>
      </div>
      <div class="timestamp" id="last-update">--:--:--</div>
    </div>
  </header>

  <div class="grid">
    <!-- Recent Executions -->
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title">Recent Executions</div>
        <div class="panel-count" id="executions-count">0 executions</div>
      </div>
      <div class="execution-list" id="executions-list"></div>
    </div>

    <!-- Learning Insights -->
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title">📊 Learning Insights</div>
        <div class="panel-count" id="learning-count">20 recent</div>
      </div>
      <div class="learning-grid" id="learning-metrics"></div>
    </div>

    <!-- Two column layout -->
    <div class="two-col">
      <!-- Activity Templates -->
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">Activity Templates</div>
          <div class="panel-count" id="templates-count">0 templates</div>
        </div>
        <div id="templates-list"></div>
      </div>

      <!-- Thompson Sampling -->
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">🎲 Thompson Sampling (Learning System)</div>
          <div class="panel-count" id="scores-count">0 scores</div>
        </div>
        <div id="scores-list"></div>
      </div>
    </div>

    <!-- Two column layout -->
    <div class="two-col">
      <!-- Impulse Resolution -->
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">Impulse Resolution</div>
          <div class="panel-count" id="impulses-count">0 shapes</div>
        </div>
        <div id="impulses-list"></div>
      </div>

      <!-- Data Sources -->
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">📡 Data Sources (Impulse Resolution)</div>
          <div class="panel-count" id="sources-count">0 data sources</div>
        </div>
        <div class="data-sources-grid" id="sources-list"></div>
      </div>
    </div>

    <!-- Activity Compositions -->
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title">🔗 Activity Compositions</div>
        <div class="panel-count" id="compositions-count">0 edges</div>
      </div>
      <div id="compositions-list"></div>
    </div>

    <!-- Recommendation Weights -->
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title">⚖️ Recommendation Weights (Thompson Sampling)</div>
        <div class="panel-count" id="recommendations-count">0 recommendations</div>
      </div>
      <div id="recommendations-list"></div>
    </div>

    <!-- Impulse Relevancy -->
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title">🎯 Impulse Relevancy Metrics</div>
        <div class="panel-count" id="relevance-count">0 metrics</div>
      </div>
      <div id="relevance-list"></div>
    </div>

    <!-- Task Resolver Views -->
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title">🔍 Task Execution Views (Resolver Perspective)</div>
        <div class="panel-count" id="tasks-count">0 executions</div>
      </div>
      <div id="tasks-list"></div>
    </div>
  </div>

  <script>
    let lastData = null;

    async function updateDashboard() {
      try {
        const response = await fetch('/api/data');
        const data = await response.json();
        lastData = data;

        // Update timestamp
        const date = new Date(data.lastUpdate);
        document.getElementById('last-update').textContent =
          date.toLocaleTimeString('en-US', { hour12: false });

        // Update executions
        renderExecutions(data.executions || []);

        // Update learning metrics
        renderLearningMetrics(data.executions || []);

        // Update templates
        renderTemplates(data.templates || []);

        // Update Thompson scores
        renderScores(data.scores || []);

        // Update impulses
        renderImpulses(data.impulses || []);

        // Update data sources
        renderDataSources(data.sources || []);

        // Update compositions
        renderCompositions(data.compositions || []);

        // Update recommendations
        renderRecommendations(data.recommendations);

        // Update relevance
        renderRelevance(data.relevance || []);

        // Update task views
        renderTaskViews(data.taskViews || []);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    }

    function renderExecutions(executions) {
      const container = document.getElementById('executions-list');
      const count = document.getElementById('executions-count');
      count.textContent = \`\${executions.length} executions\`;

      if (executions.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">No executions yet</div><div class="empty-subtext">Run some activities to see them here</div></div>';
        return;
      }

      container.innerHTML = executions.slice(0, 50).map(exec => {
        const status = exec.success ? 'success' : 'failure';
        const icon = exec.success ? '✓' : '✗';
        const date = new Date(exec.created_at);
        const time = date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
        const duration = exec.duration_ms
          ? (exec.duration_ms < 1000 ? \`\${exec.duration_ms}ms\` : \`\${(exec.duration_ms / 1000).toFixed(1)}s\`)
          : '--';
        const cost = exec.cost_usd?.toFixed(4) || '0.00';
        const tokens = \`\${exec.total_tokens_in || 0} → \${exec.total_tokens_out || 0}\`;

        return \`
          <div class="execution-item \${status}">
            <div class="execution-header">
              <div>
                <span style="font-size: 1.2em; margin-right: 8px;">\${icon}</span>
                <strong class="execution-id">\${exec.activity_id}</strong>
              </div>
              <div class="execution-timestamp">\${exec.execution_id.substring(0, 17)}... • \${time}</div>
            </div>
            <div class="execution-metrics">
              <div>⏱ \${duration}</div>
              <div>💰 $\${cost}</div>
            </div>
            <div style="margin-top: 8px; color: #666; font-size: 0.85em;">
              Tokens: \${tokens}
              <span class="execution-status \${status}">\${status.toUpperCase()}</span>
            </div>
          </div>
        \`;
      }).join('');
    }

    function renderLearningMetrics(executions) {
      const container = document.getElementById('learning-metrics');
      const recentExecs = executions.slice(0, 20);
      const successCount = recentExecs.filter(e => e.success).length;
      const successRate = recentExecs.length > 0 ? (successCount / recentExecs.length * 100).toFixed(1) : '0.0';
      const avgCost = recentExecs.reduce((sum, e) => sum + (e.cost_usd || 0), 0) / Math.max(recentExecs.length, 1);
      const avgDuration = recentExecs.reduce((sum, e) => sum + (e.duration_ms || 0), 0) / Math.max(recentExecs.length, 1);

      const mostUsed = {};
      executions.forEach(e => {
        mostUsed[e.activity_id] = (mostUsed[e.activity_id] || 0) + 1;
      });
      const topActivity = Object.entries(mostUsed).sort((a, b) => b[1] - a[1])[0] || ['None', 0];

      const scores = lastData?.scores || [];
      const converged = scores.filter(s => s.confidence > 80).length;
      const exploring = scores.filter(s => s.confidence <= 80).length;

      document.getElementById('learning-count').textContent = \`\${recentExecs.length} recent\`;

      container.innerHTML = \`
        <div class="learning-metric">
          <div class="metric-label">Success Rate (Last 20)</div>
          <div class="metric-value">\${successRate}%</div>
          <div class="metric-detail">\${successCount}/\${recentExecs.length} succeeded</div>
        </div>
        <div class="learning-metric">
          <div class="metric-label">Average Cost</div>
          <div class="metric-value">$\${avgCost.toFixed(4)}</div>
          <div class="metric-detail">⏱ Avg duration: \${avgDuration.toFixed(2)}ms</div>
        </div>
        <div class="learning-metric">
          <div class="metric-label">Exploration Balance</div>
          <div class="metric-value">\${exploring} / \${scores.length}</div>
          <div class="metric-detail">🔍 Exploring: \${exploring}<br>🎯 Exploiting: \${converged}</div>
        </div>
        <div class="learning-metric" style="grid-column: 1 / -1;">
          <div class="metric-label">🏆 Most Used Template</div>
          <div class="metric-value" style="font-size: 1em;">\${topActivity[0]}</div>
          <div class="metric-detail">\${topActivity[1]} executions • \${(successCount / Math.max(topActivity[1], 1) * 100).toFixed(0)}% success</div>
        </div>
        <div class="learning-metric" style="grid-column: 1 / -1;">
          <div class="metric-label">System Learning State</div>
          <div class="metric-detail">
            ✓ \${converged} templates converged (high confidence)<br>
            ⚡ \${exploring} templates still exploring<br>
            📈 \${scores.length} total templates tracked
          </div>
        </div>
      \`;
    }

    function renderTemplates(templates) {
      const container = document.getElementById('templates-list');
      const count = document.getElementById('templates-count');
      count.textContent = \`\${templates.length} templates\`;

      if (templates.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><div class="empty-text">No templates</div></div>';
        return;
      }

      // Group by category
      const grouped = {};
      templates.forEach(t => {
        const cat = t.category || 'uncategorized';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(t);
      });

      container.innerHTML = Object.entries(grouped).map(([category, items]) => \`
        <div class="template-group">
          <div class="template-group-title">\${category}</div>
          \${items.slice(0, 5).map(t => {
            // Prefer metrics field when available (enriched data), fallback to root fields
            const alpha = t.metrics?.thompson_alpha || t.thompson_alpha || 1;
            const beta = t.metrics?.thompson_beta || t.thompson_beta || 1;
            const totalExecs = t.metrics?.total_executions || t.total_executions || 0;
            const successExecs = t.metrics?.successful_executions || t.successful_executions || 0;

            const score = (alpha / (alpha + beta) * 100).toFixed(0);
            const runs = (alpha + beta - 2);
            const successRate = totalExecs > 0 ? ((successExecs / totalExecs) * 100).toFixed(0) : '0';
            return \`
              <div class="template-item">
                <div class="template-name">\${t.name || t.id}</div>
                <div class="template-meta">
                  <span>\${runs} runs</span>
                  <span>\${score}% Thompson</span>
                  <span>\${successRate}% success</span>
                </div>
              </div>
            \`;
          }).join('')}
        </div>
      \`).join('');
    }

    function renderScores(scores) {
      const container = document.getElementById('scores-list');
      const count = document.getElementById('scores-count');
      count.textContent = \`\${scores.length} scores\`;

      if (scores.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">🎲</div><div class="empty-text">No scores</div></div>';
        return;
      }

      // Sort by score descending, show top 10
      const sorted = [...scores].sort((a, b) => b.score - a.score).slice(0, 10);

      container.innerHTML = sorted.map(s => {
        const pct = (s.score * 100).toFixed(1);
        const uncertainty = (100 / Math.sqrt(s.alpha + s.beta)).toFixed(1);
        const phase = s.confidence < 20 ? 'EXPLORING' : s.confidence > 80 ? 'CONVERGED' : 'LEARNING';
        const runs = s.alpha + s.beta - 2;

        return \`
          <div class="score-item">
            <div class="score-header">
              <div>
                <div class="score-name">\${s.activity_id}</div>
                <div style="color: #666; font-size: 0.75em; margin-top: 2px;">
                  <span style="background: #333; padding: 2px 6px; border-radius: 3px;">\${phase}</span>
                  \${runs} runs
                </div>
              </div>
              <div class="score-value">\${pct}%<span style="font-size: 0.6em; color: #666;"> ±\${uncertainty}%</span></div>
            </div>
            <div class="score-meta" style="margin-top: 8px;">
              α=\${s.alpha.toFixed(1)} • β=\${s.beta.toFixed(1)} • confidence=\${s.confidence}
            </div>
          </div>
        \`;
      }).join('');
    }

    function renderImpulses(impulses) {
      const container = document.getElementById('impulses-list');
      const count = document.getElementById('impulses-count');
      count.textContent = \`\${impulses.length} shapes\`;

      if (impulses.length === 0) {
        container.innerHTML = \`
          <div class="empty-state">
            <div class="empty-icon">🔒</div>
            <div class="empty-text">Impulse metrics unavailable</div>
            <div class="empty-subtext">Requires API key authentication<br>Status: Waiting for authenticated executions</div>
          </div>
        \`;
        return;
      }

      container.innerHTML = impulses.map(imp => \`
        <div class="impulse-item">
          <div class="impulse-shape">\${imp.shape}</div>
          <div class="impulse-resolver">Resolver: \${imp.resolver}</div>
          <div class="impulse-stats">\${imp.count} resolutions • Avg \${imp.avg_duration_ms}ms</div>
        </div>
      \`).join('');
    }

    function renderDataSources(sources) {
      const container = document.getElementById('sources-list');
      const count = document.getElementById('sources-count');
      count.textContent = \`\${sources.length} data sources\`;

      if (sources.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">📡</div><div class="empty-text">No sources</div></div>';
        return;
      }

      container.innerHTML = sources.map(src => {
        const lastFetch = src.lastFetch === 'never' ? 'Never' :
          new Date(src.lastFetch).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

        return \`
          <div class="data-source-item \${src.status}">
            <div class="data-source-header">
              <div class="data-source-shape">\${src.shape}</div>
              <span class="data-source-status \${src.status}">\${src.status.toUpperCase()}</span>
            </div>
            <div class="data-source-meta">
              <strong>Vessel:</strong> \${src.vessel}<br>
              <strong>Type:</strong> \${src.name}<br>
              <strong>Last Fetch:</strong> \${lastFetch}
            </div>
            <div class="data-source-endpoint">GET \${src.endpoint || 'N/A'}</div>
          </div>
        \`;
      }).join('');
    }

    function renderCompositions(compositions) {
      const container = document.getElementById('compositions-list');
      const count = document.getElementById('compositions-count');
      count.textContent = \`\${compositions.length} edges\`;

      if (compositions.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔗</div><div class="empty-text">No compositions yet</div><div class="empty-subtext">Activity compositions will appear here when activities call other activities</div></div>';
        return;
      }

      // Group by parent activity
      const grouped = {};
      compositions.forEach(comp => {
        const parent = comp.parent_activity_id || 'unknown';
        if (!grouped[parent]) grouped[parent] = [];
        grouped[parent].push(comp);
      });

      container.innerHTML = Object.entries(grouped).slice(0, 10).map(([parent, edges]) => {
        const successRate = edges.reduce((sum, e) => sum + (e.success_count || 0), 0) /
                           edges.reduce((sum, e) => sum + (e.total_count || 1), 0) * 100;
        return \`
          <div class="template-group">
            <div class="template-group-title">\${parent} → \${edges.length} children</div>
            \${edges.slice(0, 5).map(edge => \`
              <div class="template-item">
                <div class="template-name">→ \${edge.child_activity_id}</div>
                <div class="template-meta">
                  <span>\${edge.total_count || 0} calls</span>
                  <span>\${((edge.success_count || 0) / (edge.total_count || 1) * 100).toFixed(0)}% success</span>
                  <span>Avg \${(edge.avg_duration_ms || 0).toFixed(0)}ms</span>
                </div>
              </div>
            \`).join('')}
          </div>
        \`;
      }).join('');
    }

    function renderRecommendations(recommendations) {
      const container = document.getElementById('recommendations-list');
      const count = document.getElementById('recommendations-count');

      if (!recommendations || !recommendations.recommendations || recommendations.recommendations.length === 0) {
        count.textContent = '0 recommendations';
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">⚖️</div><div class="empty-text">No recommendations</div><div class="empty-subtext">Recommendation weights require active goal processing</div></div>';
        return;
      }

      const recs = recommendations.recommendations;
      count.textContent = \`\${recs.length} recommendations\`;

      container.innerHTML = recs.slice(0, 10).map((rec, idx) => {
        const metadata = rec.selection_metadata || {};
        const alpha = metadata.alpha || 1;
        const beta = metadata.beta || 1;
        const sample = metadata.sample || 0.5;
        const boosts = metadata.boost_breakdown || {};
        const totalBoost = metadata.heuristic_boost || 0;

        return \`
          <div class="score-item">
            <div class="score-header">
              <div>
                <div class="score-name">#\${idx + 1} \${rec.template_id}</div>
                <div style="color: #666; font-size: 0.75em; margin-top: 2px;">
                  <span style="background: #333; padding: 2px 6px; border-radius: 3px;">\${metadata.method || 'unknown'}</span>
                  <span style="background: #333; padding: 2px 6px; border-radius: 3px; margin-left: 4px;">\${metadata.score_source || 'unknown'}</span>
                </div>
              </div>
              <div class="score-value">\${(sample * 100).toFixed(1)}%</div>
            </div>
            <div class="score-meta" style="margin-top: 8px;">
              α=\${alpha.toFixed(1)} • β=\${beta.toFixed(1)} • boost=+\${totalBoost}
            </div>
            <div style="margin-top: 8px; font-size: 0.8em; color: #666;">
              Boost breakdown:
              \${Object.entries(boosts).map(([key, val]) => \`\${key}=+\${val}\`).join(' • ')}
            </div>
          </div>
        \`;
      }).join('');
    }

    function renderRelevance(relevance) {
      const container = document.getElementById('relevance-list');
      const count = document.getElementById('relevance-count');
      count.textContent = \`\${relevance.length} metrics\`;

      if (relevance.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">🎯</div><div class="empty-text">No relevance metrics</div><div class="empty-subtext">Impulse relevancy tracking will appear here</div></div>';
        return;
      }

      container.innerHTML = relevance.slice(0, 20).map(rel => {
        const relevanceScore = rel.relevance_score || 0;
        const loadTime = rel.load_time_ms || 0;
        const accuracy = rel.state_transition_accuracy || 0;

        return \`
          <div class="impulse-item">
            <div class="impulse-shape">\${rel.impulse_id || rel.impulse_shape}</div>
            <div class="impulse-resolver">Activity: \${rel.activity_id || 'unknown'}</div>
            <div class="impulse-stats">
              Relevance: \${(relevanceScore * 100).toFixed(0)}% •
              Load: \${loadTime.toFixed(0)}ms •
              Accuracy: \${(accuracy * 100).toFixed(0)}%
            </div>
          </div>
        \`;
      }).join('');
    }

    function renderTaskViews(taskViews) {
      const container = document.getElementById('tasks-list');
      const count = document.getElementById('tasks-count');
      count.textContent = \`\${taskViews.length} executions\`;

      if (taskViews.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">No task views</div></div>';
        return;
      }

      container.innerHTML = taskViews.map(view => {
        const tasks = view.tasks || [];
        const date = new Date(view.created_at);
        const time = date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
        const status = view.success ? 'success' : 'failure';
        const icon = view.success ? '✓' : '✗';

        return \`
          <div class="execution-item \${status}" style="margin-bottom: 15px;">
            <div class="execution-header">
              <div>
                <span style="font-size: 1.2em; margin-right: 8px;">\${icon}</span>
                <strong class="execution-id">\${view.activity_id}</strong>
              </div>
              <div class="execution-timestamp">\${view.execution_id.substring(0, 17)}... • \${time}</div>
            </div>
            <div style="margin-top: 10px; padding-left: 10px; border-left: 2px solid #333;">
              \${tasks.map((task, idx) => {
                const taskStatus = task.success ? '✓' : task.error ? '✗' : '⏳';
                const taskColor = task.success ? '#10b981' : task.error ? '#ef4444' : '#f59e0b';

                return \`
                  <div style="margin-bottom: 10px; padding: 8px; background: #0a0a0a; border-radius: 4px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                      <div>
                        <span style="color: \${taskColor}; margin-right: 8px;">\${taskStatus}</span>
                        <strong style="color: #e0e0e0;">Task #\${idx + 1}: \${task.task_id || task.id || 'unknown'}</strong>
                      </div>
                      <div style="color: #666; font-size: 0.85em;">\${task.duration_ms ? task.duration_ms + 'ms' : '--'}</div>
                    </div>
                    <div style="color: #999; font-size: 0.85em;">
                      Resolver: \${task.resolver || task.resolver_id || 'llm'}
                    </div>
                    \${task.impulse_refs ? \`
                      <div style="color: #666; font-size: 0.8em; margin-top: 5px;">
                        Impulses: \${task.impulse_refs.map(ref => ref.key || ref).join(', ')}
                      </div>
                    \` : ''}
                    \${task.error ? \`
                      <div style="color: #ef4444; font-size: 0.8em; margin-top: 5px; background: #1a0000; padding: 5px; border-radius: 3px;">
                        Error: \${task.error}
                      </div>
                    \` : ''}
                  </div>
                \`;
              }).join('')}
            </div>
          </div>
        \`;
      }).join('');
    }

    // Poll every 3 seconds
    updateDashboard();
    setInterval(updateDashboard, 3000);
  </script>
</body>
</html>
  `);
});

// API endpoint for data
app.get('/api/data', (c) => {
  return c.json({
    executions: cache.executions,
    templates: cache.templates,
    impulses: cache.impulses,
    scores: cache.scores,
    compositions: cache.compositions,
    recommendations: cache.recommendations,
    relevance: cache.relevance,
    taskViews: cache.taskViews,
    sources: dataSources.map(ds => ({
      ...ds,
      endpoint: ds.name === 'executions' ? '/v2/activities/executions?limit=50' :
                ds.name === 'templates' ? '/v2/activities/templates' :
                ds.name === 'impulses' ? '/v2/impulses/resolution-metrics?limit=20' : 'N/A',
    })),
    lastUpdate: cache.lastUpdate,
  });
});

// Health check
app.get('/api/health', (c) => {
  return c.json({
    status: 'healthy',
    backend: ACTIVITY_API_URL,
    lastUpdate: new Date(cache.lastUpdate).toISOString(),
    cacheAge: Date.now() - cache.lastUpdate,
    sources: dataSources,
  });
});

// Start server
console.log(`🚀 Activity Monitor starting on port ${PORT}`);
console.log(`📡 Backend: ${ACTIVITY_API_URL}`);
console.log(`🔑 API Key: ${METABOB_API_KEY ? '✓ Set' : '✗ Not set'}`);

// Initial cache update
updateCache();

// Update cache every 3 seconds
setInterval(updateCache, 3000);

// Start HTTP server
export default {
  port: PORT,
  fetch: app.fetch,
};
