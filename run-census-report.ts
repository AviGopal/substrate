interface CapabilityActivityStats {
  activity_id: string;
  total_executions: number;
  successful_executions: number;
  success_rate: number;
}

interface CapabilityOrphan {
  shape: string;
  gap_id: string;
  summary: string;
}

interface CapabilityCensusReport {
  activity_stats: CapabilityActivityStats[];
  orphaned_capabilities: CapabilityOrphan[];
  generated_at: string;
}

const METABOB_ENDPOINT = "http://127.0.0.1:8080"; // Assuming a default endpoint for now

async function resolveImpulse(impulseType: string, metric: string): Promise<any> {
  const payload = JSON.stringify({
    impulse: {
      type: impulseType,
      group_by: "activity_id",
      limit: 200,
      metric: metric,
      window_hours: 168,
    },
  });

  // Use shellResult to execute curl
  const curlCommand = `curl -s -X POST -H "Content-Type: application/json" -d '${payload}' ${METABOB_ENDPOINT}/v2/impulses/resolve`;
  const result = await default_api.shellResult({ command: curlCommand });

  if (result.shellResult_response.exit_code !== 0) {
    console.error(`Failed to resolve impulse ${impulseType} with metric ${metric}: ${result.shellResult_response.stderr}`);
    return null;
  }

  try {
    const parsedResponse = JSON.parse(result.shellResult_response.stdout);
    // The API might return data directly or wrapped in a 'body' property
    return parsedResponse.body || parsedResponse; 
  } catch (e) {
    console.error(`Failed to parse response for impulse ${impulseType} with metric ${metric}: ${e}`);
    return null;
  }
}

async function runCensusReport(): Promise<CapabilityCensusReport> {

  const executionCounts = await resolveImpulse("traceAggregateReport", "count");
  const successCounts = await resolveImpulse("traceAggregateReport", "success_count");
  
  const activityStats: CapabilityActivityStats[] = [];

  if (executionCounts && successCounts) {
    const activityMap = new Map<string, { total: number; successful: number }>();

    // Assuming executionCounts and successCounts are arrays of objects like { activity_id: string, value: number }
    for (const item of executionCounts) {
      if (item.activity_id) {
        const current = activityMap.get(item.activity_id) || { total: 0, successful: 0 };
        current.total = item.value;
        activityMap.set(item.activity_id, current);
      }
    }

    for (const item of successCounts) {
      if (item.activity_id) {
        const current = activityMap.get(item.activity_id) || { total: 0, successful: 0 };
        current.successful = item.value;
        activityMap.set(item.activity_id, current);
      }
    }

    for (const [activity_id, stats] of activityMap.entries()) {
      activityStats.push({
        activity_id: activity_id,
        total_executions: stats.total,
        successful_executions: stats.successful,
        success_rate: stats.total > 0 ? stats.successful / stats.total : 0,
      });
    }
  }

  const missingCapabilitiesResponse = await default_api.substrateGap({ category: 'missing_capability' });
  const orphanedCapabilities: CapabilityOrphan[] = [];

  if (missingCapabilitiesResponse && Array.isArray(missingCapabilitiesResponse.gaps)) {
    for (const gap of missingCapabilitiesResponse.gaps) {
      if (gap.classification_metadata && gap.classification_metadata.missing_shape) {
        orphanedCapabilities.push({
          shape: gap.classification_metadata.missing_shape,
          gap_id: gap.id,
          summary: gap.summary,
        });
      }
    }
  }

  const report: CapabilityCensusReport = {
    activity_stats: activityStats,
    orphaned_capabilities: orphanedCapabilities,
    generated_at: new Date().toISOString(),
  };

  return report;
}

runCensusReport().then(report => console.log(JSON.stringify(report, null, 2))).catch(error => console.error(error));
