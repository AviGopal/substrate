export interface WSTestClient {
  send(msg: unknown): void
  waitFor(type: string, timeout?: number): Promise<unknown>
  messages: unknown[]
  close(): void
}

export async function connectWS(url: string): Promise<WSTestClient> {
  const ws = new WebSocket(url)
  const messages: unknown[] = []
  const listeners: Array<{ type: string; resolve: (m: unknown) => void; reject: (e: Error) => void }> = []

  ws.onmessage = (event) => {
    let parsed: unknown
    try { parsed = JSON.parse(event.data as string) } catch { parsed = event.data }
    messages.push(parsed)

    for (let i = listeners.length - 1; i >= 0; i--) {
      const l = listeners[i]
      if ((parsed as Record<string, unknown>)?.type === l.type) {
        listeners.splice(i, 1)
        l.resolve(parsed)
      }
    }
  }

  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve()
    ws.onerror = (e) => reject(new Error(`WebSocket connect failed: ${url}`))
  })

  return {
    messages,
    send(msg: unknown) { ws.send(JSON.stringify(msg)) },
    close() { ws.close() },
    waitFor(type: string, timeout = 5_000): Promise<unknown> {
      // check already-received messages first
      const existing = messages.find(
        (m) => (m as Record<string, unknown>)?.type === type
      )
      if (existing) return Promise.resolve(existing)

      return new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => {
          const idx = listeners.findIndex((l) => l.resolve === resolve)
          if (idx !== -1) listeners.splice(idx, 1)
          reject(new Error(`waitFor("${type}") timed out after ${timeout}ms`))
        }, timeout)

        listeners.push({
          type,
          resolve: (m) => { clearTimeout(timer); resolve(m) },
          reject,
        })
      })
    },
  }
}
