#!/usr/bin/env bun
/**
 * Live Learning State Dashboard
 *
 * Terminal UI showing real-time vessel learning state:
 * - Thompson Sampling scores (α/β values)
 * - Activity execution counts
 * - Success rates and performance metrics
 * - Recent execution traces
 *
 * Uses React (Ink) for terminal rendering with live database queries
 */

import React, { useEffect, useState } from 'react';
import { render, Box, Text, Newline } from 'ink';

// Types for learning state
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
}

// Mock data fetcher (replace with actual database queries)
async function fetchLearningState(): Promise<LearningState> {
  // In production, this would query SurrealDB via MCP
  // For demo, return mock data that simulates learning

  return {
    thompsonScores: [
      {
        templateId: 'demo:terminal-vessel',
        templateName: 'Terminal Vessel Demo',
        alpha: 5,
        beta: 1,
        score: 0.833,
        executions: 6,
        successRate: 0.83,
      },
      {
        templateId: 'fix-bug-complete',
        templateName: 'Fix Bug (Complete)',
        alpha: 12,
        beta: 3,
        score: 0.800,
        executions: 15,
        successRate: 0.80,
      },
      {
        templateId: 'run-tests',
        templateName: 'Run Tests',
        alpha: 8,
        beta: 2,
        score: 0.800,
        executions: 10,
        successRate: 0.80,
      },
      {
        templateId: 'create-pr',
        templateName: 'Create Pull Request',
        alpha: 3,
        beta: 2,
        score: 0.600,
        executions: 5,
        successRate: 0.60,
      },
    ],
    recentExecutions: [
      {
        id: 'exec_001',
        templateId: 'demo:terminal-vessel',
        status: 'completed',
        durationMs: 35000,
        costUsd: 0.0,
        timestamp: Date.now() - 300000,
      },
      {
        id: 'exec_002',
        templateId: 'fix-bug-complete',
        status: 'completed',
        durationMs: 120000,
        costUsd: 0.15,
        timestamp: Date.now() - 600000,
      },
      {
        id: 'exec_003',
        templateId: 'run-tests',
        status: 'failed',
        durationMs: 45000,
        costUsd: 0.05,
        timestamp: Date.now() - 900000,
      },
    ],
    totalExecutions: 36,
    avgSuccessRate: 0.78,
    totalCost: 4.25,
  };
}

// Format duration for display
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// Format timestamp as relative time
function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// Thompson Score Bar Chart
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

// Main Dashboard Component
function LearningDashboard() {
  const [state, setState] = useState<LearningState | null>(null);
  const [updateCount, setUpdateCount] = useState(0);

  // Fetch data on mount and every 5 seconds
  useEffect(() => {
    const fetchData = async () => {
      const data = await fetchLearningState();
      setState(data);
      setUpdateCount(prev => prev + 1);
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);

    return () => clearInterval(interval);
  }, []);

  if (!state) {
    return <Text>Loading learning state...</Text>;
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
            ║  MiniBob Vessel Learning State - Real-Time Dashboard          ║
          </Text>
          <Text bold color="cyan">
            ╚════════════════════════════════════════════════════════════════╝
          </Text>
        </Box>
      </Box>

      <Newline />

      {/* Summary Stats */}
      <Box borderStyle="round" borderColor="blue" padding={1} flexDirection="column">
        <Text bold color="blue">📊 Summary Statistics</Text>
        <Newline />
        <Box flexDirection="column">
          <Text>  Total Executions:     <Text bold>{state.totalExecutions}</Text></Text>
          <Text>  Average Success Rate: <Text bold color="green">{(state.avgSuccessRate * 100).toFixed(1)}%</Text></Text>
          <Text>  Total Cost:           <Text bold>${state.totalCost.toFixed(2)}</Text></Text>
          <Text>  Updates:              <Text dimColor>{updateCount} (refreshes every 5s)</Text></Text>
        </Box>
      </Box>

      <Newline />

      {/* Thompson Sampling Scores */}
      <Box borderStyle="round" borderColor="magenta" padding={1} flexDirection="column">
        <Text bold color="magenta">🎯 Thompson Sampling - Activity Performance</Text>
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
            <Box key={activity.templateId} flexDirection="column">
              <Box>
                <Text>
                  {activity.templateName.padEnd(28)}
                </Text>
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
            </Box>
          ))}
        </Box>
      </Box>

      <Newline />

      {/* Recent Executions */}
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
              <Text>{exec.templateId.padEnd(24)}</Text>
              <Text>  {formatDuration(exec.durationMs).padStart(8)}  </Text>
              <Text dimColor>${exec.costUsd.toFixed(2)}</Text>
            </Box>
          ))}
        </Box>
      </Box>

      <Newline />

      {/* Footer */}
      <Box>
        <Text dimColor>
          Press Ctrl+C to exit  •  Data refreshes every 5 seconds  •  Powered by Ink
        </Text>
      </Box>
    </Box>
  );
}

// Render the dashboard
render(<LearningDashboard />);
