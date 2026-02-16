#!/usr/bin/env python3
"""
Quick E2E Validation: Impulse Preservation Fix

Executes minimal activity (feature-00c10340 - 1 task) with test impulses,
then validates that impulse data is correctly preserved in the database.
"""

import sys
import os
import asyncio
import json
from datetime import datetime
import hashlib

sys.path.insert(0, "repos/metabob-cli/src")

from metabob_cli.mcp.activity_manager import get_activity_manager
import httpx

BASE_URL = "http://localhost:8080"
ACTIVITY_ID = "feature-00c10340"  # Minimal: 1 task only
SESSION_ID = f"impulse-test-{datetime.now().strftime('%Y%m%d-%H%M%S')}"


def print_step(msg):
    print(f"\n{'=' * 70}\n{msg}\n{'=' * 70}")


async def main():
    print_step("IMPULSE PRESERVATION FIX - QUICK VALIDATION")

    # Load session token
    print("\n[1/5] Loading session token...")
    with open(".metabob/state") as f:
        token = json.load(f)["session_metadata"]["session_token"]
    print(f"✅ Token loaded: {token[:50]}...")

    # Create test impulses with proper IDs and content
    print("\n[2/5] Creating test impulses...")
    test_impulses = [
        {
            "id": f"test-impulse-1-{SESSION_ID}",
            "type": "memo",
            "pointer": {
                "type": "memo",
                "content": "Test impulse 1: Verify impulse preservation works correctly",
            },
            "budget": 500,
            "tokens_loaded": 250,
            "tokens_used": 250,
            "content_hash": hashlib.sha256("test-impulse-1".encode()).hexdigest()[:16],
        },
        {
            "id": f"test-impulse-2-{SESSION_ID}",
            "type": "memo",
            "pointer": {
                "type": "memo",
                "content": "Test impulse 2: Ensure tokens are tracked properly",
            },
            "budget": 300,
            "tokens_loaded": 150,
            "tokens_used": 150,
            "content_hash": hashlib.sha256("test-impulse-2".encode()).hexdigest()[:16],
        },
    ]

    for imp in test_impulses:
        print(
            f"  - {imp['id']}: {imp['tokens_loaded']} tokens, hash={imp['content_hash']}"
        )

    # Initialize activity manager
    print("\n[3/5] Starting activity execution...")
    manager = get_activity_manager(BASE_URL, token)

    # Start execution with impulses
    result = await manager.start_execution(
        activity_id=ACTIVITY_ID,
        variables={"test_param": "minimal_validation", "skip_validation": "true"},
        session_id=SESSION_ID,
        impulses=test_impulses,
    )

    exec_id = result.get("execution_id")
    print(f"✅ Execution started: {exec_id}")

    # Poll for completion (minimal activity should complete in ~30-60s)
    print("\n[4/5] Waiting for completion...")
    max_wait = 120  # 2 minutes max
    poll_interval = 5
    elapsed = 0

    while elapsed < max_wait:
        await asyncio.sleep(poll_interval)
        elapsed += poll_interval

        status_result = await manager.get_execution_status(exec_id)
        status = status_result.get("status")
        print(f"  [{elapsed}s] Status: {status}")

        if status in ["completed", "failed", "error"]:
            break

    if status != "completed":
        print(f"\n⚠️  Execution did not complete (status: {status})")
        print(f"   You can check later with: check_impulse_quality_simple.py")
        return

    print(f"✅ Execution completed!")

    # Query database for impulse quality
    print("\n[5/5] Validating impulse data quality...")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/sql",
            auth=("root", "root"),
            headers={"NS": "metabob", "DB": "devbob", "Accept": "application/json"},
            content=f"SELECT * FROM impulse_effectiveness WHERE execution_id = '{exec_id}' ORDER BY recorded_at DESC;",
        )

        if response.status_code != 200:
            print(f"❌ Database query failed: {response.status_code}")
            print(response.text)
            return

        result = response.json()
        records = result[0].get("result", []) if result else []

        print(f"\n{'=' * 70}")
        print(f"VALIDATION RESULTS")
        print(f"{'=' * 70}")

        if not records:
            print("❌ No impulse records found in database")
            print("   This means impulses were NOT preserved!")
            return

        print(f"\n✅ Found {len(records)} impulse records")

        # Analyze data quality
        proper_ids = 0
        non_zero_tokens = 0
        has_content_hash = 0
        has_was_useful = 0

        for record in records:
            imp_id = record.get("impulse_id", "")
            tokens = record.get("tokens_used", 0)
            content_hash = record.get("content_hash", "")
            was_useful = "was_useful" in record

            if not imp_id.startswith("unknown-"):
                proper_ids += 1
            if tokens > 0:
                non_zero_tokens += 1
            if content_hash:
                has_content_hash += 1
            if was_useful:
                has_was_useful += 1

            print(f"\n  Impulse: {imp_id}")
            print(f"    Tokens: {tokens}")
            print(f"    Content Hash: {content_hash[:16]}...")
            print(f"    Was Useful: {record.get('was_useful', 'N/A')}")

        total = len(records)
        print(f"\n{'=' * 70}")
        print(f"QUALITY METRICS")
        print(f"{'=' * 70}")
        print(
            f"  Proper IDs (not 'unknown-*'):  {proper_ids}/{total} ({proper_ids / total * 100:.1f}%)"
        )
        print(
            f"  Non-zero tokens:                {non_zero_tokens}/{total} ({non_zero_tokens / total * 100:.1f}%)"
        )
        print(
            f"  Has content_hash:               {has_content_hash}/{total} ({has_content_hash / total * 100:.1f}%)"
        )
        print(
            f"  Has was_useful flag:            {has_was_useful}/{total} ({has_was_useful / total * 100:.1f}%)"
        )

        # Success criteria
        print(f"\n{'=' * 70}")
        print(f"SUCCESS CRITERIA (Target: ≥90%)")
        print(f"{'=' * 70}")

        proper_id_rate = proper_ids / total * 100
        token_rate = non_zero_tokens / total * 100

        if proper_id_rate >= 90 and token_rate >= 90:
            print("✅ PASS - Impulse preservation fix is working correctly!")
        else:
            print("❌ FAIL - Data quality below target")
            if proper_id_rate < 90:
                print(f"   - Proper ID rate: {proper_id_rate:.1f}% (need ≥90%)")
            if token_rate < 90:
                print(f"   - Token rate: {token_rate:.1f}% (need ≥90%)")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback

        traceback.print_exc()
