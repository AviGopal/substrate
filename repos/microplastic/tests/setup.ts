/**
 * Test setup for microplastic
 *
 * This file is preloaded by Bun before running tests.
 */

// Set test environment
process.env.NODE_ENV = "test";

// Silence console in tests by default (can be overridden)
if (!process.env.TEST_VERBOSE) {
  // Keep console available but suppress output
}

// Global test utilities
export {};
