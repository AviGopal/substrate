/**
 * Dashboard Monitor Module
 *
 * Handles data fetching from Activity API with tracing integration.
 * Implements polling, caching, and retry logic.
 */

const DashboardMonitor = (function() {
    // Configuration
    const config = {
        pollIntervalMs: 3000,      // 3 second polling
        retryAttempts: 3,
        retryDelayMs: 1000,
        cacheExpiryMs: 10000,      // 10 second cache
        defaultEndpoint: 'https://activity.metabob.com',
        shapes: {
            executions: {
                shape: 'activityExecutionTrace',
                endpoint: '/v2/activities/executions',
                params: { limit: 50 }
            },
            templates: {
                shape: 'activityTemplate',
                endpoint: '/v2/activities/templates',
                params: {}
            },
            metrics: {
                shape: 'impulseResolutionMetrics',
                endpoint: '/v2/impulses/resolution-metrics',
                params: { limit: 20 }
            },
            thompson: {
                shape: 'thompsonScores',
                endpoint: '/v2/activities/templates',
                params: { includeThompson: true }
            }
        }
    };

    // State
    let state = {
        endpoint: config.defaultEndpoint,
        apiKey: null,
        cache: new Map(),
        pollTimer: null,
        isPolling: false,
        listeners: new Map(),
        stats: {
            totalFetches: 0,
            cacheHits: 0,
            errors: 0,
            lastFetch: null
        }
    };

    /**
     * Initialize the monitor
     * @param {Object} options - Configuration options
     */
    function init(options = {}) {
        state.endpoint = options.endpoint || localStorage.getItem('dashboard_endpoint') || config.defaultEndpoint;
        state.apiKey = options.apiKey || localStorage.getItem('dashboard_api_key') || null;

        // Restore from localStorage
        if (options.persistConfig !== false) {
            const savedEndpoint = localStorage.getItem('dashboard_endpoint');
            const savedApiKey = localStorage.getItem('dashboard_api_key');
            if (savedEndpoint) state.endpoint = savedEndpoint;
            if (savedApiKey) state.apiKey = savedApiKey;
        }

        console.log(`[Monitor] Initialized with endpoint ${state.endpoint}`);
        return { endpoint: state.endpoint, hasApiKey: !!state.apiKey };
    }

    /**
     * Set the API endpoint
     * @param {string} endpoint - API endpoint URL
     */
    function setEndpoint(endpoint) {
        state.endpoint = endpoint;
        localStorage.setItem('dashboard_endpoint', endpoint);
        clearCache();
    }

    /**
     * Get the current API endpoint
     */
    function getEndpoint() {
        return state.endpoint;
    }

    /**
     * Set the API key
     * @param {string} apiKey - API key for authentication
     */
    function setApiKey(apiKey) {
        state.apiKey = apiKey;
        if (apiKey) {
            localStorage.setItem('dashboard_api_key', apiKey);
        } else {
            localStorage.removeItem('dashboard_api_key');
        }
        clearCache();
    }

    /**
     * Get the current API key
     */
    function getApiKey() {
        return state.apiKey;
    }

    /**
     * Clear the cache
     */
    function clearCache() {
        state.cache.clear();
    }

    /**
     * Fetch data from a shape endpoint with caching and retry
     * @param {string} shapeName - Shape name from config.shapes
     * @param {Object} params - Optional override parameters
     */
    async function fetchShape(shapeName, params = {}) {
        const shapeConfig = config.shapes[shapeName];
        if (!shapeConfig) {
            throw new Error(`Unknown shape: ${shapeName}`);
        }

        const cacheKey = `${shapeName}:${JSON.stringify(params)}`;

        // Check cache
        const cached = state.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < config.cacheExpiryMs) {
            state.stats.cacheHits++;
            return { ...cached.data, cached: true };
        }

        // Build URL first so we can include it in trace
        const mergedParams = { ...shapeConfig.params, ...params };
        const url = new URL(`${state.endpoint}${shapeConfig.endpoint}`);
        Object.entries(mergedParams).forEach(([key, value]) => {
            url.searchParams.append(key, String(value));
        });

        // Start trace with URL for CORS detection
        const traceEntry = DashboardTracer?.traceResolution?.(shapeConfig.shape, {
            query: mergedParams,
            url: url.toString()
        });

        state.stats.totalFetches++;
        state.stats.lastFetch = new Date().toISOString();

        let lastError = null;
        for (let attempt = 0; attempt < config.retryAttempts; attempt++) {
            try {
                const response = await fetchWithRetry(url.toString(), attempt);
                const data = await response.json();

                // Cache the result
                state.cache.set(cacheKey, {
                    data: { success: true, data, resolver: 'activity-api' },
                    timestamp: Date.now()
                });

                // Complete trace
                if (traceEntry) {
                    DashboardTracer.completeResolution(traceEntry, {
                        success: true,
                        resolver: 'activity-api',
                        cached: false,
                        dataSize: JSON.stringify(data).length
                    });
                }

                return { success: true, data, cached: false };
            } catch (error) {
                lastError = error;
                if (attempt < config.retryAttempts - 1) {
                    await sleep(config.retryDelayMs * (attempt + 1));
                }
            }
        }

        state.stats.errors++;

        // Complete trace with error
        if (traceEntry) {
            DashboardTracer.completeResolution(traceEntry, {
                success: false,
                error: lastError?.message || 'Unknown error'
            });
        }

        return { success: false, error: lastError?.message || 'Fetch failed', cached: false };
    }

    /**
     * Fetch with authentication and error handling
     */
    async function fetchWithRetry(url, attempt) {
        const headers = {
            'Content-Type': 'application/json',
            'X-Trace-Session': DashboardTracer?.getSessionId?.() || 'unknown',
            'X-Trace-Source': 'github-pages-dashboard'
        };

        if (state.apiKey) {
            headers['Authorization'] = `ApiKey ${state.apiKey}`;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers,
            signal: AbortSignal.timeout(10000) // 10 second timeout
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
    }

    /**
     * Fetch all shapes in parallel
     */
    async function fetchAll() {
        const results = {};
        const shapeNames = Object.keys(config.shapes);

        const promises = shapeNames.map(async (name) => {
            results[name] = await fetchShape(name);
        });

        await Promise.all(promises);
        return results;
    }

    /**
     * Start polling for data
     * @param {Function} callback - Called with new data on each poll
     */
    function startPolling(callback) {
        if (state.isPolling) return;
        state.isPolling = true;

        const poll = async () => {
            if (!state.isPolling) return;

            try {
                const data = await fetchAll();
                callback(data);
            } catch (error) {
                console.error('[Monitor] Poll error:', error);
                DashboardTracer?.traceError?.('poll', error);
            }

            if (state.isPolling) {
                state.pollTimer = setTimeout(poll, config.pollIntervalMs);
            }
        };

        // Initial fetch
        poll();
    }

    /**
     * Stop polling
     */
    function stopPolling() {
        state.isPolling = false;
        if (state.pollTimer) {
            clearTimeout(state.pollTimer);
            state.pollTimer = null;
        }
    }

    /**
     * Subscribe to data updates for a specific shape
     * @param {string} shapeName - Shape name
     * @param {Function} callback - Called with new data
     */
    function subscribe(shapeName, callback) {
        if (!state.listeners.has(shapeName)) {
            state.listeners.set(shapeName, new Set());
        }
        state.listeners.get(shapeName).add(callback);

        return () => {
            state.listeners.get(shapeName)?.delete(callback);
        };
    }

    /**
     * Get monitor statistics
     */
    function getStats() {
        return {
            ...state.stats,
            cacheSize: state.cache.size,
            isPolling: state.isPolling
        };
    }

    /**
     * Utility: Sleep for ms
     */
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Format data for display based on shape type
     */
    function formatForDisplay(shapeName, data) {
        if (!data.success) {
            return { type: 'error', content: data.error };
        }

        const raw = data.data;

        switch (shapeName) {
            case 'executions': {
                const traces = Array.isArray(raw) ? raw : (raw.executions || raw.traces || []);
                const completed = traces.filter(t => t.status === 'completed').length;
                const failed = traces.filter(t => t.status === 'failed').length;
                const avgDuration = traces.length > 0
                    ? Math.round(traces.reduce((sum, t) => sum + (t.duration_ms || 0), 0) / traces.length)
                    : 0;

                return {
                    type: 'executions',
                    items: traces.slice(0, 15).map(t => ({
                        id: t.id || t.execution_id,
                        template: t.template_id || t.template || 'unknown',
                        status: t.status || 'unknown',
                        duration: t.duration_ms || 0,
                        cost: t.cost_usd || 0,
                        startedAt: t.started_at || t.created_at
                    })),
                    summary: {
                        total: traces.length,
                        completed,
                        failed,
                        avgDuration
                    }
                };
            }

            case 'templates': {
                const templates = Array.isArray(raw) ? raw : (raw.templates || []);
                return {
                    type: 'templates',
                    items: templates.slice(0, 12).map(t => ({
                        id: t.id || t.name,
                        name: t.name || t.id,
                        category: t.category || 'uncategorized',
                        executions: t.total_executions || 0,
                        successRate: t.success_rate || 0,
                        thompsonAlpha: t.thompson_alpha || 1,
                        thompsonBeta: t.thompson_beta || 1
                    })),
                    summary: {
                        total: templates.length
                    }
                };
            }

            case 'metrics': {
                const metrics = Array.isArray(raw) ? raw : (raw.metrics || []);
                return {
                    type: 'metrics',
                    items: metrics.slice(0, 10).map(m => ({
                        shape: m.shape || m.type,
                        resolutions: m.resolution_count || m.count || 0,
                        avgLatency: m.avg_latency_ms || m.latency || 0,
                        successRate: m.success_rate || 1,
                        lastResolved: m.last_resolved_at || m.updated_at
                    })),
                    summary: {
                        total: metrics.length,
                        avgLatency: metrics.length > 0
                            ? Math.round(metrics.reduce((sum, m) => sum + (m.avg_latency_ms || 0), 0) / metrics.length)
                            : 0
                    }
                };
            }

            case 'thompson': {
                const templates = Array.isArray(raw) ? raw : (raw.templates || []);
                return {
                    type: 'thompson',
                    items: templates
                        .filter(t => (t.thompson_alpha || 1) + (t.thompson_beta || 1) > 2)
                        .slice(0, 10)
                        .map(t => {
                            const alpha = t.thompson_alpha || 1;
                            const beta = t.thompson_beta || 1;
                            const mean = alpha / (alpha + beta);
                            const confidence = Math.min((alpha + beta) / 100, 1);
                            return {
                                id: t.id || t.name,
                                name: t.name || t.id,
                                alpha,
                                beta,
                                mean,
                                confidence,
                                status: confidence < 0.3 ? 'exploring' : (mean > 0.7 ? 'exploiting' : 'learning')
                            };
                        })
                        .sort((a, b) => b.mean - a.mean),
                    summary: {
                        total: templates.length
                    }
                };
            }

            default:
                return { type: 'raw', content: raw };
        }
    }

    // Public API
    return {
        init,
        setEndpoint,
        getEndpoint,
        setApiKey,
        getApiKey,
        clearCache,
        fetchShape,
        fetchAll,
        startPolling,
        stopPolling,
        subscribe,
        getStats,
        formatForDisplay,
        // Expose config for extension
        getConfig: () => ({...config}),
        addShape: (name, shapeConfig) => {
            config.shapes[name] = shapeConfig;
        }
    };
})();

// Auto-initialize if not in test environment
if (typeof window !== 'undefined' && !window.__MONITOR_TEST_MODE__) {
    DashboardMonitor.init();
}
