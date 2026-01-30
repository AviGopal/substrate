# Impulse and Activity System Integration Technical Specification

**Date:** January 28, 2026  
**Status:** Comprehensive Requirements Analysis  
**Completion:** 80% Implementation → 100% Final Integration

---

## 🎯 **Executive Summary**

This specification outlines the requirements to complete the final 20% of the impulse and activity system integration. The system is 80% complete with all core infrastructure operational. The remaining work focuses on CLI-RPC API integration, real-time predictive task generation, and comprehensive validation.

---

## 📊 **Current System Assessment**

### ✅ **Implemented Components (80%)**
- **Impulse System Architecture**: Complete pointer-based resolution system with 12 resolver types
- **Activity System Core**: Template execution, state management, tracking, and metrics
- **Memory Management**: Optimization, caching, and token budget controls
- **Metabob Integration**: CPG queries, annotations, issue tracking fully operational
- **RPC API Infrastructure**: SurrealDB integration, activity learning, template evolution
- **Background Processing**: Metrics aggregation, pattern recognition, success prediction

### ⚠️ **Missing Components (20%)**
- **CLI-RPC Communication Layer**: REST client for seamless agent-to-RPC communication
- **Real-time Predictive Engine**: Context-aware task generation and proactive recommendations
- **Cross-container Validation**: End-to-end dataflow testing and integration validation
- **Production Optimization**: Performance tuning and deployment configuration

---

## 🏗️ **System Architecture Analysis**

### **Current Impulse System Architecture**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Impulse Resolution System                          │
└─────────────────────────────────────────────────────────────────────────────┘

Agent Request
    ↓ [Pointer Resolution]
ImpulseResolver.resolveForPrompt()
    ↓ [12 Resolver Types]
┌─────────────┬─────────────┬─────────────┬─────────────┐
│    memo     │    file     │  component  │   commit    │
├─────────────┼─────────────┼─────────────┼─────────────┤
│ metabobIssue│metabobAnnot │activityOut │ bashOutput  │
├─────────────┼─────────────┼─────────────┼─────────────┤
│ templateDef │activityRec │   custom    │ metabob-*   │
└─────────────┴─────────────┴─────────────┴─────────────┘
    ↓ [Content Resolution]
Temporary Cache (5min TTL)
    ↓ [Prompt Building]
LLM Context Injection
```

**Architecture Strengths:**
- ✅ Lazy loading with pointer-based schema prevents memory bloat
- ✅ 5-minute cache prevents redundant resolution calls
- ✅ 12 specialized resolvers cover all use cases
- ✅ Error handling with fallback content
- ✅ Token estimation for budget control

**Architecture Limitations:**
- ⚠️ No cross-session sharing of resolved content
- ⚠️ Limited metrics on resolver performance
- ⚠️ Cache eviction not configurable per resolver type

### **Current Activity System Architecture**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Activity Execution System                          │
└─────────────────────────────────────────────────────────────────────────────┘

Activity Template
    ↓ [Template Execution]
Activity.execute()
    ↓ [Task Orchestration]
Task Engine (Sequential/Parallel)
    ↓ [Agent Delegation] 
Session Management + Tool Execution
    ↓ [State Tracking]
Storage Layer (Activity.Info schema)
    ↓ [Metrics Collection]
Background Processing + Template Evolution
    ↓ [Learning Loop]
Success Prediction + Recommendation Engine
```

**Architecture Strengths:**
- ✅ Comprehensive state tracking with 15+ metrics
- ✅ Template evolution based on execution feedback
- ✅ Memory optimization with session cleanup
- ✅ Git integration and commit tracking
- ✅ Multi-agent coordination support

**Architecture Limitations:**
- ⚠️ Limited real-time predictive capabilities
- ⚠️ No CLI integration for direct agent communication
- ⚠️ Cross-container validation needs improvement

---

## 🔌 **Metabob Integration Requirements**

### **Current Metabob Integration (Complete)**

The system already has comprehensive Metabob integration:

1. **CPG Queries** (✅ Complete)
   ```typescript
   await metabob_search_codebase_issues("pattern search")
   await metabob_list_file_components(file_path)
   await metabob_analyze_change_impact(file_path, component)
   ```

