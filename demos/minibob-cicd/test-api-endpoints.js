#!/usr/bin/env node

import https from 'https';

const endpoints = [
    'https://activity.metabob.com/v2/shapes',
    'https://activity.metabob.com/v2/activities/templates', 
    'https://activity.metabob.com/v2/activities/execution-traces?limit=10'
];

async function testEndpoint(url) {
    return new Promise((resolve) => {
        const req = https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    url,
                    status: res.statusCode,
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    size: data.length,
                    preview: data.substring(0, 100)
                });
            });
        });
        
        req.on('error', (error) => {
            resolve({
                url,
                status: 'ERROR',
                ok: false,
                error: error.message
            });
        });
        
        req.setTimeout(10000, () => {
            req.destroy();
            resolve({
                url,
                status: 'TIMEOUT',
                ok: false,
                error: 'Request timeout'
            });
        });
    });
}

async function main() {
    console.log('🔍 Testing API endpoints for Development State Dashboard...\n');
    
    for (const endpoint of endpoints) {
        const result = await testEndpoint(endpoint);
        console.log(`${result.ok ? '✅' : '❌'} ${endpoint}`);
        console.log(`   Status: ${result.status}`);
        if (result.error) {
            console.log(`   Error: ${result.error}`);
        } else {
            console.log(`   Size: ${result.size} bytes`);
            if (result.preview) {
                console.log(`   Preview: ${result.preview}...`);
            }
        }
        console.log('');
    }
    
    console.log('📊 Dashboard file created at: demos/minibob-cicd/public/development-state.html');
    console.log('🌐 Open in browser to view live dashboard');
}

main().catch(console.error);