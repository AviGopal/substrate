#!/usr/bin/env bun

// Test the executeTool function
const { executeTool, executeBatchTools } = require('./src/tools/index.ts');

async function runTests() {
  console.log('🧪 Testing executeTool function...\n');
  
  try {
    // Test 1: Basic bash command
    console.log('📋 Test 1: Basic bash command');
    const bashResult = await executeTool('bash', { command: 'echo "Hello from bash"' });
    console.log('✅ Success:', bashResult.success);
    console.log('📤 Output:', bashResult.data?.stdout?.trim());
    console.log('⏱️  Time:', bashResult.metadata?.executionTime + 'ms\n');
    
    // Test 2: File operations
    console.log('📋 Test 2: File operations');
    await executeTool('write', { path: '/tmp/test-executor.txt', content: 'Test content' });
    const readResult = await executeTool('read', { path: '/tmp/test-executor.txt' });
    console.log('✅ File content:', readResult.data?.content?.trim());
    console.log('📊 File size:', readResult.data?.size + ' bytes\n');
    
    // Test 3: Error handling
    console.log('📋 Test 3: Error handling');
    try {
      await executeTool('bash', {});
    } catch (error) {
      console.log('✅ Expected error caught:', error.message);
    }
    
    try {
      await executeTool('nonexistent', {});
    } catch (error) {
      console.log('✅ Expected error caught:', error.message);
    }
    console.log();
    
    // Test 4: Batch execution
    console.log('📋 Test 4: Batch execution');
    const batchResults = await executeBatchTools([
      { toolName: 'bash', parameters: { command: 'echo "Batch 1"' } },
      { toolName: 'bash', parameters: { command: 'echo "Batch 2"' } },
      { toolName: 'invalid', parameters: {} }
    ]);
    
    batchResults.forEach((result, i) => {
      console.log(`📦 Batch ${i + 1}:`, result.success ? 
        `SUCCESS - ${result.data?.stdout?.trim()}` : 
        `ERROR - ${result.error}`
      );
    });
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();