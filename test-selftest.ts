import { impulses } from './src/routes/impulses.ts';

async function runTest() {
  const result = await impulses({ shape: 'learning-loop-selftest_output' });
  console.log(JSON.stringify(result, null, 2));
}

runTest();