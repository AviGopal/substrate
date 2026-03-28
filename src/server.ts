export interface ServerConfig {
  port: number;
  model: string;
}

export async function serve(config: ServerConfig): Promise<void> {
  const server = Bun.serve({
    port: config.port,
    fetch(req) {
      return new Response("Conversation Vessel Server - Coming Soon", {
        headers: { "content-type": "text/plain" },
      });
    },
  });

  console.log(`🚀 Conversation vessel listening on http://localhost:${config.port}`);
  console.log(`📝 Using model: ${config.model}`);
  
  // Keep the process running
  await new Promise(() => {});
}