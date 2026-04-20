#!/usr/bin/env bun
/**
 * Operational Dashboard - Complete System Visibility
 *
 * Shows:
 * - All connected vessels in your org
 * - Recent activity executions (last 24h)
 * - Currently active sessions
 * - Impulse resolution patterns
 * - System health metrics
 */

import React, { useEffect, useState } from 'react';
import { render, Box, Text, Newline } from 'ink';

// Configuration
const DISCOVERY_ENDPOINT = process.env.DISCOVERY_VESSEL_ENDPOINT ||
  'http://discovery-vessel.activity-system.svc.cluster.local:8080';
const ACTIVITY_API = process.env.ACTIVITY_API_URL || 'http://activity.metabob.local';
const API_KEY = process.env.METABOB_API_KEY || '';
const REFRESH_INTERVAL = 5000; // 5 seconds

// Types
interface Vessel {
  id: string;
  name: string;
  endpoint: string;
  shapes: string[];
  status: 'online' | 'offline';
  health?: {
    status: string;
    latency_ms?: number;
  };
}

interface Execution {
  execution_id: string;
  activity_id: string;
  status: string;
  success: boolean;
  duration_ms: number;
  created_at: string;
  cost_usd: number;
  org_id: string;
}

interface Template {
  id: string;
  name: string;
  category: string;
  alpha: number;
  beta: number;
  score: number;
}

interface DashboardState {
  vessels: Vessel[];
  recentExecutions: Execution[];
  topTemplates: Template[];
  totalExecutions: number;
  successRate: number;
  totalCost: number;
  avgDuration: number;
  lastUpdate: Date;
}

// Discover vessels
async function discoverVessels(): Promise<Vessel[]> {
  try {
    const response = await fetch(`${DISCOVERY_ENDPOINT}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pointer: { type: 'vesselRegistry' } }),
      signal: AbortSignal.timeout(2000),
    });

    if (response.ok) {
      const data = await response.json();
      const vessels = data.content?.vessels || [];
      console.log(`✓ Discovered ${vessels.length} vessels`);
      return Promise.all(vessels.map(async (v: any) => ({
        id: v.vesselId,
        name: v.vesselName || v.vesselId,
        endpoint: v.endpoint,
        shapes: v.shapes || [],
        status: 'online' as const,
        health: await checkVesselHealth(v.endpoint),
      })));
    }
  } catch (error) {
    console.log('Discovery not available, using Activity API only');
  }

  // Fallback: just query Activity API
  const activityHealth = await checkVesselHealth(`${ACTIVITY_API}`);
  return [{
    id: 'activity-api',
    name: 'Activity API',
    endpoint: ACTIVITY_API,
    shapes: ['activityExecutionTrace', 'activityTemplate', 'activityMetrics'],
    status: activityHealth ? 'online' : 'offline',
    health: activityHealth,
  }];
}

// Check vessel health
async function checkVesselHealth(endpoint: string) {
  try {
    const start = Date.now();
    const response = await fetch(`${endpoint}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      const data = await response.json();
      return {
        status: data.status || 'healthy',
        latency_ms: Date.now() - start,
      };
    }
  } catch (error) {
    return null;
  }
}

