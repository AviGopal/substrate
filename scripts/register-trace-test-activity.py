#!/usr/bin/env python3
"""
Register the trace-test-activity template to the backend.
"""

import json
import os
import sys
from pathlib import Path
import httpx

# Configuration
API_URL = os.environ.get("METABOB_API_URL", "http://localhost:8080")

# Try to read API key from .test_api_key or .metabob_api_key file
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
TEST_API_KEY_FILE = PROJECT_ROOT / ".test_api_key"
API_KEY_FILE = PROJECT_ROOT / ".metabob_api_key"

if TEST_API_KEY_FILE.exists():
    API_KEY = TEST_API_KEY_FILE.read_text().strip()
elif API_KEY_FILE.exists():
    API_KEY = API_KEY_FILE.read_text().strip()
else:
    API_KEY = os.environ.get(
        "TEST_API_KEY",
        os.environ.get(
            "METABOB_API_KEY", "mb_L0O32RtJXXURfynw1gtsB0CxwG0IWbp-ehvPBv0lOS8"
        ),
    )

PROJECT_ID = os.environ.get("METABOB_PROJECT_ID", "exp-repo-dev")

# Paths (already set above for API key)
TEMPLATE_FILE = PROJECT_ROOT / "test-workspace/trace-test-activity.json"


def register_template():
    """Register the trace test activity template."""

    # Read template
    if not TEMPLATE_FILE.exists():
        print(f"❌ Template not found: {TEMPLATE_FILE}")
        return False

    with open(TEMPLATE_FILE) as f:
        template = json.load(f)

    print(f"📄 Template: {template['variant_id']}")
    print(f"   Name: {template['name']}")
    print(f"   Steps: {len(template['task_steps'])}")

    # Create session first
    try:
        print(f"\n🔗 Creating session with backend...")
        session_resp = httpx.post(
            f"{API_URL}/v2/session",
            json={
                "api_key": API_KEY,
                "project_id": PROJECT_ID,
                "session_type": "activity",
            },
            timeout=10.0,
        )
        session_resp.raise_for_status()
        session_data = session_resp.json()
        session_id = session_data["session_id"]
        print(f"✅ Session created: {session_id}")
    except Exception as e:
        print(f"❌ Session creation failed: {e}")
        return False

    # Register template
    try:
        print(f"\n📤 Registering template...")
        resp = httpx.post(
            f"{API_URL}/v2/activities/templates",
            json=template,
            headers={
                "X-Session-ID": session_id,
                "X-API-Key": API_KEY,
            },
            timeout=10.0,
        )

        print(f"   Status: {resp.status_code}")

        if resp.status_code == 201:
            data = resp.json()
            print(f"✅ Template registered successfully")
            print(f"   Variant ID: {data.get('variant_id')}")
            print(f"   Activity ID: {data.get('activity_id')}")
            return True
        elif resp.status_code == 409:
            print(f"⚠️  Template already exists (409 Conflict)")
            print(f"   This is OK - template is available")
            return True
        else:
            print(f"❌ Registration failed: {resp.status_code}")
            print(f"   Response: {resp.text[:500]}")
            return False

    except Exception as e:
        print(f"❌ Registration failed: {e}")
        return False


def verify_template():
    """Verify the template is available."""
    try:
        print(f"\n🔍 Verifying template availability...")
        resp = httpx.get(
            f"{API_URL}/v2/activities/templates",
            headers={"X-API-Key": API_KEY},
            timeout=10.0,
        )
        resp.raise_for_status()
        templates = resp.json()

        # Find our template
        trace_template = None
        for t in templates:
            if t.get("variant_id") == "trace-test-deterministic":
                trace_template = t
                break

        if trace_template:
            print(f"✅ Template found in backend")
            print(f"   ID: {trace_template.get('variant_id')}")
            print(f"   Name: {trace_template.get('name')}")
            print(f"   Category: {trace_template.get('category')}")
            return True
        else:
            print(f"⚠️  Template not found in listing")
            return False

    except Exception as e:
        print(f"❌ Verification failed: {e}")
        return False


if __name__ == "__main__":
    print("=" * 60)
    print("Trace Test Activity Registration")
    print("=" * 60)

    success = register_template()

    if success:
        verify_template()
        print(f"\n✅ Registration complete")
        sys.exit(0)
    else:
        print(f"\n❌ Registration failed")
        sys.exit(1)
