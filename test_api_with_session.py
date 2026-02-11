#!/usr/bin/env python3
"""Test v2 API with session token"""

import asyncio
import httpx
import os
import sys

sys.path.insert(0, "/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-cli/src")

os.environ["METABOB_API_KEY"] = "test-api-key"
os.environ["METABOB_API_URL"] = "http://localhost:8080"
os.environ["METABOB_PROJECT_ID"] = "metabob-devbob"

async def test_api_with_session():
    from metabob_cli.mcp.server import _ensure_session, get_config_manager
    
    print("Step 1: Creating session...")
    await _ensure_session()
    
    config = get_config_manager()
    session_token = config.get("session_token", "")
    base_url = config.get("base_url", "http://localhost:8080")
    
    print(f"  Base URL: {base_url}")
    print(f"  Session token: {session_token[:20]}...")
    
    print("\nStep 2: Calling /v2/activities/templates directly...")
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {session_token}"
    }
    
    async with httpx.AsyncClient(base_url=base_url, headers=headers, timeout=30.0) as client:
        response = await client.get(
            "/v2/activities/templates",
            params={"query": "jiggle", "limit": 5}
        )
        
        print(f"  Status: {response.status_code}")
        print(f"  Response: {response.text[:200]}...")
        
        if response.status_code == 200:
            data = response.json()
            templates = data.get("templates", [])
            print(f"  Found {len(templates)} templates")
            
            for t in templates:
                print(f"    - {t.get('variant_name', t.get('name'))}")
            
            return len(templates) > 0
        else:
            print(f"  Error: {response.text}")
            return False

if __name__ == "__main__":
    result = asyncio.run(test_api_with_session())
    sys.exit(0 if result else 1)