2. **Issue Tracking** (✅ Complete)
   ```typescript
   await metabob_get_priority_issues()
   await metabob_mark_problem_complete(issue_id, resolution)
   ```

3. **Component Annotations** (✅ Complete)
   ```typescript
   await metabob_annotate_component(file, component, type, reason)
   ```

### **Enhanced Metabob Integration for Activity System**

**Priority 1: Activity-Metabob Feedback Loop**
- Use metabob_search_codebase_issues to find similar activity patterns
- Integrate metabob_get_priority_issues with activity recommendation engine
- Auto-annotate activity outcomes with metabob_annotate_component

**Priority 2: Predictive Analysis Integration**
- Leverage Metabob ML for activity success prediction
- Use CPG embeddings for activity pattern matching
- Integrate change impact analysis with activity planning

---

## 🧠 **Memory-Aware Impulse Optimization Strategy**

### **Current Memory Management (Implemented)**

```typescript
// From activity.ts:72-78
export function getMemoryStats() {
  return {
    sessionActivityMapSize: sessionActivityMap.size,
    sessionMemoryMapSize: sessionMemoryMap.size,
    estimatedMemoryKB: (sessionActivityMap.size + sessionMemoryMap.size) * 0.1,
  }
}
```

### **Enhanced Memory Optimization Requirements**

**1. Intelligent Content Caching**
```typescript
interface ImpulseCacheStrategy {
  resolverType: string;
  maxCacheSize: number;
  ttlMinutes: number;
  evictionPolicy: 'LRU' | 'LFU' | 'TIME_BASED';
}

const cacheStrategies: ImpulseCacheStrategy[] = [
  { resolverType: 'file', maxCacheSize: 100, ttlMinutes: 15, evictionPolicy: 'LRU' },
  { resolverType: 'metabobIssue', maxCacheSize: 50, ttlMinutes: 5, evictionPolicy: 'TIME_BASED' },
  { resolverType: 'activityOutput', maxCacheSize: 20, ttlMinutes: 60, evictionPolicy: 'LFU' }
];
```

**2. Budget-Aware Resolution**
```typescript
interface ResolutionBudget {
  maxTokensPerImpulse: number;
  maxTotalTokens: number;
  priorityThreshold: number;
  compressionEnabled: boolean;
}

async function resolveBudgetAware(
  impulse: ActivityTemplate.Impulse.Schema,
  budget: ResolutionBudget
): Promise<ResolvedContent> {
  // Implementation needs budget checking before resolution
}
```

**3. Cross-Session Sharing**
- Implement impulse sharing between sessions for common patterns
- Global cache for frequently accessed file content
- Template-specific impulse pre-loading

---

## 🎯 **Intelligent Context Selection Algorithms**

### **Current Context Selection (Basic)**

The system currently uses basic pointer resolution without intelligent selection. Enhancement needed:

**1. Context Relevance Scoring**
```typescript
interface ContextRelevanceScore {
  impulseId: string;
  relevanceScore: number;  // 0.0 - 1.0
  tokenWeight: number;
  lastUsed: number;
  successRate: number;
}

async function calculateRelevanceScore(
  impulse: ActivityTemplate.Impulse.Schema,
  sessionContext: string,
  agentIntent: string
): Promise<ContextRelevanceScore> {
  // Semantic similarity + historical success + recency
}
```

**2. Dynamic Context Pruning**
```typescript
interface ContextPruningStrategy {
  maxContextTokens: number;
  minRelevanceThreshold: number;
  preserveHighPriority: boolean;
  compressionRatio: number;
}

async function selectOptimalContext(
  availableImpulses: ActivityTemplate.Impulse.Schema[],
  strategy: ContextPruningStrategy
): Promise<ActivityTemplate.Impulse.Schema[]> {
  // Implementation needed
}
```

**3. Adaptive Context Learning**
- Track which impulses lead to successful outcomes
- Learn agent-specific context preferences
- Optimize context selection based on activity type

---

## 🔄 **Cross-Container Validation Approach**

### **Current Container Architecture**

