import type { ResolverResult } from '../resolvers/types.js';
import { shellResult } from '@tool-ai/bpl-core-ffi';

export async function simpleHttpResponseResolver(
  pointer: { type: 'httpResponse'; url: string },
): Promise<ResolverResult> {
  if (pointer.type !== 'httpResponse') {
    return { 
      shape: 'httpResponse', 
      body: { 
        ok: false, 
        error: 'Invalid pointer type',
        detail: `Expected type "httpResponse", got "${pointer.type}"`,
        resolved: false,
      } 
    };
  }

  const url = pointer.url;

  if (!url) {
    return {
      shape: 'httpResponse',
      body: {
        ok: false,
        error: 'URL is required',
        detail: 'A URL must be provided to fetch an HTTP response.',
        resolved: false,
      },
    };
  }

  try {
    // Use curl to get the HTTP status code
    const statusCommand = `curl -s -o /dev/null -w "%{http_code}" ${url}`;
    const statusResponse = await shellResult({ command: statusCommand });
    
    if (statusResponse.exit_code !== 0) {
      return {
        shape: 'httpResponse',
        body: {
          ok: false,
          error: 'Failed to get HTTP status code',
          detail: statusResponse.stderr || 'Unknown curl error',
          resolved: false,
        },
      };
    }
    const statusCode = parseInt(statusResponse.stdout.trim(), 10);

    // Use curl to get headers (including status line)
    const headersCommand = `curl -s -I ${url}`;
    const headersResponse = await shellResult({ command: headersCommand });

    if (headersResponse.exit_code !== 0) {
        return {
            shape: 'httpResponse',
            body: {
                ok: false,
                error: 'Failed to get HTTP headers',
                detail: headersResponse.stderr || 'Unknown curl error',
                resolved: false,
            },
        };
    }
    const rawHeaders = headersResponse.stdout.trim().split('\n').map(line => line.trim()).filter(line => line !== '');
    // Extract actual headers from the raw response, skipping the status line
    const headers = rawHeaders.slice(1).map(header => {
        const parts = header.split(': ', 2);
        return { name: parts[0], value: parts[1] };
    });


    // Use curl to get the response body
    const bodyCommand = `curl -s ${url}`;
    const bodyResponse = await shellResult({ command: bodyCommand });

    if (bodyResponse.exit_code !== 0) {
        return {
            shape: 'httpResponse',
            body: {
                ok: false,
                error: 'Failed to get HTTP body',
                detail: bodyResponse.stderr || 'Unknown curl error',
                resolved: false,
            },
        };
    }
    const body = bodyResponse.stdout;

    return {
      shape: 'httpResponse',
      body: {
        ok: statusCode >= 200 && statusCode < 300, // Consider 2xx as ok
        status: statusCode,
        headers: headers,
        body: body,
        resolved: true,
      },
    };
  } catch (error) {
    return {
      shape: 'httpResponse',
      body: {
        ok: false,
        error: 'Exception during HTTP fetch',
        detail: error instanceof Error ? error.message : 'Unknown error',
        resolved: false,
      },
    };
  }
}
