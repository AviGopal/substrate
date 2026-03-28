#!/bin/bash
#
# Validation Harness: ACP Local Network Discovery and Cross-Vessel Activity Coordination
# 
# Tests the implementation of multi-transport ACP delegation and cross-vessel coordination.
#
# Test Phases:
# - Phase 1: Transport Abstraction (docker://, tcp://, auto targets)
# - Phase 2: Network Server (HTTP/TCP listener - NOT YET IMPLEMENTED)
# - Phase 3: Discovery (mDNS peer discovery - NOT YET IMPLEMENTED)
# - Phase 4: Coordination (cross-vessel activity tracking - PARTIAL)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
SKIPPED=0

echo -e "${BLUE}🧪 ACP Local Network Discovery Validation Harness${NC}"
echo "============================================================"

# Test 1: Transport interface exists
echo -e "\n${BLUE}📦 Phase 1: Transport Abstraction${NC}"
echo -n "  → Testing transport interface... "
if [ -f "repos/metabob-opencode/packages/opencode/src/acp/transports/transport.ts" ]; then
  if grep -q "export interface Transport" "repos/metabob-opencode/packages/opencode/src/acp/transports/transport.ts" && \
     grep -q "export interface TransportConfig" "repos/metabob-opencode/packages/opencode/src/acp/transports/transport.ts" && \
     grep -q "export function parseTarget" "repos/metabob-opencode/packages/opencode/src/acp/transports/transport.ts"; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌ FAIL${NC} - Missing required exports"
    ((FAILED++))
  fi
else
  echo -e "${RED}❌ FAIL${NC} - File not found"
  ((FAILED++))
fi

# Test 2: Docker transport implementation exists
echo -n "  → Testing Docker transport... "
if [ -f "repos/metabob-opencode/packages/opencode/src/acp/transports/docker-transport.ts" ]; then
  if grep -q "export class DockerTransport" "repos/metabob-opencode/packages/opencode/src/acp/transports/docker-transport.ts" && \
     grep -q "implements Transport" "repos/metabob-opencode/packages/opencode/src/acp/transports/docker-transport.ts"; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌ FAIL${NC} - Missing DockerTransport class"
    ((FAILED++))
  fi
else
  echo -e "${RED}❌ FAIL${NC} - File not found"
  ((FAILED++))
fi

# Test 3: TCP transport stub exists
echo -n "  → Testing TCP transport stub... "
if [ -f "repos/metabob-opencode/packages/opencode/src/acp/transports/tcp-transport.ts" ]; then
  if grep -q "export class TCPTransport" "repos/metabob-opencode/packages/opencode/src/acp/transports/tcp-transport.ts" && \
     grep -q "Phase 2" "repos/metabob-opencode/packages/opencode/src/acp/transports/tcp-transport.ts"; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌ FAIL${NC} - Stub not properly implemented"
    ((FAILED++))
  fi
else
  echo -e "${RED}❌ FAIL${NC} - File not found"
  ((FAILED++))
fi

# Test 4: Discovery transport stub exists
echo -n "  → Testing discovery transport stub... "
if [ -f "repos/metabob-opencode/packages/opencode/src/acp/transports/discovery-transport.ts" ]; then
  if grep -q "export class DiscoveryTransport" "repos/metabob-opencode/packages/opencode/src/acp/transports/discovery-transport.ts" && \
     grep -q "Phase 3" "repos/metabob-opencode/packages/opencode/src/acp/transports/discovery-transport.ts"; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌ FAIL${NC} - Stub not properly implemented"
    ((FAILED++))
  fi
else
  echo -e "${RED}❌ FAIL${NC} - File not found"
  ((FAILED++))
fi

# Test 5: Transport factory exists
echo -n "  → Testing transport factory... "
if [ -f "repos/metabob-opencode/packages/opencode/src/acp/transports/factory.ts" ]; then
  if grep -q "export function createTransport" "repos/metabob-opencode/packages/opencode/src/acp/transports/factory.ts" && \
     grep -q "DockerTransport" "repos/metabob-opencode/packages/opencode/src/acp/transports/factory.ts"; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌ FAIL${NC} - Factory not properly implemented"
    ((FAILED++))
  fi
