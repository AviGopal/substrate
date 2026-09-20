const { resolveTraceRecurringPatternScan } = require('./repos/development-vessel/src/resolvers/trace-recurring-pattern-scan.js');

async function main() {
  const pointer = {
    type: 'trace_recurring_pattern_scan',
    lookbackHours: 24,
    minRecurrence: 3,
    limit: 2000,
    patternsDir: '/workspace/patterns',
    dispatch: false
  };
  
  try {
    const result = await resolveTraceRecurringPatternScan(pointer);
    console.log('Scan Result:', JSON.stringify(result, null, 2));
    
    if (result.body && result.body.has_pattern) {
      console.log('\nPattern found! Creating concept...');
      
      const conceptPointer = {
        type: 'recurringPatternConcept',
        limit: 20
      };
      
      const { resolveRecurringPatternConcept } = require('./repos/development-vessel/src/resolvers/recurring-pattern-concept.js');
      const conceptResult = await resolveRecurringPatternConcept(conceptPointer);
      console.log('Concept Result:', JSON.stringify(conceptResult, null, 2));
    } else {
      console.log('No pattern found to promote to concept.');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
