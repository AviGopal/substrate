# Incremental Build & Test Plan

## Current Status
- ✅ Backend (metabob-rpc-api): V2 routes fixed, code live-mounted
- ✅ CLI (session_manager.py): API key format fixed, code live-mounted  
- ⏳ Need to verify changes work together

## Step 1: Verify Backend Changes are Live

Since code is volume-mounted, our backend changes should already be active.
But let's verify the server picked them up.

### Actions:
1. Check if server auto-reloaded after our edits
2. Test v2/session endpoint with correct API key format
3. Check logs for any new errors

### Commands:
```bash
# Check server logs for reload
docker logs --since 10m metabob-rpc-api-server-dev-1 | grep -E "Reloading|restarted"

# Check server is responding
curl -s http://localhost:8080/health | head -5

# Test v2 session (will fail on auth, but should not crash)
curl -X POST http://localhost:8080/v2/session \
  -H "X-API-Key: test_key" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "test"}'
```

**Expected**: 
- Server responds (not crashed)
- Returns 401 with "Invalid API key" message
- No module import errors in logs

---

## Step 2: Create Valid API Key in Database

Before we can test session creation, we need a valid API key.

### Actions:
1. Connect to SurrealDB
2. Create an API key for testing
3. Verify it's stored correctly

### Commands:
```bash
# Check SurrealDB is running
docker exec metabob-rpc-api-surreal-1 ps aux | grep surreal

# Create API key (we'll need to use the API or manually insert)
# Option 1: Use existing script if available
# Option 2: Direct SurrealDB insert

# For now, let's check what's in the database
docker exec -it metabob-rpc-api-surreal-1 /surreal sql \
  --endpoint http://localhost:8000 \
  --namespace metabob \
  --database main \
  --username root \
  --password root \
  --command "SELECT * FROM api_keys LIMIT 5;"
```

---

## Step 3: Test Session Creation with CLI Changes

The CLI changes are also live-mounted, so they should be active.

### Actions:
1. Create a test script using metabob-cli
2. Test session creation with valid API key
3. Verify token extraction works

### Test Script:
```python
# repos/metabob-cli/test_v2_session.py
import asyncio
import aiohttp

async def test_session_creation():
    """Test v2 session creation with X-API-Key header"""
    
    api_url = "http://localhost:8080"
    api_key = "YOUR_VALID_KEY_HERE"  # Replace after creating in DB
    
    async with aiohttp.ClientSession() as session:
        # Test v2 endpoint
        headers = {
            "X-API-Key": api_key,
            "Content-Type": "application/json"
        }
        
        data = {"project_id": "test-project"}
        
        async with session.post(
            f"{api_url}/v2/session",
            headers=headers,
            json=data
        ) as response:
            status = response.status
            body = await response.json()
            
            print(f"Status: {status}")
            print(f"Response: {body}")
            
            if status == 200:
                # Check proto format
                metadata = body.get("metadata", {})
                token = metadata.get("session_token")
                
                print(f"\n✅ Session created successfully!")
                print(f"Session ID: {body.get('session_id')}")
                print(f"Token (first 8 chars): {token[:8] if token else 'NOT FOUND'}")
                
                if not token:
                    print("❌ ERROR: session_token not found in metadata!")
                    return False
                
                return True
            else:
                print(f"❌ Failed: {body}")
                return False

if __name__ == "__main__":
    asyncio.run(test_session_creation())
```

---

## Step 4: If Needed, Restart API Server

If changes weren't picked up by hot-reload, manually restart:

### Commands:
```bash
# Restart API server
docker restart metabob-rpc-api-server-dev-1

# Wait for startup
sleep 5

# Check logs
docker logs --tail=30 metabob-rpc-api-server-dev-1

# Verify endpoints
curl -s http://localhost:8080/openapi.json | grep -o '"/v2/[^"]*"' | sort -u
```

---

## Step 5: Document Results & Next Steps

After testing, document:
- What works ✅
- What needs fixing ❌
- What to do next ⏭️

---

## Let's Start: Step 1 - Verify Backend

Run these now to check current state:

