# Agent Self-Improvement System Status

## Overview

Building **agent-level self-improvement** to complement the existing infrastructure-level improvements.

### Two Parallel Loops

1. **Infrastructure Loop** ✅ **COMPLETE**
   - Collects operational data (sessions, jobs, queue depth)
   - Analyzes algorithmically (detects anomalies)
   - Modifies infrastructure code (docker-compose.yaml)
   - **Working end-to-end**

2. **Agent Loop** 🔄 **IN PROGRESS** 
   - Collects agent execution data (tool usage, outcomes, reflections)
   - Analyzes agent behavior patterns
   - Modifies agent code (opencode, cli)
   - **Backend API complete, integration needed**

---

## Current Status: Backend API Complete and Tested ✅

### What We Built Today

**1. Backend API (`repos/metabob-rpc-api/server/actions/agent_execution.py`)**
- ✅ Fixed import errors (Redis client, logger)
- ✅ Fixed async/await issues (Redis is sync client)
- ✅ Session tracking (start, complete)
- ✅ Tool invocation tracking
- ✅ Statistics aggregation
- ✅ Redis storage with TTLs
- **Status**: ✅ Working and tested

**2. API Routes (`repos/metabob-rpc-api/server/routes/agent_execution.py`)**
- ✅ POST `/api/agent-execution/session/start` - Working ✓
- ✅ POST `/api/agent-execution/tool/invocation` - Working ✓
- ✅ POST `/api/agent-execution/session/complete` - Working ✓
- ✅ GET `/api/agent-execution/agent/{agent_id}/statistics` - Working ✓
- ✅ GET `/api/agent-execution/agent/{agent_id}/sessions` - Working ✓
- ✅ Registered in `app.py`
- **Status**: ✅ All endpoints tested and working

**3. OpenCode Tracker (`repos/metabob-opencode/packages/opencode/src/session/agent-execution-tracker.ts`)**
- ✅ Agent identity tracking
- ✅ Session lifecycle tracking
- ✅ Tool metrics collection
- ✅ HTTP client for backend API
- **Status**: Needs integration

**4. Tool Instrumentation (`repos/metabob-opencode/packages/opencode/src/tool/tool-instrumentation.ts`)**
- ✅ Automatic tool wrapping
- ✅ Success/failure tracking
- ✅ Duration metrics
- ✅ Error type collection
- **Status**: Needs integration

---

## ✅ Phase 1 Complete: Backend API Working

**All tests passed:**

```bash
# ✅ Session start
curl -X POST http://localhost:8080/api/agent-execution/session/start
# Response: {"status":"success","session_id":"test-123","message":"Session tracking started"}

# ✅ Tool invocation
curl -X POST http://localhost:8080/api/agent-execution/tool/invocation
# Response: {"status":"success","message":"Tool invocation recorded"}

# ✅ Session complete
curl -X POST http://localhost:8080/api/agent-execution/session/complete
# Response: {"status":"success","session_id":"test-123","message":"Session completed and recorded"}

# ✅ Agent statistics
curl http://localhost:8080/api/agent-execution/agent/test-agent/statistics
# Returns: tool stats, success rates, session counts

# ✅ Recent sessions
curl http://localhost:8080/api/agent-execution/agent/test-agent/sessions?limit=5
# Returns: list of recent sessions with full details

# ✅ Redis data verified
docker exec metabob-redis redis-cli GET "agent_execution:session:test-123"
# Data present and correct ✓
```

## What We Need to Do Next

### Priority 1: Wire Up OpenCode Integration (Next Step)

### Priority 2: Wire Up OpenCode Agent

**Integrate AgentExecutionTracker into opencode session lifecycle:**

1. Import tracker in session initialization
2. Call `startSession()` when session begins
3. Call `recordToolInvocation()` after each tool
4. Call `completeSession()` when session ends

**Files to modify:**
- `repos/metabob-opencode/packages/opencode/src/session/session.ts`
- `repos/metabob-opencode/packages/opencode/src/tool/tool-manager.ts`

### Priority 3: Apply Tool Instrumentation

**Wrap all tools with instrumentation:**

```typescript
// In tool registration
import { instrumentTool } from './tool-instrumentation';

const wrappedTool = instrumentTool(originalTool, tracker);
registerTool(wrappedTool);
```

### Priority 4: Build Agent Analyzer

**Create analyzer that processes Redis data:**

