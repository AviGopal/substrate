export async function waitForHealth(url: string, timeout = 10_000): Promise<void> {
  const deadline = Date.now() + timeout
  let lastStatus: number | undefined

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2_000) })
      if (res.ok) return
      lastStatus = res.status
    } catch {
      // connection refused or timeout — keep polling
    }
    await Bun.sleep(100)
  }

  throw new Error(
    `waitForHealth: timeout after ${timeout}ms; last status: ${lastStatus ?? "no response"} — ${url}`
  )
}
