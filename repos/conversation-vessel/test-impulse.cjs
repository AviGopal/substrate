// Simple test for impulse resolution functionality
const { resolveImpulse, createImpulseRef, resolveImpulseRef } = require('./dist/index.js');
const fs = require('fs');

async function testImpulseResolver() {
  console.log('🧪 Testing Impulse Resolution...\n');

  // Test 1: Memo resolution
  console.log('1. Testing memo resolution:');
  const memoPointer = { type: 'memo', content: 'This is a test memo content' };
  const memoResult = await resolveImpulse(memoPointer);
  console.log('   Result:', memoResult);
  console.log('   ✅ Memo resolution:', memoResult.success ? 'PASS' : 'FAIL');
  
  // Test 2: File resolution (existing file)
  console.log('\n2. Testing file resolution (existing file):');
  const filePointer = { type: 'file', path: './package.json' };
  const fileResult = await resolveImpulse(filePointer);
  console.log('   Success:', fileResult.success);
  console.log('   Metadata:', fileResult.metadata);
  console.log('   Content length:', fileResult.data?.length || 0);
  console.log('   ✅ File resolution:', fileResult.success ? 'PASS' : 'FAIL');
  
  // Test 3: File resolution (non-existent file)
  console.log('\n3. Testing file resolution (non-existent file):');
  const badFilePointer = { type: 'file', path: './non-existent-file.txt' };
  const badFileResult = await resolveImpulse(badFilePointer);
  console.log('   Result:', badFileResult);
  console.log('   ✅ Error handling:', !badFileResult.success ? 'PASS' : 'FAIL');
  
  // Test 4: ImpulseRef creation and resolution
  console.log('\n4. Testing ImpulseRef creation and resolution:');
  const impulseRef = createImpulseRef('test-1', 'memo', 100, 'high', 'Test impulse content');
  console.log('   Created ref:', impulseRef);
  
  const resolvedRef = await resolveImpulseRef(impulseRef);
  console.log('   Resolved ref content length:', resolvedRef.content?.length || 0);
  console.log('   ✅ ImpulseRef resolution:', resolvedRef.content ? 'PASS' : 'FAIL');
  
  // Test 5: ImpulseRef file resolution
  console.log('\n5. Testing ImpulseRef file resolution:');
  const fileRef = createImpulseRef('test-2', 'file', 200, 'medium', './tsconfig.json');
  const resolvedFileRef = await resolveImpulseRef(fileRef);
  console.log('   File content loaded:', !!resolvedFileRef.content);
  console.log('   Metadata present:', !!resolvedFileRef.metadata?.size);
  console.log('   ✅ ImpulseRef file resolution:', resolvedFileRef.content ? 'PASS' : 'FAIL');
  
  console.log('\n🎉 All tests completed!');
}

// Run tests
testImpulseResolver().catch(console.error);