```python
#!/usr/bin/env python3
"""
Agent Self-Improvement Analyzer

Analyzes agent execution data to generate improvement instructions.
"""

import redis
import json
from collections import defaultdict

def analyze_agent_data(agent_id: str):
    """
    Analyze agent execution data to find improvement opportunities.
    
    Returns:
    - Low success rate tools (need fixes)
    - Successful patterns (replicate)
    - Common error patterns (address)
    - Improvement instructions for code
    """
    r = redis.Redis(host='localhost', port=6379, decode_responses=True)
    
    # Get agent statistics
    summary_key = f"agent_execution:agent:{agent_id}:summary"
    summary = r.hgetall(summary_key)
    
    # Get tool statistics
    tool_keys = r.keys(f"agent_execution:agent:{agent_id}:tool:*")
    tool_stats = []
    
    for tool_key in tool_keys:
        tool_data = r.hgetall(tool_key)
        tool_name = tool_key.split(":")[-1]
        
        count = int(tool_data.get("count", 0))
        success = int(tool_data.get("success", 0))
        failure = int(tool_data.get("failure", 0))
        
        success_rate = success / count if count > 0 else 0
        
        tool_stats.append({
            "tool_name": tool_name,
            "count": count,
            "success_rate": success_rate,
            "failure_count": failure
        })
    
    # Find problems
    problems = []
    
    # Problem: Tools with low success rate
    for tool in tool_stats:
        if tool["success_rate"] < 0.7 and tool["count"] > 5:
            problems.append({
                "type": "low_success_rate",
                "tool": tool["tool_name"],
                "success_rate": tool["success_rate"],
                "recommendation": f"Investigate {tool['tool_name']} - only {tool['success_rate']*100:.1f}% success rate"
            })
    
    # Problem: Tools with high failure count
    for tool in tool_stats:
        if tool["failure_count"] > 10:
            problems.append({
                "type": "high_failure_count",
                "tool": tool["tool_name"],
                "failure_count": tool["failure_count"],
                "recommendation": f"Fix {tool['tool_name']} - {tool['failure_count']} failures"
            })
    
    return {
        "agent_id": agent_id,
        "summary": summary,
        "tool_stats": tool_stats,
        "problems": problems,
        "improvement_instructions": generate_improvement_instructions(problems)
    }

def generate_improvement_instructions(problems):
    """Generate concrete code improvement instructions."""
    instructions = []
    
    for problem in problems:
        if problem["type"] == "low_success_rate":
            instructions.append({
                "file": f"repos/metabob-opencode/src/tools/{problem['tool']}.ts",
                "action": "improve_error_handling",
                "details": f"Add retry logic and better error messages for {problem['tool']}"
            })
        
        elif problem["type"] == "high_failure_count":
            instructions.append({
                "file": f"repos/metabob-opencode/src/tools/{problem['tool']}.ts",
                "action": "add_validation",
                "details": f"Add input validation to prevent common failures in {problem['tool']}"
            })
    
    return instructions

if __name__ == "__main__":
    analysis = analyze_agent_data("metabob-opencode")
    print(json.dumps(analysis, indent=2))
```

### Priority 5: Close the Loop

**Automatically apply improvements:**

1. Analyzer detects low success rate for `read` tool
2. Generates instruction: "Add validation for file paths"
3. Code updater modifies `read.ts`:
   - Adds path validation
   - Adds better error messages
   - Adds retry for transient failures
4. Commits changes with message: "Auto-improvement: Fix read tool (success rate was 65%)"
5. Next session uses improved tool
6. Success rate increases to 95%
7. **Self-improvement loop complete!**

---

## Data Flow

### Agent Execution → Backend API → Redis

```
OpenCode Agent
  │
  ├─ Session starts
  │   └─→ POST /api/agent-execution/session/start
  │        └─→ Redis: agent_execution:session:{id}
  │
  ├─ Tool invoked (read, write, bash, etc.)
  │   └─→ POST /api/agent-execution/tool/invocation
  │        ├─→ Redis: session data updated
  │        └─→ Redis: agent_execution:agent:{id}:tool:{name}
  │
  └─ Session completes
      └─→ POST /api/agent-execution/session/complete
           ├─→ Redis: session marked complete
           └─→ Redis: agent_execution:agent:{id}:summary
```

### Redis → Analyzer → Code Updates

```
Redis Data
  │
  ├─ Tool statistics (success rates, durations)
  ├─ Session outcomes (goal achieved, tests passed)
  └─ Reflection data (what worked, what didn't)
       │
       └─→ Analyzer Script
            │
            ├─ Detect low success rate tools
            ├─ Detect common error patterns
            ├─ Detect successful tool combinations
            └─ Generate improvement instructions
                 │
                 └─→ Code Updater
                      │
                      ├─ Modify tool implementations
                      ├─ Add error handling
                      ├─ Add validation
                      ├─ Add retry logic
                      └─ Commit changes
                           │
                           └─→ Improved Agent ✓
```