// Fetch recent executions
async function fetchRecentExecutions(): Promise<Execution[]> {
  try {
    const response = await fetch(`${ACTIVITY_API}/v2/activities/execution-traces?limit=20&sort=desc`, {
      headers: { 'Authorization': `ApiKey ${API_KEY}` },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      return (data.executions || []).map((e: any) => ({
        execution_id: e.execution_id,
        activity_id: e.activity_id,
        status: e.status,
        success: e.success,
        duration_ms: e.duration_ms || 0,
        created_at: e.created_at,
        cost_usd: e.cost_usd || 0,
        org_id: e.org_id,
      }));
    }
  } catch (error) {
    console.error('Failed to fetch executions:', error);
  }
  return [];
}

// Fetch top templates
async function fetchTopTemplates(): Promise<Template[]> {
  try {
    const response = await fetch(`${ACTIVITY_API}/v2/activities/templates?limit=10`, {
      headers: { 'Authorization': `ApiKey ${API_KEY}` },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      const templates = data.templates || [];
      return templates
        .map((t: any) => {
          const alpha = t.alpha || 1;
          const beta = t.beta || 1;
          return {
            id: t.id,
            name: t.name || t.id,
            category: t.category || 'unknown',
            alpha,
            beta,
            score: alpha / (alpha + beta),
          };
        })
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 5);
    }
  } catch (error) {
    console.error('Failed to fetch templates');
  }
  return [];
}

// Fetch complete dashboard state
async function fetchDashboardState(): Promise<DashboardState> {
  const [vessels, executions, templates] = await Promise.all([
    discoverVessels(),
    fetchRecentExecutions(),
    fetchTopTemplates(),
  ]);

  // Calculate metrics
  const totalExecutions = executions.length;
  const successCount = executions.filter(e => e.success).length;
  const successRate = totalExecutions > 0 ? successCount / totalExecutions : 1.0;
  const totalCost = executions.reduce((sum, e) => sum + e.cost_usd, 0);
  const avgDuration = totalExecutions > 0
    ? executions.reduce((sum, e) => sum + e.duration_ms, 0) / totalExecutions
    : 0;

  return {
    vessels,
    recentExecutions: executions,
    topTemplates: templates,
    totalExecutions,
    successRate,
    totalCost,
    avgDuration,
    lastUpdate: new Date(),
  };
}

// Format helpers
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatRelativeTime(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Components
function StatusIndicator({ status }: { status: 'online' | 'offline' }) {
  return <Text color={status === 'online' ? 'green' : 'red'}>{status === 'online' ? '●' : '○'}</Text>;
}

function SuccessRateBar({ rate }: { rate: number }) {
  const width = 20;
  const filled = Math.floor(rate * width);
  const color = rate > 0.8 ? 'green' : rate > 0.5 ? 'yellow' : 'red';
  return (
    <Text>
      <Text color={color}>{'█'.repeat(filled)}</Text>
      <Text dimColor>{'░'.repeat(width - filled)}</Text>
      <Text> {(rate * 100).toFixed(0)}%</Text>
    </Text>
  );
}

// Main Dashboard
function OperationalDashboard() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [updateCount, setUpdateCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      const dashboardState = await fetchDashboardState();
      setState(dashboardState);
      setUpdateCount(prev => prev + 1);
    };

    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  if (!state) {
    return <Text>Loading operational dashboard...</Text>;
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box borderStyle="double" borderColor="cyan" padding={1}>
        <Text bold color="cyan">
          ╔═══════════════════════════════════════════════════════════════════╗{'\n'}
          ║         Operational Dashboard - System-Wide Visibility           ║{'\n'}
          ╚═══════════════════════════════════════════════════════════════════╝
        </Text>
      </Box>

      <Newline />

      {/* System Health */}
      <Box borderStyle="round" borderColor="green" padding={1} flexDirection="column">
        <Text bold color="green">🏥 System Health</Text>
        <Newline />
        <Box flexDirection="column">
          <Text>  Active Vessels:       <Text bold color="green">{state.vessels.filter(v => v.status === 'online').length} / {state.vessels.length}</Text></Text>
          <Text>  Executions (24h):     <Text bold>{state.totalExecutions}</Text></Text>
          <Text>  Success Rate:         <SuccessRateBar rate={state.successRate} /></Text>
          <Text>  Avg Duration:         <Text bold>{formatDuration(state.avgDuration)}</Text></Text>
          <Text>  Total Cost:           <Text bold>${state.totalCost.toFixed(4)}</Text></Text>
          <Text>  Last Update:          <Text dimColor>{state.lastUpdate.toLocaleTimeString()} (#{updateCount})</Text></Text>
        </Box>
      </Box>

      <Newline />

      {/* Connected Vessels */}
      <Box borderStyle="round" borderColor="blue" padding={1} flexDirection="column">
        <Text bold color="blue">🌐 Connected Vessels in Your Org</Text>
        <Newline />
        <Box flexDirection="column">
          <Box>
            <Text bold dimColor>Status  </Text>
            <Text bold dimColor>Vessel Name                  </Text>
            <Text bold dimColor>  Health    </Text>
            <Text bold dimColor>  Capabilities</Text>
          </Box>
          <Text dimColor>{'─'.repeat(85)}</Text>

          {state.vessels.map(vessel => (
            <Box key={vessel.id}>
              <StatusIndicator status={vessel.status} />
              <Text>  {vessel.name.substring(0, 28).padEnd(28)}  </Text>
              {vessel.health ? (
                <Text color="green">{vessel.health.status.substring(0, 8).padEnd(8)} ({vessel.health.latency_ms}ms)  </Text>
              ) : (
                <Text dimColor>offline   --      </Text>
              )}
              <Text dimColor>{vessel.shapes.slice(0, 3).join(', ')}</Text>
            </Box>
          ))}
        </Box>
      </Box>

      <Newline />

      {/* Recent Executions */}
      <Box borderStyle="round" borderColor="yellow" padding={1} flexDirection="column">
        <Text bold color="yellow">⚡ Recent Activity Executions</Text>
        <Text dimColor> (excluding failed auth attempts)</Text>
        <Newline />
        <Box flexDirection="column">
          <Box>
            <Text bold dimColor>Status   </Text>
            <Text bold dimColor>Activity ID                </Text>
            <Text bold dimColor>  Duration  </Text>
            <Text bold dimColor>  Cost      </Text>
            <Text bold dimColor>  When</Text>
          </Box>
          <Text dimColor>{'─'.repeat(85)}</Text>

          {(() => {
            const filteredExecs = state.recentExecutions.filter(exec => {
              // Filter out failed auth attempts (they're expected and numerous)
              // Show successful auth and all other activities
              if (exec.activity_id === 'auth_resolve_v1' && !exec.success) {
                return false;
              }
              return true;
            });

            if (filteredExecs.length === 0) {
              return (
                <Box flexDirection="column" paddingTop={1}>
                  <Text dimColor>  No activity executions yet.</Text>
                  <Newline />
                  <Text dimColor>  Run activities through MiniBob to populate this view:</Text>
                  <Text dimColor>    cd repos/minibob</Text>
                  <Text dimColor>    minibob --single "check system status"</Text>
                  <Newline />
                  <Text dimColor>  Or run the populate script:</Text>
                  <Text dimColor>    cd demos</Text>
                  <Text dimColor>    ./populate-dashboard.sh</Text>
                </Box>
              );
            }

            return filteredExecs.slice(0, 10).map(exec => (
              <Box key={exec.execution_id}>
                <Text color={exec.success ? 'green' : 'red'}>{exec.success ? '✓' : '✗'}</Text>
                <Text>  {exec.activity_id.substring(0, 26).padEnd(26)}  </Text>
                <Text>{formatDuration(exec.duration_ms).padEnd(10)}  </Text>
                <Text dimColor>${exec.cost_usd.toFixed(4).padEnd(10)}  </Text>
                <Text dimColor>{formatRelativeTime(exec.created_at)}</Text>
              </Box>
            ));
          })()}
        </Box>
      </Box>

      <Newline />

      {/* Top Performing Activities */}
      <Box borderStyle="round" borderColor="magenta" padding={1} flexDirection="column">
        <Text bold color="magenta">⭐ Top Performing Activities (Thompson Sampling)</Text>
        <Newline />
        <Box flexDirection="column">
          <Box>
            <Text bold dimColor>Activity Name                 </Text>
            <Text bold dimColor>  Category        </Text>
            <Text bold dimColor>  α    β   </Text>
            <Text bold dimColor>  Score</Text>
          </Box>
          <Text dimColor>{'─'.repeat(85)}</Text>

          {state.topTemplates.map(template => (
            <Box key={template.id}>
              <Text>{template.name.substring(0, 28).padEnd(28)}  </Text>
              <Text dimColor>{template.category.substring(0, 14).padEnd(14)}  </Text>
              <Text color="green">{template.alpha.toString().padStart(3)}</Text>
              <Text>  </Text>
              <Text color="red">{template.beta.toString().padStart(3)}</Text>
              <Text>  </Text>
              <Text color={template.score > 0.7 ? 'green' : template.score > 0.4 ? 'yellow' : 'red'}>
                {(template.score * 100).toFixed(0)}%
              </Text>
            </Box>
          ))}
        </Box>
      </Box>

      <Newline />

      {/* Footer */}
      <Box>
        <Text dimColor>
          Press Ctrl+C to exit  •  Refreshes every {REFRESH_INTERVAL/1000}s  •  Activity API: {ACTIVITY_API}
        </Text>
      </Box>
    </Box>
  );
}

// Render
render(<OperationalDashboard />);