```
devbob-opencode (Activity Mode)
    ↓ [ACP Delegation]
devbob-cli (CLI Interface) 
    ↓ [REST Communication - MISSING]
devbob-rpc-api (Backend Services)
    ↓ [Database Operations]
SurrealDB (Data Persistence)
```

### **Required Integration Components**

**1. CLI-RPC REST Client (Priority 1)**
```python
# In metabob-cli/src/metabob_cli/rpc/
class ActivityAPIClient:
    async def record_activity_outcome(self, outcome: ActivityOutcome):
        """Record activity execution results to RPC API"""
        
    async def get_activity_recommendations(self, context: str) -> List[ActivityRecommendation]:
        """Get ML-powered activity recommendations"""
        
    async def search_activity_patterns(self, query: str) -> List[ActivityPattern]:
        """Search historical activity patterns"""
        
    async def submit_learning_feedback(self, feedback: LearningFeedback):
        """Submit feedback for continuous learning"""
```

**2. End-to-End Validation Tests**
```typescript
// test-activity-integration-full.ts
describe('Full Activity System Integration', () => {
  test('Agent → CLI → RPC API → SurrealDB flow', async () => {
    // 1. Agent creates activity via OpenCode
    // 2. CLI communicates with RPC API  
    // 3. RPC API stores in SurrealDB
    // 4. Background processing updates templates
    // 5. Recommendations flow back to agents
  });
  
  test('Real-time predictive task generation', async () => {
    // Test context-aware task suggestions
  });
  
  test('Cross-container ACP delegation', async () => {
    // Test devbob container communication
  });
});
```

**3. Communication Protocol Definition**
```typescript
interface ActivityCommunicationProtocol {
  // Agent → CLI → RPC API
  activityExecution: {
    endpoint: '/activities/execute',
    method: 'POST',
    auth: 'Bearer token',
    payload: ActivityExecutionRequest
  };
  
  // RPC API → CLI → Agent
  activityRecommendations: {
    endpoint: '/activities/recommendations',
    method: 'GET', 
    params: { context: string, limit: number },
    response: ActivityRecommendation[]
  };
  
  // Bi-directional learning feedback
  learningFeedback: {
    endpoint: '/activities/feedback',
    method: 'POST',
    payload: LearningFeedbackData
  };
}
```

---

## ⚡ **Performance Requirements and Constraints**

### **Current Performance Characteristics**

From the codebase analysis:
- ✅ Impulse resolution cache: 5-minute TTL
- ✅ Activity cleanup: 10-minute intervals  
- ✅ Token estimation: ~4 chars/token approximation
- ✅ Session mapping: O(1) lookup performance

### **Performance Requirements for Remaining 20%**

**1. CLI-RPC Communication Performance**
- **Latency**: < 200ms for activity recommendations
- **Throughput**: Handle 10+ concurrent activity requests
- **Reliability**: 99.9% success rate for API calls
- **Timeout**: 30s max for complex activity operations

**2. Real-time Predictive Engine Performance**
- **Response Time**: < 500ms for context-based predictions
- **Accuracy**: > 75% for activity success predictions
- **Cache Hit Rate**: > 80% for recommendation queries
- **Memory Usage**: < 100MB for prediction models

**3. Cross-Container Validation Performance**
- **End-to-End Latency**: < 5s for full activity cycle
- **ACP Delegation**: < 2s for container communication
- **Database Operations**: < 100ms for activity queries
- **Background Processing**: < 1min for template updates

### **Resource Constraints**

**Memory Constraints:**
```typescript
interface SystemResourceLimits {
  maxImpulsesCached: 1000;
  maxCacheMemoryMB: 50;
  maxSessionsTracked: 100;
  maxActivityHistoryDays: 30;
}
```

**CPU Constraints:**
- Background processing: < 10% CPU utilization
- Real-time predictions: < 5% CPU per request
- Template evolution: Batch processing during low usage

**Network Constraints:**
- CLI-RPC bandwidth: < 1MB per activity operation
- Database connection pooling: Max 10 connections
- WebSocket connections: Max 50 concurrent

---

## 💾 **Data Models and Schema Changes**

### **Current Data Models (Complete)**

