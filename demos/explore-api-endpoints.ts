#!/usr/bin/env bun

/**
 * Explore available API endpoints for operational dashboard
 */

const ACTIVITY_API = process.env.ACTIVITY_API_URL || 'http://activity.metabob.local';
const API_KEY = process.env.METABOB_API_KEY || '';

const headers = {
  'Authorization': `ApiKey ${API_KEY}`,
  'Content-Type': 'application/json',
};

console.log('Exploring Activity API endpoints...\n');

// Test 1: Execution traces
console.log('=== Execution Traces ===');
try {
  const response = await fetch(`${ACTIVITY_API}/v2/activities/execution-traces?limit=3`, { headers });
  console.log(`Status: ${response.status}`);
  if (response.ok) {
    const data = await response.json();
    console.log('Response structure:', Object.keys(data));
    const traces = Array.isArray(data) ? data : (data.traces || data.executions || []);
    console.log(`Found ${traces.length} traces`);
    if (traces.length > 0) {
      const sample = traces[0];
      console.log('Sample trace:', JSON.stringify(sample, null, 2).substring(0, 500));
    }
  } else {
    console.log(`Error: ${await response.text()}`);
  }
} catch (error) {
  console.error('Error:', error instanceof Error ? error.message : 'Unknown');
}

// Test 2: Templates
console.log('\n=== Activity Templates ===');
try {
  const response = await fetch(`${ACTIVITY_API}/v2/activities/templates?limit=3`, { headers });
  if (response.ok) {
    const data = await response.json();
    const templates = data.templates || [];
    console.log(`Found ${templates.length} templates`);
    if (templates.length > 0) {
      const sample = templates[0];
      console.log('Sample template fields:', Object.keys(sample));
    }
  }
} catch (error) {
  console.error('Error:', error instanceof Error ? error.message : 'Unknown');
}

// Test 3: Composition graph
console.log('\n=== Composition Graph ===');
try {
  const response = await fetch(`${ACTIVITY_API}/v2/activities/composition/graph?limit=5`, { headers });
  if (response.ok) {
    const compositions = await response.json();
    console.log(`Found ${compositions.length} compositions`);
    if (compositions.length > 0) {
      console.log('Sample composition:', compositions[0]);
    }
  } else {
    console.log(`HTTP ${response.status}`);
  }
} catch (error) {
  console.error('Error:', error instanceof Error ? error.message : 'Unknown');
}

// Test 4: Tool usage
console.log('\n=== Tool Usage ===');
try {
  const response = await fetch(`${ACTIVITY_API}/v2/activities/tool-usage?limit=5`, { headers });
  if (response.ok) {
    const toolUsage = await response.json();
    console.log(`Found ${toolUsage.length} tool usage records`);
    if (toolUsage.length > 0) {
      console.log('Sample tool usage:', toolUsage[0]);
    }
  } else {
    console.log(`HTTP ${response.status}`);
  }
} catch (error) {
  console.error('Error:', error instanceof Error ? error.message : 'Unknown');
}

// Test 5: Impulse relevance
console.log('\n=== Impulse Relevance ===');
try {
  const response = await fetch(`${ACTIVITY_API}/v2/activities/impulse-relevance?limit=5`, { headers });
  if (response.ok) {
    const relevance = await response.json();
    console.log(`Found ${relevance.length} relevance records`);
    if (relevance.length > 0) {
      console.log('Sample relevance:', relevance[0]);
    }
  } else {
    console.log(`HTTP ${response.status}`);
  }
} catch (error) {
  console.error('Error:', error instanceof Error ? error.message : 'Unknown');
}

console.log('\nExploration complete');
