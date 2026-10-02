export async function connectWS(url) {
    const ws = new WebSocket(url);
    const messages = [];
    const listeners = [];
    ws.onmessage = (event) => {
        let parsed;
        try {
            parsed = JSON.parse(event.data);
        }
        catch {
            parsed = event.data;
        }
        messages.push(parsed);
        for (let i = listeners.length - 1; i >= 0; i--) {
            const l = listeners[i];
            if (parsed?.type === l.type) {
                listeners.splice(i, 1);
                l.resolve(parsed);
            }
        }
    };
    await new Promise((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = (e) => reject(new Error(`WebSocket connect failed: ${url}`));
    });
    return {
        messages,
        send(msg) { ws.send(JSON.stringify(msg)); },
        close() { ws.close(); },
        waitFor(type, timeout = 5_000) {
            // check already-received messages first
            const existing = messages.find((m) => m?.type === type);
            if (existing)
                return Promise.resolve(existing);
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    const idx = listeners.findIndex((l) => l.resolve === resolve);
                    if (idx !== -1)
                        listeners.splice(idx, 1);
                    reject(new Error(`waitFor("${type}") timed out after ${timeout}ms`));
                }, timeout);
                listeners.push({
                    type,
                    resolve: (m) => { clearTimeout(timer); resolve(m); },
                    reject,
                });
            });
        },
    };
}
//# sourceMappingURL=ws-client.js.map