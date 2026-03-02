#!/usr/bin/env python3
"""
Test script to isolate the SurrealDB RPC issue with variant_id not persisting.
"""

import requests
import json

# SurrealDB connection
URL = "http://localhost:8000/rpc"
NAMESPACE = "metabob"
DATABASE = "production"

# Step 1: Sign in
print("Step 1: Signing in...")
response = requests.post(
    URL,
    json={"method": "signin", "params": [{"user": "root", "pass": "root"}]},
)
result = response.json()
token = result["result"]
print(f"✓ Token: {token[:50]}...")

# Step 2: Create record with variant_id
print("\nStep 2: Creating record with variant_id...")
query = """
CREATE template_metrics SET
    variant_id = $variant_id,
    activity_id = $activity_id,
    total_executions = $total_executions
"""

params = {
    "variant_id": "python-test-script-456",
    "activity_id": "python-test-script",
    "total_executions": 777,
}

payload = {"method": "query", "params": [query, params]}

print(f"Query: {query.strip()}")
print(f"Params: {json.dumps(params)}")
print(f"Full payload: {json.dumps(payload)[:200]}...")

response = requests.post(
    URL,
    headers={
        "Content-Type": "application/json",
        "Surreal-NS": NAMESPACE,
        "Surreal-DB": DATABASE,
        "Authorization": f"Bearer {token}",
    },
    json=payload,
)

print(f"\nResponse status: {response.status_code}")
result = response.json()
print(f"Response: {json.dumps(result, indent=2)}")

if "result" in result and len(result["result"]) > 0:
    record = result["result"][0]["result"][0]
    print(f"\n✓ Created record:")
    print(f"  ID: {record['id']}")
    print(f"  variant_id: {record.get('variant_id', 'MISSING!')}")
    print(f"  activity_id: {record.get('activity_id', 'MISSING!')}")
    print(f"  total_executions: {record.get('total_executions', 'MISSING!')}")
else:
    print("✗ Failed to create record")
