#!/usr/bin/env bun

const ACTIVITY_API = 'http://activity.metabob.local';
const API_KEY = 'mb-bWV0YWJvYi1taW5pYm9iLXNlcnZpY2Uta2V5X3VkMVhORUFUVEVVZ1kzTHEtaHR0cHM6Ly9pZGVudGl0eS5tZXRhYm9iLmNvbQ-f92a497a9baef17a6d4e497d6f76d211';

const response = await fetch(`${ACTIVITY_API}/v2/activities/execution-traces?limit=50`, {
  headers: { 'Authorization': `ApiKey ${API_KEY}` },
});

const data = await response.json();
const executions = data.executions || [];

// Filter out auth_resolve_v1
const nonAuthExecs = executions.filter((e: any) => e.activity_id !== 'auth_resolve_v1');

console.log(`Total executions: ${executions.length}`);
console.log(`Non-auth executions: ${nonAuthExecs.length}\n`);

if (nonAuthExecs.length > 0) {
  console.log('Recent non-auth executions:');
  nonAuthExecs.slice(0, 10).forEach((e: any) => {
    const status = e.success ? '✓' : '✗';
    const time = new Date(e.created_at).toLocaleString();
    console.log(`  ${status} ${e.activity_id.padEnd(30)} ${time}`);
  });
} else {
  console.log('No activity executions found yet.');
  console.log('\nTo populate the dashboard, run:');
  console.log('  cd ../repos/minibob');
  console.log('  minibob --single "check system status"');
}
