#!/usr/bin/env python3
"""Test session creation fix"""

import asyncio
import os
import sys

# Set up environment
os.environ["METABOB_API_KEY"] = "test-api-key"
os.environ["METABOB_API_URL"] = "http://localhost:8080"
os.environ["METABOB_PROJECT_ID"] = "metabob-devbob"

sys.path.insert(0, "/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-cli/src")

async def test_session_creation():
    """Test that _ensure_session creates a session"""
    from metabob_cli.mcp.server import _ensure_session
    from metabob_cli.mcp.server import get_config_manager
    
    print("Step 1: Checking initial state...")
    config = get_config_manager()
    initial_token = config.get("session_token", "")
    print(f"  Initial session_token: '{initial_token}' (length: {len(initial_token)})")
    
    print("\nStep 2: Calling _ensure_session()...")
    await _ensure_session()
    
    print("\nStep 3: Checking state after session creation...")
    config = get_config_manager()
    final_token = config.get("session_token", "")
    print(f"  Final session_token: '{final_token[:20] if final_token else ''}...' (length: {len(final_token)})")
    
    if final_token:
        print("\n✅ SUCCESS: Session token created!")
        return True
    else:
        print("\n❌ FAILURE: No session token found")
        return False

if __name__ == "__main__":
    result = asyncio.run(test_session_creation())
    sys.exit(0 if result else 1)
