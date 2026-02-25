#!/bin/bash
# Direct test of boredom activities API without full session

echo "🧪 Direct Boredom Activities API Test"
echo "======================================"
echo ""

echo "📡 Fetching boredom activities from backend..."
echo "   URL: http://localhost:8080/api/v1/learning-loop/boredom-activities"
echo "   Parameters: threshold=0.5, exclude_hours=0, limit=5"
echo ""

RESPONSE=$(curl -s "http://localhost:8080/api/v1/learning-loop/boredom-activities?threshold=0.5&exclude_hours=0&limit=5")

echo "📊 Results:"
echo "$RESPONSE" | python3 -m json.tool | head -50

echo ""
echo "📈 Summary:"
COUNT=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data))" 2>/dev/null || echo "0")
echo "   Total activities: $COUNT"

if [ "$COUNT" -gt "0" ]; then
    echo "   ✅ Boredom activities endpoint is working!"
    echo ""
    echo "   Top activity:"
    echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(f\"   - {data[0]['template_id']} (gradient: {data[0]['improvement_gradient']})\")" 2>/dev/null
else
    echo "   ⚠️  No activities found (database may be empty)"
fi

