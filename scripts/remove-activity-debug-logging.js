#!/usr/bin/env node
/**
 * Remove debug logging added for activity execution troubleshooting
 * 
 * This script removes:
 * - fs.appendFileSync calls to activity-debug.log
 * - console.error calls with [ACTIVITY-DEBUG] prefix
 * - CHECKPOINT A/B/C/D/E logging
 * 
 * It preserves:
 * - Legitimate error handling (try-catch blocks)
 * - Legitimate logging (log.debug, log.info, log.error)
 * - Actual application logic
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../repos/metabob-opencode/packages/opencode/src/tool/activity.ts');

console.log('Reading activity.ts...');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log(`Original: ${lines.length} lines`);

const cleanedLines = [];
let skipNext = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Skip if previous line indicated we should skip this one
  if (skipNext) {
    skipNext = false;
    // Check if this line is a continuation (ends with comma or closing paren)
    if (line.trim().endsWith(',') || line.trim().endsWith(')')) {
      continue;
    }
    continue;
  }
  
  // Pattern 1: fs.appendFileSync to activity-debug.log (multi-line)
  if (line.includes('fs.appendFileSync') && line.includes('activity-debug.log')) {
    // Skip this line and the next line (which is the content)
    skipNext = true;
    continue;
  }
  
  // Pattern 2: console.error with [ACTIVITY-DEBUG]
  if (line.includes('console.error') && line.includes('[ACTIVITY-DEBUG]')) {
    continue;
  }
  
  // Pattern 3: Standalone lines that are just CHECKPOINT comments (rare)
  if (line.trim().startsWith('// CHECKPOINT') || line.trim() === '// CHECKPOINT B') {
    continue;
  }
  
  cleanedLines.push(line);
}

console.log(`Cleaned: ${cleanedLines.length} lines (removed ${lines.length - cleanedLines.length} lines)`);

// Write back
const cleanedContent = cleanedLines.join('\n');
fs.writeFileSync(filePath, cleanedContent, 'utf8');

console.log('✓ Debug logging removed successfully');
console.log('');
console.log('Verifying with TypeScript...');
const { execSync } = require('child_process');
try {
  execSync('cd repos/metabob-opencode && bun run typecheck', { 
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });
  console.log('✓ TypeScript validation passed');
} catch (error) {
  console.error('✗ TypeScript validation failed - please review changes');
  process.exit(1);
}
