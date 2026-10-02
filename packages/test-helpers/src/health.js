export async function waitForHealth(url, timeout = 10_000) {
    const deadline = Date.now() + timeout;
    let lastStatus;
    while (Date.now() < deadline) {
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
            if (res.ok)
                return;
            lastStatus = res.status;
        }
        catch {
            // connection refused or timeout — keep polling
        }
        await Bun.sleep(100);
    }
    throw new Error(`waitForHealth: timeout after ${timeout}ms; last status: ${lastStatus ?? "no response"} — ${url}`);
}
//# sourceMappingURL=health.js.map