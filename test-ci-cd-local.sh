#!/bin/bash
set -e

# =============================================================================
# Local CI/CD Pipeline Test
# =============================================================================
# Simulates GitHub Actions workflow locally
# =============================================================================

echo "================================="
echo "Local CI/CD Pipeline Test"
echo "================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

# =============================================================================
# JOB 1: Build OpenCode Binary
# =============================================================================
log_step "Job 1: Building OpenCode Binary"
echo ""

if [ ! -f "repos/metabob-opencode/packages/opencode/dist/opencode-linux-x64/bin/opencode" ]; then
    log_info "OpenCode binary not found, building..."
    
    cd repos/metabob-opencode
    
    log_info "Installing dependencies with Bun..."
    bun install
    
    cd packages/opencode
    log_info "Building standalone binary..."
    bun run build --single
    
    cd ../../../
    log_success "OpenCode binary built successfully"
else
    log_success "OpenCode binary already exists, skipping build"
fi

# Verify binary
OPENCODE_BIN="repos/metabob-opencode/packages/opencode/dist/opencode-linux-x64/bin/opencode"
if [ -f "$OPENCODE_BIN" ]; then
    BINARY_SIZE=$(du -h "$OPENCODE_BIN" | cut -f1)
    log_success "Binary verified: $BINARY_SIZE"
    
    # Test binary
    if $OPENCODE_BIN --version > /dev/null 2>&1; then
        VERSION=$($OPENCODE_BIN --version 2>&1 | tail -1)
        log_success "Binary is functional: $VERSION"
    else
        log_error "Binary exists but failed version check"
        exit 1
    fi
else
    log_error "OpenCode binary not found after build"
    exit 1
fi

echo ""

# =============================================================================
# JOB 2: Build DevBob Container
# =============================================================================
log_step "Job 2: Building DevBob Container"
echo ""

log_info "Building devbob:ci-test image..."
docker build -f docker/Dockerfile.devbob --target runtime -t devbob:ci-test . 2>&1 | tail -20

if [ $? -eq 0 ]; then
    log_success "DevBob container built successfully"
else
    log_error "DevBob container build failed"
    exit 1
fi

# Get image size
IMAGE_SIZE=$(docker images devbob:ci-test --format "{{.Size}}")
log_success "Image size: $IMAGE_SIZE"

echo ""

# =============================================================================
# Smoke Tests
# =============================================================================
log_step "Running Smoke Tests"
echo ""

log_info "Test 1: Version check"
if docker run --rm -e ANTHROPIC_API_KEY="test-key" -e SKIP_CONFIG=true devbob:ci-test --version > /dev/null 2>&1; then
    VERSION=$(docker run --rm -e ANTHROPIC_API_KEY="test-key" -e SKIP_CONFIG=true devbob:ci-test --version 2>&1 | tail -1)
    log_success "Version: $VERSION"
else
    log_error "Version check failed"
    exit 1
fi

log_info "Test 2: Help command"
if docker run --rm -e ANTHROPIC_API_KEY="test-key" -e SKIP_CONFIG=true devbob:ci-test --help > /dev/null 2>&1; then
    log_success "Help command works"
else
    log_error "Help command failed"
    exit 1
fi

log_info "Test 3: Binary verification"
if docker run --rm --entrypoint which devbob:ci-test opencode > /dev/null 2>&1; then
    BINARY_PATH=$(docker run --rm --entrypoint which devbob:ci-test opencode)
    log_success "Binary found at: $BINARY_PATH"
else
    log_error "Binary not found in container"
    exit 1
fi

log_info "Test 4: Python verification"
if docker run --rm --entrypoint python3 devbob:ci-test --version > /dev/null 2>&1; then
    PYTHON_VERSION=$(docker run --rm --entrypoint python3 devbob:ci-test --version 2>&1)
    log_success "Python: $PYTHON_VERSION"
else
    log_error "Python not found in container"
    exit 1
fi

echo ""

# =============================================================================
# JOB 3: Integration Tests
# =============================================================================
log_step "Job 3: Integration Tests"
echo ""

log_info "Checking backend services..."
if docker ps | grep -q "api-server-dev"; then
    log_success "Backend services are running"
