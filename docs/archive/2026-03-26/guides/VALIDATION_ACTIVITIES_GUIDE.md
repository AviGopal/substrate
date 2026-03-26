# Data Flow Validation Activity Template

**Template**: `validate-data-flow`  
**Category**: infrastructure  
**Tasks**: 5  
**Status**: ✅ Ready for use

## Quick Start

```bash
# Test impulse system flow
activity validate-data-flow \
  --dataFlowName "impulse-system" \
  --sourceComponent "OpenCode" \
  --processingLayers "metabob-cli → Backend" \
  --targetDatabase "SurrealDB" \
  --targetTable "impulse_registry" \
  --traceIdField "impulse_id" \
  --sourceOriginField "created_by" \
  --timestampField "created_at"
```

## What It Does

Creates comprehensive end-to-end data flow validation:
1. ✅ Generates executable test script
2. ✅ Creates trace queries for forensics
3. ✅ Validates each stage independently  
4. ✅ Documents complete data lineage
5. ✅ Enables source tracking for any record

## Key Innovation

Every test creates a unique `trace_id` that propagates through your entire data flow, enabling you to trace any record back to its exact source.

## When to Use

✅ Testing data persistence (API → Database)  
✅ Validating ETL pipelines  
✅ Debugging data quality issues  
✅ Compliance/audit requirements  
✅ Microservice communication validation

## What You Get

- **Test Script**: Executable end-to-end validation
- **Trace Queries**: SQL for forensic analysis
- **Documentation**: Complete data lineage guide
- **Trace Report**: Shows where data came from

## Example Output

```bash
./test-impulse-system-validation.sh

[1/5] Verifying prerequisites... ✓
[2/5] Creating test data... ✓ (trace_id: test-impulse-1771502517)
[3/5] Verifying processing... ✓
[4/5] Verifying database... ✓
[5/5] Generating trace report... ✓

✅ ALL TESTS PASSED

Trace ID: test-impulse-1771502517
Duration: 3s
```

## Full Documentation

See template file for complete documentation: `templates/validate-data-flow.json`

---

**Created**: 2026-02-19  
**Based on**: test-impulse-working.sh (proven working test)
