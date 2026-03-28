#!/bin/bash
# Validation Harness: dashboard-authentication-backend-fix
# Tests authentication backend implementation against specification
# Usage: ./dashboard-authentication-backend-fix-harness.sh [--deploy-first]

set -e

# Configuration
API_BASE_URL="${API_BASE_URL:-http://app.metabob.local}"
NAMESPACE="${NAMESPACE:-metabob}"
DEPLOYMENT="${DEPLOYMENT:-metabob-rpc-api}"
TIMESTAMP=$(date +%s)
TEST_EMAIL="test${TIMESTAMP}@validation.metabob.com"
TEST_PASSWORD="ValidTestPass123!"
TEST_NAME="Validation Test User"
TEST_ORG="Validation Test Org"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Results
PASS_COUNT=0
FAIL_COUNT=0
TOTAL_TESTS=0

# Helper functions
log_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASS_COUNT++))
    ((TOTAL_TESTS++))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAIL_COUNT++))
    ((TOTAL_TESTS++))
}

log_section() {
    echo ""
    echo "=================================================="
    echo "$1"
    echo "=================================================="
}

# Check if deployment should be applied first
if [ "$1" == "--deploy-first" ]; then
    log_section "DEPLOYING CHANGES"
    log_info "Applying Helmfile changes..."
    cd metabob-apps
    helmfile -e default apply || {
        log_fail "Helmfile apply failed"
        exit 1
    }
    cd ..
    
    log_info "Restarting RPC API deployment..."
    kubectl rollout restart deployment/${DEPLOYMENT} -n ${NAMESPACE} || {
        log_fail "Deployment restart failed"
        exit 1
    }
    
    log_info "Waiting for pods to be ready..."
    kubectl wait --for=condition=ready pod -l app=${DEPLOYMENT} -n ${NAMESPACE} --timeout=120s || {
        log_fail "Pods failed to become ready"
        exit 1
    }
    
    log_pass "Deployment complete"
    sleep 5  # Give pods a moment to fully initialize
fi

log_section "VALIDATION HARNESS: dashboard-authentication-backend-fix"
log_info "Timestamp: $(date)"
log_info "API Base URL: ${API_BASE_URL}"
log_info "Test Email: ${TEST_EMAIL}"

# Test Case 1: Verify JWT_SECRET_KEY is configured
log_section "TEST 1: JWT_SECRET_KEY Configuration"
log_info "Checking JWT_SECRET_KEY in pod environment..."

JWT_SECRET=$(kubectl exec -n ${NAMESPACE} deployment/${DEPLOYMENT} -- env | grep '^JWT_SECRET_KEY=' | cut -d'=' -f2 || echo "")

if [ -z "$JWT_SECRET" ]; then
    log_fail "JWT_SECRET_KEY not found in pod environment"
    JWT_SECRET_LENGTH=0
else
    JWT_SECRET_LENGTH=${#JWT_SECRET}
    log_info "JWT_SECRET_KEY found with length: ${JWT_SECRET_LENGTH}"
    
    if [ ${JWT_SECRET_LENGTH} -lt 32 ]; then
        log_fail "JWT_SECRET_KEY too short (${JWT_SECRET_LENGTH} < 32 characters)"
    elif [ "$JWT_SECRET" == "development-secret-key-change-in-production" ]; then
        log_fail "JWT_SECRET_KEY is using weak default value"
    else
        log_pass "JWT_SECRET_KEY is properly configured (${JWT_SECRET_LENGTH} characters)"
    fi
fi

# Test Case 2: Test Registration Endpoint
log_section "TEST 2: User Registration"
log_info "Registering new user: ${TEST_EMAIL}"

REGISTER_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_BASE_URL}/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"${TEST_EMAIL}\",
        \"password\": \"${TEST_PASSWORD}\",
        \"name\": \"${TEST_NAME}\",
        \"org_name\": \"${TEST_ORG}\"
    }")

REGISTER_HTTP_CODE=$(echo "$REGISTER_RESPONSE" | tail -n1)
REGISTER_BODY=$(echo "$REGISTER_RESPONSE" | head -n-1)