The system has comprehensive data models:
- ✅ `Activity.Info` (45+ fields including stats, commits, impulses)
- ✅ `ActivityTemplate` (template repository integration) 
- ✅ `Todo.Info` (task tracking)
- ✅ `ActivityStats` (comprehensive metrics)

### **Required Schema Extensions**

**1. CLI Integration Schema**
```typescript
interface CLIActivityRequest {
  sessionId: string;
  agentId: string;
  activityType: string;
  context: string;
  priority: 'high' | 'medium' | 'low';
  expectedOutcomes: string[];
  timeout: number;
}

interface CLIActivityResponse {
  activityId: string;
  status: 'accepted' | 'queued' | 'rejected';
  estimatedDuration: number;
  estimatedCost: number;
  recommendations: ActivityRecommendation[];
}
```

**2. Predictive Engine Schema**
```typescript
interface PredictiveContext {
  currentFiles: string[];
  recentActions: string[];
  projectDomain: string;
  agentHistory: string[];
  timeContext: Date;
}

interface TaskPrediction {
  taskId: string;
  description: string;
  confidence: number;  // 0.0 - 1.0
  suggestedActivity: string;
  reasoning: string[];
  priority: number;
}
```

**3. Cross-Container Communication Schema**
```typescript
interface ACPActivityDelegation {
  sourceContainer: string;
  targetContainer: string;
  taskDescription: string;
  sharedImpulses: string[];
  expectedOutcome: string;
  maxDuration: number;
}

interface ACPActivityResult {
  success: boolean;
  duration: number;
  tokensUsed: number;
  toolsExecuted: string[];
  errorDetails?: string;
}
```

---

## 🌐 **API Changes and New Interfaces**

### **Current API Status (RPC-API)**

- ✅ Activity Management (deprecated, being replaced)
- ✅ Activity Recommendations (functional)  
- ✅ Activity Learning (complete)
- ✅ Background Processing (operational)

### **Required New Interfaces**

**1. CLI Integration Endpoints**
```python
# New routes in metabob-rpc-api/server/routes/cli_integration.py

@router.post("/cli/activities/execute")
async def execute_activity_from_cli(request: CLIActivityRequest) -> CLIActivityResponse:
    """Handle activity execution requests from CLI"""
    
@router.get("/cli/activities/recommendations")  
async def get_cli_recommendations(context: str, limit: int = 5) -> List[ActivityRecommendation]:
    """Get activity recommendations for CLI agents"""
    
@router.post("/cli/activities/feedback")
async def submit_cli_feedback(feedback: CLIFeedbackData) -> dict:
    """Submit execution feedback from CLI"""
```

**2. Real-time Prediction Endpoints**
```python
# New routes in metabob-rpc-api/server/routes/predictive_engine.py

@router.post("/predict/tasks")
async def predict_tasks(context: PredictiveContext) -> List[TaskPrediction]:
    """Generate context-aware task predictions"""
    
@router.get("/predict/next-activities")
async def suggest_next_activities(project_id: str) -> List[ActivitySuggestion]:
    """Suggest next activities based on project state"""
    
@router.post("/predict/success-rate")
async def predict_success_rate(activity_id: str, context: dict) -> SuccessPrediction:
    """Predict success rate for activity in given context"""
```

**3. Integration Monitoring Endpoints**
```python
# New routes in metabob-rpc-api/server/routes/system_monitoring.py

@router.get("/monitor/integration-health")
async def check_integration_health() -> IntegrationHealthStatus:
    """Check health of CLI-RPC-DB integration"""
    
@router.get("/monitor/performance-metrics")
async def get_performance_metrics() -> PerformanceMetrics:
    """Get system performance metrics"""
    
@router.get("/monitor/prediction-accuracy")
async def get_prediction_accuracy() -> PredictionAccuracyReport:
    """Get prediction system accuracy metrics"""
```

---

## 🧪 **Testing Strategy Across DevBob Containers**

### **Container-Specific Testing**

**1. devbob-opencode (Activity Mode)**
```typescript
// Test activity creation and execution
describe('OpenCode Activity Integration', () => {
  test('Activity template execution', async () => {
    // Test template loading and execution
  });
  
  test('Impulse system integration', async () => {
    // Test impulse resolution with activities
  });
  
  test('Memory optimization under load', async () => {
    // Test memory usage during complex activities
  });
});
```

