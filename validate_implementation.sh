#!/bin/bash
# Internal validation of minibob self-configuration implementation

echo "=== Internal Code Validation ==="
echo ""

# Check 1: environment.ts exists and has required functions
echo "Check 1: Environment detection module exists"
if [ -f "repos/minibob/src/environment.ts" ]; then
  echo "✓ src/environment.ts exists"
  
  # Check for required functions
  grep -q "export.*function detectEnvironment" repos/minibob/src/environment.ts && echo "  ✓ detectEnvironment() present" || echo "  ✗ detectEnvironment() MISSING"
  grep -q "export.*function detectClusterMode" repos/minibob/src/environment.ts && echo "  ✓ detectClusterMode() present" || echo "  ✗ detectClusterMode() MISSING"
  grep -q "export.*function checkBackendHealth" repos/minibob/src/environment.ts && echo "  ✓ checkBackendHealth() present" || echo "  ✗ checkBackendHealth() MISSING"
  grep -q "export.*function detectCompleteEnvironment" repos/minibob/src/environment.ts && echo "  ✓ detectCompleteEnvironment() present" || echo "  ✗ detectCompleteEnvironment() MISSING"
  
  # Check for K8s detection
  grep -q "KUBERNETES_SERVICE_HOST" repos/minibob/src/environment.ts && echo "  ✓ K8s detection via KUBERNETES_SERVICE_HOST" || echo "  ✗ K8s detection MISSING"
  
  # Check for Docker detection
  grep -q "/.dockerenv" repos/minibob/src/environment.ts && echo "  ✓ Docker detection via /.dockerenv" || echo "  ✗ Docker detection MISSING"
  
  # Check for DNS lookup
  grep -q "dns.resolve4" repos/minibob/src/environment.ts && echo "  ✓ DNS-based peer counting" || echo "  ✗ DNS peer counting MISSING"
else
  echo "✗ src/environment.ts MISSING"
fi
echo ""

# Check 2: config.ts has RuntimeContext and dynamic manifest
echo "Check 2: Dynamic manifest generation"
if [ -f "repos/minibob/src/config.ts" ]; then
  grep -q "interface RuntimeContext" repos/minibob/src/config.ts && echo "  ✓ RuntimeContext interface defined" || echo "  ✗ RuntimeContext MISSING"
  grep -q "generateManifest.*runtime" repos/minibob/src/config.ts && echo "  ✓ generateManifest accepts runtime parameter" || echo "  ✗ generateManifest signature unchanged"
  grep -q "runtime?.acpGossipEnabled" repos/minibob/src/config.ts && echo "  ✓ Conditional acp-gossip capability" || echo "  ✗ Static capabilities only"
  grep -q "runtime?.boredomEnabled" repos/minibob/src/config.ts && echo "  ✓ Conditional boredom capability" || echo "  ✗ Static capabilities only"
else
  echo "✗ src/config.ts MISSING"
fi
echo ""

# Check 3: types.ts has metadata in VesselManifest
echo "Check 3: Manifest metadata support"
if [ -f "repos/minibob/src/types.ts" ]; then
  grep -q "metadata?" repos/minibob/src/types.ts && echo "  ✓ VesselManifest has optional metadata field" || echo "  ✗ metadata field MISSING"
else
  echo "✗ src/types.ts MISSING"
fi
echo ""

# Check 4: mcp.ts has async health check
echo "Check 4: MCP conditional initialization"
if [ -f "repos/minibob/src/mcp.ts" ]; then
  grep -q "async.*initializeMCP" repos/minibob/src/mcp.ts && echo "  ✓ initializeMCP is async" || echo "  ✗ initializeMCP still synchronous"
  grep -q "checkBackendHealth" repos/minibob/src/mcp.ts && echo "  ✓ Backend health check before init" || echo "  ✗ No health check"
  grep -q "Promise<MCPClient | null>" repos/minibob/src/mcp.ts && echo "  ✓ Returns null on backend unavailable" || echo "  ✗ Still returns MCPClient always"
else
  echo "✗ src/mcp.ts MISSING"
fi
echo ""

# Check 5: boredom.ts checks cluster mode
echo "Check 5: Boredom cluster mode gating"
if [ -f "repos/minibob/src/boredom.ts" ]; then
  grep -q "start.*clusterMode" repos/minibob/src/boredom.ts && echo "  ✓ start() accepts clusterMode parameter" || echo "  ✗ start() signature unchanged"
  grep -q "if (!clusterMode)" repos/minibob/src/boredom.ts && echo "  ✓ Checks cluster mode before starting" || echo "  ✗ No cluster mode check"
else
  echo "✗ src/boredom.ts MISSING"
fi
echo ""

# Check 6: index.ts orchestrates detection
echo "Check 6: Server initialization orchestration"
if [ -f "repos/minibob/index.ts" ]; then
  grep -q "detectCompleteEnvironment" repos/minibob/index.ts && echo "  ✓ Calls detectCompleteEnvironment" || echo "  ✗ No environment detection"
  grep -q "RuntimeContext" repos/minibob/index.ts && echo "  ✓ Builds RuntimeContext" || echo "  ✗ No runtime context"
  grep -q "await initializeMCP" repos/minibob/index.ts && echo "  ✓ Awaits async MCP init" || echo "  ✗ Still synchronous MCP init"
  grep -q "startBoredom.*cluster" repos/minibob/index.ts && echo "  ✓ Passes cluster mode to startBoredom" || echo "  ✗ Unconditional boredom start"
  grep -q "generateManifest.*runtime" repos/minibob/index.ts && echo "  ✓ Passes runtime to generateManifest" || echo "  ✗ Static manifest generation"
else
  echo "✗ index.ts MISSING"
fi
echo ""

echo "=== Compilation Test ==="
cd repos/minibob
bun build index.ts --target=node > /tmp/minibob_build.log 2>&1
if [ $? -eq 0 ]; then
  echo "✓ minibob compiles successfully"
else
  echo "✗ minibob compilation FAILED"
  echo "Build errors:"
  cat /tmp/minibob_build.log | head -20
fi
