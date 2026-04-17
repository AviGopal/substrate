#!/usr/bin/env bun
/**
 * Standalone test for the three new validation executors
 * Tests without requiring backend API calls
 */

// Mock implementations matching run-validation.ts

async function resolveImpulses(action: any, setup: any): Promise<any> {
  const results: Record<string, any> = {};

  for (const impulseId of action.impulse_ids) {
    const impulse = setup.impulses.find((i: any) => i.id === impulseId);

    if (!impulse) {
      results[impulseId] = {
        resolver: 'ERROR',
        error: 'Impulse not found in setup'
      };
      continue;
    }

    const pointerType = impulse.pointer.type;

    // Step 1: LOCAL resolvers
    const localTypes = ['memo', 'file', 'directoryTree', 'gitDiff'];
    if (localTypes.includes(pointerType)) {
      results[impulseId] = {
        resolver: 'LOCAL',
        content_source: pointerType === 'memo' ? 'embedded' : 'filesystem',
        content: impulse.pointer.content || `<${pointerType} content>`,
      };
      continue;
    }

    // Step 2-4: BACKEND types (would call API in real scenario)
    const backendTypes = ['activityExecutionTrace', 'activityTemplate'];
    if (backendTypes.includes(pointerType)) {
      results[impulseId] = {
        resolver: 'BACKEND',
        content_source: 'mcp',
        content: `<mocked ${pointerType} content>`,
      };
      continue;
    }

    // FALLBACK
    results[impulseId] = {
      resolver: 'FALLBACK',
      content_source: 'unknown',
      error: `Unknown pointer type: ${pointerType}`
    };
  }

  return results;
}

async function loadImpulse(action: any, setup: any): Promise<any> {
  const impulse = setup.impulse;

  if (!impulse) {
    throw new Error('No impulse in setup');
  }

  let content = '';
  if (impulse.pointer.type === 'memo') {
    content = impulse.pointer.content || '';
  } else if (impulse.pointer.type === 'file') {
    content = 'x'.repeat(50000); // Simulate large file
  }

  const estimateTokens = (text: string): number => Math.ceil(text.length / 4);
  const originalTokenCount = estimateTokens(content);
  const budget = impulse.budget || 2000;

  const wasTruncated = originalTokenCount > budget;
  const truncationRatio = budget > 0 ? originalTokenCount / budget : 0;

  let finalContent = content;
  let tokenCount = originalTokenCount;

  if (wasTruncated) {
    const ratio = budget / originalTokenCount;
    const targetChars = Math.floor(content.length * ratio * 0.9);
    finalContent = content.substring(0, targetChars) + '\n... (truncated to fit budget)';
    tokenCount = Math.floor(budget * 0.9);
  }

  return {
    loaded: true,
    token_count: tokenCount,
    metadata: {
      was_truncated: wasTruncated,
      original_token_count: originalTokenCount,
      truncation_ratio: wasTruncated ? truncationRatio : 1.0,
    },
    content_suffix: wasTruncated ? '... (truncated to fit budget)' : null,
  };
}

