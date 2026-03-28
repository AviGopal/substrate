# Test Minimal Activity Execution

Testing activity tool with complete variables in devbob container.

## Command:
```bash
docker exec -it devbob-clean bash -c 'cd /workspace && timeout 600 opencode run "Test the activity tool by calling search_activities with verbose=true and show template details for create-activity-template." 2>&1 | tee /workspace/test-output.log'
```

This tests that:
1. Activity tool can be invoked
2. Template details can be retrieved  
3. No actual activity execution (just info query)
