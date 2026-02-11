#!/usr/bin/env python3
import asyncio
import os
import sys

sys.path.insert(0, 'repos/metabob-cli/src')

os.environ['METABOB_API_KEY'] = 'test-api-key'
os.environ['METABOB_API_URL'] = 'http://localhost:8080'
os.environ['METABOB_PROJECT_ID'] = 'metabob-devbob'

async def test():
    print("Importing _ensure_session...")
    from metabob_cli.mcp.server import _ensure_session
    
    print("Calling _ensure_session()...")
    await _ensure_session()
    
    print("Checking if token was saved...")
    from metabob_cli.core.file_state import FileStateManager
    fsm = FileStateManager()
    token = fsm.get_session_token()
    
    if token:
        print(f"✅ Token saved: {token[:30]}...")
        return True
    else:
        print("❌ No token saved")
        return False

try:
    result = asyncio.run(test())
    sys.exit(0 if result else 1)
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