**2. devbob-cli (CLI Interface)**
```python
# Test CLI-RPC communication
import pytest
from metabob_cli.rpc.activity_client import ActivityAPIClient

@pytest.mark.asyncio
async def test_cli_rpc_communication():
    client = ActivityAPIClient()
    
    # Test activity execution request
    response = await client.record_activity_outcome(sample_outcome)
    assert response.success is True
    
    # Test recommendation retrieval
    recommendations = await client.get_activity_recommendations("add REST endpoint")
    assert len(recommendations) > 0
```

**3. devbob-rpc-api (Backend Services)**
```python
# Test RPC API endpoints
@pytest.mark.asyncio
async def test_activity_learning_integration():
    # Test learning system updates
    # Test prediction accuracy
    # Test database operations
```

### **Cross-Container Integration Tests**

**1. End-to-End Activity Flow Test**
```typescript
describe('Full System Integration', () => {
  test('Agent → CLI → RPC → DB → Response flow', async () => {
    // 1. Create activity in devbob-opencode
    const activity = await createActivity({
      templateId: 'add-rest-endpoint',
      variables: { path: '/api/test', method: 'POST' }
    });
    
    // 2. Verify CLI communication
    const cliResponse = await callCLIEndpoint('/activities/execute', activity);
    expect(cliResponse.status).toBe('accepted');
    
    // 3. Check RPC API processing
    const rpcStatus = await checkRPCProcessing(activity.id);
    expect(rpcStatus.processed).toBe(true);
    
    // 4. Validate database storage
    const dbRecord = await queryDatabase(activity.id);
    expect(dbRecord.stored).toBe(true);
    
    // 5. Confirm feedback loop
    const recommendations = await getRecommendations(activity.context);
    expect(recommendations.length).toBeGreaterThan(0);
  });
});
```

**2. Real-time Prediction Test**
```typescript
describe('Predictive Task Generation', () => {
  test('Context-aware task predictions', async () => {
    // Simulate development context
    const context = {
      currentFiles: ['src/auth.py', 'src/models/user.py'],
      recentActions: ['added authentication', 'created user model'],
      projectDomain: 'web_application'
    };
    
    // Request predictions
    const predictions = await getPredictiveTasks(context);
    
    // Validate predictions
    expect(predictions.length).toBeGreaterThan(0);
    expect(predictions[0].confidence).toBeGreaterThan(0.7);
    expect(predictions[0].suggestedActivity).toContain('test');
  });
});
```

**3. Performance and Load Testing**
```typescript
describe('System Performance', () => {
  test('Handle 10 concurrent activity requests', async () => {
    const activities = Array(10).fill(null).map(() => createSampleActivity());
    
    const startTime = Date.now();
    const results = await Promise.all(activities.map(executeActivity));
    const endTime = Date.now();
    
    expect(endTime - startTime).toBeLessThan(30000); // 30s timeout
    expect(results.every(r => r.success)).toBe(true);
  });
  
  test('Memory usage stays within limits', async () => {
    // Monitor memory during extended test
    const memoryMonitor = startMemoryMonitoring();
    
    await executeExtendedWorkload();
    
    const memoryStats = memoryMonitor.getStats();
    expect(memoryStats.maxMemoryMB).toBeLessThan(200);
    expect(memoryStats.memoryLeaks).toBe(0);
  });
});
```

---

## 🎯 **Implementation Roadmap**

### **Phase 1: CLI-RPC Integration (Days 1-4)**

**Day 1-2: CLI REST Client Implementation**
- Create `ActivityAPIClient` in metabob-cli
- Implement REST communication with RPC API
- Add authentication and error handling

**Day 3-4: RPC API Endpoints**
- Create CLI integration routes
- Implement activity execution endpoints
- Add monitoring and logging

**Success Criteria:**
- ✅ CLI can successfully communicate with RPC API
- ✅ Activity execution requests processed correctly
- ✅ Error handling and retries work properly

