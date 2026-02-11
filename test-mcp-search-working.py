#!/usr/bin/env python3
"""
Test MCP search_activities tool directly - simplified version
"""

import asyncio
import json
import sys
import httpx

# Test parameters
API_URL = "http://localhost:8080"
API_KEY = "mb_Y99iQNMiycAlpkQamp0dhnU_t5e0ds0mkwDrU7g9bxs"
PROJECT_ID = "test-project"


async def main():
    print("=" * 80)
    print("Testing MCP Activity Search Flow")
    print("=" * 80)

    async with httpx.AsyncClient() as client:
        # Step 1: Create session
        print("\n[1] Creating session...")
        try:
            response = await client.post(
                f"{API_URL}/v2/session",
                headers={"X-API-Key": API_KEY},
                json={"project_id": PROJECT_ID},
                timeout=10.0,
            )
            response.raise_for_status()
            session_data = response.json()
            session_token = session_data["metadata"]["session_token"]
            print(f"✓ Session created: {session_token[:50]}...")
        except Exception as e:
            print(f"✗ Failed to create session: {e}")
            return 1

        # Step 2: Search activities
        print("\n[2] Searching for activities...")
        try:
            response = await client.get(
                f"{API_URL}/v2/activities/templates",
                headers={"Authorization": f"Bearer {session_token}"},
                params={"category": "refactor", "limit": 10},
                timeout=10.0,
            )
            response.raise_for_status()
            data = response.json()

            print(f"✓ Total activities: {data['total']}")

            if data["total"] > 0:
                print(f"\n[3] Found activities:")
                for template in data["templates"]:
                    variant_id = template.get("variant_id", "N/A")
                    name = template.get("variant_name", "N/A")
                    print(f"  - {variant_id}: {name}")

                # Check if jiggle activity exists
                jiggle = [
                    t
                    for t in data["templates"]
                    if "jiggle" in t.get("variant_name", "").lower()
                ]
                if jiggle:
                    print(f"\n✓ Found jiggle activity: {jiggle[0]['variant_id']}")
                else:
                    print("\n⚠ Jiggle activity not in results (but API works)")
            else:
                print("\n✗ No activities found!")
                return 1

        except Exception as e:
            print(f"✗ Search failed: {e}")
            import traceback

            traceback.print_exc()
            return 1

    print("\n" + "=" * 80)
    print("✓ Backend API is WORKING - session + search both succeed")
    print("=" * 80)
    print("\nNext step: Test if metabob-cli MCP server can do the same...")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
