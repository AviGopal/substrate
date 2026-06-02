import { Hono } from "hono";
import { config } from "./config.js";
import { impulsesRouter } from "./routes/impulses.js";
import { registerWithDiscovery } from "./discovery-registration.js";
const app = new Hono();
app.get("/health", (c) => c.json({ status: "ok", vesselId: config.vesselId }));
app.get("/shapes", (c) => c.json({ shapes: config.discovery.shapes }));
app.route("/", impulsesRouter);
Bun.serve({ port: config.port, hostname: config.host, fetch: app.fetch });
console.log(`[metric-collector-vessel] listening on ${config.host}:${config.port}`);
registerWithDiscovery().catch((err) =>
  console.warn(`[metric-collector-vessel] discovery registration failed: ${(err as Error).message}`),
);