async function formatForContext(action: any, setup: any): Promise<any> {
  const impulse = setup.impulse;

  if (!impulse) {
    throw new Error('No impulse in setup');
  }

  const loadContent = action.load_content ?? false;

  // Pointer-mode: metadata only
  if (!loadContent && impulse.metadata) {
    const attrs = [
      `id="${impulse.id}"`,
      `type="${impulse.pointer.type}"`,
      `shape="${impulse.shape || impulse.metadata.shape || 'unknown'}"`,
    ];

    if (impulse.metadata.row_count !== undefined) {
      attrs.push(`row_count="${impulse.metadata.row_count}"`);
    }

    if (impulse.summary || impulse.metadata.summary) {
      const summary = (impulse.summary || impulse.metadata.summary).replace(/"/g, '&quot;');
      attrs.push(`summary="${summary}"`);
    }

    if (impulse.metadata.available_ops?.length) {
      attrs.push(`available_ops="${impulse.metadata.available_ops.join(',')}"`);
    }

    return {
      format: 'pointer-mode',
      xml: `<impulse_ref ${attrs.join(' ')} />`,
    };
  }

  // Content-mode: loaded with content
  if (loadContent) {
    let content = '';
    if (impulse.pointer.type === 'memo') {
      content = impulse.pointer.content || '';
    } else {
      content = `<${impulse.pointer.type} content placeholder>`;
    }

    const tokenCount = Math.ceil(content.length / 4);
    const budget = impulse.budget || 2000;
    const tokenUsage = `${tokenCount}/${budget}`;

    return {
      format: 'content-mode',
      xml_start: `<impulse id="${impulse.id}" type="${impulse.pointer.type}" tokens="${tokenUsage}">`,
      xml_end: '</impulse>',
      content_included: true,
    };
  }

  return {
    format: 'none',
    xml: null,
  };
}

// Test scenarios
async function runTests() {
  console.log('Testing resolve_impulses...');

  const resolveSetup = {
    impulses: [
      {
        id: 'impulse-memo',
        pointer: { type: 'memo', content: 'embedded content' }
      },
      {
        id: 'impulse-file',
        pointer: { type: 'file', path: '/tmp/test.txt' }
      },
      {
        id: 'impulse-backend',
        pointer: { type: 'activityExecutionTrace', execution_id: 'exec_123' }
      }
    ]
  };

  const resolveResult = await resolveImpulses(
    { impulse_ids: ['impulse-memo', 'impulse-file', 'impulse-backend'] },
    resolveSetup
  );

  console.log('  impulse-memo resolver:', resolveResult['impulse-memo'].resolver);
  console.log('  impulse-file resolver:', resolveResult['impulse-file'].resolver);
  console.log('  impulse-backend resolver:', resolveResult['impulse-backend'].resolver);

  if (resolveResult['impulse-memo'].resolver !== 'LOCAL') {
    throw new Error('❌ memo should use LOCAL resolver');
  }
  if (resolveResult['impulse-file'].resolver !== 'LOCAL') {
    throw new Error('❌ file should use LOCAL resolver');
  }
  if (resolveResult['impulse-backend'].resolver !== 'BACKEND') {
    throw new Error('❌ activityExecutionTrace should use BACKEND resolver');
  }
  console.log('✓ resolve_impulses tests passed\n');

  // Test load_impulse
  console.log('Testing load_impulse...');

  const loadSetup = {
    impulse: {
      id: 'impulse-large',
      pointer: { type: 'file', path: '/tmp/large.txt' },
      budget: 2000
    }
  };

  const loadResult = await loadImpulse({ impulse_id: 'impulse-large' }, loadSetup);

  console.log('  loaded:', loadResult.loaded);
  console.log('  token_count:', loadResult.token_count);
  console.log('  was_truncated:', loadResult.metadata.was_truncated);
  console.log('  original_token_count:', loadResult.metadata.original_token_count);

  if (!loadResult.loaded) {
    throw new Error('❌ impulse should be loaded');
  }
  if (!loadResult.metadata.was_truncated) {
    throw new Error('❌ large file should be truncated');
  }
  if (loadResult.token_count > 2000) {
    throw new Error('❌ token_count should respect budget');
  }
  console.log('✓ load_impulse tests passed\n');

  // Test format_for_context
  console.log('Testing format_for_context (pointer-mode)...');

  const formatSetup = {
    impulse: {
      id: 'impulse-unloaded',
      pointer: { type: 'file', path: 'src/auth.ts' },
      shape: 'source_code',
      summary: 'Authentication module with JWT handling',
      metadata: {
        shape: 'source_code',
        row_count: 250,
        available_ops: ['debug', 'refactor', 'test']
      }
    }
  };

  const formatResult = await formatForContext({ load_content: false }, formatSetup);

  console.log('  format:', formatResult.format);
  console.log('  xml:', formatResult.xml);

  if (formatResult.format !== 'pointer-mode') {
    throw new Error('❌ should use pointer-mode when content not loaded');
  }
  if (!formatResult.xml.includes('impulse_ref')) {
    throw new Error('❌ pointer-mode should use impulse_ref tag');
  }
  if (!formatResult.xml.includes('row_count="250"')) {
    throw new Error('❌ should include row_count metadata');
  }
  console.log('✓ format_for_context (pointer-mode) tests passed\n');

  console.log('Testing format_for_context (content-mode)...');

  const contentSetup = {
    impulse: {
      id: 'impulse-loaded',
      pointer: { type: 'memo', content: 'Error: Cannot read property' },
      shape: 'error_log',
      budget: 2000
    }
  };

  const contentResult = await formatForContext({ load_content: true }, contentSetup);

  console.log('  format:', contentResult.format);
  console.log('  xml_start:', contentResult.xml_start);
  console.log('  content_included:', contentResult.content_included);

  if (contentResult.format !== 'content-mode') {
    throw new Error('❌ should use content-mode when content loaded');
  }
  if (!contentResult.xml_start.includes('<impulse')) {
    throw new Error('❌ content-mode should use impulse tag');
  }
  if (!contentResult.content_included) {
    throw new Error('❌ content should be included');
  }
  console.log('✓ format_for_context (content-mode) tests passed\n');

  console.log('✅ All tests passed!');
}

runTests().catch(error => {
  console.error('Test failed:', error.message);
  process.exit(1);
});
