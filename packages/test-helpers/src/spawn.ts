import { waitForHealth } from "./health.ts"

export interface SpawnOptions {
  cmd: string[]
  cwd: string
  port: number
  env?: Record<string, string>
  timeout?: number
}

export interface VesselHandle {
  port: number
  baseUrl: string
  stop(): Promise<void>
}

export async function spawnVessel(opts: SpawnOptions): Promise<VesselHandle> {
  const baseUrl = `http://localhost:${opts.port}`

  const proc = Bun.spawn(opts.cmd, {
    cwd: opts.cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT: String(opts.port),
      DISCOVERY_ENABLED: "false",
      ...(opts.env ?? {}),
    },
  })

  await waitForHealth(`${baseUrl}/health`, opts.timeout ?? 10_000)

  return {
    port: opts.port,
    baseUrl,
    async stop() {
      proc.kill("SIGTERM")
      const exitPromise = proc.exited
      const timeout = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("stop() timeout")), 5_000)
      )
      await Promise.race([exitPromise, timeout]).catch(() => {
        proc.kill("SIGKILL")
      })
    },
  }
}
