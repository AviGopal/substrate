#!/usr/bin/env bun

import { TestArtifactCleaner, CleanupConfig } from './cleanup-test-artifacts';
import { writeFileSync } from 'fs';

// Configuration for test artifact cleanup
const config: CleanupConfig = {
  dryRun: process.argv.includes('--dry-run'),
  logFile: 'logs/cleanup.log',
  maxFileAge: 1, // Only delete files older than 1 day
  patterns: {
    // Safe patterns - commonly temporary files that are safe to delete
    safe: [
      '**/*.tmp',
      '**/*.temp',
      '**/tmp/**',
      '**/.coverage',
      '**/.nyc_output/**',
      '**/.pytest_cache/**',
      '**/__pycache__/**',
      '**/*.pyc',
      '**/*.pyo',
      '**/test-results/**',
      '**/coverage/**',
      '**/.DS_Store',
      '**/Thumbs.db',
      '**/*.log.old',
      '**/*.log.[0-9]*',
      '**/junit.xml',
      '**/test-output.xml',
      '**/.tsbuildinfo'
    ],
    // Risky patterns - require extra caution and age checks
    risky: [
      '**/*.log',
      '**/logs/*.log',
      '**/debug.log',
      '**/error.log',
      '**/npm-debug.log*',
      '**/yarn-debug.log*',
      '**/yarn-error.log*',
      '**/.env.local',
      '**/.env.test.local'
    ]
  },
  protectedPaths: [
    'src/',
    'tests/',
    'activities/',
    'docs/',
    'README.md',
    'package.json',
    'tsconfig.json',
    'eslint.config.js',
    '.git/',
    '.github/',
    'node_modules/',
    '.metabob/',
    'scripts/',
    'public/'
  ]
};

async function main() {
  console.log('🧹 Test Artifact Cleanup Tool');
  console.log('==============================');
  
  if (config.dryRun) {
    console.log('🔍 DRY RUN MODE - No files will be deleted');
  } else {
    console.log('⚠️  LIVE MODE - Files will be permanently deleted');
  }
  
  console.log(`📁 Working directory: ${process.cwd()}`);
  console.log(`📝 Log file: ${config.logFile}`);
  console.log(`⏰ Max file age: ${config.maxFileAge} day(s)`);
  console.log('');
  
  try {
    const cleaner = new TestArtifactCleaner(config);
    
    console.log('🔍 Scanning for test artifacts...');
    await cleaner.cleanup();
    
    console.log('📊 Generating cleanup report...');
    const report = cleaner.generateReport();
    
    // Save report to file
    const reportFile = `logs/cleanup-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    writeFileSync(reportFile, report);
    
    console.log(`✅ Cleanup completed! Report saved to: ${reportFile}`);
    console.log('');
    console.log('📋 Summary:');
    
    const summary = JSON.parse(report).summary;
    console.log(`   Files deleted: ${summary.filesDeleted}`);
    console.log(`   Files skipped: ${summary.filesSkipped}`);
    console.log(`   Errors: ${summary.errors}`);
    
    if (summary.errors > 0) {
      console.log('⚠️  Check the log file for error details.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.main) {
  main().catch(console.error);
}

export { config };