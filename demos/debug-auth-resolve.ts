#!/usr/bin/env bun

/**
 * Debug auth_resolve_v1 failures
 */

const ACTIVITY_API = 'http://activity.metabob.local';
const API_KEY = 'mb-bWV0YWJvYi1taW5pYm9iLXNlcnZpY2Uta2V5X3VkMVhORUFUVEVVZ1kzTHEtaHR0cHM6Ly9pZGVudGl0eS5tZXRhYm9iLmNvbQ-f92a497a9baef17a6d4e497d6f76d211';

console.log('Fetching auth_resolve_v1 execution traces...\n');

try {
  const response = await fetch(`${ACTIVITY_API}/v2/activities/execution-traces?limit=5`, {
    headers: { 'Authorization': `ApiKey ${API_KEY}` },
  });

  if (response.ok) {
    const data = await response.json();
    const executions = data.executions || [];

    console.log(`Total executions: ${executions.length}\n`);

    // Find auth_resolve_v1 executions
    const authExecs = executions.filter((e: any) => e.activity_id === 'auth_resolve_v1');

    console.log(`auth_resolve_v1 executions: ${authExecs.length}\n`);

    if (authExecs.length > 0) {
      const sample = authExecs[0];
      console.log('Sample auth_resolve_v1 execution:');
      console.log(JSON.stringify(sample, null, 2));
    }
  } else {
    console.error(`HTTP ${response.status}: ${await response.text()}`);
  }
} catch (error) {
  console.error('Error:', error);
}
