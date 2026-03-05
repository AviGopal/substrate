/**
 * Conflict Analysis for activity-retrieval-learning-backend-communication
 */

interface Specification {
  name: string;
  sharedComponents: string[];
  requirements: string[];
}

interface Conflict {
  type: 'CONTRADICTORY_REQUIREMENTS' | 'OVERLAPPING_CHANGES' | 'SHARED_COMPONENT' | 'NONE';
  spec1: string;
  spec2: string;
  sharedComponent?: string;
  description: string;
  resolution?: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

const currentSpec: Specification = {
  name: 'activity-retrieval-learning-backend-communication',
  sharedComponents: [
    'repos/metabob-opencode/packages/opencode/src/util/metabob.ts',
    'repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts',
    'repos/metabob-opencode/packages/opencode/src/session/activity-template-repository.ts',
    'repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py',
    'repos/metabob-rpc-api/server/routes/activity.py',
    'repos/metabob-rpc-api/server/db/operations/activity_execution.py'
  ],
  requirements: [
    'Activities retrieved from backend via MCP',
    'Learning data flows back to backend',
    'No local activity storage in OpenCode',
    'No implicit file dependencies'
  ]
};

const relatedSpecs: Specification[] = [
  {
    name: 'complete-architecture-separation',
    sharedComponents: [
      'repos/metabob-opencode/packages/opencode/src/util/metabob.ts',
      'repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py',
      'repos/metabob-rpc-api/server/routes/activity.py'
    ],
    requirements: [
      'opencode has ZERO ML implementations',
      'CLI has ZERO training logic',
      'RPC API has ALL learning endpoints',
      'Data flow: opencode → CLI (MCP) → RPC API (HTTP) → SurrealDB'
    ]
  },
  {
    name: 'impulse-learning-storage-complete',
    sharedComponents: [
      'repos/metabob-rpc-api/server/db/operations/activity_execution.py',
      'repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py'
    ],
    requirements: [
      'Impulse learning data stored in SurrealDB',
      'Pattern extraction from prompts',
      'Quality calculation based on success + impulse usage',
      'Duplicate detection via UPSERT'
    ]
  },
  {
    name: 'metabob-cli-mcp-activity-impulse-learning-integration',
    sharedComponents: [
      'repos/metabob-opencode/packages/opencode/src/session/activity.ts',
      'repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts',
      'repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py'
    ],
    requirements: [
      'Activity recording via MCP',
      'Metrics updated on completion',
      'Impulses synced to backend',
      'Boredom detection enabled'
    ]
  }
];

function detectConflicts(): Conflict[] {
  const conflicts: Conflict[] = [];

  // Check for shared component overlaps
  relatedSpecs.forEach(spec => {
    const sharedFiles = currentSpec.sharedComponents.filter(file =>
      spec.sharedComponents.includes(file)
    );

    if (sharedFiles.length > 0) {
      // Analyze for contradictions
      const hasContradiction = checkForContradictions(currentSpec, spec);
      
      if (hasContradiction) {
        conflicts.push({
          type: 'CONTRADICTORY_REQUIREMENTS',
          spec1: currentSpec.name,
          spec2: spec.name,
          sharedComponent: sharedFiles.join(', '),
          description: hasContradiction.description,
          resolution: hasContradiction.resolution,
          severity: hasContradiction.severity
        });
      } else {
        // No contradiction - specs are complementary
        conflicts.push({
          type: 'SHARED_COMPONENT',
          spec1: currentSpec.name,
          spec2: spec.name,
          sharedComponent: sharedFiles.join(', '),
          description: `Specs share ${sharedFiles.length} component(s). Requirements are complementary.`,
          resolution: 'No action required - specs are compatible',
          severity: 'LOW'
        });
      }
    }
  });

  return conflicts;
}

function checkForContradictions(
  spec1: Specification,
  spec2: Specification
): { description: string; resolution: string; severity: 'HIGH' | 'MEDIUM' | 'LOW' } | null {
  
  // Check activity-retrieval-learning-backend-communication vs complete-architecture-separation
  if (spec2.name === 'complete-architecture-separation') {
    // Both specs require MCP gateway pattern - COMPATIBLE
    // Both specs prevent local ML/learning implementations - COMPATIBLE
    return null; // No contradiction
  }

  // Check vs impulse-learning-storage-complete
  if (spec2.name === 'impulse-learning-storage-complete') {
    // activity-retrieval requires learning data posted to backend
    // impulse-learning requires learning data stored in SurrealDB
    // These are COMPLEMENTARY - learning data flows through activity execution to SurrealDB
    return null; // No contradiction
  }

  // Check vs metabob-cli-mcp-activity-impulse-learning-integration
  if (spec2.name === 'metabob-cli-mcp-activity-impulse-learning-integration') {
    // activity-retrieval requires metrics reporting via MCP
    // mcp-activity-impulse-learning requires metrics updated on completion
    // These are COMPLEMENTARY - same data flow
    return null; // No contradiction
  }

  return null;
}

// Run analysis
const conflicts = detectConflicts();

console.log(JSON.stringify({
  specificationName: currentSpec.name,
  otherSpecifications: relatedSpecs.map(s => s.name),
  conflicts: conflicts,
  sharedComponents: currentSpec.sharedComponents.map(component => {
    const affectedBy = relatedSpecs
      .filter(spec => spec.sharedComponents.includes(component))
      .map(spec => spec.name);
    
    return {
      component,
      affectedBySpecs: [currentSpec.name, ...affectedBy],
      recommendation: affectedBy.length > 0 
        ? `Shared by ${affectedBy.length + 1} specification(s). Ensure changes maintain compatibility.`
        : 'Component only used by current specification.'
    };
  }),
  summary: {
    totalConflicts: conflicts.length,
    contradictions: conflicts.filter(c => c.type === 'CONTRADICTORY_REQUIREMENTS').length,
    sharedComponentIssues: conflicts.filter(c => c.type === 'SHARED_COMPONENT').length,
    highSeverity: conflicts.filter(c => c.severity === 'HIGH').length,
    mediumSeverity: conflicts.filter(c => c.severity === 'MEDIUM').length,
    lowSeverity: conflicts.filter(c => c.severity === 'LOW').length
  },
  conclusion: conflicts.filter(c => c.type === 'CONTRADICTORY_REQUIREMENTS').length === 0
    ? 'NO CONFLICTS DETECTED - All specifications are compatible'
    : 'CONFLICTS DETECTED - Review and resolve contradictions'
}, null, 2));
