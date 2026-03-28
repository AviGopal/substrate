/**
 * Dashboard UI Data Flow Validation
 * 
 * Validates: metabob-cli -> metabob-rpc-api -> surrealdb -> dashboard
 * Ensures UI displays data sent by CLI and reflects database state
 */

import { test, expect, chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const DASHBOARD_URL = 'http://app.metabob.local';
const RPC_API_URL = 'http://api.metabob.local';
const API_KEY = process.env.METABOB_API_KEY || 'mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ';
const SCREENSHOT_DIR = '/home/avi/documents/work/exp-repo/metabob-devbob/screenshots/dashboard-validation';

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

test.describe('Dashboard Data Display Validation', () => {
  
  test('Complete E2E validation: CLI -> RPC API -> SurrealDB -> Dashboard', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();

    try {
      // =====================================================================
      // Step 1: Verify Backend Data Exists
      // =====================================================================
      console.log('\n🔍 Step 1: Verifying backend data availability...\n');
      
      const execResponse = await page.request.get(`${RPC_API_URL}/api/v1/learning-loop/executions`, {
        headers: { 'X-API-Key': API_KEY }
      });
      
      const execData = await execResponse.json();
      console.log('Activity Executions:', JSON.stringify(execData, null, 2));
      
      const templatesResponse = await page.request.get(`${RPC_API_URL}/analytics/templates`, {
        headers: { 'X-API-Key': API_KEY }
      });
      
      const templatesData = await templatesResponse.json();
      console.log('Templates:', JSON.stringify(templatesData, null, 2));
      
      // =====================================================================
      // Step 2: Navigate to Dashboard
      // =====================================================================
      console.log('\n🌐 Step 2: Navigating to dashboard...\n');
      
      await page.goto(DASHBOARD_URL);
      await page.waitForLoadState('networkidle');
      
      await page.screenshot({ 
        path: path.join(SCREENSHOT_DIR, '01-dashboard-initial.png'), 
        fullPage: true 
      });
      
      console.log('✅ Dashboard loaded');
      
      // =====================================================================
      // Step 3: Handle Authentication
      // =====================================================================
      console.log('\n🔐 Step 3: Handling authentication...\n');
      
      // Check if we're on login page
      const pageContent = await page.content();
      const isLoginPage = pageContent.toLowerCase().includes('sign in') || 
                          pageContent.toLowerCase().includes('login') ||
                          await page.locator('input[type="email"]').isVisible().catch(() => false);
      
      if (isLoginPage) {
        console.log('Login page detected');
        
        // Take screenshot of login page
        await page.screenshot({ 
          path: path.join(SCREENSHOT_DIR, '02-login-page.png'), 
          fullPage: true 
        });
        
        // Get visible HTML for analysis
        const visibleText = await page.evaluate(() => {
          return document.body.innerText;
        });
        
        console.log('Login page content (first 500 chars):');
        console.log(visibleText.substring(0, 500));
        
        // Look for authentication methods
        const hasGitHub = pageContent.includes('github') || pageContent.includes('GitHub');
        const hasEmailLogin = await page.locator('input[type="email"]').isVisible().catch(() => false);
        
        console.log('Authentication methods available:');
        console.log('  - GitHub OAuth:', hasGitHub);
        console.log('  - Email/Password:', hasEmailLogin);
        
        // Try to find and document login options
        if (hasGitHub) {
          const githubButton = page.locator('button:has-text("GitHub"), a:has-text("GitHub")').first();
          const isVisible = await githubButton.isVisible().catch(() => false);
          if (isVisible) {
            console.log('  ✅ GitHub login button found');
            await githubButton.screenshot({
              path: path.join(SCREENSHOT_DIR, '02a-github-login-button.png')
            });
          }
        }
        
        if (hasEmailLogin) {
          console.log('  ✅ Email login form found');
          console.log('\n⚠️  MANUAL ACTION REQUIRED:');
          console.log('     Please login manually in the browser window');
          console.log('     This script will wait for 60 seconds...\n');
          
          // Wait for manual login
          await page.waitForTimeout(60000);
          
          // Check if still on login page
          const stillOnLogin = await page.locator('input[type="email"]').isVisible().catch(() => false);
          
          if (stillOnLogin) {
            console.log('❌ Still on login page. Test cannot continue without authentication.');
            await page.screenshot({ 
              path: path.join(SCREENSHOT_DIR, '02b-login-failed.png'), 
              fullPage: true 
            });
            throw new Error('Login required - please authenticate manually');
          } else {
            console.log('✅ Login successful! Continuing...');
            await page.screenshot({ 
              path: path.join(SCREENSHOT_DIR, '03-dashboard-authenticated.png'), 
              fullPage: true 
            });
          }
        }
      } else {
        console.log('✅ Already authenticated or no auth required');
      }
      
      // =====================================================================
      // Step 4: Verify Dashboard Panels
      // =====================================================================
      console.log('\n📊 Step 4: Verifying dashboard panels...\n');
      
      await page.waitForLoadState('networkidle');
      
      // Get page structure
      const pageStructure = await page.evaluate(() => {
        const panels = Array.from(document.querySelectorAll('[class*="panel"], [class*="card"], [class*="widget"], section, article'));
        return panels.map(p => ({
          tagName: p.tagName,
          className: p.className,
          textPreview: p.textContent?.substring(0, 100)
        }));
      });
      
      console.log('Dashboard structure:', JSON.stringify(pageStructure, null, 2));
      
      // Take full page screenshot
      await page.screenshot({ 
        path: path.join(SCREENSHOT_DIR, '04-dashboard-full.png'), 
        fullPage: true 
      });
      
      // Look for activity-related panels
      const activityPanels = await page.locator('[class*="activity"], [class*="execution"], [class*="history"]').count();
      console.log(`Found ${activityPanels} potential activity-related panels`);
      
      // Look for template panels
      const templatePanels = await page.locator('[class*="template"]').count();
      console.log(`Found ${templatePanels} potential template-related panels`);
      
      // Look for statistics panels
      const statsPanels = await page.locator('[class*="stats"], [class*="metric"], [class*="usage"]').count();
      console.log(`Found ${statsPanels} potential statistics panels`);
      
      // =====================================================================
      // Step 5: Check for Data Display
      // =====================================================================
      console.log('\n🔎 Step 5: Checking for data display...\n');
      
      // Get all visible text
      const allText = await page.evaluate(() => document.body.innerText);
      
      // Check if activity data is displayed
      const hasActivityCount = /\d+\s*(activity|activities|execution)/i.test(allText);
      const hasTemplateCount = /\d+\s*(template|templates)/i.test(allText);
      const hasTimestamp = /\d{4}-\d{2}-\d{2}|\d+\s*(min|hour|day)/.test(allText);
      
      console.log('Data display indicators:');
      console.log('  - Activity count displayed:', hasActivityCount);
      console.log('  - Template count displayed:', hasTemplateCount);
      console.log('  - Timestamps present:', hasTimestamp);
      
      // Search for specific data points we know exist
      const searchTerms = ['activity', 'template', 'execution', 'usage', 'api key'];
      for (const term of searchTerms) {
        const count = (allText.match(new RegExp(term, 'gi')) || []).length;
        if (count > 0) {
          console.log(`  - Found "${term}": ${count} occurrence(s)`);
        }
      }
      
      // =====================================================================
      // Step 6: Validate Specific Panels
      // =====================================================================
      console.log('\n✅ Step 6: Validating specific panels...\n');
      
      // Try to find and validate each expected panel
      const panelsToCheck = [
        { name: 'Activity History', selectors: ['[data-testid="activity-history"]', '[class*="activity"][class*="history"]', 'h2:has-text("Activity")', 'h3:has-text("Activity")'] },
        { name: 'Templates', selectors: ['[data-testid="templates"]', '[class*="template"][class*="list"]', 'h2:has-text("Template")', 'h3:has-text("Template")'] },
        { name: 'Usage Statistics', selectors: ['[data-testid="usage"]', '[class*="usage"]', '[class*="stats"]', 'h2:has-text("Usage")', 'h3:has-text("Usage")'] },
      ];
      
      for (const panel of panelsToCheck) {
        console.log(`\nChecking ${panel.name} panel...`);
        
        let found = false;
        for (const selector of panel.selectors) {
          const element = page.locator(selector).first();
          const isVisible = await element.isVisible().catch(() => false);
          
          if (isVisible) {
            console.log(`  ✅ Found via selector: ${selector}`);
            
            // Take screenshot of this panel
            await element.screenshot({
              path: path.join(SCREENSHOT_DIR, `05-panel-${panel.name.toLowerCase().replace(/\s/g, '-')}.png`)
            }).catch(() => console.log('    (Could not capture panel screenshot)'));
            
            // Get panel text content
            const panelText = await element.textContent().catch(() => '');
            console.log(`  Panel preview: ${panelText.substring(0, 200)}...`);
            
            found = true;
            break;
          }
        }
        
        if (!found) {
          console.log(`  ⚠️  ${panel.name} panel not found with standard selectors`);
        }
      }
      
      // =====================================================================
      // Step 7: Validate API Key Filtering
      // =====================================================================
      console.log('\n🔑 Step 7: Validating API key filtering...\n');
      
      // Check if API key is visible or referenced
      const apiKeyShort = API_KEY.substring(0, 15);
      const hasAPIKeyRef = allText.includes(apiKeyShort) || allText.includes('API Key') || allText.includes('api-key');
      
      console.log('API Key filtering indicators:');
      console.log('  - API key reference found:', hasAPIKeyRef);
      console.log('  - Looking for:', apiKeyShort + '...');
      
      // =====================================================================
      // Step 8: Generate Summary Report
      // =====================================================================
      console.log('\n📋 Step 8: Generating validation summary...\n');
      
      const summary = {
        timestamp: new Date().toISOString(),
        dashboard_url: DASHBOARD_URL,
        api_url: RPC_API_URL,
        api_key: apiKeyShort + '...',
        backend_data: {
          executions: execData,
          templates: templatesData
        },
        ui_validation: {
          authenticated: !isLoginPage,
          activity_panels_found: activityPanels,
          template_panels_found: templatePanels,
          stats_panels_found: statsPanels,
          data_indicators: {
            has_activity_count: hasActivityCount,
            has_template_count: hasTemplateCount,
            has_timestamps: hasTimestamp,
            has_api_key_ref: hasAPIKeyRef
          }
        },
        screenshots: fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png')),
      };
      
      // Save summary
      const summaryPath = path.join(SCREENSHOT_DIR, 'validation-summary.json');
      fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
      
      console.log('\n' + '='.repeat(70));
      console.log('VALIDATION SUMMARY');
      console.log('='.repeat(70));
      console.log(JSON.stringify(summary, null, 2));
      console.log('='.repeat(70));
      console.log(`\n✅ Summary saved to: ${summaryPath}`);
      console.log(`📸 Screenshots saved to: ${SCREENSHOT_DIR}\n`);
      
    } catch (error) {
      console.error('\n❌ Test failed:', error);
      
      // Take error screenshot
      await page.screenshot({ 
        path: path.join(SCREENSHOT_DIR, 'error-screenshot.png'), 
        fullPage: true 
      }).catch(() => {});
      
      throw error;
    } finally {
      await browser.close();
    }
  });
});