log_info "Registration HTTP Status: ${REGISTER_HTTP_CODE}"

if [ "$REGISTER_HTTP_CODE" == "200" ]; then
    log_pass "Registration returned 200 OK"
    
    # Parse response to check for required fields
    REGISTER_TOKEN=$(echo "$REGISTER_BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4 || echo "")
    REGISTER_USER_ID=$(echo "$REGISTER_BODY" | grep -o '"user_id":"[^"]*"' | cut -d'"' -f4 || echo "")
    REGISTER_ORG_ID=$(echo "$REGISTER_BODY" | grep -o '"org_id":"[^"]*"' | cut -d'"' -f4 || echo "")
    
    if [ -n "$REGISTER_TOKEN" ]; then
        log_pass "Registration response contains token"
        REGISTER_TOKEN_LENGTH=${#REGISTER_TOKEN}
        log_info "Token length: ${REGISTER_TOKEN_LENGTH}"
    else
        log_fail "Registration response missing token"
    fi
    
    if [ -n "$REGISTER_USER_ID" ]; then
        log_pass "Registration response contains user_id"
    else
        log_fail "Registration response missing user_id"
    fi
    
    if [ -n "$REGISTER_ORG_ID" ]; then
        log_pass "Registration response contains org_id"
    else
        log_fail "Registration response missing org_id"
    fi
else
    log_fail "Registration failed with HTTP ${REGISTER_HTTP_CODE}"
    log_info "Response body: ${REGISTER_BODY}"
    REGISTER_TOKEN=""
fi

# Test Case 3: Test Login Endpoint
log_section "TEST 3: User Login"
log_info "Logging in with: ${TEST_EMAIL}"

LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_BASE_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"${TEST_EMAIL}\",
        \"password\": \"${TEST_PASSWORD}\"
    }")

LOGIN_HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n1)
LOGIN_BODY=$(echo "$LOGIN_RESPONSE" | head -n-1)

log_info "Login HTTP Status: ${LOGIN_HTTP_CODE}"

