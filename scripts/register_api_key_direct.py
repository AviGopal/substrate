#!/usr/bin/env python3
"""
Register the existing API key from config directly into SurrealDB.
"""

import json
import requests
from pathlib import Path
from datetime import datetime, timedelta

# Configuration
SURREAL_URL = "http://localhost:8000/sql"
SURREAL_USER = "root"
SURREAL_PASS = "root"
CONFIG_PATH = Path(__file__).parent.parent / ".metabob/config.json"

# Load existing API key and hash
with open(CONFIG_PATH) as f:
    config = json.load(f)
    api_key = config["api_key"]
    key_hash = "54bea5bbf121c6a22a56e024280ec99972ee43c1830543f98a7324c30d76b043"  # Pre-computed

# Key details (must match what's expected)
org_id = "org:dev"
user_id = "user:dev"
key_id = "key_dev_bootstrap"
expires_at = (datetime.now() + timedelta(days=365)).isoformat() + "Z"

print(f"Registering API key: {api_key[:30]}...")
print(f"Org: {org_id}")
print(f"User: {user_id}")
print(f"Key ID: {key_id}")

# Prepare SQL
sql = f"""
USE NS metabob DB metabob;

CREATE api_keys:{key_id} SET
    key_hash = '{key_hash}',
    key_id = '{key_id}',
    org_id = '{org_id}',
    user_id = '{user_id}',
    scopes = ['read', 'write', 'admin'],
    expires_at = <datetime>'{expires_at}',
    created_at = time::now(),
    last_used_at = NONE,
    is_active = true,
    description = 'Bootstrap development API key';
"""

# Execute
response = requests.post(
    SURREAL_URL,
    auth=(SURREAL_USER, SURREAL_PASS),
    headers={"Content-Type": "text/plain", "Accept": "application/json"},
    data=sql,
    timeout=10,
)

if response.status_code == 200:
    result = response.json()
    # Check if CREATE succeeded (should be in second result)
    if len(result) > 1 and result[1].get("status") == "OK":
        print("\n✅ API key registered successfully!")
        print(f"\nThe key in your .metabob/config.json is now active.")
        print(f"\nTest it:")
        print(f"  python3 scripts/test-activity-system-complete.py")
    else:
        print(f"\n⚠️  Response: {json.dumps(result, indent=2)}")
else:
    print(f"\n❌ HTTP {response.status_code}: {response.text}")
