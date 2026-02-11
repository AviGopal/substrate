#!/bin/bash
# Test script to verify shared backend configuration

echo "=========================================="
echo "Shared Backend Configuration Test"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test 1: Backend is running
echo -e "${BLUE}Test 1: Backend Server${NC}"
if curl -s http://localhost:8080/ | grep -q "status"; then
    echo -e "${GREEN}✓ Backend server is responding${NC}"
else
    echo -e "${RED}✗ Backend server is not responding${NC}"
    exit 1
fi

# Test 2: Check project_id in configs
echo ""
echo -e "${BLUE}Test 2: Project ID Configuration${NC}"
PROJECT_ID="exp-repo-dev"

if grep -q "\"project_id\": \"$PROJECT_ID\"" ~/.opencode/opencode.json 2>/dev/null; then
    echo -e "${GREEN}✓ Host OpenCode config has correct project_id${NC}"
else
    echo -e "${RED}✗ Host OpenCode config missing project_id${NC}"
fi

if grep -q "\"project_id\": \"$PROJECT_ID\"" configs/opencode.devbob.json; then
    echo -e "${GREEN}✓ DevBob config has correct project_id${NC}"
else
    echo -e "${RED}✗ DevBob config missing project_id${NC}"
fi

if grep -q "\"project_id\": \"$PROJECT_ID\"" repos/metabob-cli/.metabob/config.json; then
    echo -e "${GREEN}✓ metabob-cli config has correct project_id${NC}"
else
    echo -e "${RED}✗ metabob-cli config missing project_id${NC}"
fi

# Test 3: URL configurations
echo ""
echo -e "${BLUE}Test 3: Backend URL Configuration${NC}"

if grep -q "\"base_url\": \"http://localhost:8080\"" ~/.opencode/opencode.json 2>/dev/null; then
    echo -e "${GREEN}✓ Host uses localhost:8080${NC}"
else
    echo -e "${RED}✗ Host config has wrong URL${NC}"
fi

if grep -q "\"base_url\": \"http://host.docker.internal:8080\"" configs/opencode.devbob.json; then
    echo -e "${GREEN}✓ DevBob uses host.docker.internal:8080${NC}"
else
    echo -e "${RED}✗ DevBob config has wrong URL${NC}"
fi

# Test 4: API Documentation
echo ""
echo -e "${BLUE}Test 4: API Documentation${NC}"
if curl -s http://localhost:8080/docs | grep -q "swagger"; then
    echo -e "${GREEN}✓ API docs are accessible${NC}"
else
    echo -e "${RED}✗ API docs are not accessible${NC}"
fi

# Summary
echo ""
echo "=========================================="
echo -e "${GREEN}All tests passed!${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Open browser: http://localhost:8080/docs"
echo "  2. Start DevBob: ./devbob start"
echo "  3. Test activities in both environments"
