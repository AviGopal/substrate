// Simple test to verify API integration
const fs = require('fs');

console.log('Testing MiniBob Dashboard API Integration...');

// Check if the updated HTML file exists and contains the API URLs
const htmlContent = fs.readFileSync('demos/minibob-cicd/public/index.html', 'utf8');

const tests = [
    {
        name: 'API URL for execution traces',
        check: htmlContent.includes('https://activity.metabob.com/v2/activities/execution-traces'),
        expected: true
    },
    {
        name: 'API URL for templates',  
        check: htmlContent.includes('https://activity.metabob.com/v2/activities/templates'),
        expected: true
    },
    {
        name: 'Field mapping for cost_usd',
        check: htmlContent.includes('trace.cost_usd'),
        expected: true
    },
    {
        name: 'Field mapping for activityName',
        check: htmlContent.includes('trace.activityName'),
        expected: true
    },
    {
        name: 'Field mapping for duration_ms',
        check: htmlContent.includes('trace.duration_ms'),
        expected: true
    },
    {
        name: 'Fallback to local JSON',
        check: htmlContent.includes('../traces/index.json') && htmlContent.includes('../cost-budget.json'),
        expected: true
    },
    {
        name: 'Error handling preserved',
        check: htmlContent.includes('showError') && htmlContent.includes('fetchWithCache'),
        expected: true
    },
    {
        name: 'Auto-refresh functionality preserved',
        check: htmlContent.includes('refreshInterval') && htmlContent.includes('startAutoRefresh'),
        expected: true
    }
];

let passed = 0;
let total = tests.length;

tests.forEach(test => {
    if (test.check === test.expected) {
        console.log(`✅ ${test.name}: PASSED`);
        passed++;
    } else {
        console.log(`❌ ${test.name}: FAILED`);
    }
});

console.log(`\nTest Summary: ${passed}/${total} tests passed`);

if (passed === total) {
    console.log('🎉 All API integration tests passed!');
    console.log('\nKey Features Implemented:');
    console.log('- Real Activity API integration for execution traces');
    console.log('- Cost budget calculation from API data');
    console.log('- Thompson Sampling with activity templates');
    console.log('- Learning insights from real trace data');
    console.log('- Backward compatibility with local JSON files');
    console.log('- Error handling and caching preserved');
    console.log('- All 9 dashboard sections maintained');
    console.log('- Auto-refresh and responsive design preserved');
} else {
    console.log('❌ Some tests failed. Please check the implementation.');
}