---

## Key Insight: Why Two Loops?

**Infrastructure Loop (System → Infrastructure Code)**
- **What**: Redis queue depth, service health, resource usage
- **How**: Threshold-based detection, anomaly detection
- **Changes**: docker-compose.yaml, scaling configs, resource limits
- **Example**: High queue depth → Add celery worker

**Agent Loop (Agent → Agent Code)**
- **What**: Tool success rates, goal achievement, reflection data
- **How**: Pattern analysis, success correlation, error clustering
- **Changes**: tool implementations, prompt strategies, validation logic
- **Example**: Low read tool success → Add path validation

Both loops use the **same pattern** (data → analysis → code changes) but operate on **different layers** of the system.

---

## Files Created/Modified

### Backend (Complete ✅)
- `repos/metabob-rpc-api/server/actions/agent_execution.py` - API logic
- `repos/metabob-rpc-api/server/routes/agent_execution.py` - HTTP endpoints
- `repos/metabob-rpc-api/server/routes/__init__.py` - Router registration
- `repos/metabob-rpc-api/server/app.py` - App integration

### OpenCode (Needs Integration ⏳)
- `repos/metabob-opencode/packages/opencode/src/session/agent-execution-tracker.ts` - Tracker
- `repos/metabob-opencode/packages/opencode/src/tool/tool-instrumentation.ts` - Instrumentation

### Analysis Scripts (To Be Created ⏳)
- `/tmp/agent_analyzer.py` - Analyze agent data for improvements
- `/tmp/agent_code_updater.py` - Apply improvements to agent code

---

## Success Criteria

### Phase 1: Data Collection (Next)
- ✅ Backend API returns 200 for all endpoints
- ✅ Data appears in Redis with correct structure
- ✅ OpenCode agent sends data on session lifecycle
- ✅ Tool invocations are tracked automatically

### Phase 2: Analysis (After Phase 1)
- ✅ Analyzer identifies tool with <70% success rate
- ✅ Analyzer generates improvement instruction
- ✅ Pattern detection finds successful tool combinations

### Phase 3: Code Updates (Final)
- ✅ Code updater modifies tool implementation
- ✅ Changes improve success rate measurably
- ✅ System runs full loop: data → analysis → code → improved agent

### Phase 4: Automation
- ✅ Loop runs automatically (cron job or background service)
- ✅ Improvements tracked over time
- ✅ System self-improves without human intervention

---

## Next Session Commands

```bash
# Test backend API
cd /home/avi/documents/work/exp-repo/metabob-devbob
docker-compose --profile stable up -d
curl http://localhost:8080/api/agent-execution/agent/metabob-opencode/statistics

# Check Redis data
docker exec -it metabob-redis redis-cli
> KEYS agent_execution:*

# Wire up OpenCode integration
cd repos/metabob-opencode
# Edit session.ts to use AgentExecutionTracker
# Edit tool-manager.ts to use instrumentTool

# Test end-to-end
# 1. Start OpenCode with OPENCODE_ENABLE_INSTRUMENTATION=true
# 2. Run a simple task (read a file)
# 3. Check Redis for data
# 4. Verify API returns statistics
```

---

## Questions to Answer

1. **Does data reach the backend API?** Test with curl
2. **Is data stored correctly in Redis?** Check with redis-cli
3. **Can we retrieve statistics?** GET /agent/{id}/statistics
4. **What's the tool success rate baseline?** Analyze after 10-20 sessions
5. **Which tools fail most often?** Sort by failure count
6. **What patterns correlate with success?** Cross-reference tool combinations with outcomes

---

## Timeline Estimate

- **Now**: Backend API complete, integration needed
- **+2 hours**: OpenCode integration, end-to-end data flow working
- **+4 hours**: Analyzer built, generating insights
- **+6 hours**: Code updater built, first automated improvement
- **+8 hours**: Full loop running, measurable improvements

**Total**: 1 day to working self-improvement loop

---

## Lessons Learned

1. **Start with backend**: API first, then frontend integration
2. **Fix imports early**: Don't let linter errors accumulate
3. **Use existing patterns**: Followed RPC API conventions for routes/actions
4. **Dependency injection**: Redis client passed as parameter (FastAPI Depends)
5. **Incremental testing**: Test each component before integration

---

## Resources

- **Backend API Docs**: http://localhost:8080/docs (when running)
- **Redis Data Explorer**: `docker exec -it metabob-redis redis-cli`
- **Session Memory**: Check `<session_memory>` for context
- **Infrastructure Analyzer**: `/tmp/simple_analyzer.py` (working reference)
