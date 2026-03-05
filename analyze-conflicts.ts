#!/usr/bin/env bun
import fs from 'fs';

// Our specification's key components
const ourSpec = {
  name: "Activity Template Flow via MCP Backend",
  components: [
    "repos/metabob-opencode/packages/opencode/src/session/template-loader.ts",
    "repos/metabob-opencode/packages/opencode/src/server/template-service-client.ts",
    "repos/metabob-opencode/packages/opencode/src/util/metabob.ts",
    "repos/metabob-opencode/packages/opencode/src/agent/agent.ts",
    "repos/metabob-opencode/packages/opencode/src/tool/activity.ts",
    "repos/metabob-rpc-api/server/routes/activity.py",
    "repos/metabob-rpc-api/server/actions/activity.py"
  ],
  requirements: [
    "TemplateLoader returns source='metabob' for backend templates",
    "No direct file access to .metabob/activities/*.json",
    "MetabobCLI has no local template writes",
    "Activity agent has search_activities, no impulse tools",
    "Memory agent has impulse tools",
    "TemplateServiceClient delegates to MetabobCLI"
  ]
};

// Load all validation results
const validationFiles = fs.readdirSync('./impulses')
  .filter(f => f.startsWith('validation-results-') && f.endsWith('.json'))
  .filter(f => f !== 'validation-results-activity-template-flow-via-mcp-backend.json');

console.log(`Found ${validationFiles.length} other validation results to analyze\n`);

const relatedSpecs: any[] = [];
const potentialConflicts: any[] = [];

validationFiles.forEach(file => {
  try {
    const content = JSON.parse(fs.readFileSync(`./impulses/${file}`, 'utf-8'));
    const specName = content.metadata?.specification || file.replace('validation-results-', '').replace('.json', '');
    
    // Check if this spec might touch our components
    const contentStr = JSON.stringify(content).toLowerCase();
    
    const touchesOurComponents = 
      contentStr.includes('template') ||
      contentStr.includes('activity') ||
      contentStr.includes('agent') ||
      contentStr.includes('mcp') ||
      contentStr.includes('metabob');
    
    if (touchesOurComponents) {
      relatedSpecs.push({
        name: specName,
        file,
        status: content.metadata?.overallStatus || 'UNKNOWN',
        tests: content.metadata?.totalTests || 0,
        passed: content.metadata?.passed || 0
      });
    }
  } catch (error) {
    // Skip invalid JSON
  }
});

console.log('═'.repeat(70));
console.log('Related Specifications');
console.log('═'.repeat(70));

relatedSpecs.forEach((spec, i) => {
  console.log(`\n${i + 1}. ${spec.name}`);
  console.log(`   Status: ${spec.status}`);
  console.log(`   Tests: ${spec.passed}/${spec.tests}`);
  console.log(`   File: ${spec.file}`);
});

console.log(`\n${'═'.repeat(70)}`);
console.log(`Total Related Specs: ${relatedSpecs.length}`);
console.log('═'.repeat(70));

// Analyze specific conflicts
console.log('\n\n🔍 Analyzing Potential Conflicts...\n');

// Check for architecture separation specs
const architectureSeparation = relatedSpecs.find(s => 
  s.name.includes('architecture-separation') || s.name.includes('complete-architecture')
);

if (architectureSeparation) {
  console.log(`✅ Found: ${architectureSeparation.name}`);
  console.log(`   This spec likely ALIGNS with our specification (both enforce separation)`);
  console.log(`   Status: ${architectureSeparation.status}`);
}

// Check for MCP data flow specs
const mcpDataFlow = relatedSpecs.filter(s => 
  s.name.includes('mcp-data-flow') || s.name.includes('mcp')
);

if (mcpDataFlow.length > 0) {
  console.log(`\n✅ Found ${mcpDataFlow.length} MCP data flow spec(s):`);
  mcpDataFlow.forEach(s => {
    console.log(`   - ${s.name} (${s.status})`);
  });
  console.log(`   These specs likely ALIGN with our MCP backend flow requirement`);
}

// Check for activity-related specs
const activitySpecs = relatedSpecs.filter(s => 
  s.name.includes('activity') && !s.name.includes('template-flow')
);

if (activitySpecs.length > 0) {
  console.log(`\n⚠️  Found ${activitySpecs.length} other activity-related spec(s):`);
  activitySpecs.forEach(s => {
    console.log(`   - ${s.name} (${s.status})`);
  });
  console.log(`   Need to check if these specs have conflicting requirements`);
}

// Check for bootstrap template specs
const bootstrapSpecs = relatedSpecs.filter(s => 
  s.name.includes('bootstrap')
);

if (bootstrapSpecs.length > 0) {
  console.log(`\n✅ Found ${bootstrapSpecs.length} bootstrap template spec(s):`);
  bootstrapSpecs.forEach(s => {
    console.log(`   - ${s.name} (${s.status})`);
  });
  console.log(`   These specs define bootstrap fallback behavior (complements our spec)`);
}

// Write analysis to file
const analysis = {
  specificationName: ourSpec.name,
  analyzedDate: new Date().toISOString(),
  totalRelatedSpecs: relatedSpecs.length,
  relatedSpecs: relatedSpecs.map(s => ({
    name: s.name,
    status: s.status,
    relationship: 
      s.name.includes('architecture-separation') ? 'ALIGNS' :
      s.name.includes('mcp') ? 'ALIGNS' :
      s.name.includes('bootstrap') ? 'COMPLEMENTS' :
      'UNKNOWN'
  })),
  potentialConflicts: [],
  sharedComponents: ourSpec.components
};

fs.writeFileSync('./conflict-analysis-preliminary.json', JSON.stringify(analysis, null, 2));
console.log('\n\n✅ Preliminary analysis saved to conflict-analysis-preliminary.json');