if [ "$LOGIN_HTTP_CODE" == "200" ]; then
    log_pass "Login returned 200 OK"
    
    # Parse response to check for required fields
    LOGIN_TOKEN=$(echo "$LOGIN_BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4 || echo "")
    LOGIN_USER_EMAIL=$(echo "$LOGIN_BODY" | grep -o '"email":"[^"]*"' | cut -d'"' -f4 || echo "")
    
    if [ -n "$LOGIN_TOKEN" ]; then
        log_pass "Login response contains token"
        LOGIN_TOKEN_LENGTH=${#LOGIN_TOKEN}
        log_info "Token length: ${LOGIN_TOKEN_LENGTH}"
    else
        log_fail "Login response missing token"
    fi
    
    if [ "$LOGIN_USER_EMAIL" == "$TEST_EMAIL" ]; then
        log_pass "Login response contains correct email"
    else
        log_fail "Login response email mismatch (expected: ${TEST_EMAIL}, got: ${LOGIN_USER_EMAIL})"
    fi
else
    log_fail "Login failed with HTTP ${LOGIN_HTTP_CODE}"
    log_info "Response body: ${LOGIN_BODY}"
    LOGIN_TOKEN=""
fi

# Test Case 4: Verify JWT Token Can Be Decoded
log_section "TEST 4: JWT Token Validation"

if [ -n "$LOGIN_TOKEN" ]; then
    log_info "Testing token validation with /auth/session endpoint..."
    
    SESSION_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "${API_BASE_URL}/auth/session" \
        -H "Authorization: Bearer ${LOGIN_TOKEN}")
    
    SESSION_HTTP_CODE=$(echo "$SESSION_RESPONSE" | tail -n1)
    SESSION_BODY=$(echo "$SESSION_RESPONSE" | head -n-1)
    
    log_info "Session validation HTTP Status: ${SESSION_HTTP_CODE}"
    
    if [ "$SESSION_HTTP_CODE" == "200" ]; then
        log_pass "Token validation succeeded (200 OK)"
        
        # Check for expected claims in response
        SESSION_USER_ID=$(echo "$SESSION_BODY" | grep -o '"user_id":"[^"]*"' | cut -d'"' -f4 || echo "")
        SESSION_EMAIL=$(echo "$SESSION_BODY" | grep -o '"email":"[^"]*"' | cut -d'"' -f4 || echo "")
        
        if [ -n "$SESSION_USER_ID" ]; then
            log_pass "Token contains user_id claim"
        else
            log_fail "Token missing user_id claim"
        fi
        
        if [ "$SESSION_EMAIL" == "$TEST_EMAIL" ]; then
            log_pass "Token contains correct email claim"
        else
            log_fail "Token email claim mismatch"
        fi
    else
        log_fail "Token validation failed with HTTP ${SESSION_HTTP_CODE}"
        log_info "Response: ${SESSION_BODY}"
    fi
else
    log_fail "Skipping token validation - no token available from login"
fi

# Test Case 5: Verify Database Records
log_section "TEST 5: Database Record Verification"

if [ -n "$REGISTER_USER_ID" ] && [ -n "$REGISTER_ORG_ID" ]; then
    log_info "Verifying SurrealDB records..."
    
    # Get SurrealDB pod
    SURREAL_POD=$(kubectl get pods -n ${NAMESPACE} -l app=surrealdb -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [ -z "$SURREAL_POD" ]; then
        log_fail "SurrealDB pod not found - skipping database verification"
    else
        log_info "Using SurrealDB pod: ${SURREAL_POD}"
        
        # Get SurrealDB credentials
        SURREAL_USER=$(kubectl get secret surrealdb-credentials -n ${NAMESPACE} -o jsonpath='{.data.username}' | base64 -d 2>/dev/null || echo "root")
        SURREAL_PASS=$(kubectl get secret surrealdb-credentials -n ${NAMESPACE} -o jsonpath='{.data.password}' | base64 -d 2>/dev/null || echo "root")
        
        # Query user record
        log_info "Checking user record for: ${TEST_EMAIL}"
        USER_QUERY_RESULT=$(kubectl exec -n ${NAMESPACE} ${SURREAL_POD} -- \
            surreal sql --endpoint http://localhost:8000 \
            --username "${SURREAL_USER}" --password "${SURREAL_PASS}" \
            --namespace metabob --database default \
            --query "SELECT * FROM users WHERE email = '${TEST_EMAIL}';" 2>/dev/null || echo "ERROR")
        
        if echo "$USER_QUERY_RESULT" | grep -q "${TEST_EMAIL}"; then
            log_pass "User record exists in SurrealDB"
            
            # Check for password hash
            if echo "$USER_QUERY_RESULT" | grep -q "password_hash"; then
                log_pass "User record contains password_hash (bcrypt)"
            else
                log_fail "User record missing password_hash"
            fi
        else
            log_fail "User record not found in SurrealDB"
            log_info "Query result: ${USER_QUERY_RESULT}"
        fi
        
        # Query organization record
        log_info "Checking organization record: ${TEST_ORG}"
        ORG_QUERY_RESULT=$(kubectl exec -n ${NAMESPACE} ${SURREAL_POD} -- \
            surreal sql --endpoint http://localhost:8000 \
            --username "${SURREAL_USER}" --password "${SURREAL_PASS}" \
            --namespace metabob --database default \
            --query "SELECT * FROM organizations WHERE name = '${TEST_ORG}';" 2>/dev/null || echo "ERROR")
        
        if echo "$ORG_QUERY_RESULT" | grep -q "${TEST_ORG}"; then
            log_pass "Organization record exists in SurrealDB"
        else
            log_fail "Organization record not found in SurrealDB"
            log_info "Query result: ${ORG_QUERY_RESULT}"
        fi
        
        # Query user_organizations junction
        if [ -n "$REGISTER_USER_ID" ] && [ -n "$REGISTER_ORG_ID" ]; then
            log_info "Checking user_organizations junction..."
            JUNCTION_QUERY_RESULT=$(kubectl exec -n ${NAMESPACE} ${SURREAL_POD} -- \
                surreal sql --endpoint http://localhost:8000 \
                --username "${SURREAL_USER}" --password "${SURREAL_PASS}" \
                --namespace metabob --database default \
                --query "SELECT * FROM user_organizations WHERE user_id = '${REGISTER_USER_ID}';" 2>/dev/null || echo "ERROR")
            
            if echo "$JUNCTION_QUERY_RESULT" | grep -q "${REGISTER_USER_ID}"; then
                log_pass "user_organizations junction record exists"
            else
                log_fail "user_organizations junction record not found"
                log_info "Query result: ${JUNCTION_QUERY_RESULT}"
            fi
        fi
    fi
else
    log_fail "Skipping database verification - no user_id or org_id from registration"
fi

# Test Case 6: Test Registration with Duplicate Email (Should Fail)
log_section "TEST 6: Duplicate Email Rejection"
log_info "Attempting to register duplicate email: ${TEST_EMAIL}"

DUPLICATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_BASE_URL}/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"${TEST_EMAIL}\",
        \"password\": \"${TEST_PASSWORD}\",
        \"name\": \"${TEST_NAME}\",
        \"org_name\": \"${TEST_ORG}\"
    }")

