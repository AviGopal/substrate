#!/usr/bin/env python3
"""Test with correct API paths"""
import asyncio
import aiohttp
import json

API_BASE_URL = "http://api.metabob.local"
API_KEY = "c2Vzc2lvbnM6ZDFmYWU2MGMtM2Y5OS00NzBmLWE1ZGQtZGI5ZTMyOTU0OGY1OmJvb3RzdHJhcC1vcmc6Ym9vdHN0cmFwLXVzZXI="

async def test_endpoint(path: str, method: str = "GET", data: dict = None):
    """Test a single endpoint"""
    headers = {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json"
    }
    url = f"{API_BASE_URL}{path}"
    
    try:
        async with aiohttp.ClientSession() as session:
            if method == "GET":
                async with session.get(url, headers=headers) as resp:
                    status = resp.status
                    try:
                        response_data = await resp.json()
                    except:
                        response_data = await resp.text()
                    return status, response_data
            elif method == "POST":
                async with session.post(url, json=data, headers=headers) as resp:
                    status = resp.status
                    try:
                        response_data = await resp.json()
                    except:
                        response_data = await resp.text()
                    return status, response_data
    except Exception as e:
        return None, str(e)

async def main():
    print("Testing API with correct paths...\n")
    
    tests = [
        ("GET", "/health", None),
        ("GET", "/v2/activities/templates", None),
        ("GET", "/v2/activities/storage/test-activity-123", None),
        ("POST", "/v2/impulses", {
            "impulse_id": "test-impulse-123",
            "api_key": API_KEY,
            "project_id": "test-project",
            "pointer_type": "memo",
            "pointer_data": {"test": "data"},
            "budget": 1000,
            "priority": "high"
        }),
    ]
    
    for method, endpoint, data in tests:
        print(f"{method} {endpoint}...")
        status, response = await test_endpoint(endpoint, method, data)
        if status:
            print(f"  Status: {status}")
            if isinstance(response, dict):
                print(f"  Keys: {list(response.keys())[:10]}")
            elif isinstance(response, str) and len(response) < 200:
                print(f"  Response: {response[:200]}")
        else:
            print(f"  Error: {response}")
        print()

if __name__ == "__main__":
    asyncio.run(main())
