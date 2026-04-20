import { Hono } from "hono";
import { serveStatic } from "hono/bun";

const app = new Hono();

// Configuration
const ACTIVITY_API = process.env.ACTIVITY_API_URL || "https://activity.metabob.com";
const API_KEY = process.env.METABOB_API_KEY || "";
const PORT = parseInt(process.env.PORT || "3030");

interface ActivityExecution {
  id: string;
  activity_id: string;
  variant_id?: string;
  status: string;
  created_at: string;
  duration_ms?: number;
  cost_usd?: number;
  tokens_in?: number;
  tokens_out?: number;
}

interface ActivityTemplate {
  id: string;
  name: string;
  category: string;
  tags: string[];
  variant_count: number;
  thompson_alpha?: number;
  thompson_beta?: number;
  metrics?: {
    total_executions: number;
    successful_executions: number;
    failed_executions: number;
    success_rate: number;
    thompson_alpha: number;
    thompson_beta: number;
    avg_duration_ms: number;
    avg_cost_usd: number;
  };
}

interface ThompsonScore {
  activity_id: string;
  alpha: number;
  beta: number;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  success_rate: number;
  mean_score: number;
  confidence_interval: {
    lower: number;
    upper: number;
  };
  confidence_level: number;
  exploring: boolean;
}

interface ImpulseResolution {
  shape: string;
  resolver: string;
  count: number;
  avg_duration_ms: number;
}

// Data source metadata
interface DataSource {
  endpoint: string;
  shape: string;
  vessel: string;
  lastFetch: number;
  status: "healthy" | "error" | "stale";
}

// Cache for real-time updates
let cachedData = {
  executions: [] as ActivityExecution[],
  templates: [] as ActivityTemplate[],
  thompsonScores: [] as ThompsonScore[],
  impulses: [] as ImpulseResolution[],
  lastUpdate: Date.now(),
  sources: {
    executions: {
      endpoint: "/v2/activities/executions?limit=50",
      shape: "execution_trace",
      vessel: "metabob-activity-api",
      lastFetch: 0,
      status: "healthy" as const,
    },
    templates: {
      endpoint: "/v2/activities/templates",
      shape: "activity_template",
      vessel: "metabob-activity-api",
      lastFetch: 0,
      status: "healthy" as const,
    },
    // thompsonScores: {
    //   endpoint: "/v2/activities/scores?limit=50&org_id=test-metabob-users",
    //   shape: "thompson_scores",
    //   vessel: "metabob-activity-api",
    //   lastFetch: 0,
    //   status: "healthy" as const,
    // },
    impulses: {
      endpoint: "/v2/impulses/resolution-metrics?limit=20",
      shape: "impulse_resolution_metrics",
      vessel: "metabob-activity-api",
      lastFetch: 0,
      status: "healthy" as const,
    },
  },
};

