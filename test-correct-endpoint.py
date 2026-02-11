#!/usr/bin/env python3
import requests
import json

# Create session
session_resp = requests.post("http://localhost:8080/v2/session", json={"api_key": "test-api-key", "project_id": "metabob-devbob", "org_id": "test-org"})
token = session_resp.json().get("session_token") or session_resp.json().get("metadata", {}).get("session_token")

print("Testing GET /v2/activities/templates/{variant_id}")
variant_id = "refactor-5fccfc17"

# Try the correct endpoint
detail_resp = requests.get(
    f"http://localhost:8080/v2/activities/templates/{variant_id}",
    headers={"Authorization": f"Bearer {token}"}
)

print(f"Status: {detail_resp.status_code}")
if detail_resp.status_code == 200:
    data = detail_resp.json()
    print("SUCCESS!")
    print(f"  Name: {data.get('variant_name')}")
    print(f"  Tasks: {len(data.get('task_steps', []))}")
    print(f"  Has taskSteps (OpenCode expects this): {('taskSteps' in data) or ('task_steps' in data)}")
else:
    print(f"FAIL: {detail_resp.text[:200]}")
