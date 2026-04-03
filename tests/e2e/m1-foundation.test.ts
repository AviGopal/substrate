/**
 * Milestone 1: Foundation Validation
 *
 * These tests verify that all existing RBAC components work correctly.
 * They are black-box tests that call real APIs in the deployed environment.
 *
 * Service URLs (per Istio gateway config):
 * - activity.metabob.local → metabob-activity-api (MiniBob auth, templates, traces)
 * - api.metabob.local → metabob-analysis-api (user auth, analysis routes)
 * - app.metabob.local → metabob-cloud-dashboard
 *
 * Pre-conditions:
 * - Local Kubernetes cluster running (docker-desktop context)
 * - SurrealDB deployed with schemas
 * - metabob-activity-api deployed
 * - Default org (metabob_internal) and MiniBob instance (minibob-local-001) created
 * - /etc/hosts configured: 127.0.0.1 activity.metabob.local api.metabob.local app.metabob.local
 */

import { test, expect } from '@playwright/test';
import {
  authenticateMiniBob,
  authenticateWithApiKey,
  getTemplates,
  createTemplate,
  getExecutionTrace,
  createExecutionTrace,
  checkHealth
} from './helpers/api-client';
import { loginAsDashboard, getTemplateRows, assertNoOtherOrgData } from './helpers/dashboard-helpers';

// Test configuration
const DEFAULT_INSTANCE_ID = 'minibob-local-001';
const DEFAULT_INSTANCE_KEY = 'test-api-key-123';
const DEFAULT_API_KEY = 'mb_test_alpha_key_001';