### **Phase 2: Real-time Predictive Engine (Days 5-8)**

**Day 5-6: Prediction Algorithm Implementation**
- Enhance activity learning system
- Add context-aware task generation
- Implement success rate prediction

**Day 7-8: Integration and Optimization**
- Connect predictive engine to CLI
- Optimize prediction performance
- Add caching for common predictions

**Success Criteria:**
- ✅ Real-time task predictions working
- ✅ Prediction accuracy > 75%
- ✅ Response time < 500ms

### **Phase 3: Cross-Container Validation (Days 9-12)**

**Day 9-10: Integration Testing Infrastructure**
- Set up end-to-end test environment
- Create cross-container test cases
- Implement performance monitoring

**Day 11-12: Validation and Bug Fixes**
- Run comprehensive integration tests
- Fix identified issues
- Optimize performance bottlenecks

**Success Criteria:**
- ✅ All integration tests passing
- ✅ Performance requirements met
- ✅ System stability verified

### **Phase 4: Production Optimization (Days 13-14)**

**Day 13: Performance Tuning**
- Optimize database queries
- Tune cache configurations
- Improve memory management

**Day 14: Documentation and Deployment**
- Complete system documentation
- Prepare deployment configurations
- Create operational runbooks

**Success Criteria:**
- ✅ Production-ready configuration
- ✅ Complete documentation
- ✅ Monitoring and alerting set up

---

## 📊 **Success Metrics and Validation**

### **Technical Metrics**

**Performance Metrics:**
- Activity execution latency: < 5s end-to-end
- CLI-RPC communication: < 200ms
- Prediction response time: < 500ms
- Memory usage: < 200MB total system
- CPU usage: < 15% average

**Quality Metrics:**
- Prediction accuracy: > 75%
- Activity success rate: > 85%
- System availability: > 99.9%
- Error rate: < 1%

**Integration Metrics:**
- Cross-container communication success: > 99%
- Data consistency across components: 100%
- End-to-end test pass rate: 100%

### **Development Metrics**

**Developer Experience:**
- Task completion speed improvement: 25%
- Reduction in context-switching: 40%
- Proactive assistance effectiveness: 70%

**System Health:**
- Template evolution accuracy: > 80%
- Learning system improvement rate: 10% per week
- Background processing efficiency: > 95%

---

## 🔍 **Risk Assessment and Mitigation**

### **Technical Risks**

**Risk 1: ACP Communication Failures**
- **Impact:** High - blocks cross-container testing
- **Mitigation:** Implement alternative communication protocols, fix ACP issues
- **Contingency:** Use direct REST communication between containers

**Risk 2: Performance Degradation**  
- **Impact:** Medium - affects user experience
- **Mitigation:** Comprehensive performance testing, optimization
- **Contingency:** Fallback to simplified prediction algorithms

**Risk 3: Data Consistency Issues**
- **Impact:** High - corrupts learning system
- **Mitigation:** Transaction-based database operations, validation
- **Contingency:** Database rollback and recovery procedures

### **Integration Risks**

**Risk 4: CLI-RPC Protocol Mismatch**
- **Impact:** Medium - breaks communication
- **Mitigation:** Clear API specification, contract testing
- **Contingency:** Version-aware protocol handlers

**Risk 5: Memory Leaks in Production**
- **Impact:** High - system instability
- **Mitigation:** Extensive memory testing, monitoring
- **Contingency:** Automatic restart policies, memory limits

---

## 🏁 **Conclusion**

The impulse and activity system integration is 80% complete with solid architectural foundations. The remaining 20% focuses on:

1. **CLI Integration** - Connecting agents directly to RPC API
2. **Predictive Engine** - Real-time context-aware task generation  
3. **Validation** - Comprehensive testing and optimization
4. **Production** - Performance tuning and deployment

**Key Success Factors:**
- Leverage existing robust infrastructure
- Focus on integration over rebuilding
- Maintain performance requirements
- Ensure comprehensive testing

**Timeline:** 14 days to full completion with systematic phase approach.

**Expected Outcome:** A fully integrated, high-performance activity tracking and evolution system that provides proactive development assistance with 85%+ accuracy and sub-second response times.