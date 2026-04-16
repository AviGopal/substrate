#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Configuration Validation Test
 * Demonstrates loading and validating configuration functionality
 */

function loadConfig(configPath) {
    try {
        const configContent = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(configContent);
    } catch (error) {
        throw new Error(`Failed to load config from ${configPath}: ${error.message}`);
    }
}

function validateConfiguration(config) {
    const validationResults = {
        passed: [],
        failed: [],
        warnings: []
    };

    // Test 1: Check if metabob section exists
    if (config.metabob) {
        validationResults.passed.push('✓ Metabob configuration section found');
        
        // Test 2: Check if metabob is enabled
        const enabled = config.metabob.enabled;
        if (enabled === 'true' || enabled === true || enabled === '${METABOB_ENABLED:-true}') {
            validationResults.passed.push('✓ Metabob is enabled');
        } else {
            validationResults.failed.push('✗ Metabob is disabled');
        }
        
        // Test 3: Check activity learning configuration
        if (config.metabob.activity_learning && config.metabob.activity_learning.enabled) {
            validationResults.passed.push('✓ Activity learning is enabled');
        } else {
            validationResults.warnings.push('⚠ Activity learning is disabled');
        }
        
        // Test 4: Check development metrics
        if (config.metabob.development_metrics && config.metabob.development_metrics.enabled) {
            validationResults.passed.push('✓ Development metrics tracking is enabled');
        }
    } else {
        validationResults.failed.push('✗ Metabob configuration section missing');
    }

    // Test 5: Check provider configuration
    if (config.provider) {
        validationResults.passed.push('✓ Provider configuration found');
        
        if (config.provider.anthropic || config.provider.openai) {
            validationResults.passed.push('✓ AI provider endpoints configured');
        } else {
            validationResults.failed.push('✗ No AI providers configured');
        }
    } else {
        validationResults.failed.push('✗ Provider configuration missing');
    }

    // Test 6: Check session memory configuration
    if (config.sessionMemory && config.sessionMemory.enabled) {
        validationResults.passed.push('✓ Session memory is enabled');
        
        if (config.sessionMemory.budgets && config.sessionMemory.budgets.total > 0) {
            validationResults.passed.push('✓ Memory budgets configured');
        }
    }

    return validationResults;
}

function writeSuccessMessage(results) {
    const timestamp = new Date().toISOString();
    const totalTests = results.passed.length + results.failed.length + results.warnings.length;
    const passedTests = results.passed.length;
    const failedTests = results.failed.length;
    
    const successMessage = `
🎉 CONFIGURATION VALIDATION COMPLETE 🎉

Timestamp: ${timestamp}
Total Tests: ${totalTests}
Passed: ${passedTests}
Failed: ${failedTests}
Warnings: ${results.warnings.length}

PASSED TESTS:
${results.passed.map(test => `  ${test}`).join('\n')}

${results.failed.length > 0 ? `FAILED TESTS:\n${results.failed.map(test => `  ${test}`).join('\n')}\n\n` : ''}${results.warnings.length > 0 ? `WARNINGS:\n${results.warnings.map(test => `  ${test}`).join('\n')}\n\n` : ''}${failedTests === 0 ? '✅ ALL CRITICAL VALIDATIONS PASSED - Configuration is valid and functional!' : '❌ Some validations failed - Please review configuration'}

--- End of Validation Report ---
`;

    // Write to validation-results.txt
    fs.writeFileSync('validation-results.txt', successMessage);
    
    return successMessage;
}

function main() {
    try {
        console.log('🔧 Starting Configuration Validation Test...');
        
        // Load the devbob configuration
        const configPath = './configs/devbob-config.json';
        console.log(`📖 Loading configuration from: ${configPath}`);
        
        const config = loadConfig(configPath);
        console.log('✅ Configuration loaded successfully');
        
        // Validate the configuration
        console.log('🔍 Validating configuration...');
        const results = validateConfiguration(config);
        
        // Write success message to disk
        const message = writeSuccessMessage(results);
        console.log(message);
        
        console.log('📄 Detailed results written to: validation-results.txt');
        
        // Exit with appropriate code
        process.exit(results.failed.length === 0 ? 0 : 1);
        
    } catch (error) {
        console.error('❌ Configuration validation failed:', error.message);
        
        // Write failure message
        const failureMessage = `\n❌ CONFIGURATION VALIDATION FAILED\n\nTimestamp: ${new Date().toISOString()}\nError: ${error.message}\n\n--- End of Validation Report ---\n`;
        fs.writeFileSync('validation-results.txt', failureMessage);
        
        process.exit(1);
    }
}

// Run the validation if this script is executed directly
if (require.main === module) {
    main();
}

module.exports = { loadConfig, validateConfiguration, writeSuccessMessage };