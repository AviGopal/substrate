#!/usr/bin/env bun
/**
 * Multi-Vessel Learning Dashboard
 *
 * Self-contained vessel that:
 * - Discovers other vessels via discovery-vessel
 * - Queries each vessel's learning state
 * - Displays aggregated network-wide metrics
 * - Shows cross-vessel activity execution
 */

import React, { useEffect, useState } from 'react';
import { render, Box, Text, Newline } from 'ink';

// Types
interface VesselInfo {
  id: string;
  name: string;
  endpoint: string;
  shapes: string[];
  status: 'online' | 'offline';
  lastSeen: number;
}

interface VesselState {
  vesselId: string;
  vesselName: string;
  totalExecutions: number;
  successRate: number;
  topActivities: Array<{
    name: string;
    alpha: number;
    beta: number;
    score: number;
  }>;
  recentActivity: number; // timestamp
}

interface NetworkState {
  vessels: VesselInfo[];
  vesselStates: Map<string, VesselState>;
  totalExecutions: number;
  avgSuccessRate: number;
  activeVessels: number;
  discoveryStatus: 'connected' | 'offline';
}

// Configuration
const DISCOVERY_ENDPOINT = process.env.DISCOVERY_VESSEL_ENDPOINT ||
  'http://discovery-vessel.activity-system.svc.cluster.local:8080';
const ACTIVITY_API_ENDPOINT = process.env.ACTIVITY_API_URL || 'http://activity.metabob.local';
const REFRESH_INTERVAL = 10000; // 10 seconds

// Discover vessels on the network
async function discoverVessels(): Promise<VesselInfo[]> {
  // Try discovery-vessel first (with very short timeout since it's often not accessible)
  try {
    const response = await fetch(`${DISCOVERY_ENDPOINT}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pointer: { type: 'vesselRegistry' }
      }),
      signal: AbortSignal.timeout(2000),  // Short timeout - discovery often not accessible
    });

    if (response.ok) {
      const data = await response.json();
      const vessels = data.content?.vessels || [];
      console.log(`✓ Discovered ${vessels.length} vessels via discovery-vessel`);
      return vessels.map((v: any) => ({
        id: v.vesselId,
        name: v.vesselName || v.vesselId,
        endpoint: v.endpoint,
        shapes: v.shapes || [],
        status: 'online' as const,
        lastSeen: Date.now(),
      }));
    }
  } catch (error) {
    console.log('Discovery-vessel not accessible, using direct mode');
  }

  // Fallback: Query Activity API directly (always works locally)
  console.log('✓ Using direct mode with known vessels');
  return [
    {
      id: 'activity-api-local',
      name: 'Activity API (Local)',
      endpoint: ACTIVITY_API_ENDPOINT,
      shapes: ['activityExecutionTrace', 'activityTemplate', 'activityMetrics'],
      status: 'online' as const,
      lastSeen: Date.now(),
    },
  ];
}

// Query a vessel's learning state
async function queryVesselState(vessel: VesselInfo): Promise<VesselState | null> {
  try {
    // Try to query vessel's activity endpoint
    const response = await fetch(`${vessel.endpoint}/v2/activities/templates`, {
      headers: {
        'Authorization': `ApiKey ${process.env.METABOB_API_KEY || ''}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.error(`Failed to query ${vessel.name}: HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    const templates = data.templates || [];

    console.log(`Successfully queried ${vessel.name}: ${templates.length} templates`);

    // Calculate vessel stats
    const totalExecutions = templates.reduce((sum: number, t: any) =>
      sum + ((t.alpha - 1) + (t.beta - 1)), 0
    );
    const totalSuccesses = templates.reduce((sum: number, t: any) =>
      sum + (t.alpha - 1), 0
    );
    const successRate = totalExecutions > 0 ? totalSuccesses / totalExecutions : 1.0;

    // Get top 3 activities by score
    const topActivities = templates
      .map((t: any) => ({
        name: t.name || t.id,
        alpha: t.alpha || 1,
        beta: t.beta || 1,
        score: (t.alpha || 1) / ((t.alpha || 1) + (t.beta || 1)),
      }))
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 3);

    return {
      vesselId: vessel.id,
      vesselName: vessel.name,
      totalExecutions,
      successRate,
      topActivities,
      recentActivity: Date.now(),
    };
  } catch (error) {
    // Vessel offline or unreachable
    console.error(`Error querying ${vessel.name}:`, error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Fetch complete network state
async function fetchNetworkState(): Promise<NetworkState> {
  // Step 1: Discover vessels
  const vessels = await discoverVessels();
  console.log(`Discovered ${vessels.length} vessels`);

  // Step 2: Query each vessel in parallel
  const statePromises = vessels.map(v => queryVesselState(v));
  const states = await Promise.all(statePromises);

  // Step 3: Build state map and mark vessel status
  const vesselStates = new Map<string, VesselState>();
  let totalExecutions = 0;
  let totalSuccesses = 0;
  let activeVessels = 0;

  states.forEach((state, index) => {
    if (state) {
      vesselStates.set(vessels[index].id, state);
      totalExecutions += state.totalExecutions;
      totalSuccesses += state.totalExecutions * state.successRate;
      activeVessels++;
      vessels[index].status = 'online';
    } else {
      vessels[index].status = 'offline';
    }
  });

  const avgSuccessRate = totalExecutions > 0 ? totalSuccesses / totalExecutions : 1.0;

  console.log(`Network state: ${activeVessels}/${vessels.length} vessels online, ${totalExecutions} total executions`);

  return {
    vessels,
    vesselStates,
    totalExecutions,
    avgSuccessRate,
    activeVessels,
    discoveryStatus: vessels.length > 0 ? 'connected' : 'offline',
  };
}

// Format helpers
function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

// Components
function VesselStatusIndicator({ status }: { status: 'online' | 'offline' }) {
  return (
    <Text color={status === 'online' ? 'green' : 'red'}>
      {status === 'online' ? '●' : '○'}
    </Text>
  );
}

function SuccessRateBar({ rate }: { rate: number }) {
  const width = 15;
  const filled = Math.floor(rate * width);
  const color = rate > 0.7 ? 'green' : rate > 0.4 ? 'yellow' : 'red';

  return (
    <Text>
      <Text color={color}>{'█'.repeat(filled)}</Text>
      <Text dimColor>{'░'.repeat(width - filled)}</Text>
      <Text> {(rate * 100).toFixed(0)}%</Text>
    </Text>
  );
}

// Main Dashboard
function MultiVesselDashboard() {
  const [state, setState] = useState<NetworkState | null>(null);
  const [updateCount, setUpdateCount] = useState(0);
  const [selectedVessel, setSelectedVessel] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const networkState = await fetchNetworkState();
      setState(networkState);
      setUpdateCount(prev => prev + 1);
    };

    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  if (!state) {
    return <Text>Discovering vessels and querying state...</Text>;
  }

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box borderStyle="double" borderColor="cyan" padding={1}>
        <Text bold color="cyan">
          ╔═══════════════════════════════════════════════════════════════════╗{'\n'}
          ║  Multi-Vessel Network Dashboard - Distributed Learning State     ║{'\n'}
          ╚═══════════════════════════════════════════════════════════════════╝
        </Text>
      </Box>

      <Newline />

      {/* Network Summary */}
      <Box borderStyle="round" borderColor="blue" padding={1} flexDirection="column">
        <Text bold color="blue">🌐 Network Summary</Text>
        <Newline />
        <Box flexDirection="column">
          <Text>  Discovery Status:     <Text color={state.discoveryStatus === 'connected' ? 'green' : 'red'}>
            {state.discoveryStatus === 'connected' ? '● CONNECTED' : '○ OFFLINE'}
          </Text></Text>
          <Text>  Active Vessels:       <Text bold>{state.activeVessels} / {state.vessels.length}</Text></Text>
          <Text>  Network Executions:   <Text bold>{state.totalExecutions || 0}</Text></Text>
          <Text>  Avg Success Rate:     <Text bold color="green">{(state.avgSuccessRate * 100).toFixed(1)}%</Text></Text>
          <Text>  Updates:              <Text dimColor>#{updateCount} (every {REFRESH_INTERVAL/1000}s)</Text></Text>
        </Box>
      </Box>

      <Newline />

      {/* Vessel List */}
      <Box borderStyle="round" borderColor="magenta" padding={1} flexDirection="column">
        <Text bold color="magenta">🚀 Discovered Vessels</Text>
        <Newline />
        <Box flexDirection="column">
          <Box>
            <Text bold dimColor>Status  </Text>
            <Text bold dimColor>Vessel Name              </Text>
            <Text bold dimColor>  Exec  </Text>
            <Text bold dimColor>  Success Rate      </Text>
            <Text bold dimColor>  Last Activity</Text>
          </Box>
          <Text dimColor>{'─'.repeat(80)}</Text>

          {state.vessels.map(vessel => {
            const vesselState = state.vesselStates.get(vessel.id);
            return (
              <Box key={vessel.id}>
                <VesselStatusIndicator status={vessel.status} />
                <Text>  {vessel.name.substring(0, 24).padEnd(24)}  </Text>
                {vesselState ? (
                  <>
                    <Text>{(vesselState.totalExecutions || 0).toString().padStart(4)}  </Text>
                    <SuccessRateBar rate={vesselState.successRate} />
                    <Text>  </Text>
                    <Text dimColor>{formatRelativeTime(vesselState.recentActivity)} ago</Text>
                  </>
                ) : (
                  <Text dimColor>  No data available</Text>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>

      <Newline />

      {/* Top Activities Across All Vessels */}
      <Box borderStyle="round" borderColor="yellow" padding={1} flexDirection="column">
        <Text bold color="yellow">⭐ Top Performing Activities (Network-Wide)</Text>
        <Newline />
        <Box flexDirection="column">
          <Box>
            <Text bold dimColor>Vessel                   </Text>
            <Text bold dimColor>  Activity               </Text>
            <Text bold dimColor>  α    β   </Text>
            <Text bold dimColor>  Score</Text>
          </Box>
          <Text dimColor>{'─'.repeat(80)}</Text>

          {Array.from(state.vesselStates.entries()).flatMap(([vesselId, vesselState]) =>
            vesselState.topActivities.map((activity, idx) => ({
              vesselName: vesselState.vesselName,
              ...activity,
              key: `${vesselId}-${idx}`,
            }))
          )
          .sort((a, b) => b.score - a.score)
          .slice(0, 10)
          .map(activity => (
            <Box key={activity.key}>
              <Text>{activity.vesselName.substring(0, 24).padEnd(24)}  </Text>
              <Text>{activity.name.substring(0, 22).padEnd(22)}  </Text>
              <Text color="green">{activity.alpha.toString().padStart(3)}</Text>
              <Text>  </Text>
              <Text color="red">{activity.beta.toString().padStart(3)}</Text>
              <Text>  </Text>
              <Text color={activity.score > 0.7 ? 'green' : 'yellow'}>
                {(activity.score * 100).toFixed(0)}%
              </Text>
            </Box>
          ))}
        </Box>
      </Box>

      <Newline />

      {/* Vessel Capabilities */}
      <Box borderStyle="round" borderColor="cyan" padding={1} flexDirection="column">
        <Text bold color="cyan">🔧 Vessel Capabilities (Advertised Shapes)</Text>
        <Newline />
        <Box flexDirection="column">
          {state.vessels.map(vessel => (
            <Box key={vessel.id} flexDirection="column">
              <Text>
                <VesselStatusIndicator status={vessel.status} />
                <Text bold> {vessel.name}</Text>
              </Text>
              <Text dimColor>  {vessel.shapes.join(', ') || 'No shapes advertised'}</Text>
              <Text dimColor>  Endpoint: {vessel.endpoint}</Text>
              <Newline />
            </Box>
          ))}
        </Box>
      </Box>

      <Newline />

      {/* Footer */}
      <Box>
        <Text dimColor>
          Press Ctrl+C to exit  •  Self-contained vessel monitoring network  •  Discovery: {DISCOVERY_ENDPOINT}
        </Text>
      </Box>
    </Box>
  );
}

// Render
render(<MultiVesselDashboard />);