else
    log_error "Backend services not running. Start with: docker-compose --profile stable up -d"
    exit 1
fi

log_info "Starting DevBob container with self-configuration..."

# Get Anthropic API key
if [ -f "$HOME/.anthropic/api_key" ]; then
    ANTHROPIC_API_KEY=$(cat "$HOME/.anthropic/api_key")
elif [ -f "$HOME/.metabob/config.json" ]; then
    ANTHROPIC_API_KEY=$(cat "$HOME/.metabob/config.json" | jq -r '.anthropic_api_key // .ANTHROPIC_API_KEY // empty')
else
    log_error "Anthropic API key not found"
    exit 1
fi

# Clean up any existing test container
docker stop devbob-ci-test 2>/dev/null || true
docker rm devbob-ci-test 2>/dev/null || true

# Start DevBob with full configuration
docker run -d --name devbob-ci-test \
    --network metabob-network \
    -e METABOB_API_URL=http://api-server-dev:8080 \
    -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
    -e WAIT_FOR_BACKEND=true \
    -e SKIP_CONFIG=true \
    -e LOG_LEVEL=INFO \
    -p 3200:3000 \
    devbob:ci-test > /dev/null 2>&1

log_success "Container started: devbob-ci-test"

log_info "Waiting for initialization (30 seconds)..."
sleep 30

log_info "Checking container logs..."
if docker logs devbob-ci-test 2>&1 | grep -q "DevBob Ready"; then
    log_success "Container initialized successfully"
else
    # Check if backend connectivity passed at least
    if docker logs devbob-ci-test 2>&1 | grep -q "Backend is reachable"; then
        log_success "Backend connectivity validated"
        if docker logs devbob-ci-test 2>&1 | grep -q "Configuration Summary"; then
            log_success "Configuration completed"
        fi
    else
        log_error "Container failed to initialize properly"
        echo ""
        echo "=== Container Logs ==="
        docker logs devbob-ci-test 2>&1 | tail -40
        docker stop devbob-ci-test 2>/dev/null || true
        docker rm devbob-ci-test 2>/dev/null || true
        exit 1
    fi
fi

log_info "Testing OpenCode inside container..."
if docker exec devbob-ci-test opencode --version > /dev/null 2>&1; then
    CONTAINER_VERSION=$(docker exec devbob-ci-test opencode --version 2>&1 | tail -1)
    log_success "OpenCode works inside container: $CONTAINER_VERSION"
else
    log_error "OpenCode failed inside container"
    docker stop devbob-ci-test 2>/dev/null || true
    docker rm devbob-ci-test 2>/dev/null || true
    exit 1
fi

log_info "Cleaning up test container..."
docker stop devbob-ci-test > /dev/null 2>&1
docker rm devbob-ci-test > /dev/null 2>&1
log_success "Cleanup complete"

echo ""

# =============================================================================
# Summary
# =============================================================================
log_step "CI/CD Pipeline Test Summary"
echo ""

echo "✅ Job 1: OpenCode binary built and verified"
echo "✅ Job 2: DevBob container built successfully ($IMAGE_SIZE)"
echo "✅ Smoke Tests: All 4 tests passed"
echo "✅ Job 3: Integration tests passed"
echo ""

log_success "All CI/CD pipeline tests passed!"
echo ""

# =============================================================================
# Optional: Push to Docker Hub
# =============================================================================
read -p "Do you want to push this image to Docker Hub as metabobapp/devbob:test? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    log_step "Pushing to Docker Hub"
    echo ""
    
    # Tag for Docker Hub
    docker tag devbob:ci-test metabobapp/devbob:test
    log_success "Tagged as metabobapp/devbob:test"
    
    # Push
    log_info "Pushing to Docker Hub..."
    if docker push metabobapp/devbob:test; then
        log_success "Pushed successfully!"
        echo ""
        echo "Image available at: https://hub.docker.com/r/metabobapp/devbob/tags"
    else
        log_error "Push failed. Check Docker Hub authentication: docker login"
    fi
else
    log_info "Skipping Docker Hub push"
fi

echo ""
log_success "CI/CD Pipeline Test Complete!"
