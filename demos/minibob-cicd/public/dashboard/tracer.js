/**
 * Dashboard Tracer Module
 *
 * Client-side tracing for the self-improving dashboard.
 * Traces every shape resolution for learning loop analysis.
 */

const DashboardTracer = (function() {
    // Session ID persists for the duration of this page visit
    const sessionId = `dash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Configuration
    const config = {
        batchSize: 50,
        flushIntervalMs: 30000, // 30 seconds
        endpoint: '/v2/activities/dashboard-traces',
        source: 'github-pages-dashboard',
        version: '1.0.0'
    };

    // Trace buffer
    let traceBuffer = [];
    let flushTimer = null;
    let stats = {
        totalTraces: 0,
        flushedTraces: 0,
        flushErrors: 0,
        lastFlush: null
    };

    /**
     * Initialize the tracer
     * @param {Object} options - Configuration options
     */
    function init(options = {}) {
        Object.assign(config, options);

        // Start periodic flush
        if (flushTimer) clearInterval(flushTimer);
        flushTimer = setInterval(flush, config.flushIntervalMs);

        // Flush on page unload
        window.addEventListener('beforeunload', () => flush(true));

        console.log(`[Tracer] Initialized with session ${sessionId}`);
        return sessionId;
    }

    /**
     * Record a shape resolution trace
     * @param {Object} trace - Trace data
     */
    function trace(data) {
        const traceEntry = {
            session_id: sessionId,
            timestamp: new Date().toISOString(),
            source: config.source,
            version: config.version,
            ...data
        };

        traceBuffer.push(traceEntry);
        stats.totalTraces++;

        // Auto-flush if batch is full
        if (traceBuffer.length >= config.batchSize) {
            flush();
        }

        return traceEntry;
    }

    /**
     * Trace a shape resolution attempt
     * @param {string} shape - The shape being resolved
     * @param {Object} options - Resolution options
     */
    function traceResolution(shape, options = {}) {
        return trace({
            type: 'resolution',
            shape,
            query: options.query || {},
            startTime: Date.now()
        });
    }

    /**
     * Complete a resolution trace with results
     * @param {Object} traceEntry - Original trace entry
     * @param {Object} result - Resolution result
     */
    function completeResolution(traceEntry, result) {
        const latencyMs = Date.now() - traceEntry.startTime;

        // Find and update the trace in buffer
        const index = traceBuffer.findIndex(t =>
            t.startTime === traceEntry.startTime && t.shape === traceEntry.shape
        );

        if (index !== -1) {
            traceBuffer[index] = {
                ...traceBuffer[index],
                latency_ms: latencyMs,
                success: result.success,
                error_type: result.error ? categorizeError(result.error) : null,
                error_message: result.error || null,
                resolver: result.resolver || 'unknown',
                cached: result.cached || false,
                data_size: result.dataSize || 0,
                completed_at: new Date().toISOString()
            };
        }

        return latencyMs;
    }

    /**
     * Trace a user interaction
     * @param {string} action - Action name
     * @param {Object} details - Action details
     */
    function traceInteraction(action, details = {}) {
        return trace({
            type: 'interaction',
            action,
            details
        });
    }

    /**
     * Trace an error
     * @param {string} context - Error context
     * @param {Error|string} error - The error
     */
    function traceError(context, error) {
        return trace({
            type: 'error',
            context,
            error_type: categorizeError(error),
            error_message: error.message || String(error),
            stack: error.stack || null
        });
    }

    /**
     * Categorize an error for pattern analysis
     * @param {Error|string} error - The error
     */
    function categorizeError(error) {
        const message = (error.message || String(error)).toLowerCase();

        if (message.includes('network') || message.includes('fetch')) {
            return 'NETWORK_ERROR';
        }
        if (message.includes('timeout')) {
            return 'TIMEOUT';
        }
        if (message.includes('401') || message.includes('unauthorized')) {
            return 'AUTH_ERROR';
        }
        if (message.includes('403') || message.includes('forbidden')) {
            return 'FORBIDDEN';
        }
        if (message.includes('404') || message.includes('not found')) {
            return 'NOT_FOUND';
        }
        if (message.includes('429') || message.includes('rate limit')) {
            return 'RATE_LIMIT';
        }
        if (message.includes('500') || message.includes('server error')) {
            return 'SERVER_ERROR';
        }
        if (message.includes('cors')) {
            return 'CORS_ERROR';
        }
        if (message.includes('parse') || message.includes('json')) {
            return 'PARSE_ERROR';
        }

        return 'UNKNOWN_ERROR';
    }

    /**
     * Flush traces to the backend
     * @param {boolean} sync - Use synchronous request (for page unload)
     */
    async function flush(sync = false) {
        if (traceBuffer.length === 0) return;

        const tracesToSend = [...traceBuffer];
        traceBuffer = [];

        const payload = {
            session_id: sessionId,
            source: config.source,
            version: config.version,
            traces: tracesToSend,
            flushed_at: new Date().toISOString()
        };

        const apiEndpoint = window.DashboardMonitor?.getEndpoint?.() ||
                           document.getElementById('api-endpoint')?.value ||
                           'https://activity.metabob.com';

        const apiKey = window.DashboardMonitor?.getApiKey?.() ||
                      document.getElementById('api-key')?.value;

        const headers = {
            'Content-Type': 'application/json',
            'X-Trace-Session': sessionId,
            'X-Trace-Source': config.source
        };

        if (apiKey) {
            headers['Authorization'] = `ApiKey ${apiKey}`;
        }

        try {
            if (sync && navigator.sendBeacon) {
                // Use sendBeacon for page unload
                navigator.sendBeacon(
                    `${apiEndpoint}${config.endpoint}`,
                    JSON.stringify(payload)
                );
                stats.flushedTraces += tracesToSend.length;
            } else {
                const response = await fetch(`${apiEndpoint}${config.endpoint}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    stats.flushedTraces += tracesToSend.length;
                    stats.lastFlush = new Date().toISOString();
                } else {
                    // Put traces back in buffer on failure
                    traceBuffer = [...tracesToSend, ...traceBuffer].slice(0, config.batchSize * 2);
                    stats.flushErrors++;
                    console.warn(`[Tracer] Flush failed: HTTP ${response.status}`);
                }
            }
        } catch (error) {
            // Put traces back in buffer on failure
            traceBuffer = [...tracesToSend, ...traceBuffer].slice(0, config.batchSize * 2);
            stats.flushErrors++;
            console.warn(`[Tracer] Flush error:`, error.message);
        }
    }

    /**
     * Get tracer statistics
     */
    function getStats() {
        return {
            ...stats,
            pendingTraces: traceBuffer.length,
            sessionId
        };
    }

    /**
     * Get the session ID
     */
    function getSessionId() {
        return sessionId;
    }

    /**
     * Reset tracer state (for testing)
     */
    function reset() {
        traceBuffer = [];
        stats = {
            totalTraces: 0,
            flushedTraces: 0,
            flushErrors: 0,
            lastFlush: null
        };
    }

    // Public API
    return {
        init,
        trace,
        traceResolution,
        completeResolution,
        traceInteraction,
        traceError,
        flush,
        getStats,
        getSessionId,
        reset,
        // Expose for testing
        _getBuffer: () => [...traceBuffer],
        _getConfig: () => ({...config})
    };
})();

// Auto-initialize if not in test environment
if (typeof window !== 'undefined' && !window.__TRACER_TEST_MODE__) {
    DashboardTracer.init();
}
