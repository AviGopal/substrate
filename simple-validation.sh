#!/bin/bash

echo "🔍 Running MCP Activity and Impulse System Tool Call Enforcement Validation"
echo "================================================================================"
echo ""

PASS=0
FAIL=0

# Test 1: Check that opencode.json exists (configuration test)
echo "📋 Test 1: Configuration File Exists"
if [ -f "repos/metabob-opencode/opencode.json" ]; then
  echo "✅ PASS: opencode.json found"
  ((PASS++))
else
  echo "❌ FAIL: opencode.json not found"
  ((FAIL++))
fi
echo ""

# Test 2: Check MCP.healthCheck() function exists
echo "📋 Test 2: MCP.healthCheck() Function Exists"
if grep -q "export async function healthCheck" repos/metabob-opencode/packages/opencode/src/mcp/index.ts; then
  echo "✅ PASS: healthCheck() function found in MCP module"
  ((PASS++))
else
  echo "❌ FAIL: healthCheck() function not found"
  ((FAIL++))
fi
echo ""

# Test 3: Check activity.ts has log.warn for backend reporting (not log.debug)
echo "📋 Test 3: Activity Backend Reporting uses log.warn"
if grep -A2 "failed to report activity start" repos/metabob-opencode/packages/opencode/src/tool/activity.ts | grep -q "log.warn"; then
  echo "✅ PASS: Activity reporting failures use log.warn (not log.debug)"
  ((PASS++))
else
  echo "❌ FAIL: Activity reporting doesn't use log.warn"
  ((FAIL++))
fi
echo ""

# Test 4: Check impulse-create.ts has log.error for backend sync (not log.warn)
echo "📋 Test 4: Impulse Backend Sync uses log.error"
if grep -A2 "failed to sync impulse to backend" repos/metabob-opencode/packages/opencode/src/tool/impulse-create.ts | grep -q "log.error"; then
  echo "✅ PASS: Impulse sync failures use log.error (not log.warn)"
  ((PASS++))
else
  echo "❌ FAIL: Impulse sync doesn't use log.error"
  ((FAIL++))
fi
echo ""

# Test 5: Check template-loader.ts has strictBackend option
echo "📋 Test 5: Template Loader has strictBackend Option"
if grep -q "strictBackend" repos/metabob-opencode/packages/opencode/src/session/template-loader.ts; then
  echo "✅ PASS: strictBackend option found in TemplateLoader"
  ((PASS++))
else
  echo "❌ FAIL: strictBackend option not found"
  ((FAIL++))
fi
echo ""

# Test 6: Check template-loader.ts enforces strictBackend with error throwing
echo "📋 Test 6: Template Loader Enforces strictBackend"
if grep -A5 "strictBackend" repos/metabob-opencode/packages/opencode/src/session/template-loader.ts | grep -q "throw new Error"; then
  echo "✅ PASS: strictBackend enforcement logic found (throws errors)"
  ((PASS++))
else
  echo "❌ FAIL: strictBackend enforcement not found"
  ((FAIL++))
fi
echo ""

# Summary
TOTAL=$((PASS + FAIL))
PASS_RATE=$(echo "scale=1; $PASS * 100 / $TOTAL" | bc)

echo "================================================================================"
echo "📊 Validation Summary"
echo "================================================================================"
echo "Total Tests: $TOTAL"
echo "Passed: $PASS ✅"
echo "Failed: $FAIL ❌"
echo "Pass Rate: ${PASS_RATE}%"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "🎯 Overall Result: ✅ PASS"
  exit 0
else
  echo "🎯 Overall Result: ❌ FAIL"
  exit 1
fi
