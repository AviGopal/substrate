#!/usr/bin/env python3
import requests
import json
import bcrypt

# Hash the password
password = "testpassword123"
password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode(
    "utf-8"
)

# Create user, org, developer, and API key
sql = f"""
-- Create organization
CREATE organizations:test_org CONTENT {{
    org_id: 'org_test_001',
    name: 'Test Organization',
    display_name: 'Test Org',
    settings: {{}},
    metadata: {{}},
    created_at: time::now(),
    updated_at: time::now()
}};

-- Create user for authentication
CREATE users:test_user CONTENT {{
    user_id: 'user_test_001',
    email: 'test@metabob.com',
    password_hash: '{password_hash}',
    name: 'Test User',
    org_id: 'org_test_001',
    role: 'admin',
    is_active: true,
    email_verified: true,
    metadata: {{}},
    created_at: time::now(),
    updated_at: time::now()
}};

-- Create developer record
CREATE developers:test_dev CONTENT {{
    user_id: 'user_test_001',
    org_id: 'org_test_001',
    name: 'Test User',
    email: 'test@metabob.com',
    role: 'admin',
    is_ai: false,
    metadata: {{}},
    created_at: time::now(),
    updated_at: time::now()
}};

-- Create API key
CREATE api_keys:test_api_key CONTENT {{
    key_id: 'key_test_001',
    api_key: 'mb_devbob_test_simple_2026_v2',
    user_id: 'user_test_001',
    org_id: 'org_test_001',
    name: 'Test API Key',
    scopes: ['read', 'write'],
    is_active: true,
    created_at: time::now(),
    updated_at: time::now()
}};
"""

resp = requests.post(
    "http://surrealdb:8000/sql",
    headers={
        "Surreal-NS": "metabob",
        "Surreal-DB": "metabob",
        "Authorization": "Basic cm9vdDpyb290",
        "Accept": "application/json",
    },
    data=sql,
)
print(f"Status: {resp.status_code}")
results = resp.json()
for r in results:
    print(json.dumps(r, indent=2))
