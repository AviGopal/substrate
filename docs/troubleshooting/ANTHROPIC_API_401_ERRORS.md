# Troubleshooting Anthropic API 401 Errors

**Problem:** Getting 401 Unauthorized errors when using MiniBob or MiniBob-TUI

---

## Quick Diagnosis

### Step 1: Check API Key is Set

```bash
# Check environment variable
echo $ANTHROPIC_API_KEY

# Should output: sk-ant-...
# If empty, key is not set
```

### Step 2: Verify API Key Format

Valid Anthropic API keys:
- Start with `sk-ant-`
- Are exactly 108 characters long
- Example: `sk-ant-api03-abcd1234...`

```bash
# Check key length
echo -n $ANTHROPIC_API_KEY | wc -c
# Should output: 108

# Check key prefix
echo $ANTHROPIC_API_KEY | grep -o '^sk-ant-'
# Should output: sk-ant-
```

### Step 3: Test API Key Directly

```bash
# Test with curl
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 10,
    "messages": [{"role": "user", "content": "test"}]
  }'

# Expected: JSON response with message
# If 401: API key is invalid
```

---

## Common Causes & Fixes

### Cause 1: API Key Not Set

**Symptom:**
```
echo $ANTHROPIC_API_KEY
# (empty output)
```

**Fix:**
```bash
# Set for current session
export ANTHROPIC_API_KEY="sk-ant-your-key-here"

# Verify
echo $ANTHROPIC_API_KEY
```

**Permanent Fix:**
```bash
# Add to ~/.bashrc or ~/.zshrc
echo 'export ANTHROPIC_API_KEY="sk-ant-your-key-here"' >> ~/.bashrc
source ~/.bashrc
```

### Cause 2: Invalid or Expired Key

**Symptom:**
```bash
curl test returns:
{
  "error": {
    "type": "authentication_error",
    "message": "invalid x-api-key"
  }
}
```

**Fix:**
1. Go to https://console.anthropic.com/settings/keys
2. Delete old key
3. Create new key
4. Update environment variable

```bash
export ANTHROPIC_API_KEY="sk-ant-NEW-KEY-HERE"
```

### Cause 3: Key in Config File Not Loaded

MiniBob can load keys from `~/.metabob/config.json`, but environment variable takes precedence.

**Check config:**
```bash
cat ~/.metabob/config.json
```

**Expected:**
```json
{
  "providers": {
    "anthropic": {
      "apiKey": "sk-ant-your-key-here"
    }
  }
}
```

**Fix if missing:**
```bash
mkdir -p ~/.metabob
cat > ~/.metabob/config.json <<'EOF'
{
  "metabob": {
    "apiKey": "your-metabob-api-key",
    "endpoint": "https://activity.metabob.com"
  },
  "providers": {
    "anthropic": {
      "apiKey": "sk-ant-your-anthropic-key-here"
    }
  },
  "defaults": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514"
  }
}
EOF
```

### Cause 4: Wrong API Endpoint

**Symptom:**
MiniBob tries to use old endpoint or wrong URL.

**Check MiniBob config:**
```bash
cd repos/minibob
minibob /config
```

**Fix:**
Ensure using correct Anthropic endpoint: `https://api.anthropic.com/v1/messages`

### Cause 5: Rate Limiting

**Symptom:**
```json
{
  "error": {
    "type": "rate_limit_error",
    "message": "rate limit exceeded"
  }
}
```

**Fix:**
- Wait a few minutes
- Check usage at https://console.anthropic.com/settings/usage
- Consider upgrading plan

### Cause 6: Org/Workspace Issues

**Symptom:**
Key works in browser but not in CLI.

**Fix:**
1. Check which workspace/org the key belongs to
2. Ensure account has API access enabled
3. Try creating key in different workspace

---

## Testing Without Anthropic API

If you can't resolve Anthropic API issues, you can test MiniBob-TUI without the LLM:

### Option 1: Use Mock Mode (Development)

**Not implemented yet**, but could add a `--mock` flag that simulates activity execution.

### Option 2: Test Only Import Resolution

```bash
cd repos/minibob-tui

# This doesn't need API key
bun run /tmp/test-minibob-imports.ts
```

### Option 3: Use Different LLM Provider

MiniBob supports multiple providers. Try OpenAI:

```bash
# Install OpenAI SDK if not already
cd repos/minibob
bun add openai

# Set OpenAI key
export OPENAI_API_KEY="sk-..."

# Configure MiniBob to use OpenAI
cat > ~/.metabob/config.json <<'EOF'
{
  "providers": {
    "openai": {
      "apiKey": "sk-your-openai-key"
    }
  },
  "defaults": {
    "provider": "openai",
    "model": "gpt-4"
  }
}
EOF

# Test
minibob --single "echo 'test'"
```

---

## Detailed Debugging

### Enable Debug Logging

```bash
cd repos/minibob-tui

# Start with verbose logging
ANTHROPIC_API_KEY="sk-ant-..." bun run start --embedded --dev -vvv

# Watch for these lines:
# [LLM] Using API key: sk-ant-***...
# [LLM] Endpoint: https://api.anthropic.com/v1/messages
# [LLM] Model: claude-sonnet-4-20250514
```

### Check MiniBob LLM Client

