#!/usr/bin/env node
/**
 * Test calling activity tool directly (simulating what agent would do)
 */

// Simulate loading the built tool
const toolPath = './repos/metabob-opencode/packages/opencode/dist/tool/activity.js';
console.log('Loading activity tool from:', toolPath);

try {
  const { ActivityTool } = await import(toolPath);
  
  console.log('ActivityTool loaded:', !!ActivityTool);
  console.log('ActivityTool.id:', ActivityTool.id);
  
  // Initialize the tool
  const toolDef = await ActivityTool.init();
  console.log('Tool initialized');
  console.log('Has execute function:', !!toolDef.execute);
  
  // Create mock context
  const mockCtx = {
    sessionID: 'test-session-123',
    messageID: 'test-msg-123',
    agent: 'test',
    abort: new AbortController().signal,
    metadata: () => {},
  };
  
  // Try to execute with our registered activity
  console.log('\nAttempting to execute activity...');
  console.log('Activity ID: refactor-5fccfc17');
  
  const result = await toolDef.execute({
    activityId: 'refactor-5fccfc17',
    variables: {
      scope: 'entire repo',
      mode: 'dryRun'
    },
    reason: 'Test jiggle activity'
  }, mockCtx);
  
  console.log('\nSUCCESS!');
  console.log('Result title:', result.title);
  console.log('Output length:', result.output?.length || 0);
  
} catch (error) {
  console.log('\nFAILED!');
  console.log('Error:', error.message);
  console.log('Stack:', error.stack?.split('\n').slice(0, 5).join('\n'));
}
