/**
 * Global Setup for E2E Tests
 *
 * Runs once before all tests to set up the test environment.
 */

import { setupTestFixtures } from './helpers/fixtures';

async function globalSetup(): Promise<void> {
  console.log('\n🔧 Setting up E2E test environment...\n');

  try {
    // Create test fixtures in the database
    await setupTestFixtures();

    console.log('\n✓ E2E test environment ready\n');
  } catch (error) {
    console.error('\n❌ Failed to set up test environment:', error);
    throw error;
  }
}

export default globalSetup;
