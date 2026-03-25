/**
 * Test Helpers - Barrel Export
 *
 * Provides a single import point for all test helpers.
 */

// API Client functions
export {
  authenticateMiniBob,
  authenticateWithApiKey,
  authenticateUser,
  getTemplates,
  createTemplate,
  createExecutionTrace,
  getExecutionTrace,
  getExecutionTraces,
  createImpulse,
  resolveImpulse,
  addUserToProject,
  removeUserFromProject,
  checkHealth,
  createExpiredJWT,
  waitFor,
  type AuthResponse,
  type Template,
  type ExecutionTrace,
} from './api-client';

// Dashboard helpers
export {
  loginAsDashboard,
  logoutFromDashboard,
  navigateTo,
  getTemplateRows,
  getExecutionRows,
  waitForWebSocketMessage,
  getCurrentUser,
  isAuthenticated,
  waitForDataLoad,
  triggerMiniBobExecutionAndWait,
  createTestTemplate,
  assertNoOtherOrgData,
} from './dashboard-helpers';

// Fixtures
export {
  setupTestFixtures,
  teardownTestFixtures,
  testCredentials,
  TEST_ORG_ALPHA,
  TEST_ORG_BETA,
  TEST_ORG_GAMMA,
  TEST_USER_ALPHA_ADMIN,
  TEST_USER_ALPHA_MEMBER,
  TEST_USER_BETA_ADMIN,
  TEST_PROJECT_ALPHA,
  TEST_PROJECT_BETA,
  TEST_MINIBOB_ALPHA,
  TEST_MINIBOB_BETA,
  TEST_API_KEY_ALPHA,
  TEST_API_KEY_BETA,
} from './fixtures';
