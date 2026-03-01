from server.db.surrealdb_client import get_surreal_client
import json

db = get_surreal_client()

# Test query
query = "SELECT * FROM activity_template WHERE activity_id = $activity_id"
result = db.query(query, {"activity_id": "activity-id-test-template"})

print("Result type:", type(result))
print("Result length:", len(result) if result else 0)
print("Result:", json.dumps(result, indent=2, default=str))

# Also try without params
query2 = "SELECT * FROM activity_template WHERE activity_id = 'activity-id-test-template'"
result2 = db.query(query2)
print("\nDirect query result:", json.dumps(result2, indent=2, default=str))
