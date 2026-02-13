// Test if OpenCode can import the MCP module properly
const metabobUtil = await import('./repos/metabob-opencode/packages/opencode/src/util/metabob.ts');
console.log('MetabobCLI namespace:', Object.keys(metabobUtil.MetabobCLI));

// Try calling searchActivities
try {
  console.log('Calling searchActivities...');
  const results = await metabobUtil.MetabobCLI.searchActivities('', { limit: 5 });
  console.log('Results:', results.length, 'activities');
  if (results.length > 0) {
    console.log('First:', results[0].name || results[0].id);
  }
} catch (e) {
  console.error('Error:', e.message);
  console.error('Stack:', e.stack);
}