else
  echo -e "${RED}❌ FAIL${NC} - File not found"
  ((FAILED++))
fi

# Test 6: ACP delegate refactored
echo -n "  → Testing ACP delegate refactoring... "
if [ -f "repos/metabob-opencode/packages/opencode/src/tool/acp-delegate.ts" ]; then
  if grep -q "import { createTransport }" "repos/metabob-opencode/packages/opencode/src/tool/acp-delegate.ts" && \
     grep -q "transport = createTransport" "repos/metabob-opencode/packages/opencode/src/tool/acp-delegate.ts" && \
     grep -q "transport.close()" "repos/metabob-opencode/packages/opencode/src/tool/acp-delegate.ts"; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌ FAIL${NC} - Not properly refactored"
    ((FAILED++))
  fi
else
  echo -e "${RED}❌ FAIL${NC} - File not found"
  ((FAILED++))
fi

# Phase 2: Network Server (SKIPPED)
echo -e "\n${BLUE}🌐 Phase 2: Network Server (SKIPPED - Not Implemented)${NC}"
echo -e "  ${YELLOW}⏭️  Network server with HTTP/TCP listener not yet implemented${NC}"
((SKIPPED++))

# Phase 3: Discovery (SKIPPED)
echo -e "\n${BLUE}🔍 Phase 3: Discovery (SKIPPED - Not Implemented)${NC}"
echo -e "  ${YELLOW}⏭️  mDNS discovery service not yet implemented${NC}"
((SKIPPED++))

# Phase 4: Coordination Schema Tests
echo -e "\n${BLUE}🤝 Phase 4: Activity Coordination${NC}"

# Test 7: Coordination schema exists
echo -n "  → Testing coordination schema... "
if [ -f "repos/metabob-opencode/packages/opencode/src/session/activity-coordination.ts" ]; then
  if grep -q "export interface CrossVesselDelegation" "repos/metabob-opencode/packages/opencode/src/session/activity-coordination.ts" && \
     grep -q "export interface DelegationChain" "repos/metabob-opencode/packages/opencode/src/session/activity-coordination.ts"; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌ FAIL${NC} - Missing required interfaces"
    ((FAILED++))
  fi
else
  echo -e "${RED}❌ FAIL${NC} - File not found"
  ((FAILED++))
fi

# Test 8: Coordination API methods exist
echo -n "  → Testing coordination API... "
if [ -f "repos/metabob-opencode/packages/opencode/src/session/activity-coordination.ts" ]; then
  if grep -q "static async saveDelegation" "repos/metabob-opencode/packages/opencode/src/session/activity-coordination.ts" && \
     grep -q "static async queryActivities" "repos/metabob-opencode/packages/opencode/src/session/activity-coordination.ts" && \
     grep -q "static async getActivityChain" "repos/metabob-opencode/packages/opencode/src/session/activity-coordination.ts"; then
    echo -e "${GREEN}✅ PASS${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌ FAIL${NC} - Missing required methods"
    ((FAILED++))
  fi
else
  echo -e "${RED}❌ FAIL${NC} - File not found"
  ((FAILED++))
fi

# Summary
TOTAL=$((PASSED + FAILED + SKIPPED))
echo ""
echo "============================================================"
echo -e "${BLUE}📊 Summary: ${PASSED}/${TOTAL} tests passed${NC}"
echo -e "   ${GREEN}✅ Passed: ${PASSED}${NC}"
echo -e "   ${RED}❌ Failed: ${FAILED}${NC}"
echo -e "   ${YELLOW}⏭️  Skipped: ${SKIPPED}${NC}"

if [ $FAILED -eq 0 ]; then
  echo -e "\n${GREEN}✨ All tests passed!${NC}"
  exit 0
else
  echo -e "\n${RED}⚠️  Some tests failed${NC}"
  exit 1
fi
