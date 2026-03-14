# Validation Test Case 10: Schema Tables with PERMISSIONS FULL

**Impulse ID:** validation-surrealdb-v3-schema-init-case-10  
**Type:** memo  
**Purpose:** Expected values for schema table permissions check

## Test Input
```python
# Execute via kubectl exec in RPC API pod
import os, requests
url = 'http://surrealdb:8000/rpc'
auth_resp = requests.post(url, json={'method': 'signin', 'params': [{'user': os.environ['SURREAL_USER'], 'pass': os.environ['SURREAL_PASS']}]})
token = auth_resp.json()['result']

info_resp = requests.post(
    url,
    headers={'Authorization': f'Bearer {token}', 'Surreal-NS': 'metabob', 'Surreal-DB': 'production'},
    json={'method': 'query', 'params': ['INFO FOR DB;']}
)

tables_info = info_resp.json()['result'][0]['result']['tables']
tables_with_perms = sum(1 for defn in tables_info.values() if 'PERMISSIONS FULL' in str(defn))
total_tables = len(tables_info)
print(f'{tables_with_perms}/{total_tables}')
```

## Expected Output
```
16/16
```

## Validation Logic
- Minimum 13 tables with PERMISSIONS FULL (original spec)
- After enforcement: 16/16 tables (includes RPC API migration tables)
- Format: "X/Y" where X >= 13 and Y >= 13

## Context
Init-schema script creates tables with PERMISSIONS FULL to bypass IAM restrictions in SurrealDB v2.x and ensure consistent security model.
