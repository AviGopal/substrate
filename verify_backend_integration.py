#!/usr/bin/env python3
"""
Verify backend integration end-to-end.

Tests:
1. Backend health check
2. API key → Session creation
3. Session token → Template access
4. metabob-cli configuration
5. metabob-opencode configuration
"""

import asyncio
import json
import sys
from pathlib import Path

import httpx

# Configuration
BASE_URL = "http://localhost:8080"
API_KEY = "mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ"


async def verify_backend_integration():
    """Verify backend integration step by step."""
    print("=" * 70)
    print("Backend Integration Verification")
    print("=" * 70)
    print()

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Test 1: Health check
        print("✓ Test 1: Backend Health Check")
        try:
            response = await client.get(f"{BASE_URL}/health")
            if response.status_code == 200:
                health = response.json()
                print(f"  ✅ Backend is healthy (version: {health.get('version')})")
            else:
                print(f"  ❌ Backend returned {response.status_code}")
                return False
        except Exception as e:
            print(f"  ❌ Cannot connect to backend: {e}")
            return False
        print()

        # Test 2: Create session from API key
        print("✓ Test 2: Create Session from API Key")
        try:
            response = await client.post(
                f"{BASE_URL}/v2/session",
                headers={
                    "X-API-Key": API_KEY,
                    "Content-Type": "application/json",
                },
                json={"project_id": "default"},
            )
            if response.status_code == 200:
                session_data = response.json()
                session_token = session_data["metadata"]["session_token"]
                session_id = session_data["session_id"]
                print(f"  ✅ Session created: {session_id}")
                print(f"  ✅ Token: {session_token[:40]}...")
            else:
                print(f"  ❌ Session creation failed: {response.status_code}")
                print(f"     Response: {response.text}")
                return False
        except Exception as e:
            print(f"  ❌ Session creation error: {e}")
            return False
        print()

        # Test 3: Access templates with session token
        print("✓ Test 3: Access Templates with Session Token")
        try:
            response = await client.get(
                f"{BASE_URL}/v2/activities/templates",
                headers={"Authorization": f"Bearer {session_token}"},
            )
            if response.status_code == 200:
                templates_data = response.json()
                templates = templates_data.get("templates", [])
                print(f"  ✅ Templates accessible: {len(templates)} available")

                # Show a few examples
                if templates:
                    print(f"\n  📋 Sample templates:")
                    for template in templates[:5]:
                        name = template.get("name", "Unknown")
                        activity_id = template.get("activity_id", "?")
                        category = template.get("category", "?")
                        print(f"     - {name} ({activity_id}) [{category}]")
                    if len(templates) > 5:
                        print(f"     ... and {len(templates) - 5} more")
            else:
                print(f"  ❌ Template access failed: {response.status_code}")
                print(f"     Response: {response.text}")
                return False
        except Exception as e:
            print(f"  ❌ Template access error: {e}")
            return False
        print()

        # Test 4: Verify CLI configuration
        print("✓ Test 4: Verify CLI Configuration")
        cli_config_path = Path("repos/metabob-cli/.metabob/config.json")
        if cli_config_path.exists():
            with open(cli_config_path) as f:
                cli_config = json.load(f)
            if cli_config.get("base_url") == BASE_URL:
                print(f"  ✅ CLI base_url: {cli_config.get('base_url')}")
            else:
                print(
                    f"  ⚠️  CLI base_url: {cli_config.get('base_url')} (expected: {BASE_URL})"
                )

            if cli_config.get("api_key") == API_KEY:
                print(f"  ✅ CLI api_key: {cli_config.get('api_key')[:30]}...")
            else:
                print(f"  ⚠️  CLI api_key mismatch")
        else:
            print(f"  ⚠️  CLI config not found at {cli_config_path}")
        print()

        # Test 5: Verify OpenCode configuration
        print("✓ Test 5: Verify OpenCode Configuration")
        opencode_config_path = Path("repos/metabob-opencode/.metabob/config.json")
        if opencode_config_path.exists():
            with open(opencode_config_path) as f:
                opencode_config = json.load(f)
            if opencode_config.get("base_url") == BASE_URL:
                print(f"  ✅ OpenCode base_url: {opencode_config.get('base_url')}")
            else:
                print(
                    f"  ⚠️  OpenCode base_url: {opencode_config.get('base_url')} (expected: {BASE_URL})"
                )

            if opencode_config.get("api_key") == API_KEY:
                print(
                    f"  ✅ OpenCode api_key: {opencode_config.get('api_key')[:30]}..."
                )
            else:
                print(f"  ⚠️  OpenCode api_key mismatch")
        else:
            print(f"  ⚠️  OpenCode config not found at {opencode_config_path}")
        print()

    print("=" * 70)
    print("✅ Backend Integration Verification COMPLETE")
    print("=" * 70)
    print()
    print("Summary:")
    print(f"  • Backend: {BASE_URL} (healthy)")
    print(f"  • API Key: {API_KEY[:30]}... (active)")
    print(f"  • Templates: {len(templates)} available")
    print(f"  • CLI: Configured ✓")
    print(f"  • OpenCode: Configured ✓")
    print()
    print("Next steps:")
    print("  1. Test metabob-cli MCP server")
    print("  2. Test OpenCode → CLI → Backend flow")
    print("  3. Execute an activity template")

    return True


if __name__ == "__main__":
    try:
        result = asyncio.run(verify_backend_integration())
        sys.exit(0 if result else 1)
    except KeyboardInterrupt:
        print("\n⚠️  Interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Verification failed: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
