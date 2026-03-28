#!/usr/bin/env bun
// Check if activity.ts has the auto-debug function

import * as fs from 'fs'

const activityFile = './repos/metabob-opencode/packages/opencode/src/tool/activity.ts'
const content = fs.readFileSync(activityFile, 'utf-8')

// Check for auto-debug function and invocation
const hasMaybeAutoDebug = content.includes('maybeAutoDebugFailedActivity')
const hasAutoDebugCall = content.includes('await maybeAutoDebugFailedActivity(activity, parentSessionID)')
const hasDebugTemplate = content.includes('"debug-activity-self-contained"')
const hasLifecycleConfig = content.includes('template_lifecycle_automation')

console.log('Activity Auto-Debug Verification:')
console.log('  maybeAutoDebugFailedActivity function:', hasMaybeAutoDebug ? '✅' : '❌')
console.log('  Function invoked after failure:', hasAutoDebugCall ? '✅' : '❌')
console.log('  Uses debug-activity-self-contained:', hasDebugTemplate ? '✅' : '❌')
console.log('  Checks lifecycle config:', hasLifecycleConfig ? '✅' : '❌')
console.log('')

const allPresent = hasMaybeAutoDebug && hasAutoDebugCall && hasDebugTemplate && hasLifecycleConfig

console.log('Overall:', allPresent ? '✅ PASS' : '❌ FAIL')
