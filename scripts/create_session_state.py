#!/usr/bin/env python3
"""
Create .metabob/state file with valid session token for MCP server.

This script:
1. Creates a new session via API
2. Writes session token to .metabob/state using FileStateManager format
3. Verifies the session is valid
"""

import json
import sys
from pathlib import Path

import httpx

# Configuration
API_KEY = "mb_nH7j21NRXWRaqWyHq4ntSuwiRxARrhFnsR2J7i7vb-E"
BASE_URL = "http://localhost:8080"
PROJECT_ID = "exp-repo-dev"
STATE_DIR = Path(__file__).parent.parent / ".metabob"
STATE_FILE = STATE_DIR / "state"


def create_session():
    """Create a new session via API and return session data."""
    print(f"Creating session for project: {PROJECT_ID}")

    response = httpx.post(
        f"{BASE_URL}/v2/session",
        headers={"X-API-Key": API_KEY, "Content-Type": "application/json"},
        json={"project_id": PROJECT_ID},
        timeout=10.0,
    )

    if response.status_code != 200:
        print(f"❌ Failed to create session: {response.status_code}")
        print(response.text)
        sys.exit(1)

    session_data = response.json()
    print(f"✅ Session created: {session_data['session_id']}")
    return session_data


def write_state_file(session_data):
    """Write session token to state file in FileStateManager format."""
    session_token = session_data["metadata"]["session_token"]
    session_id = session_data["session_id"]
    project_id = session_data["project_id"]
    created_at = session_data["created_at"]

    # Create state directory if it doesn't exist
    STATE_DIR.mkdir(parents=True, exist_ok=True)

    # FileStateManager expects session_metadata nested structure
    # Based on file_state.py line 985-991
    from datetime import datetime

    state_content = {
        "version": 1,
        "session_metadata": {
            "session_token": session_token,
            "session_id": session_id,
            "project_id": project_id,
            "created_at": created_at,
            "last_updated": datetime.now().isoformat(),
            "format_version": "4.0",
        },
        "file_states": {},  # FileStateManager expects file_states not files
        "results": {},
    }

    print(f"Writing state to: {STATE_FILE}")
    with open(STATE_FILE, "w") as f:
        json.dump(state_content, f, indent=2)

    print(f"✅ State file created with session token")
    return session_token


def verify_session(session_token):
    """Verify the session token works by searching activities."""
    print(f"\nVerifying session token...")

    response = httpx.get(
        f"{BASE_URL}/v2/activities/templates/search",
        headers={
            "Authorization": f"Bearer {session_token}",
            "Content-Type": "application/json",
        },
        params={"limit": 5},
        timeout=10.0,
    )

    if response.status_code != 200:
        print(f"⚠️  Session verification failed: {response.status_code}")
        print(response.text)
        return False

    templates = response.json()
    print(
        f"✅ Session valid - found {len(templates.get('templates', []))} activity templates"
    )

    # Show a few templates
    for template in templates.get("templates", [])[:3]:
        print(f"   - {template.get('id')}: {template.get('name', 'unnamed')}")

    return True


def main():
    print("=" * 60)
    print("Creating Metabob Session State")
    print("=" * 60)

    try:
        # Step 1: Create session
        session_data = create_session()

        # Step 2: Write state file
        session_token = write_state_file(session_data)

        # Step 3: Verify session
        verify_session(session_token)

        print("\n" + "=" * 60)
        print("✅ SUCCESS - Session state created")
        print("=" * 60)
        print(f"\nState file: {STATE_FILE}")
        print(f"Session ID: {session_data['session_id']}")
        print(f"Expires: {session_data['expires_at']}")
        print("\n✨ MCP search_activities should now work!")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
