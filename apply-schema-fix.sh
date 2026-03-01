#!/bin/bash
echo "=== Applying Schema Migration ==="
echo ""

# Create SQL commands file
kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
cat > /tmp/schema-migration.sql << "SQL"
DEFINE FIELD scope ON activity_template TYPE string DEFAULT '\''org'\'';
DEFINE FIELD org_id ON activity_template TYPE string;
DEFINE INDEX activity_template_org_idx ON activity_template FIELDS org_id;
INFO FOR TABLE activity_template;
SQL
cat /tmp/schema-migration.sql
'

echo ""
echo "Applying via curl (text/plain)..."
kubectl exec devbob-0 -n metabob -c devbob -- bash -c '
curl -s -X POST http://surrealdb:8000/sql \
  -u "root:root" \
  -H "NS: metabob" \
  -H "DB: production" \
  -H "Accept: application/json" \
  --data-binary "@/tmp/schema-migration.sql"
' | python3 -m json.tool 2>/dev/null | head -100

echo ""
echo "✅ Migration complete (if no errors above)"