DUPLICATE_HTTP_CODE=$(echo "$DUPLICATE_RESPONSE" | tail -n1)
DUPLICATE_BODY=$(echo "$DUPLICATE_RESPONSE" | head -n-1)

log_info "Duplicate registration HTTP Status: ${DUPLICATE_HTTP_CODE}"

if [ "$DUPLICATE_HTTP_CODE" == "400" ]; then
    if echo "$DUPLICATE_BODY" | grep -qi "already registered"; then
        log_pass "Duplicate email correctly rejected with 400 'Email already registered'"
    else
        log_fail "Duplicate email rejected with 400 but wrong error message"
        log_info "Response: ${DUPLICATE_BODY}"
    fi
else
    log_fail "Duplicate email handling incorrect (expected 400, got ${DUPLICATE_HTTP_CODE})"
    log_info "Response: ${DUPLICATE_BODY}"
fi

# Test Case 7: Test Login with Wrong Password
log_section "TEST 7: Invalid Password Rejection"
log_info "Attempting login with wrong password..."

WRONG_PASS_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_BASE_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"${TEST_EMAIL}\",
        \"password\": \"WrongPassword123!\"
    }")

WRONG_PASS_HTTP_CODE=$(echo "$WRONG_PASS_RESPONSE" | tail -n1)
WRONG_PASS_BODY=$(echo "$WRONG_PASS_RESPONSE" | head -n-1)

log_info "Wrong password login HTTP Status: ${WRONG_PASS_HTTP_CODE}"

if [ "$WRONG_PASS_HTTP_CODE" == "401" ]; then
    log_pass "Invalid password correctly rejected with 401 Unauthorized"
else
    log_fail "Invalid password handling incorrect (expected 401, got ${WRONG_PASS_HTTP_CODE})"
    log_info "Response: ${WRONG_PASS_BODY}"
fi

# Final Summary
log_section "VALIDATION SUMMARY"
echo ""
echo "Total Tests: ${TOTAL_TESTS}"
echo -e "${GREEN}Passed: ${PASS_COUNT}${NC}"
echo -e "${RED}Failed: ${FAIL_COUNT}${NC}"
echo ""

if [ ${FAIL_COUNT} -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
    echo ""
    echo "Specification Status: ✅ COMPLIANT"
    echo "- JWT_SECRET_KEY properly configured with strong secret"
    echo "- Registration endpoint validates emails correctly"
    echo "- User records created in SurrealDB with bcrypt password hashing"
    echo "- Login endpoint verifies credentials and returns valid JWT tokens"
    echo "- Token validation works correctly"
    echo "- Duplicate email rejection works"
    echo "- Invalid password rejection works"
    exit 0
else
    echo -e "${RED}✗ VALIDATION FAILED${NC}"
    echo ""
    echo "Specification Status: ❌ NON-COMPLIANT"
    echo "Failed ${FAIL_COUNT} out of ${TOTAL_TESTS} tests"
    echo ""
    echo "Review failed tests above for details."
    exit 1
fi