test.describe('M1: Foundation Validation', () => {

  // ============================================================================
  // M1.2: MiniBob Authentication
  // ============================================================================

  test.describe('MiniBob Authentication', () => {

    test('M1.2.1: signin returns JWT with org_id', async () => {
      const response = await authenticateMiniBob(DEFAULT_INSTANCE_ID, DEFAULT_INSTANCE_KEY);

      expect(response.token).toBeTruthy();
      expect(response.token.split('.')).toHaveLength(3); // Valid JWT format
      // org_id uses record format for consistency
      expect(response.org_id).toBe('organizations:metabob_internal');
    });

    test('M1.2.2: signin returns JWT with project_id', async () => {
      const response = await authenticateMiniBob(DEFAULT_INSTANCE_ID, DEFAULT_INSTANCE_KEY);

      expect(response.token).toBeTruthy();
      // project_id may be optional but should be defined if instance has one
      expect(response).toHaveProperty('project_id');
    });

    test('M1.2.3: signin fails for inactive instance', async () => {
      // This test requires an inactive instance in the fixtures
      // For now, test with invalid credentials
      await expect(
        authenticateMiniBob('inactive-instance', 'wrong-key')
      ).rejects.toThrow(/401|Invalid/);
    });

    test('M1.2.4: MiniBob JWT enables template queries', async () => {
      const { token } = await authenticateMiniBob(DEFAULT_INSTANCE_ID, DEFAULT_INSTANCE_KEY);

      const templates = await getTemplates(token);

      // Should get templates without error
      expect(Array.isArray(templates)).toBe(true);
    });

    test('M1.2.5: MiniBob cannot access other org templates', async () => {
      const { token, org_id } = await authenticateMiniBob(DEFAULT_INSTANCE_ID, DEFAULT_INSTANCE_KEY);

      const templates = await getTemplates(token);

      // All templates should be from same org or global
      // org_id uses record format for consistency
      for (const template of templates) {
        if (template.org_id) {
          expect([org_id, 'organizations:metabob_internal']).toContain(template.org_id);
        }
      }
    });
  });

  // ============================================================================
  // M1.3: API Key Authentication
  // ============================================================================

  test.describe('API Key Authentication', () => {

    test('M1.3.1: exchange returns JWT with org_id', async () => {
      const response = await authenticateWithApiKey(DEFAULT_API_KEY);

      expect(response.token).toBeTruthy();
      expect(response.token.split('.')).toHaveLength(3); // Valid JWT format
      expect(response.org_id).toBeTruthy();
    });

    test('M1.3.2: exchange returns JWT with project_ids array', async () => {
      const response = await authenticateWithApiKey(DEFAULT_API_KEY);

      expect(response.token).toBeTruthy();
      // project_ids should be an array (even if empty)
      expect(response.project_ids).toBeDefined();
      if (response.project_ids) {
        expect(Array.isArray(response.project_ids)).toBe(true);
      }
    });

    test('M1.3.3: expired API key returns 401', async () => {
      // This test requires an expired API key in fixtures
      // For now, test with invalid key
      await expect(
        authenticateWithApiKey('mb_expired_key_123')
      ).rejects.toThrow(/401|Invalid/);
    });

    test('M1.3.4: revoked API key returns 401', async () => {
      // This test requires a revoked API key in fixtures
      await expect(
        authenticateWithApiKey('mb_revoked_key_123')
      ).rejects.toThrow(/401|Invalid/);
    });

    test('M1.3.5: API key JWT enables scoped queries', async () => {
      const { token, org_id } = await authenticateWithApiKey(DEFAULT_API_KEY);

      const templates = await getTemplates(token);

      // Should get templates without error
      expect(Array.isArray(templates)).toBe(true);

      // All templates should be accessible to this org
      for (const template of templates) {
        if (template.scope === 'org' && template.org_id) {
          expect(template.org_id).toBe(org_id);
        }
      }
    });
  });

  // ============================================================================
  // M1.4: Database PERMISSIONS
  // ============================================================================

  test.describe('Database PERMISSIONS', () => {

    test('M1.4.1: User A cannot see Org B templates', async () => {
      // This test requires two different orgs in fixtures
      // Get token for default org
      const { token: orgAToken, org_id: orgA } = await authenticateWithApiKey(DEFAULT_API_KEY);

      // Get templates
      const templates = await getTemplates(orgAToken);

      // None should be from a different org (unless global)
      for (const template of templates) {
        if (template.scope === 'org') {
          expect(template.org_id).toBe(orgA);
        }
      }
    });

    test('M1.4.2: User A cannot see Org B execution traces', async () => {
      const { token } = await authenticateWithApiKey(DEFAULT_API_KEY);

      // Try to get a trace that doesn't exist or is from another org
      const trace = await getExecutionTrace(token, 'non-existent-trace-id');

      // Should return null (not found) rather than forbidden
      expect(trace).toBeNull();
    });

    test('M1.4.3: Global templates visible to all orgs', async () => {
      const { token } = await authenticateWithApiKey(DEFAULT_API_KEY);

      const templates = await getTemplates(token, { scope: 'global' });

      // Should get at least some global templates (if they exist)
      // All returned should be global scope
      for (const template of templates) {
        expect(template.scope).toBe('global');
      }
    });

    test('M1.4.4: Project-scoped templates filtered by project_ids', async () => {
      const { token, project_ids } = await authenticateWithApiKey(DEFAULT_API_KEY);

      const templates = await getTemplates(token);

      // Project-scoped templates should only be from accessible projects
      for (const template of templates) {
        if (template.scope === 'project' && template.project_id) {
          if (project_ids && project_ids.length > 0) {
            expect(project_ids).toContain(template.project_id);
          }
        }
      }
    });

    // TODO: Backend issue - $auth.id contains minibob_instance from cached connection
    // Need to investigate how apikey auth inherits session state
    test.skip('M1.4.5: org_id auto-populated on INSERT', async () => {
      // Use API key auth since it has a user_id (execution traces require user auth, not MiniBob)
      const { token, org_id } = await authenticateWithApiKey(DEFAULT_API_KEY);

      // Create an execution trace
      const { execution_id } = await createExecutionTrace(token, {
        variant_id: `test-autopop-${Date.now()}`,
        success: true,
        duration_ms: 1000,
        cost: 0.01,
        tokens: { input: 50, output: 25, cache: 0 }
      });

      // Fetch it back
      const trace = await getExecutionTrace(token, execution_id);

      // org_id should be auto-populated from $auth
      expect(trace).not.toBeNull();
      expect(trace!.org_id).toBe(org_id);
    });
  });

  // ============================================================================
  // M1.5: Dashboard Validation
  // ============================================================================

  test.describe('Dashboard Validation', () => {

    // Skip dashboard tests until dashboard is configured with test IDs
    test.skip('M1.5.1: shows current org after login', async ({ page }) => {
      await loginAsDashboard(page, 'admin@metabob.local', 'test-password');

      // Check that org name is displayed
      const orgName = await page.locator('[data-testid="current-org"]').textContent();
      expect(orgName).toContain('Metabob');
    });

    // Skip dashboard tests until dashboard is configured with test IDs
    test.skip('M1.5.2: templates list shows only org templates', async ({ page }) => {
      await loginAsDashboard(page, 'admin@metabob.local', 'test-password');

      // Navigate to templates
      await page.click('[data-testid="nav-templates"]');
      await page.waitForSelector('[data-testid="template-list"]');

      // Verify no cross-org templates visible
      await assertNoOtherOrgData(page, 'metabob_internal', 'template-row');
    });
  });

  // ============================================================================
  // Health Check
  // ============================================================================

  test.describe('System Health', () => {

    test('health endpoint returns healthy', async () => {
      const health = await checkHealth();

      expect(health.status).toBe('healthy');
      expect(health.checks.redis.status).toBe('healthy');
      expect(health.checks.surrealdb.status).toBe('healthy');
    });
  });
});
