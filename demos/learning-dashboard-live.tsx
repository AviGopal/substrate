#!/usr/bin/env bun
/**
 * Live Learning State Dashboard with Real Database Queries
 *
 * Queries SurrealDB to show actual vessel learning state in real-time
 */

import React, { useEffect, useState } from 'react';
import { render, Box, Text, Newline } from 'ink';

// Types
interface ThompsonScores {
  templateId: string;
  templateName: string;
  alpha: number;
  beta: number;
  score: number;
  executions: number;
  successRate: number;
}

interface ExecutionTrace {
  id: string;
  templateId: string;
  templateName: string;
  status: 'completed' | 'failed';
  durationMs: number;
  costUsd: number;
  timestamp: number;
}

interface LearningState {
  thompsonScores: ThompsonScores[];
  recentExecutions: ExecutionTrace[];
  totalExecutions: number;
  avgSuccessRate: number;
  totalCost: number;
  connected: boolean;
  lastUpdate: number;
}

// Database query function
async function fetchFromDatabase(): Promise<LearningState> {
  const backendUrl = process.env.ACTIVITY_API_URL || 'https://activity.metabob.com';

  try {
    // Query 1: Get Thompson Sampling scores
    const templatesResponse = await fetch(`${backendUrl}/v2/activities/templates`, {
      headers: {
        'Authorization': `ApiKey ${process.env.METABOB_API_KEY || ''}`,
      },
    });

    if (!templatesResponse.ok) {
      throw new Error(`Templates query failed: ${templatesResponse.status}`);
    }

    const templatesData = await templatesResponse.json();
    const templates = templatesData.templates || [];

    // Calculate Thompson scores
    const thompsonScores: ThompsonScores[] = templates.map((t: any) => {
      const alpha = t.alpha || 1;
      const beta = t.beta || 1;
      const score = alpha / (alpha + beta);
      const executions = (alpha - 1) + (beta - 1); // Approximate
      const successRate = (alpha - 1) / Math.max(executions, 1);

      return {
        templateId: t.id,
        templateName: t.name || t.id,
        alpha,
        beta,
        score,
        executions: Math.max(executions, 0),
        successRate: Math.max(0, Math.min(1, successRate)),
      };
    }).sort((a: ThompsonScores, b: ThompsonScores) => b.score - a.score);

    // Query 2: Get recent execution traces
    const tracesResponse = await fetch(`${backendUrl}/v2/activities/execution-traces?limit=10`, {
      headers: {
        'Authorization': `ApiKey ${process.env.METABOB_API_KEY || ''}`,
      },
    });

    const tracesData = tracesResponse.ok ? await tracesResponse.json() : { traces: [] };
    const traces = tracesData.traces || [];

    const recentExecutions: ExecutionTrace[] = traces.map((t: any) => ({
      id: t.id,
      templateId: t.template_id || 'unknown',
      templateName: t.template_name || t.template_id || 'Unknown',
      status: t.status === 'completed' ? 'completed' : 'failed',
      durationMs: t.duration_ms || 0,
      costUsd: t.cost_usd || 0,
      timestamp: new Date(t.created_at).getTime(),
    }));

    // Calculate summary stats
    const totalExecutions = templates.reduce((sum: number, t: any) =>
      sum + ((t.alpha - 1) + (t.beta - 1)), 0
    );
    const totalSuccesses = templates.reduce((sum: number, t: any) => sum + (t.alpha - 1), 0);
    const avgSuccessRate = totalExecutions > 0 ? totalSuccesses / totalExecutions : 0;
    const totalCost = traces.reduce((sum: number, t: any) => sum + (t.cost_usd || 0), 0);

    return {
      thompsonScores: thompsonScores.slice(0, 10), // Top 10
      recentExecutions,
      totalExecutions,
      avgSuccessRate,
      totalCost,
      connected: true,
      lastUpdate: Date.now(),
    };
  } catch (error) {
    // Return offline state with cached/mock data
    return {
      thompsonScores: [],
      recentExecutions: [],
      totalExecutions: 0,
      avgSuccessRate: 0,
      totalCost: 0,
      connected: false,
      lastUpdate: Date.now(),
    };
  }
}

// Format helpers
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// Thompson Score Bar
function ThompsonBar({ score }: { score: number }) {
  const width = 20;
  const filled = Math.floor(score * width);
  const empty = width - filled;
  const color = score > 0.7 ? 'green' : score > 0.4 ? 'yellow' : 'red';

  return (
    <Text>
      <Text color={color}>{'█'.repeat(filled)}</Text>
      <Text dimColor>{'░'.repeat(empty)}</Text>
      <Text> {(score * 100).toFixed(0)}%</Text>
    </Text>
  );
}