// Fetch recent executions
async function fetchExecutions(): Promise<ActivityExecution[]> {
  const source = cachedData.sources.executions;
  try {
    console.log(`[IMPULSE] Resolving ${source.shape} from ${source.vessel}${source.endpoint}`);
    const response = await fetch(`${ACTIVITY_API}${source.endpoint}`, {
      headers: {
        Authorization: `ApiKey ${API_KEY}`,
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch executions: ${response.status}`);
      source.status = "error";
      return [];
    }

    const data = await response.json();
    source.lastFetch = Date.now();
    source.status = "healthy";
    console.log(`[IMPULSE] Resolved ${data.executions?.length || 0} execution_trace impulses`);
    return data.executions || [];
  } catch (error) {
    console.error("Error fetching executions:", error);
    source.status = "error";
    return [];
  }
}

// Fetch activity templates
async function fetchTemplates(): Promise<ActivityTemplate[]> {
  const source = cachedData.sources.templates;
  try {
    console.log(`[IMPULSE] Resolving ${source.shape} from ${source.vessel}${source.endpoint}`);
    const response = await fetch(`${ACTIVITY_API}${source.endpoint}`, {
      headers: {
        Authorization: `ApiKey ${API_KEY}`,
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch templates: ${response.status}`);
      source.status = "error";
      return [];
    }

    const data = await response.json();
    source.lastFetch = Date.now();
    source.status = "healthy";
    console.log(`[IMPULSE] Resolved ${data.templates?.length || 0} activity_template impulses`);
    return data.templates || [];
  } catch (error) {
    console.error("Error fetching templates:", error);
    source.status = "error";
    return [];
  }
}

// Fetch Thompson Sampling scores
async function fetchThompsonScores(): Promise<ThompsonScore[]> {
  const source = cachedData.sources.thompsonScores;
  try {
    console.log(`[IMPULSE] Resolving ${source.shape} from ${source.vessel}${source.endpoint}`);
    const response = await fetch(`${ACTIVITY_API}${source.endpoint}`, {
      headers: {
        Authorization: `ApiKey ${API_KEY}`,
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch Thompson scores: ${response.status}`);
      source.status = "error";
      return [];
    }

    const data = await response.json();
    source.lastFetch = Date.now();
    source.status = "healthy";
    console.log(`[IMPULSE] Resolved ${data.scores?.length || 0} thompson_scores`);
    return data.scores || [];
  } catch (error) {
    console.error("Error fetching Thompson scores:", error);
    source.status = "error";
    return [];
  }
}

// Fetch impulse resolution metrics
async function fetchImpulseMetrics(): Promise<ImpulseResolution[]> {
  const source = cachedData.sources.impulses;
  try {
    console.log(`[IMPULSE] Resolving ${source.shape} from ${source.vessel}${source.endpoint}`);
    const response = await fetch(`${ACTIVITY_API}${source.endpoint}`, {
      headers: {
        Authorization: `ApiKey ${API_KEY}`,
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch impulse metrics: ${response.status}`);
      source.status = "error";
      return [];
    }

    const data = await response.json();
    source.lastFetch = Date.now();
    source.status = "healthy";
    console.log(`[IMPULSE] Resolved ${data.metrics?.length || 0} impulse_resolution_metrics`);
    return data.metrics || [];
  } catch (error) {
    console.error("Error fetching impulse metrics:", error);
    source.status = "error";
    return [];
  }
}

// Update cache periodically
async function updateCache() {
  console.log("Updating cache...");
  const [executions, templates, impulses] = await Promise.all([
    fetchExecutions(),
    fetchTemplates(),
    fetchImpulseMetrics(),
  ]);

  // Derive Thompson scores from templates (since /scores endpoint requires JWT auth)
  const thompsonScores = templates
    .filter(t => t.thompson_alpha != null && t.thompson_beta != null)
    .map(t => ({
      activity_id: t.id,
      alpha: t.thompson_alpha!,
      beta: t.thompson_beta!,
      total_executions: t.total_executions || 0,
      success_rate: t.success_rate || 0,
      mean_score: t.thompson_alpha! / (t.thompson_alpha! + t.thompson_beta!),
      confidence_interval: {
        lower: 0, // Simplified - would need beta distribution calculation
        upper: 1,
      },
      confidence_level: t.total_executions || 0,
      exploring: (t.total_executions || 0) < 10,
    }));

  cachedData.executions = executions;
  cachedData.templates = templates;
  cachedData.thompsonScores = thompsonScores;
  cachedData.impulses = impulses;
  cachedData.lastUpdate = Date.now();

  console.log(`Cache updated: ${executions.length} executions, ${templates.length} templates, ${thompsonScores.length} scores (derived), ${impulses.length} impulses`);
}

// Start periodic updates
setInterval(updateCache, 3000); // Update every 3 seconds
updateCache(); // Initial update

// API Routes
app.get("/api/data", (c) => {
  // Return only summary data needed by dashboard (not full execution/template objects with traces)
  const summaryData = {
    executions: cachedData.executions.map(exec => ({
      id: exec.id,
      execution_id: exec.execution_id,
      activity_id: exec.activity_id,
      status: exec.status || (exec.success ? 'success' : 'failure'),
      success: exec.success,
      created_at: exec.created_at,
      executed_at: exec.executed_at,
      duration_ms: exec.duration_ms || 0,
      cost_usd: exec.cost_usd || 0,
      tokens_in: exec.tokens_in || exec.tokens_input || 0,
      tokens_out: exec.tokens_out || exec.tokens_output || 0,
    })),
    templates: cachedData.templates.map(t => ({
      id: t.id,
      name: t.name,
      category: t.category,
      thompson_alpha: t.thompson_alpha,
      thompson_beta: t.thompson_beta,
      total_executions: t.total_executions,
      success_rate: t.success_rate,
      created_at: t.created_at,
    })),
    thompsonScores: cachedData.thompsonScores || [],
    impulses: cachedData.impulses || [],
    sources: cachedData.sources,
    lastUpdate: cachedData.lastUpdate,
  };
  return c.json(summaryData);
});

app.get("/api/sources", (c) => {
  return c.json({
    backend: ACTIVITY_API,
    sources: cachedData.sources,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health", (c) => {
  return c.json({
    status: "healthy",
    backend: ACTIVITY_API,
    lastUpdate: new Date(cachedData.lastUpdate).toISOString(),
    cacheAge: Date.now() - cachedData.lastUpdate,
    sources: Object.entries(cachedData.sources).map(([key, src]) => ({
      name: key,
      shape: src.shape,
      vessel: src.vessel,
      status: src.status,
      lastFetch: src.lastFetch ? new Date(src.lastFetch).toISOString() : "never",
    })),
  });
});

// Frontend
app.get("/", (c) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Activity Monitor - Live Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
      background: #0a0a0a;
      color: #e0e0e0;
      padding: 20px;
      line-height: 1.5;
    }

    .container {
      max-width: 1800px;
      margin: 0 auto;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #333;
    }

    h1 {
      font-size: 24px;
      color: #00ff88;
      font-weight: 600;
    }

    .status {
      display: flex;
      gap: 20px;
      font-size: 12px;
      color: #888;
    }

    .status-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .pulse {
      width: 8px;
      height: 8px;
      background: #00ff88;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }

    .panel {
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 20px;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid #333;
    }

    .panel-title {
      font-size: 14px;
      font-weight: 600;
      color: #00ff88;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .panel-count {
      font-size: 12px;
      color: #666;
    }

    .execution-list {
      max-height: 400px;
      overflow-y: auto;
    }

    .execution-item {
      padding: 12px;
      margin-bottom: 8px;
      background: #0f0f0f;
      border-left: 3px solid #333;
      border-radius: 4px;
      font-size: 12px;
      transition: all 0.2s;
    }

    .execution-item:hover {
      background: #151515;
      border-left-color: #00ff88;
    }

    .execution-item.status-completed { border-left-color: #00ff88; }
    .execution-item.status-failed { border-left-color: #ff4444; }
    .execution-item.status-running { border-left-color: #ffaa00; }
    .execution-item.status-success { border-left-color: #00ff88; }
    .execution-item.status-failure { border-left-color: #ff4444; }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(-20px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .execution-item.new {
      animation: slideIn 0.3s ease-out;
    }

    .execution-meta {
      display: flex;
      justify-content: space-between;
      margin-top: 6px;
      color: #666;
      font-size: 11px;
    }

    .tag {
      display: inline-block;
      padding: 2px 8px;
      background: #222;
      border-radius: 3px;
      font-size: 10px;
      color: #00ff88;
      margin-right: 5px;
    }

    .template-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px;
      margin-bottom: 6px;
      background: #0f0f0f;
      border-radius: 4px;
      font-size: 12px;
    }

    .template-info {
      flex: 1;
    }

    .template-name {
      color: #e0e0e0;
      font-weight: 500;
      margin-bottom: 4px;
    }

    .template-tags {
      display: flex;
      gap: 5px;
      margin-top: 4px;
    }

    .template-metrics {
      display: flex;
      gap: 12px;
      font-size: 11px;
      color: #666;
    }

    .metric {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      min-width: 45px;
    }

    .metric-value {
      color: #00ff88;
      font-weight: 600;
      font-size: 12px;
    }

    .metric-value.zero {
      color: #666;
    }

    .metric-label {
      color: #666;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .impulse-item {
      display: flex;
      justify-content: space-between;
      padding: 10px;
      margin-bottom: 6px;
      background: #0f0f0f;
      border-radius: 4px;
      font-size: 12px;
    }

    .impulse-shape {
      color: #ffaa00;
      font-weight: 500;
    }

    .impulse-resolver {
      color: #666;
      font-size: 11px;
    }

    .impulse-stats {
      display: flex;
      gap: 15px;
      font-size: 11px;
      color: #666;
    }

    .thompson-item {
      padding: 12px;
      margin-bottom: 8px;
      background: #0f0f0f;
      border-left: 3px solid #333;
      border-radius: 4px;
      font-size: 12px;
      transition: all 0.2s;
    }

    .thompson-item:hover {
      background: #151515;
    }

    ::-webkit-scrollbar {
      width: 8px;
    }

    ::-webkit-scrollbar-track {
      background: #0a0a0a;
    }

    ::-webkit-scrollbar-thumb {
      background: #333;
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: #444;
    }

    .full-width {
      grid-column: 1 / -1;
    }

    .source-item {
      background: #0f0f0f;
      border: 1px solid #333;
      border-radius: 4px;
      padding: 12px;
      font-size: 11px;
    }

    .source-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .source-shape {
      color: #ffaa00;
      font-weight: 600;
      font-size: 12px;
    }

    .source-status {
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 600;
    }

    .source-status.healthy {
      background: #00ff88;
      color: #000;
    }

    .source-status.error {
      background: #ff4444;
      color: #fff;
    }

    .source-status.stale {
      background: #666;
      color: #fff;
    }

    .source-detail {
      color: #888;
      margin-top: 4px;
      line-height: 1.6;
    }

    .source-detail strong {
      color: #e0e0e0;
    }

    .source-endpoint {
      color: #00ff88;
      font-family: monospace;
      font-size: 10px;
      margin-top: 6px;
      padding: 4px;
      background: #0a0a0a;
      border-radius: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>⚡ Activity Monitor</h1>
      <div class="status">
        <div class="status-item">
          <div class="pulse"></div>
          <span id="status-text">Connecting...</span>
        </div>
        <div class="status-item">
          <span id="last-update">--:--:--</span>
        </div>
      </div>
    </header>

    <div class="grid">
      <div class="panel full-width">
        <div class="panel-header">
          <div class="panel-title">Recent Executions</div>
          <div class="panel-count" id="executions-count">0 executions</div>
        </div>
        <div class="execution-list" id="executions-list">
          <div style="color: #666; text-align: center; padding: 20px;">Loading...</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">📊 Learning Insights</div>
          <div class="panel-count" id="insights-count">--</div>
        </div>
        <div id="insights-list">
          <div style="color: #666; text-align: center; padding: 20px;">Loading...</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">Activity Templates</div>
          <div class="panel-count" id="templates-count">0 templates</div>
        </div>
        <div id="templates-list">
          <div style="color: #666; text-align: center; padding: 20px;">Loading...</div>
        </div>
      </div>

      <div class="panel full-width" style="background: #151515; border: 2px solid #00ff88;">
        <div class="panel-header">
          <div class="panel-title" style="color: #00ff88;">🎲 Thompson Sampling (Learning System)</div>
          <div class="panel-count" id="thompson-count">0 scores</div>
        </div>
        <div id="thompson-list" style="max-height: 500px; overflow-y: auto;">
          <div style="color: #666; text-align: center; padding: 20px;">Loading...</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">Impulse Resolution</div>
          <div class="panel-count" id="impulses-count">0 shapes</div>
        </div>
        <div id="impulses-list">
          <div style="color: #666; text-align: center; padding: 20px;">Loading...</div>
        </div>
      </div>

      <div class="panel full-width" style="background: #151515; border-color: #444;">
        <div class="panel-header">
          <div class="panel-title" style="color: #ffaa00;">📡 Data Sources (Impulse Resolution)</div>
          <div class="panel-count" id="sources-count">0 vessels</div>
        </div>
        <div id="sources-list" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
          <div style="color: #666; text-align: center; padding: 20px; grid-column: 1 / -1;">Loading...</div>
        </div>
      </div>
    </div>
  </div>

  <script>
    let lastExecutionId = null;

    function formatTime(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleTimeString();
    }

    function formatDuration(ms) {
      if (!ms) return '--';
      if (ms < 1000) return ms + 'ms';
      return (ms / 1000).toFixed(1) + 's';
    }

    function formatCost(usd) {
      if (!usd) return '$0.00';
      return '$' + usd.toFixed(4);
    }

    function renderExecutions(executions) {
      const list = document.getElementById('executions-list');
      const count = document.getElementById('executions-count');

      count.textContent = executions.length + ' executions';

      if (executions.length === 0) {
        list.innerHTML = \`
          <div style="color: #666; text-align: center; padding: 30px;">
            <div style="font-size: 14px; margin-bottom: 10px;">📭 No recent executions</div>
            <div style="font-size: 11px; color: #555;">
              Run an activity to see executions appear here<br/>
              <code style="color: #00ff88; background: #0a0a0a; padding: 2px 6px; border-radius: 2px; margin-top: 8px; display: inline-block;">
                minibob --single "check git status"
              </code>
            </div>
          </div>
        \`;
        return;
      }

      list.innerHTML = executions.map((exec, index) => {
        const isNew = index === 0 && lastExecutionId && exec.id !== lastExecutionId;
        const statusIcon = exec.status === 'success' || exec.status === 'completed' ? '✓' : '✗';
        const statusColor = exec.status === 'success' || exec.status === 'completed' ? '#00ff88' : '#ff4444';

        return \`
          <div class="execution-item status-\${exec.status} \${isNew ? 'new' : ''}">
            <div style="display: flex; justify-content: space-between; align-items: start;">
              <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                  <span style="color: \${statusColor}; font-size: 16px; font-weight: bold;">\${statusIcon}</span>
                  <strong style="color: #e0e0e0;">\${exec.activity_id}</strong>
                </div>
                <div style="font-size: 11px; color: #666; margin-left: 24px;">
                  \${exec.id.substring(0, 16)}... • \${formatTime(exec.created_at)}
                </div>
              </div>
              <div style="text-align: right; font-size: 11px;">
                <div style="color: #00ff88; margin-bottom: 4px;">⏱ \${formatDuration(exec.duration_ms)}</div>
                <div style="color: #ffaa00;">💰 \${formatCost(exec.cost_usd)}</div>
              </div>
            </div>
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #222; display: flex; justify-content: space-between; font-size: 11px; color: #666;">
              <span>Tokens: \${exec.tokens_in || 0} → \${exec.tokens_out || 0}</span>
              <span class="tag" style="background: \${statusColor}; color: #000;">\${exec.status.toUpperCase()}</span>
            </div>
          </div>
        \`;
      }).join('');

      if (executions.length > 0) {
        lastExecutionId = executions[0].id;
      }
    }

    function renderTemplates(templates) {
      const list = document.getElementById('templates-list');
      const count = document.getElementById('templates-count');

      count.textContent = templates.length + ' templates';

      if (templates.length === 0) {
        list.innerHTML = '<div style="color: #666; text-align: center; padding: 20px;">No templates</div>';
        return;
      }

      // Group by category
      const grouped = templates.reduce((acc, t) => {
        if (!acc[t.category]) acc[t.category] = [];
        acc[t.category].push(t);
        return acc;
      }, {});

      list.innerHTML = Object.entries(grouped).map(([category, items]) => \`
        <div style="margin-bottom: 20px;">
          <div style="font-size: 11px; color: #666; text-transform: uppercase; margin-bottom: 8px;">
            \${category}
          </div>
          \${items.map(t => {
            const alpha = t.metrics?.thompson_alpha || t.thompson_alpha || 1;
            const beta = t.metrics?.thompson_beta || t.thompson_beta || 1;
            const score = ((alpha / (alpha + beta)) * 100).toFixed(0);
            const executions = t.metrics?.total_executions || 0;
            const successRate = t.metrics?.success_rate || 0;

            return \`
            <div class="template-item">
              <div class="template-info">
                <div class="template-name">\${t.name}</div>
                <div class="template-tags">
                  \${(t.tags || []).slice(0, 3).map(tag => \`<span class="tag">\${tag}</span>\`).join('')}
                </div>
              </div>
              <div class="template-metrics">
                <div class="metric">
                  <div class="metric-value \${executions === 0 ? 'zero' : ''}">\${executions}</div>
                  <div class="metric-label">runs</div>
                </div>
                <div class="metric">
                  <div class="metric-value">\${score}%</div>
                  <div class="metric-label">Thompson</div>
                </div>
                <div class="metric">
                  <div class="metric-value \${successRate === 0 ? 'zero' : ''}">\${successRate.toFixed(0)}%</div>
                  <div class="metric-label">success</div>
                </div>
              </div>
            </div>
          \`;
          }).join('')}
        </div>
      \`).join('');
    }

    function renderImpulses(impulses) {
      const list = document.getElementById('impulses-list');
      const count = document.getElementById('impulses-count');

      count.textContent = impulses.length + ' shapes';

      if (impulses.length === 0) {
        list.innerHTML = \`
          <div style="color: #666; text-align: center; padding: 30px;">
            <div style="font-size: 14px; margin-bottom: 10px;">🔒 Impulse metrics unavailable</div>
            <div style="font-size: 11px; color: #555;">
              Requires API key authentication<br/>
              <span style="color: #ffaa00;">Status: Waiting for authenticated executions</span>
            </div>
          </div>
        \`;
        return;
      }

      list.innerHTML = impulses.map(imp => \`
        <div class="impulse-item">
          <div>
            <div class="impulse-shape">\${imp.shape}</div>
            <div class="impulse-resolver">via \${imp.resolver}</div>
          </div>
          <div class="impulse-stats">
            <div>
              <strong style="color: #00ff88;">\${imp.count}</strong>
              <span style="color: #666; margin-left: 5px;">resolutions</span>
            </div>
            <div>
              <strong style="color: #ffaa00;">\${formatDuration(imp.avg_duration_ms)}</strong>
              <span style="color: #666; margin-left: 5px;">avg</span>
            </div>
          </div>
        </div>
      \`).join('');
    }

    function renderLearningInsights(executions, thompsonScores) {
      const list = document.getElementById('insights-list');
      const count = document.getElementById('insights-count');

      if (executions.length === 0) {
        list.innerHTML = '<div style="color: #666; text-align: center; padding: 20px;">No data yet</div>';
        count.textContent = '--';
        return;
      }

      // Calculate insights
      const recentExecs = executions.slice(0, 20);
      const successCount = recentExecs.filter(e => e.status === 'success' || e.status === 'completed').length;
      const successRate = (successCount / recentExecs.length * 100).toFixed(1);

      const totalCost = recentExecs.reduce((sum, e) => sum + (e.cost_usd || 0), 0);
      const avgCost = (totalCost / recentExecs.length).toFixed(4);

      const avgDuration = recentExecs.reduce((sum, e) => sum + (e.duration_ms || 0), 0) / recentExecs.length;

      // Exploring vs exploiting
      const exploring = thompsonScores.filter(s => s.exploring).length;
      const exploiting = thompsonScores.length - exploring;
      const explorationPct = thompsonScores.length > 0 ? (exploring / thompsonScores.length * 100).toFixed(0) : 0;

      // Most/least used
      const sortedByExecs = thompsonScores.sort((a, b) => b.total_executions - a.total_executions);
      const mostUsed = sortedByExecs[0];
      const leastUsed = sortedByExecs[sortedByExecs.length - 1];

      // Converging templates (high confidence)
      const converged = thompsonScores.filter(s => s.confidence_level >= 10).length;

      count.textContent = recentExecs.length + ' recent';

      list.innerHTML = \`
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div class="insight-box" style="background: linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%); padding: 12px; border-radius: 6px; border: 1px solid #333;">
            <div style="font-size: 11px; color: #888; text-transform: uppercase; margin-bottom: 6px;">Success Rate (Last 20)</div>
            <div style="display: flex; align-items: baseline; gap: 8px;">
              <span style="font-size: 24px; color: \${successRate >= 75 ? '#00ff88' : successRate >= 50 ? '#ffaa00' : '#ff4444'}; font-weight: 600;">
                \${successRate}%
              </span>
              <span style="font-size: 12px; color: #666;">
                \${successCount}/\${recentExecs.length} succeeded
              </span>
            </div>
          </div>

          <div class="insight-box" style="background: #0f0f0f; padding: 12px; border-radius: 6px; border: 1px solid #333;">
            <div style="font-size: 11px; color: #888; text-transform: uppercase; margin-bottom: 6px;">Average Cost</div>
            <div style="font-size: 20px; color: #ffaa00; font-weight: 600;">
              $\${avgCost}
            </div>
            <div style="font-size: 10px; color: #666; margin-top: 4px;">
              ⏱ Avg duration: \${formatDuration(avgDuration)}
            </div>
          </div>

          <div class="insight-box" style="background: #0f0f0f; padding: 12px; border-radius: 6px; border: 1px solid #333;">
            <div style="font-size: 11px; color: #888; text-transform: uppercase; margin-bottom: 6px;">Exploration Balance</div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span style="color: #ffaa00; font-size: 12px;">🔍 Exploring: \${exploring}</span>
              <span style="color: #00ff88; font-size: 12px;">🎯 Exploiting: \${exploiting}</span>
            </div>
            <div style="height: 8px; background: #0a0a0a; border-radius: 4px; overflow: hidden;">
              <div style="height: 100%; background: linear-gradient(to right, #ffaa00, #00ff88); width: \${100 - explorationPct}%;"></div>
            </div>
          </div>

          \${mostUsed ? \`
          <div class="insight-box" style="background: #0f0f0f; padding: 12px; border-radius: 6px; border: 1px solid #333;">
            <div style="font-size: 11px; color: #888; text-transform: uppercase; margin-bottom: 6px;">🏆 Most Used Template</div>
            <div style="font-size: 13px; color: #00ff88; font-weight: 500; margin-bottom: 4px;">
              \${mostUsed.activity_id}
            </div>
            <div style="font-size: 11px; color: #666;">
              \${mostUsed.total_executions} executions • \${(mostUsed.success_rate * 100).toFixed(0)}% success
            </div>
          </div>
          \` : ''}

          <div class="insight-box" style="background: #0f0f0f; padding: 12px; border-radius: 6px; border: 1px solid #333;">
            <div style="font-size: 11px; color: #888; text-transform: uppercase; margin-bottom: 6px;">System Learning State</div>
            <div style="font-size: 12px; color: #e0e0e0;">
              <div style="margin-bottom: 4px;">✓ \${converged} templates converged (high confidence)</div>
              <div style="margin-bottom: 4px;">⚡ \${exploring} templates still exploring</div>
              <div>📈 \${thompsonScores.length} total templates tracked</div>
            </div>
          </div>
        </div>
      \`;
    }

    function renderThompsonScores(scores) {
      const list = document.getElementById('thompson-list');
      const count = document.getElementById('thompson-count');

      count.textContent = scores.length + ' scores';

      if (scores.length === 0) {
        list.innerHTML = \`
          <div style="color: #666; text-align: center; padding: 30px;">
            <div style="font-size: 14px; margin-bottom: 10px;">🎲 No Thompson Sampling data</div>
            <div style="font-size: 11px; color: #555;">
              Run activities to see learning system in action
            </div>
          </div>
        \`;
        return;
      }

      // Sort by confidence level (most uncertain first)
      const sortedScores = scores.sort((a, b) => a.confidence_level - b.confidence_level);

      list.innerHTML = sortedScores.slice(0, 10).map(score => {
        const meanPct = (score.mean_score * 100).toFixed(1);
        const ciWidth = (score.confidence_interval.upper - score.confidence_interval.lower) * 100;
        const ciWidthPct = ciWidth.toFixed(1);

        return \`
          <div class="thompson-item" style="\${score.exploring ? 'border-left-color: #ffaa00;' : 'border-left-color: #00ff88;'}">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div style="flex: 1;">
                <div style="color: #e0e0e0; font-weight: 500; font-size: 13px; margin-bottom: 4px;">
                  \${score.activity_id}
                </div>
                <div style="font-size: 11px; color: #888;">
                  <span class="tag" style="background: \${score.exploring ? '#ffaa00' : '#00ff88'}; color: #000;">
                    \${score.exploring ? 'EXPLORING' : 'EXPLOITING'}
                  </span>
                  <span style="margin-left: 10px;">\${score.total_executions} runs</span>
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 16px; color: #00ff88; font-weight: 600;">
                  \${meanPct}%
                </div>
                <div style="font-size: 10px; color: #666;">
                  ±\${ciWidthPct}%
                </div>
              </div>
            </div>
            <div style="margin-top: 10px;">
              <div style="display: flex; justify-content: space-between; font-size: 11px; color: #666; margin-bottom: 4px;">
                <span>α=\${score.alpha.toFixed(1)}</span>
                <span>β=\${score.beta.toFixed(1)}</span>
                <span>confidence=\${score.confidence_level}</span>
              </div>
              <div style="height: 6px; background: #0f0f0f; border-radius: 3px; overflow: hidden;">
                <div style="height: 100%; background: linear-gradient(to right, #ff4444, #ffaa00, #00ff88); width: \${meanPct}%;"></div>
              </div>
            </div>
          </div>
        \`;
      }).join('');
    }

    function renderSources(sources) {
      const list = document.getElementById('sources-list');
      const count = document.getElementById('sources-count');

      if (!sources) {
        list.innerHTML = '<div style="color: #666; text-align: center; padding: 20px; grid-column: 1 / -1;">Loading sources...</div>';
        return;
      }

      const sourceArray = Object.entries(sources).map(([key, src]) => ({
        name: key,
        ...src
      }));

      count.textContent = sourceArray.length + ' data sources';

      list.innerHTML = sourceArray.map(src => \`
        <div class="source-item">
          <div class="source-header">
            <div class="source-shape">\${src.shape}</div>
            <div class="source-status \${src.status}">\${src.status.toUpperCase()}</div>
          </div>
          <div class="source-detail">
            <strong>Vessel:</strong> \${src.vessel}
          </div>
          <div class="source-detail">
            <strong>Type:</strong> \${src.name}
          </div>
          <div class="source-detail">
            <strong>Last Fetch:</strong> \${src.lastFetch ? formatTime(src.lastFetch) : 'Never'}
          </div>
          <div class="source-endpoint" title="\${src.endpoint}">
            GET \${src.endpoint}
          </div>
        </div>
      \`).join('');
    }

    async function fetchData() {
      try {
        const [dataResponse, sourcesResponse] = await Promise.all([
          fetch('/api/data'),
          fetch('/api/data')  // sources are now included in data
        ]);

        const data = await dataResponse.json();

        renderExecutions(data.executions);
        renderLearningInsights(data.executions, data.thompsonScores || []);
        renderTemplates(data.templates);
        renderThompsonScores(data.thompsonScores || []);
        renderImpulses(data.impulses);
        renderSources(data.sources);

        document.getElementById('status-text').textContent = 'Live';
        document.getElementById('last-update').textContent = formatTime(data.lastUpdate);
      } catch (error) {
        console.error('Error fetching data:', error);
        document.getElementById('status-text').textContent = 'Error';
      }
    }

    // Initial fetch
    fetchData();

    // Poll every 3 seconds
    setInterval(fetchData, 3000);
  </script>
</body>
</html>
  `;

  return c.html(html);
});

console.log(`🚀 Activity Monitor starting on http://localhost:${PORT}`);
console.log(`📊 Backend: ${ACTIVITY_API}`);
console.log(`🔑 API Key: ${API_KEY ? '✓ Set' : '✗ Not set'}`);

export default {
  port: PORT,
  fetch: app.fetch,
};
