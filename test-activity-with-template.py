#!/usr/bin/env python3
"""Test with templates endpoint instead of variants"""
import requests
import json

# Create session
session_resp = requests.post("http://localhost:8080/v2/session", json={"api_key": "test-api-key", "project_id": "metabob-devbob", "org_id": "test-org"})
token = session_resp.json().get("session_token") or session_resp.json().get("metadata", {}).get("session_token")

print("Step 1: List templates")
list_resp = requests.get("http://localhost:8080/v2/activities/templates", headers={"Authorization": f"Bearer {token}"}, params={"limit": 50})
templates = list_resp.json().get('templates', [])
print(f"  Found {len(templates)} templates")
for t in templates:
    print(f"    - {t.get('variant_name', 'unknown')} (variant_id: {t.get('variant_id')})")

if templates:
    print("\nStep 2: Try to GET specific template details")
    variant_id = templates[0]['variant_id']
    # The OpenCode code does: GET /v2/activities/variants/{variant_id}
    detail_resp = requests.get(f"http://localhost:8080/v2/activities/variants/{variant_id}", headers={"Authorization": f"Bearer {token}"})
    print(f"  GET /v2/activities/variants/{variant_id}")
    print(f"  Status: {detail_resp.status_code}")
    if detail_resp.status_code == 200:
        print("  SUCCESS - Can fetch template details!")
    else:
        print(f"  FAIL: {detail_resp.text[:200]}")
        print("\n  This is the error OpenCode's TemplateLoader would see.")
