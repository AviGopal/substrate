#!/usr/bin/env python3
"""
Cleanup test sessions from Redis
"""

import redis

r = redis.Redis(host="localhost", port=6379, decode_responses=True)

# Delete all agent_execution:session:* keys
keys = r.keys("agent_execution:session:*")

if keys:
    print(f"Deleting {len(keys)} session key(s) from Redis...")
    r.delete(*keys)
    print("✅ Cleanup complete")
else:
    print("No session keys found to delete")
