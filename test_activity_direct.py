import asyncio
import httpx

async def test_activity():
    session_token = "c2Vzc2lvbnM6NjJhNGQ4NTMtNDY3My00NDUwLWIxN2UtNDUyMWY5NmU1YzBlOmV4cC1yZXBvLWRldjo1ODU4NTQ0NC03NjZjLTQyYWQtYTVkMy01OTU5NDE5OWJlZGY="
    
    async with httpx.AsyncClient() as client:
        # Test 1: List templates
        print("=== Test 1: List Templates ===")
        response = await client.get(
            "http://localhost:8080/v2/activities/templates",
            headers={"Authorization": f"Bearer {session_token}"}
        )
        templates = response.json()
        print(f"Found {len(templates.get('templates', []))} templates")
        
        # Find Activity Create template
        activity_create = None
        for t in templates.get('templates', []):
            if t.get('variant_name') == 'Activity Create' and len(t.get('task_steps', [])) > 0:
                activity_create = t
                break
        
        if activity_create:
            print(f"\nFound Activity Create: {activity_create['variant_id']}")
            print(f"Tasks: {len(activity_create['task_steps'])}")
        else:
            print("\nActivity Create template not found or has no tasks!")
            return
        
        # Test 2: Start execution
        print("\n=== Test 2: Start Activity Execution ===")
        execution_id = f"test-exec-{asyncio.get_event_loop().time()}"
        
        start_payload = {
            "template_id": activity_create['variant_id'],
            "variables": {
                "activity_name": "Test Activity",
                "activity_description": "A test activity to validate execution",
                "category": "test"
            },
            "session_id": "test-session",
            "execution_id": execution_id
        }
        
        response = await client.post(
            "http://localhost:8080/v2/activities/record/start",
            headers={"Authorization": f"Bearer {session_token}"},
            json=start_payload
        )
        
        print(f"Start response: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"Execution started: {result.get('execution_id')}")
            
            # Test 3: Get next step
            print("\n=== Test 3: Get Next Step ===")
            response = await client.get(
                f"http://localhost:8080/v2/activities/record/next-step/{execution_id}",
                headers={"Authorization": f"Bearer {session_token}"}
            )
            print(f"Next step response: {response.status_code}")
            if response.status_code == 200:
                step = response.json()
                print(f"Next step: {step}")
        else:
            print(f"Error: {response.text}")

if __name__ == "__main__":
    asyncio.run(test_activity())
