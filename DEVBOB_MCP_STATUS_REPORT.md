# DevBob MCP Server Status Report

**Date**: 2026-03-09
**Container**: devbob-84466fdfff-dd87l (k8s namespace: metabob)
**Image**: metabobapp/devbob:v1.0.66-cumulative (March 4, 2026)

## Executive Summary

**FINDING**: Packaged metabob-cli has syntax error preventing MCP server startup
**IMPACT**: Cannot test local MCP or observe full data flow
**SOLUTION**: Hot-fix syntax error + switch to local MCP config (7 min)

## What Works
- metabob-cli 1.10.0 installed at /opt/metabob-cli/
- Python 3.12.12
- MCP command available (stdio/sse support)
- opencode configured (currently using remote MCP)

## What's Broken
- SyntaxError in activity_template_tools.py line 650
- MCP server cannot start
- Config uses remote type (should be local)

## Root Cause
- Stale image (March 4) with broken package
- Missing recent fixes from commits aa799fa, 6924f39
- Wrong MCP config type (remote vs local)

## Quick Fix (7 minutes)
1. Copy fixed file from repos/metabob-cli/src to container
2. Update opencode.json to use local MCP with stdio
3. Test: opencode activity search

## Production Fix (20 minutes)
1. Rebuild devbob image with latest metabob-cli
2. Deploy to k8s
3. Verify all tests pass

See docs/operations/observing-activity-execution-flow.md for testing
