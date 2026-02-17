# Activity System Sequence Trace

## Working Path (Direct Python)
```
Python script
  → import search_activities_tool
  → await search_activities_tool(query='', limit=5)
  → _get_server().get_config_manager()
  → get_activity_manager(base_url, session_token)
  → manager.search_activities()
  → httpx GET http://localhost:8080/v2/activities/templates
  → Backend returns 5 templates
  → SUCCESS ✅
```

## Broken Path (OpenCode)
```
OpenCode agent calls search_activities tool
  → OpenCode's SearchActivitiesTool.execute()
  → MetabobCLI.searchActivities()
  → callMCPTool("search_activities", ...)
  → MCP.clients() - get "metabob" client
  → ??? WHERE DOES IT BREAK ???
```

## Let's Find the Break Point

