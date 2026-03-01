import { impulse_create } from './repos/metabob-opencode/src/impulse/impulse-tools.js';

const traceData = {
  specificationName: "surrealdb-primary-redis-cache",
  description: "SurrealDB as single source of truth with Redis as performance cache",
  desiredBehavior: {
    writePath: "Client → rpc-api → SurrealDB (PRIMARY) → Redis cache (TTL)",
    readPath: "Client → rpc-api → Redis (cache hit) OR SurrealDB (cache miss) → populate Redis",
    cacheInvalidation: "On successful SurrealDB write, update Redis cache with TTL"
  },
  dataFlow: {
    entry: "server/actions/activity.py (create_template, record_execution_result)",
    transform: "server/db/operations/template_data.py (SurrealDB writes)",
    validate: "Cache-aside pattern in activity.py",
    exit: "Redis cache population with TTL"
  },
  compliance: {
    overallCompliance: "75%",
    compliantComponents: 8,
    partialCompliantComponents: 1,
    nonCompliantComponents: 1,
    criticalIssues: 2,
    status: "MOSTLY COMPLIANT with 2 critical gaps requiring fixes"
  },
  criticalIssues: [
    {
      component: "record_execution_result",
      file: "repos/metabob-rpc-api/server/actions/activity.py",
      lines: "487-712",
      issue: "Inverted write order: Redis → SurrealDB → Rollback instead of SurrealDB → Redis",
      impact: "Violates single source of truth principle. If SurrealDB write fails after Redis succeeds, requires complex rollback.",
      recommendation: "Reverse write order: Write to SurrealDB first, then update Redis cache on success."
    },
    {
      component: "MetricsAggregator",
      file: "repos/metabob-rpc-api/server/services/metrics_aggregator.py",
      lines: "1-221",
      issue: "Entire service bypasses SurrealDB, writes directly to Redis only",
      impact: "Metrics data not persisted in primary storage. No single source of truth for metrics aggregation.",
      recommendation: "Refactor to use server/db/operations/template_metrics.py which correctly writes to SurrealDB."
    }
  ],
  compliantComponents: [
    "create_template (activity.py:253-401)",
    "list_templates (activity.py:87-196)",
    "get_template_by_id (activity.py:199-250)",
    "create_template_record (template_data.py:26-64)",
    "get_template_by_variant_id (template_data.py:67-92)",
    "list_all_templates (template_data.py:95-123)",
    "insert_execution (activity_execution.py:20-108)",
    "update_metrics_after_execution (template_metrics.py:99-214)"
  ],
  recommendations: [
    {
      priority: "HIGH",
      action: "Fix record_execution_result write order",
      details: "Refactor activity.py:487-712 to write SurrealDB first, then Redis cache. Eliminate rollback complexity."
    },
    {
      priority: "HIGH",
      action: "Deprecate MetricsAggregator service",
      details: "Replace metrics_aggregator.py with calls to server/db/operations/template_metrics.py which already implements SurrealDB-first pattern."
    }
  ]
};

async function createTraceImpulse() {
  try {
    const result = await impulse_create({
      id: 'trace-surrealdb-primary-redis-cache',
      type: 'trace',
      pointer: {
        type: 'memo',
        content: JSON.stringify(traceData, null, 2),
        source: 'trace-data-flow-single-feature'
      },
      budget: 5000
    });
    
    console.log('✅ Trace impulse created successfully');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Failed to create trace impulse:', error);
    process.exit(1);
  }
}

createTraceImpulse();