// Main Dashboard
function LearningDashboard() {
  const [state, setState] = useState<LearningState | null>(null);
  const [updateCount, setUpdateCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await fetchFromDatabase();
        setState(data);
        setUpdateCount(prev => prev + 1);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (error && !state) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">Error connecting to database: {error}</Text>
        <Text dimColor>Retrying...</Text>
      </Box>
    );
  }

  if (!state) {
    return <Text>Loading learning state from database...</Text>;
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box borderStyle="double" borderColor="cyan" padding={1}>
        <Box flexDirection="column">
          <Text bold color="cyan">
            ╔════════════════════════════════════════════════════════════════╗
          </Text>
          <Text bold color="cyan">
            ║  MiniBob Vessel Learning State - Live Database Dashboard      ║
          </Text>
          <Text bold color="cyan">
            ╚════════════════════════════════════════════════════════════════╝
          </Text>
        </Box>
      </Box>

      <Newline />

      {/* Connection Status */}
      <Box>
        <Text>
          Status: {' '}
          {state.connected ? (
            <Text color="green">● CONNECTED</Text>
          ) : (
            <Text color="red">● OFFLINE</Text>
          )}
          {' • '}
          <Text dimColor>Last update: {formatRelativeTime(state.lastUpdate)}</Text>
          {' • '}
          <Text dimColor>Refresh #{updateCount}</Text>
        </Text>
      </Box>

      <Newline />

      {!state.connected && (
        <>
          <Box borderStyle="round" borderColor="yellow" padding={1}>
            <Text color="yellow">
              ⚠ Backend unavailable - showing cached data or offline mode
            </Text>
          </Box>
          <Newline />
        </>
      )}

      {/* Summary Stats */}
      <Box borderStyle="round" borderColor="blue" padding={1} flexDirection="column">
        <Text bold color="blue">📊 Summary Statistics</Text>
        <Newline />
        <Box flexDirection="column">
          <Text>  Total Executions:     <Text bold>{state.totalExecutions}</Text></Text>
          <Text>  Average Success Rate: <Text bold color="green">{(state.avgSuccessRate * 100).toFixed(1)}%</Text></Text>
          <Text>  Total Cost:           <Text bold>${state.totalCost.toFixed(2)}</Text></Text>
          <Text>  Active Templates:     <Text bold>{state.thompsonScores.length}</Text></Text>
        </Box>
      </Box>

      <Newline />

      {/* Thompson Sampling Scores */}
      {state.thompsonScores.length > 0 ? (
        <>
          <Box borderStyle="round" borderColor="magenta" padding={1} flexDirection="column">
            <Text bold color="magenta">🎯 Thompson Sampling - Top Performing Activities</Text>
            <Newline />
            <Box flexDirection="column">
              <Box>
                <Text bold dimColor>Activity                     </Text>
                <Text bold dimColor>  α    β   </Text>
                <Text bold dimColor>  Score              </Text>
                <Text bold dimColor>  Exec  Success</Text>
              </Box>
              <Text dimColor>{'─'.repeat(80)}</Text>

              {state.thompsonScores.map(activity => (
                <Box key={activity.templateId}>
                  <Text>{activity.templateName.substring(0, 28).padEnd(28)}</Text>
                  <Text>
                    <Text color="green">{activity.alpha.toString().padStart(3)}</Text>
                    {' '}
                    <Text color="red">{activity.beta.toString().padStart(3)}</Text>
                    {'  '}
                  </Text>
                  <ThompsonBar score={activity.score} />
                  <Text>  {activity.executions.toString().padStart(4)}  </Text>
                  <Text color={activity.successRate > 0.7 ? 'green' : 'yellow'}>
                    {(activity.successRate * 100).toFixed(0)}%
                  </Text>
                </Box>
              ))}
            </Box>
          </Box>
          <Newline />
        </>
      ) : (
        <>
          <Box borderStyle="round" borderColor="gray" padding={1}>
            <Text dimColor>No activity templates found in database</Text>
          </Box>
          <Newline />
        </>
      )}

      {/* Recent Executions */}
      {state.recentExecutions.length > 0 ? (
        <>
          <Box borderStyle="round" borderColor="yellow" padding={1} flexDirection="column">
            <Text bold color="yellow">⚡ Recent Executions</Text>
            <Newline />
            <Box flexDirection="column">
              <Box>
                <Text bold dimColor>Time      </Text>
                <Text bold dimColor>  Status     </Text>
                <Text bold dimColor>  Activity                </Text>
                <Text bold dimColor>  Duration  </Text>
                <Text bold dimColor>  Cost</Text>
              </Box>
              <Text dimColor>{'─'.repeat(80)}</Text>

              {state.recentExecutions.map(exec => (
                <Box key={exec.id}>
                  <Text dimColor>{formatRelativeTime(exec.timestamp).padEnd(10)}</Text>
                  <Text>  </Text>
                  <Text color={exec.status === 'completed' ? 'green' : 'red'}>
                    {exec.status === 'completed' ? '✓ DONE  ' : '✗ FAILED'}
                  </Text>
                  <Text>  </Text>
                  <Text>{exec.templateName.substring(0, 24).padEnd(24)}</Text>
                  <Text>  {formatDuration(exec.durationMs).padStart(8)}  </Text>
                  <Text dimColor>${exec.costUsd.toFixed(2)}</Text>
                </Box>
              ))}
            </Box>
          </Box>
          <Newline />
        </>
      ) : (
        <>
          <Box borderStyle="round" borderColor="gray" padding={1}>
            <Text dimColor>No recent executions found</Text>
          </Box>
          <Newline />
        </>
      )}

      {/* Footer */}
      <Box>
        <Text dimColor>
          Press Ctrl+C to exit  •  Refreshes every 5s  •  Backend: {process.env.ACTIVITY_API_URL || 'https://activity.metabob.com'}
        </Text>
      </Box>
    </Box>
  );
}

// Render
render(<LearningDashboard />);
