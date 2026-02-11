#!/usr/bin/env python3
import asyncio
import os
import sys

os.environ["METABOB_API_KEY"] = "test-api-key"
os.environ["METABOB_API_URL"] = "http://localhost:8080"
os.environ["METABOB_PROJECT_ID"] = "metabob-devbob"

sys.path.insert(0, "/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-cli/src")

async def main():
    from metabob_cli.mcp.server import _ensure_session, get_config_manager
    from metabob_cli.mcp.activity_manager import get_activity_manager
    
    # Create session
    await _ensure_session()
    
    # Get config
    config = get_config_manager()
    print(f"base_url: {config['base_url']}")
    print(f"session_token: {config['session_token'][:20]}...")
    
    # Get manager
    manager = get_activity_manager(config["base_url"], config["session_token"])
    
    # Search directly
    print("\nCalling manager.search_activities()...")
    results = await manager.search_activities(query="jiggle", limit=5)
    
    print(f"Results type: {type(results)}")
    print(f"Results count: {len(results)}")
    for r in results:
        print(f"  - {r.get('name', r.get('variant_name'))}")

asyncio.run(main())
