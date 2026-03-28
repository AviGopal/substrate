#!/usr/bin/env ts-node
/**
 * Sync Local Templates to Backend
 * 
 * Reads all activity templates from local storage and registers them to the backend API.
 * This ensures template continuity when switching from local-only to MCP backend mode.
 */

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

interface ActivityTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  tasks: any[];
  [key: string]: any;
}

const API_BASE_URL = process.env.METABOB_API_URL || 'http://api.metabob.local:8080';
const API_KEY = process.env.METABOB_API_KEY || 'mb_devbob_test_simple_2026_v2';

class TemplateSyncer {
  private storagePath: string;
  private apiClient: any;
  
  constructor() {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    this.storagePath = path.join(homeDir, '.local/share/opencode/storage/activity-template');
    
    this.apiClient = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }
  
  /**
   * Load all templates from local storage
   */
  loadLocalTemplates(): ActivityTemplate[] {
    const templates: ActivityTemplate[] = [];
    
    if (!fs.existsSync(this.storagePath)) {
      console.warn(`Template storage path not found: ${this.storagePath}`);
      return templates;
    }
    
    const files = fs.readdirSync(this.storagePath);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(this.storagePath, file);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const template = JSON.parse(content) as ActivityTemplate;
          templates.push(template);
        } catch (err) {
          console.warn(`Failed to parse ${file}:`, err);
        }
      }
    }
    
    console.log(`✅ Loaded ${templates.length} templates from local storage`);
    return templates;
  }
  
  /**
   * Register template to backend API
   */
  async registerTemplate(template: ActivityTemplate): Promise<boolean> {
    try {
      const response = await this.apiClient.post('/v2/activities/templates', template);
      
      if (response.status === 200 || response.status === 201) {
        console.log(`  ✅ Registered: ${template.id}`);
        return true;
      } else {
        console.log(`  ⚠️  Unexpected status for ${template.id}: ${response.status}`);
        return false;
      }
    } catch (error: any) {
      if (error.response?.status === 409) {
        console.log(`  ℹ️  Already exists: ${template.id}`);
        return true; // Already exists is OK
      }
      
      console.error(`  ❌ Failed to register ${template.id}:`, error.response?.data || error.message);
      return false;
    }
  }
  
  /**
   * Verify backend connectivity
   */
  async checkBackend(): Promise<boolean> {
    try {
      const response = await this.apiClient.get('/v2/activities/templates');
      console.log(`✅ Backend connected: ${response.data.templates.length} templates exist`);
      return true;
    } catch (error: any) {
      console.error(`❌ Backend check failed:`, error.message);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Data:`, error.response.data);
      }
      return false;
    }
  }
  
  /**
   * Sync all templates
   */
  async sync() {
    console.log('🔄 Template Sync: Local Storage → Backend API');
    console.log(`   Storage: ${this.storagePath}`);
    console.log(`   Backend: ${API_BASE_URL}`);
    console.log('');
    
    // Step 1: Check backend
    console.log('Step 1: Checking backend connectivity...');
    const backendOK = await this.checkBackend();
    if (!backendOK) {
      console.error('\n❌ Backend not accessible. Aborting sync.');
      console.error('   Check that metabob-rpc-api is running and accessible.');
      process.exit(1);
    }
    console.log('');
    
    // Step 2: Load local templates
    console.log('Step 2: Loading templates from local storage...');
    const templates = this.loadLocalTemplates();
    
    if (templates.length === 0) {
      console.log('\n⚠️  No templates found in local storage. Nothing to sync.');
      process.exit(0);
    }
    console.log('');
    
    // Step 3: Register each template
    console.log(`Step 3: Registering ${templates.length} templates to backend...`);
    let successCount = 0;
    let failCount = 0;
    
    for (const template of templates) {
      const success = await this.registerTemplate(template);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }
    
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('  Sync Complete');
    console.log('═══════════════════════════════════════');
    console.log(`  Total templates: ${templates.length}`);
    console.log(`  ✅ Registered: ${successCount}`);
    console.log(`  ❌ Failed: ${failCount}`);
    console.log('═══════════════════════════════════════');
    
    if (failCount > 0) {
      console.error('\n⚠️  Some templates failed to register. Check logs above.');
      process.exit(1);
    } else {
      console.log('\n✅ All templates synced successfully!');
      process.exit(0);
    }
  }
}

// Run the syncer
const syncer = new TemplateSyncer();
syncer.sync().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
