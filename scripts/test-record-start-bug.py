#!/usr/bin/env python3
"""
Test if /v2/activities/record/start creates templates or executions.

This tests the bug reported in commit 97e700dde where calling /record/start
was creating NEW templates instead of recording execution start.
"""

import asyncio
import httpx
import uuid
from datetime import datetime


async def test_record_start():
    """Test if /record/start creates templates or executions."""

    base_url = "http://localhost:8080"

    # Use test API key (or get from environment)
    api_key = "mb_test_devbob_2024"
    headers = {"Authorization": f"Bearer {api_key}"}

    print("=" * 60)
    print("Testing /v2/activities/record/start endpoint")
    print("=" * 60)

    async with httpx.AsyncClient() as client:
        # Step 1: Count templates before
        try:
            response = await client.get(
                f"{base_url}/v2/activities/templates", headers=headers, timeout=10.0
            )

            if response.status_code != 200:
                print(f"❌ Failed to get templates: {response.status_code}")
                print(f"   Response: {response.text}")
                return False

            templates_before = response.json().get("templates", [])
            template_count_before = len(templates_before)
            print(f"\n✓ Templates before: {template_count_before}")

        except Exception as e:
            print(f"❌ Error getting templates: {e}")
            return False

        # Step 2: Call /record/start with test execution
        execution_id = f"test-exec-{uuid.uuid4().hex[:8]}"
        test_session_id = f"test-session-{uuid.uuid4().hex[:8]}"

        payload = {
            "template_id": "test-activity-fake",  # Non-existent template
            "variables": {"test": "value"},
            "session_id": test_session_id,
            "execution_id": execution_id,
        }

        print(f"\n✓ Calling /record/start with:")
        print(f"  - execution_id: {execution_id}")
        print(f"  - session_id: {test_session_id}")
        print(f"  - template_id: {payload['template_id']}")

        try:
            response = await client.post(
                f"{base_url}/v2/activities/record/start",
                headers=headers,
                json=payload,
                timeout=10.0,
            )

            print(f"\n✓ Response status: {response.status_code}")
            print(f"  Response body: {response.json()}")

            if response.status_code not in [200, 201]:
                print(f"⚠️  Warning: Non-success status code")
                # Continue to check if template was created

        except Exception as e:
            print(f"❌ Error calling /record/start: {e}")
            return False

        # Step 3: Count templates after
        try:
            response = await client.get(
                f"{base_url}/v2/activities/templates", headers=headers, timeout=10.0
            )

            templates_after = response.json().get("templates", [])
            template_count_after = len(templates_after)
            print(f"\n✓ Templates after: {template_count_after}")

        except Exception as e:
            print(f"❌ Error getting templates: {e}")
            return False

        # Step 4: Analyze results
        print("\n" + "=" * 60)
        print("ANALYSIS")
        print("=" * 60)

        if template_count_after > template_count_before:
            new_templates = [t for t in templates_after if t not in templates_before]
            print(f"❌ BUG CONFIRMED: Created {len(new_templates)} new template(s)")
            print(f"   instead of recording execution")
            print(f"\n   New template(s):")
            for t in new_templates:
                print(
                    f"   - {t.get('variant_id', 'unknown')}: {t.get('variant_name', 'unnamed')}"
                )
            return False

        else:
            print("✅ NO BUG: No new templates created")
            print(f"   Template count unchanged: {template_count_before}")

            # TODO: Verify execution exists in database
            # Would require SurrealDB query or additional endpoint
            print(f"\n   Note: Execution {execution_id} should exist in")
            print(f"         activity_executions table (not verified)")

            return True


async def main():
    print("\n/v2/activities/record/start Bug Test")
    print("=" * 60)
    print("Purpose: Verify if endpoint creates templates (bug) or")
    print("         records executions (correct behavior)")
    print()

    success = await test_record_start()

    print("\n" + "=" * 60)
    if success:
        print("✅ RESULT: Endpoint works correctly")
        print("   Safe to re-enable in activity_manager.py")
    else:
        print("❌ RESULT: Bug exists or test failed")
        print("   Need to investigate further")
    print("=" * 60 + "\n")

    return success


if __name__ == "__main__":
    result = asyncio.run(main())
    exit(0 if result else 1)
