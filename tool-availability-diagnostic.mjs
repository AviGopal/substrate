#!/usr/bin/env node
/**
 * DIAGNOSTIC SCRIPT - No LLM Involvement
 * 
 * Purpose: Prove what tools are actually available to the agent
 * at each stage of execution, and verify MCP connectivity.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const R = '\x1b[0m', B = '\x1b[1m', RED = '\x1b[31m', G = '\x1b[32m', Y = '\x1b[33m', BL = '\x1b[34m';

function section(t) { console.log(`\n${B}${BL}${'='.repeat(80)}${R}\n${B}${BL}${t}${R}\n${B}${BL}${'='.repeat(80)}${R}\n`); }
function pass(m) { console.log(`${G}✓${R} ${m}`); }
function fail(m) { console.log(`${RED}✗${R} ${m}`); }
function warn(m) { console.log(`${Y}⚠${R} ${m}`); }
function info(m) { console.log(`  ${m}`); }

// STAGE 1: OpenCode Tool Registry
section('STAGE 1: OpenCode Tool Registry');

const registryPath = './repos/metabob-opencode/packages/opencode/src/tool/registry.ts';
if (!fs.existsSync(registryPath)) { fail(`Registry not found`); process.exit(1); }
pass('Found registry.ts');

const registryContent = fs.readFileSync(registryPath, 'utf-8');
const toolsMatch = registryContent.match(/return \[([\s\S]*?)\]/);
if (!toolsMatch) { fail('Could not parse tool list'); process.exit(1); }

const toolNames = toolsMatch[1].split(',').map(l => l.trim()).filter(l => l.endsWith('Tool')).map(n => n.replace('Tool', '').replace(/([A-Z])/g, '_$1').toLowerCase().slice(1));

console.log('Registered OpenCode Tools:');
toolNames.forEach(name => info(`  - ${name}`));

const hasActivityTool = toolNames.includes('activity');
const hasSearchActivitiesTool = toolNames.includes('search_activities');

console.log('\n' + B + 'Key Tools:' + R);
hasActivityTool ? pass('activity tool is registered') : fail('activity tool is NOT registered');
hasSearchActivitiesTool ? pass('search_activities tool is registered') : fail('search_activities tool is NOT registered');

// STAGE 2: MCP Tools Hidden Check
section('STAGE 2: MCP Tool Hiding');

const promptPath = './repos/metabob-opencode/packages/opencode/src/session/prompt.ts';
if (!fs.existsSync(promptPath)) { fail(`Prompt not found`); process.exit(1); }
pass('Found prompt.ts');

const promptContent = fs.readFileSync(promptPath, 'utf-8');
const hiddenMatch = promptContent.match(/const HIDDEN_MCP_TOOLS = new Set\(\[([\s\S]*?)\]\)/);
if (!hiddenMatch) { fail('Could not parse HIDDEN_MCP_TOOLS'); process.exit(1); }

const hiddenTools = hiddenMatch[1].split('\n').map(l => l.trim()).filter(l => l.startsWith('"') || l.startsWith("'")).map(l => l.replace(/["',]/g, '').trim()).filter(Boolean);

console.log('Hidden MCP Tools:');
hiddenTools.forEach(name => info(`  - ${name}`));

const searchActivitiesHidden = hiddenTools.includes('metabob_search_activities');
const activityHidden = hiddenTools.includes('metabob_activity');

console.log('\n' + B + 'Activity-Related MCP Tools:' + R);
searchActivitiesHidden ? warn('metabob_search_activities is HIDDEN from agent') : pass('metabob_search_activities is exposed to agent');
activityHidden ? warn('metabob_activity is HIDDEN from agent') : pass('metabob_activity is exposed to agent');

// STAGE 3: Tool File Existence
section('STAGE 3: Tool Implementation Files');

const toolDir = './repos/metabob-opencode/packages/opencode/src/tool';
const searchActivitiesTxt = path.join(toolDir, 'search-activities.txt');
const searchActivitiesTs = path.join(toolDir, 'search-activities.ts');
const activityTs = path.join(toolDir, 'activity.ts');

console.log('Checking for activity-related tool files:\n');
fs.existsSync(searchActivitiesTxt) ? pass('search-activities.txt exists (description)') : fail('search-activities.txt missing');
fs.existsSync(searchActivitiesTs) ? pass('search-activities.ts exists (implementation)') : fail('search-activities.ts MISSING (implementation)');
fs.existsSync(activityTs) ? pass('activity.ts exists (implementation)') : fail('activity.ts MISSING (implementation)');

// SUMMARY
section('DIAGNOSTIC SUMMARY');

console.log(B + 'Current State:' + R + '\n');

const issues = [];
const working = [];

if (!hasSearchActivitiesTool) issues.push('❌ search_activities tool NOT implemented in OpenCode');
else working.push('✓ search_activities tool implemented');

if (searchActivitiesHidden && !hasSearchActivitiesTool) issues.push('❌ metabob_search_activities is HIDDEN but OpenCode wrapper does NOT exist');
else if (!searchActivitiesHidden) working.push('✓ metabob_search_activities is exposed to agent');

if (!hasActivityTool) issues.push('❌ activity tool NOT implemented in OpenCode');
else working.push('✓ activity tool implemented');

if (!fs.existsSync(searchActivitiesTs)) issues.push('❌ search-activities.ts implementation file MISSING');

console.log(G + B + 'Working:' + R);
working.forEach(item => console.log(`  ${item}`));

console.log('\n' + RED + B + 'Issues:' + R);
issues.forEach(item => console.log(`  ${item}`));

console.log('\n' + B + 'Conclusion:' + R);
if (issues.length === 0) {
  console.log(G + '✓ All checks passed! Activity system should work.' + R);
} else {
  console.log(RED + '✗ Activity system has configuration issues.' + R);
  console.log('\n' + Y + 'Root Cause:' + R);
  console.log('  The agent cannot search for activities because:');
  console.log('  1. OpenCode does not have a search_activities tool implementation');
  console.log('  2. MCP metabob_search_activities is hidden from the agent');
  console.log('  3. Only the .txt description exists, not the .ts implementation');
  console.log('\n' + Y + 'Solution Options:' + R);
  console.log('  A. Implement search-activities.ts in OpenCode (matches design intent)');
  console.log('  B. Unhide metabob_search_activities MCP tool (quick fix)');
}

console.log('\n' + B + BL + '='.repeat(80) + R + '\n');
process.exit(issues.length === 0 ? 0 : 1);
