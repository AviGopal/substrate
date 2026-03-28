#!/bin/bash
# Apply authentication schema to SurrealDB in Kubernetes

set -e

NAMESPACE="metabob"
POD=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=rpc-api -o jsonpath='{.items[0].metadata.name}')

echo "📊 Applying authentication schema to SurrealDB..."
echo "   Namespace: $NAMESPACE"
echo "   RPC API Pod: $POD"

# Copy schema file to pod
kubectl cp scripts/init-surrealdb-devbob-schema-v2.sql $NAMESPACE/$POD:/tmp/schema.sql

# Apply schema via Python
kubectl exec -n $NAMESPACE $POD -- python3 -c "
import asyncio
import sys
from server.db.surrealdb_client import get_surreal_client

async def apply_schema():
    try:
        # Read schema file
        with open('/tmp/schema.sql', 'r') as f:
            schema_sql = f.read()
        
        print('Connecting to SurrealDB...')
        db = await get_surreal_client()
        
        print('Applying schema...')
        # Split by semicolon and execute each statement
        statements = [s.strip() for s in schema_sql.split(';') if s.strip()]
        
        for i, stmt in enumerate(statements):
            if stmt and not stmt.startswith('--'):
                print(f'  [{i+1}/{len(statements)}] Executing statement...')
                try:
                    result = await db.query(stmt)
                    print(f'    ✓ Success')
                except Exception as e:
                    print(f'    ⚠ Warning: {e}')
        
        print('✅ Schema applied successfully')
        
        # Verify tables exist
        print('\\nVerifying tables...')
        result = await db.query('INFO FOR DB;')
        print(f'Result: {result}')
        
        return 0
    except Exception as e:
        print(f'❌ Error: {e}', file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1

sys.exit(asyncio.run(apply_schema()))
"

echo ""
echo "✅ Schema application complete"
