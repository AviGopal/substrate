/**
 * Dashboard UI Data Flow Validation
 * 
 * Validates: metabob-cli -> metabob-rpc-api -> surrealdb -> dashboard
 * Ensures UI displays data sent by CLI and reflects database state
 */

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const DASHBOARD_URL = 'http://app.metabob.local';
const RPC_API_URL = 'http://api.metabob.local';
const API_KEY = process.env.METABOB_API_KEY || 'mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ';
const SCREENSHOT_DIR = '/home/avi/documents/work/exp-repo/metabob-devbob/screenshots/dashboard-validation';

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function validateDashboard() {
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
    console.log('Activity Executions Response:', JSON.stringify(execData, null, 2));
    
    const templatesResponse = await page.request.get(`${RPC_API_URL}/analytics/templates`, {
      headers: { 'X-API-Key': API_KEY }
    });
    
    const templatesData = await templatesResponse.json();
    console.log('Templates Response:', JSON.stringify(templatesData, null, 2));
    
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
    console.log(`   Screenshot: ${path.join(SCREENSHOT_DIR, '01-dashboard-initial.png')}`);
    
    // =====================================================================
    // Step 3: Check Page State
    // =====================================================================
    console.log('\n🔐 Step 3: Analyzing page state...\n');
    
    const pageTitle = await page.title();
    console.log(`Page title: ${pageTitle}`);
    
    // Get visible text
    const visibleText = await page.evaluate(() => {
      return document.body.innerText;
    });
    
    console.log('Page content preview (first 500 chars):');
    console.log(visibleText.substring(0, 500));
    console.log('...\n');
    
    // Check if we're on login page
    const isLoginPage = visibleText.toLowerCase().includes('sign in') || 
                        visibleText.toLowerCase().includes('login') ||
                        visibleText.toLowerCase().includes('email') && visibleText.toLowerCase().includes('password');
    
    if (isLoginPage) {
      console.log('⚠️  Login page detected');
      console.log('\n📝 MANUAL ACTION REQUIRED:');
      console.log('   The dashboard requires authentication.');
      console.log('   Please login in the browser window that opened.');
      console.log('   This script will wait for 120 seconds...\n');
      
      await page.screenshot({ 
        path: path.join(SCREENSHOT_DIR, '02-login-page.png'), 
        fullPage: true 
      });
      
      // Wait for manual login (2 minutes)
      console.log('Waiting for authentication...');
      await page.waitForTimeout(120000);
      
      // Check if still on login page
      const currentText = await page.evaluate(() => document.body.innerText);
      const stillOnLogin = currentText.toLowerCase().includes('sign in') || 
                           currentText.toLowerCase().includes('login');
      
      if (stillOnLogin) {
        console.log('❌ Still on login page. Cannot continue without authentication.');
        await page.screenshot({ 
          path: path.join(SCREENSHOT_DIR, '02b-login-timeout.png'), 
          fullPage: true 
        });
        console.log('\nPlease login manually and run this script again.');
        await browser.close();
        return;
      } else {
        console.log('✅ Authentication successful!\n');
        await page.screenshot({ 
          path: path.join(SCREENSHOT_DIR, '03-dashboard-authenticated.png'), 
          fullPage: true 
        });
      }
    } else {
      console.log('✅ Already authenticated or no auth required\n');
    }
    
    // =====================================================================
    // Step 4: Analyze Dashboard Structure
    // =====================================================================
    console.log('\n📊 Step 4: Analyzing dashboard structure...\n');
    
    await page.waitForLoadState('networkidle');
    
    // Get all headings
    const headings = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => ({
        level: h.tagName,
        text: h.textContent?.trim()
      }));
    });
    
    console.log('Dashboard headings:');
    headings.forEach(h => console.log(`  ${h.level}: ${h.text}`));
    console.log('');
    
    // Get navigation structure
    const navLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('nav a, [role="navigation"] a')).map(a => ({
        text: a.textContent?.trim(),
        href: a.getAttribute('href')
      }));
    });
    
    if (navLinks.length > 0) {
      console.log('Navigation links:');
      navLinks.forEach(link => console.log(`  - ${link.text} (${link.href})`));
      console.log('');
    }
    
    // Take full page screenshot
    await page.screenshot({ 
      path: path.join(SCREENSHOT_DIR, '04-dashboard-full.png'), 
      fullPage: true 
    });
    
    console.log(`Full page screenshot: ${path.join(SCREENSHOT_DIR, '04-dashboard-full.png')}\n`);
    
    // =====================================================================
    // Step 5: Search for Data Display
    // =====================================================================
    console.log('\n🔎 Step 5: Searching for data display...\n');
    
    const allText = await page.evaluate(() => document.body.innerText);
    
    // Check for key indicators
    const indicators = {
      'Activity/Execution mentions': (allText.match(/activity|execution/gi) || []).length,
      'Template mentions': (allText.match(/template/gi) || []).length,
      'Usage/Statistics mentions': (allText.match(/usage|statistic|metric/gi) || []).length,
      'API Key mentions': (allText.match(/api[\s-]?key/gi) || []).length,
      'Date/Time mentions': (allText.match(/\d{4}-\d{2}-\d{2}|\d+\s*(min|hour|day|ago)/gi) || []).length,
      'Number counts': (allText.match(/\d+/g) || []).length,
    };
    
    console.log('Data indicators found:');
    Object.entries(indicators).forEach(([key, count]) => {
      console.log(`  ${key}: ${count}`);
    });
    console.log('');
    
    // Search for specific data we know should exist
    const apiKeyShort = API_KEY.substring(0, 15);
    const hasAPIKey = allText.includes(apiKeyShort);
    console.log(`API Key (${apiKeyShort}...) visible: ${hasAPIKey}`);
    
    // =====================================================================
    // Step 6: Find and Validate Panels
    // =====================================================================
    console.log('\n✅ Step 6: Finding dashboard panels...\n');
    
    // Look for common panel/card patterns
    const panels = await page.evaluate(() => {
      const selectors = [
        '[class*="panel"]',
        '[class*="card"]',
        '[class*="widget"]',
        '[class*="section"]',
        'section',
        'article',
        '[role="region"]'
      ];
      
      const found = [];
      selectors.forEach(sel => {
        const elements = document.querySelectorAll(sel);
        elements.forEach(el => {
          const text = el.textContent?.trim() || '';
          if (text && text.length > 20 && text.length < 5000) {
            found.push({
              selector: sel,
              className: el.className,
              textPreview: text.substring(0, 150)
            });
          }
        });
      });
      
      // Deduplicate
      const unique = [];
      const seen = new Set();
      found.forEach(item => {
        const key = item.textPreview;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(item);
        }
      });
      
      return unique.slice(0, 10); // Top 10
    });
    
    console.log(`Found ${panels.length} potential panel(s):\n`);
    panels.forEach((panel, idx) => {
      console.log(`Panel ${idx + 1}:`);
      console.log(`  Selector: ${panel.selector}`);
      console.log(`  Class: ${panel.className}`);
      console.log(`  Content: ${panel.textPreview}...`);
      console.log('');
    });
    
    // =====================================================================
    // Step 7: Check for Specific Panel Types
    // =====================================================================
    console.log('\n🎯 Step 7: Checking for specific panel types...\n');
    
    const panelChecks = [
      { name: 'Activity History', keywords: ['activity', 'execution', 'history'] },
      { name: 'Templates', keywords: ['template', 'workflow'] },
      { name: 'Usage Statistics', keywords: ['usage', 'statistics', 'metrics', 'cost'] },
      { name: 'Recent Activity', keywords: ['recent', 'latest'] },
    ];
    
    for (const check of panelChecks) {
      const found = check.keywords.some(kw => allText.toLowerCase().includes(kw.toLowerCase()));
      console.log(`${check.name}: ${found ? '✅ Found' : '❌ Not found'}`);
      
      if (found) {
        console.log(`  Keywords matched: ${check.keywords.filter(kw => allText.toLowerCase().includes(kw.toLowerCase())).join(', ')}`);
      }
    }
    
    // =====================================================================
    // Step 8: Generate Summary
    // =====================================================================
    console.log('\n📋 Step 8: Generating validation summary...\n');
    
    const summary = {
      timestamp: new Date().toISOString(),
      dashboard_url: DASHBOARD_URL,
      api_url: RPC_API_URL,
      api_key: apiKeyShort + '...',
      page_title: pageTitle,
      authentication: {
        required: isLoginPage,
        completed: !isLoginPage
      },
      backend_data: {
        executions_response: execData,
        templates_response: templatesData
      },
      ui_analysis: {
        headings_found: headings.length,
        nav_links_found: navLinks.length,
        panels_found: panels.length,
        data_indicators: indicators
      },
      screenshots: fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png'))
    };
    
    const summaryPath = path.join(SCREENSHOT_DIR, 'validation-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    
    console.log('\n' + '='.repeat(70));
    console.log('VALIDATION SUMMARY');
    console.log('='.repeat(70));
    console.log(JSON.stringify(summary, null, 2));
    console.log('='.repeat(70));
    console.log(`\n✅ Validation complete!`);
    console.log(`📄 Summary: ${summaryPath}`);
    console.log(`📸 Screenshots: ${SCREENSHOT_DIR}\n`);
    
    console.log('\n🎬 Browser will close in 10 seconds...\n');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('\n❌ Validation failed:', error);
    
    await page.screenshot({ 
      path: path.join(SCREENSHOT_DIR, 'error-screenshot.png'), 
      fullPage: true 
    }).catch(() => {});
    
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the validation
validateDashboard().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
