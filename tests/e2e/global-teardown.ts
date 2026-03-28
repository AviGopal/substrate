/**
 * Global Teardown for E2E Tests
 *
 * Runs once after all tests to clean up the test environment.
 */

import { teardownTestFixtures } from './helpers/fixtures';

async function globalTeardown(): Promise<void> {
  console.log('\n🧹 Cleaning up E2E test environment...\n');

  try {
    // Remove test fixtures from the database
    await teardownTestFixtures();

    console.log('\n✓ E2E test environment cleaned up\n');
  } catch (error) {
    console.error('\n❌ Failed to clean up test environment:', error);
    // Don't throw - we don't want cleanup failures to fail the test run
  }
}

export default globalTeardown;