```bash
cd repos/minibob

# Check LLM client code
cat src/llm.ts | grep -A 20 "class.*LLM"

# Verify it uses correct headers
grep -n "x-api-key" src/llm.ts
grep -n "anthropic-version" src/llm.ts
```

### Manual API Test Script

Create a test script to verify API access:

```bash
cat > /tmp/test-anthropic-api.ts <<'EOF'
#!/usr/bin/env bun

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.error("❌ ANTHROPIC_API_KEY not set");
  process.exit(1);
}

console.log("✓ API key found:", apiKey.substring(0, 12) + "...");
console.log("✓ API key length:", apiKey.length);

console.log("\nTesting Anthropic API...");

const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json"
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 10,
    messages: [{ role: "user", content: "Say 'test'" }]
  })
});

console.log("Status:", response.status);

if (response.status === 401) {
  console.error("\n❌ 401 Unauthorized - API key is invalid or expired");
  console.error("Go to: https://console.anthropic.com/settings/keys");
  process.exit(1);
}

if (response.status === 429) {
  console.error("\n❌ 429 Rate Limit - Too many requests");
  console.error("Wait a few minutes and try again");
  process.exit(1);
}

if (response.ok) {
  const data = await response.json();
  console.log("\n✅ API working!");
  console.log("Response:", JSON.stringify(data, null, 2));
} else {
  console.error("\n❌ Error:", response.status, response.statusText);
  const text = await response.text();
  console.error("Body:", text);
}
EOF

chmod +x /tmp/test-anthropic-api.ts
bun run /tmp/test-anthropic-api.ts
```

---

## Alternative: Use MiniBob Without LLM

For testing MiniBob-TUI functionality (not activity execution), you can verify the production package works without needing the Anthropic API:

### Test 1: Package Installation

```bash
cd repos/minibob-tui

# Check package is from registry
ls -la node_modules/@metabob/minibob

# Should be a directory, not symlink
```

### Test 2: Import Resolution

```bash
# This doesn't need API key
cat > /tmp/test-imports.ts <<'EOF'
import { MiniBob } from "@metabob/minibob";
import { getLogger } from "@metabob/minibob/logger";
console.log("✓ Imports work");
EOF

bun run /tmp/test-imports.ts
```

### Test 3: Demo Script

```bash
# Most checks don't need API key
./scripts/demo-minibob-tui.sh

# Will show:
# ✓ Production package installed
# ✓ Imports work
# ⚠ API key not set (expected)
```

---

## Checklist

Run through this checklist to diagnose 401 errors:

- [ ] `echo $ANTHROPIC_API_KEY` shows key starting with `sk-ant-`
- [ ] Key is exactly 108 characters: `echo -n $ANTHROPIC_API_KEY | wc -c`
- [ ] Key was created recently (not expired)
- [ ] Direct curl test to Anthropic API succeeds
- [ ] No rate limiting (check https://console.anthropic.com/settings/usage)
- [ ] Config file has correct key (if using config file)
- [ ] Environment variable takes precedence over config file
- [ ] MiniBob debug logs show correct API key prefix
- [ ] Account has API access enabled
- [ ] Not using old/revoked key

---

## If All Else Fails

### Contact Anthropic Support

If API key appears valid but still getting 401:

1. Check Anthropic status: https://status.anthropic.com
2. Contact support: https://support.anthropic.com
3. Provide:
   - API key prefix (first 12 chars)
   - Error timestamp
   - Full error message

### Use Alternative Provider

Switch to OpenAI temporarily:

```bash
export OPENAI_API_KEY="sk-..."

# Update MiniBob config
cat > ~/.metabob/config.json <<'EOF'
{
  "defaults": {
    "provider": "openai",
    "model": "gpt-4"
  }
}
EOF

# Test
minibob --single "echo test"
```

---

## Prevention

### Store API Key Securely

```bash
# Add to shell profile (choose one)
echo 'export ANTHROPIC_API_KEY="sk-ant-..."' >> ~/.bashrc   # bash
echo 'export ANTHROPIC_API_KEY="sk-ant-..."' >> ~/.zshrc    # zsh

# Reload
source ~/.bashrc  # or source ~/.zshrc
```

### Verify Before Starting Work

```bash
# Quick check script
cat > ~/bin/check-api-keys.sh <<'EOF'
#!/bin/bash
echo "Checking API keys..."

if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "❌ ANTHROPIC_API_KEY not set"
else
  echo "✓ ANTHROPIC_API_KEY set (${#ANTHROPIC_API_KEY} chars)"
fi

if [ -z "$METABOB_API_KEY" ]; then
  echo "⚠ METABOB_API_KEY not set"
else
  echo "✓ METABOB_API_KEY set"
fi
EOF

chmod +x ~/bin/check-api-keys.sh
~/bin/check-api-keys.sh
```

### Rotate Keys Regularly

- Create new key monthly
- Delete old keys
- Update in all locations (env vars, config files, CI/CD)

---

## Summary

**Most common cause:** API key not set correctly in environment.

**Quick fix:**
```bash
export ANTHROPIC_API_KEY="sk-ant-your-key-from-console"
bun run /tmp/test-anthropic-api.ts
```

**If that doesn't work:** API key is invalid/expired - generate new one at https://console.anthropic.com/settings/keys
