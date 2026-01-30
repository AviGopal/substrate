# Template Registration Validation Tool

A comprehensive validation tool for activity template registration and freshness in OpenCode.

## Overview

The `validate_template_registration` tool ensures that activity templates are:

1. ✅ **Correctly registered** in all available backends
2. ✅ **Not stale** (cache vs backends comparison)  
3. ✅ **Consistent** across backends (version and content)
4. ✅ **Ready for execution** with the latest version

## Features

### 🔍 Comprehensive Validation

**5 Core Checks:**
- **Template Existence**: Verifies presence in cache, Metabob, and local storage
- **Version Consistency**: Compares version strings across all backends
- **Cache Freshness**: Validates cache age against 5-minute TTL
- **Content Consistency**: Compares content hashes between backends
- **Backend Connectivity**: Tests Metabob MCP server availability

### 🔧 Auto-Fix Capabilities

When `fix_issues: true`:
- Invalidates stale cache entries
- Clears cache for version mismatches
- Re-synchronizes content from authoritative sources
- Reports all applied fixes

### 📊 Detailed Reporting

- Backend availability status with versions
- Pass/fail results for all validation checks
- Severity-classified issues (critical, high, medium, low)
- Actionable fix recommendations
- Overall readiness assessment

## Usage

### Basic Validation

```bash
# CLI usage
opencode run "validate_template_registration({ templateId: 'add-feature-complete' })"

# Tool call
validate_template_registration({
  templateId: "add-feature-complete"
})
```

### Validation with Auto-Fix

```bash
# CLI usage
opencode run "validate_template_registration({ templateId: 'add-feature-complete', fix_issues: true })"

# Tool call
validate_template_registration({
  templateId: "add-feature-complete",
  fix_issues: true
})
```

## Output Format

```
📋 Template Validation: add-feature-complete
🕐 Timestamp: 2024-01-30T10:30:45.123Z

📊 Backend Status:
  Cache:   ✓ Found (1769715375226::cfa93ba764d3efef, age: 45s)
  Metabob: ✗ Connection failed
  Local:   ✓ Found (1769715375226::cfa93ba764d3efef)

🔍 Validation Results:
  ✅ Template found in cache, local
  ✅ Versions consistent across backends
  ✅ Cache is fresh (age: 45s)
  ✅ Content identical across backends  
  ❌ Metabob MCP not available: connection refused

⚠️ Issues Found:
  💡 Metabob MCP not available
     Fix: Check MCP server status or continue with local-only

📈 Summary:
  4/5 checks passed
  1 issue found
  0 critical issues
  Template is ready for execution

💡 Recommendations:
  ✅ Template is ready for execution
  💡 Consider fixing Metabob MCP connection for full backend synchronization
```

## Validation Logic

### Backend Priority

1. **Metabob TemplateService** (authoritative when available)
2. **Local Storage** (always available fallback)
3. **Cache** (performance layer)

### Issue Severity Levels

- **🚨 Critical**: Template not found, execution impossible
- **⚠️ High**: Version/content mismatches, data integrity issues
- **⚡ Medium**: Stale cache, performance impacts
- **💡 Low**: Backend unavailable but fallbacks exist

### Success Criteria

Template is "ready for execution" when:
- ✅ Exists in at least one backend
- ✅ No critical issues
- ✅ Cache fresh or not cached
- ✅ Content consistent across available backends
- ⚠️ Metabob connectivity optional (local fallback)

## Implementation Details

### Core Functions

```typescript
// Backend availability checks
checkCache(templateId): Promise<BackendStatus>
checkMetabob(templateId): Promise<BackendStatus>
checkLocal(templateId): Promise<BackendStatus>

// Consistency validation
compareVersions(templateId): Promise<ConsistencyReport>
compareContent(templateId): Promise<ConsistencyReport>

// Auto-repair capabilities
fixIssues(templateId, issues): Promise<string[]>
```

### Error Handling

The tool gracefully handles:
- **Backend Unavailability**: Continues with available backends
- **Network Timeouts**: Reports as connectivity issues
- **Malformed Templates**: Reports as content validation errors
- **Cache Corruption**: Invalidates and rebuilds cache

## Integration

### Tool Registry

The tool is registered in the OpenCode tool registry and available in all execution contexts:
- Agent tool calls
- CLI commands  
- API integrations
- Activity templates

### Dependencies

- `TemplateRepository` - Template CRUD operations
- `TemplateLoader` - Multi-backend loading logic
- `TemplateCache` - Cache management and metadata
- `test_metabob_mcp` - Connectivity testing

## Testing

Run the validation tool test:

```bash
cd /path/to/metabob-devbob
npx tsx test_validate_template_tool.ts
```

Expected test coverage:
- ✅ Tool initialization
- ✅ Parameter validation  
- ✅ Backend status checking
- ✅ Version comparison logic
- ✅ Content consistency validation
- ✅ Auto-fix functionality
- ✅ Report formatting

## Use Cases

### Development Workflow

```bash
# Before executing activity
validate_template_registration({ templateId: "my-template" })

# If issues found, auto-fix
validate_template_registration({ templateId: "my-template", fix_issues: true })

# Then proceed with activity
activity({ templateId: "my-template", variables: {...} })
```

### Template Maintenance

```bash
# Validate all critical templates
for template in $(echo "add-feature fix-bug create-subagent"); do
  validate_template_registration({ templateId: "$template" })
done
```

### CI/CD Integration

```bash
# In deployment pipeline
if ! validate_template_registration({ templateId: "deploy-template" }).metadata.validated; then
  echo "Template validation failed, aborting deployment"
  exit 1
fi
```

## Troubleshooting

### Common Issues

**Template Not Found**
- Cause: Template not registered in any backend
- Fix: Use `register_activity_template` tool
- Priority: 🚨 Critical

**Version Mismatch** 
- Cause: Backends have different template versions
- Fix: Clear cache, check registration source
- Priority: ⚠️ High

**Stale Cache**
- Cause: Cache entry older than 5 minutes
- Fix: Cache auto-expires or clear manually
- Priority: ⚡ Medium

**Metabob Unavailable**
- Cause: MCP server down or misconfigured
- Fix: Check server status or use local-only
- Priority: 💡 Low

### Debug Mode

For detailed debugging, check the logs:

```typescript
// Enable debug logging
process.env.LOG_LEVEL = 'debug'
validate_template_registration({ templateId: "debug-me" })
```

## Future Enhancements

- **Health Monitoring**: Periodic validation of critical templates
- **Batch Validation**: Validate multiple templates in single call
- **Sync Scheduling**: Automatic backend synchronization
- **Alerting**: Integration with monitoring systems
- **Metrics**: Template validation success rates and timing

## Contributing

When modifying the validation tool:

1. Update validation checks in `validate-template-registration.ts`
2. Add corresponding tests in `test_validate_template_tool.ts`
3. Update this documentation
4. Ensure backward compatibility of report format
5. Test with various template states (missing, stale, inconsistent)

The tool is designed to be the authoritative source for template readiness validation across the OpenCode ecosystem.