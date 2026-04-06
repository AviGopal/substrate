#!/usr/bin/env bun
/**
 * Test script to send a query to the internal dashboard via WebSocket
 */

const port = process.env.PORT || "3002";
const ws = new WebSocket(`ws://localhost:${port}/ws`);

ws.onopen = () => {
  console.log("Connected to internal dashboard");

  // Send a query to visualize learning loop
  const query = {
    type: "query",
    id: "q-" + Date.now(),
    text: "Show me the current learning loop state with Thompson Sampling metrics",
    timestamp: Date.now()
  };

  console.log("Sending query:", query.text);
  ws.send(JSON.stringify(query));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data as string);
  const preview = JSON.stringify(msg, null, 2).slice(0, 500);
  console.log(`[${msg.type}]`, preview);

  if (msg.type === "activity_complete" || msg.type === "error") {
    console.log("\n=== Activity finished ===");
    setTimeout(() => process.exit(0), 1000);
  }
};

ws.onerror = (error) => {
  console.error("WebSocket error:", error);
  process.exit(1);
};

// Timeout after 60 seconds
setTimeout(() => {
  console.log("Timeout - closing connection");
  ws.close();
  process.exit(1);
}, 60000);
