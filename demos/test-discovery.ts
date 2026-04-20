#!/usr/bin/env bun

/**
 * Test discovery-vessel and Activity API connectivity
 */

const DISCOVERY_ENDPOINT = process.env.DISCOVERY_VESSEL_ENDPOINT ||
  'http://discovery-vessel.activity-system.svc.cluster.local:8080';
const ACTIVITY_API_ENDPOINT = process.env.ACTIVITY_API_URL || 'http://activity.metabob.local';
const API_KEY = process.env.METABOB_API_KEY || '';

console.log('Testing discovery and data fetching...\n');
console.log(`Discovery endpoint: ${DISCOVERY_ENDPOINT}`);
console.log(`Activity API: ${ACTIVITY_API_ENDPOINT}`);
console.log(`API key: ${API_KEY ? '***configured***' : 'NOT SET'}\n`);

// Test 1: Discovery-vessel
console.log('=== Test 1: Query Discovery-Vessel ===');
try {
  const response = await fetch(`${DISCOVERY_ENDPOINT}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pointer: { type: 'vesselRegistry' }
    }),
    signal: AbortSignal.timeout(5000),
  });

  console.log(`Status: ${response.status}`);
  const data = await response.json();
  const vessels = data.content?.vessels || [];
  console.log(`Discovered ${vessels.length} vessels`);
  vessels.forEach((v: any) => {
    console.log(`  - ${v.vesselName || v.vesselId} (${v.endpoint})`);
  });
} catch (error) {
  console.error(`Discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
}

console.log('\n=== Test 2: Query Activity API Templates ===');
try {
  const response = await fetch(`${ACTIVITY_API_ENDPOINT}/v2/activities/templates?limit=5`, {
    headers: {
      'Authorization': `ApiKey ${API_KEY}`,
    },
    signal: AbortSignal.timeout(5000),
  });

  console.log(`Status: ${response.status}`);
  const data = await response.json();
  const templates = data.templates || [];
  console.log(`Found ${templates.length} templates`);

  templates.forEach((t: any) => {
    const alpha = t.alpha || 1;
    const beta = t.beta || 1;
    const score = alpha / (alpha + beta);
    console.log(`  - ${t.name || t.id}: α=${alpha}, β=${beta}, score=${(score * 100).toFixed(0)}%`);
  });
} catch (error) {
  console.error(`Activity API failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
}

console.log('\nTests complete');
