#!/usr/bin/env python3
"""
Fix CLI Session Token

This script creates a valid session token for metabob-cli so it can
record activity executions to the backend.

Root Cause:
- OpenCode calls MetabobCLI.startActivityExecution()
- MCP CLI calls /v2/activities/record/start
- Backend rejects with "Invalid or expired session token"
- Recording fails silently, 0 executions in DB

Solution:
- Create session directly in SurrealDB
- Update CLI config with valid token
- Verify recording works
"""

import asyncio
import json
import uuid
from pathlib import Path

import httpx


async def create_bootstrap_session():
    """Create a bootstrap session directly"""

    # Use SurrealDB HTTP API to create session
    # Note: SurrealDB record IDs cannot contain hyphens
    session_id = f"sessions:clibootstrap{uuid.uuid4().hex[:8]}"

    async with httpx.AsyncClient() as client:
        # Create session record in SurrealDB
        response = await client.post(
            "http://localhost:8000/sql",
            auth=("root", "root"),  # Default SurrealDB creds
            headers={
                "NS": "metabob",
                "DB": "metabob",
                "Accept": "application/json",
                "Content-Type": "text/plain",  # SurrealDB SQL endpoint expects text/plain
            },
            content=f"""
            CREATE {session_id} SET
                user_id = "bootstrap-user",
                org_id = "bootstrap-org",
                project_id = "default",
                session_type = "cli",
                created_at = time::now(),
                expires_at = time::now() + 30d,
                last_accessed = time::now(),
                is_active = true,
                metadata = {{}};
            """,
        )

        if response.status_code != 200:
            print(f"Failed to create session: {response.text}")
            return None

        result = response.json()
        print(f"Created session: {session_id}")

        # Generate session token (base64 encoded session_id)
        import base64

        token = base64.b64encode(session_id.encode()).decode()

        return {
            "session_id": session_id,
            "session_token": token,
            "user_id": "bootstrap-user",
            "org_id": "bootstrap-org",
        }


async def update_cli_config(session_data):
    """Update CLI config with new session token"""

    config_path = Path.home() / ".metabob" / "config.json"

    # Read existing config
    if config_path.exists():
        with open(config_path) as f:
            config = json.load(f)
    else:
        config = {}

    # Update session token
    config["session_token"] = session_data["session_token"]
    config["backend_url"] = "http://localhost:8080"

    # Write back
    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)

    print(f"Updated {config_path}")
    print(f"Token: {session_data['session_token'][:50]}...")


async def test_recording(session_token):
    """Test that recording actually works"""

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8080/v2/activities/record/start",
            headers={
                "Authorization": f"Bearer {session_token}",
                "Content-Type": "application/json",
            },
            json={
                "template_id": "test-template",
                "variables": {},
                "session_id": "test-session",
                "execution_id": f"exec_test_{uuid.uuid4().hex[:8]}",
            },
        )

        if response.status_code == 200:
            print("✅ Recording works! Backend accepted the request")
            print(f"Response: {response.json()}")
            return True
        else:
            print(f"❌ Recording failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False


async def main():
    print("=" * 60)
    print("FIX CLI SESSION TOKEN")
    print("=" * 60)
    print()

    # Step 1: Create bootstrap session
    print("[1/3] Creating bootstrap session...")
    session_data = await create_bootstrap_session()
    if not session_data:
        print("Failed to create session")
        return
    print()

    # Step 2: Update CLI config
    print("[2/3] Updating CLI config...")
    await update_cli_config(session_data)
    print()

    # Step 3: Test recording
    print("[3/3] Testing recording...")
    success = await test_recording(session_data["session_token"])
    print()

    if success:
        print("=" * 60)
        print("✅ SUCCESS! CLI can now record activity executions")
        print("=" * 60)
        print()
        print("Next steps:")
        print("1. Run an activity: opencode activity --help")
        print(
            "2. Check executions: curl http://localhost:8080/v2/activities/executions -H 'Authorization: Bearer TOKEN'"
        )
        print()
    else:
        print("=" * 60)
        print("❌ FAILED - See error above")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
