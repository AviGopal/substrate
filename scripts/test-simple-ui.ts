#!/usr/bin/env bun
/**
 * Test simple UI creation through the dashboard
 */

const port = process.env.PORT || "3002";
const ws = new WebSocket(`ws://localhost:${port}/ws`);

ws.onopen = () => {
  console.log("Connected");

  // Send a simpler query
  const query = {
    type: "query",
    id: "q-" + Date.now(),
    text: "Create a simple badge showing 'System Online' with success variant",
    timestamp: Date.now()
  };

  console.log("Sending:", query.text);
  ws.send(JSON.stringify(query));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data as string);
  console.log(`[${msg.type}]`, msg.type === 'impulse_create'
    ? JSON.stringify(msg.impulse?.primitive, null, 2)
    : JSON.stringify(msg, null, 2).slice(0, 200));

  if (msg.type === "impulse_create") {
    console.log("\n✅ UI Component Created!");
    setTimeout(() => process.exit(0), 500);
  }
  if (msg.type === "activity_complete" || msg.type === "error") {
    console.log("\n=== Done ===");
    setTimeout(() => process.exit(msg.type === "error" ? 1 : 0), 500);
  }
};

ws.onerror = (e) => {
  console.error("Error:", e);
  process.exit(1);
};

setTimeout(() => {
  console.log("Timeout");
  ws.close();
  process.exit(1);
}, 60000);
