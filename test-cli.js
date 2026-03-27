#!/usr/bin/env bun
const { parseArgs } = require("util");

const testArgs = ['serve', '--port', '8080', '--model', 'gpt-3.5-turbo'];
const { values, positionals } = parseArgs({
  args: testArgs,
  options: {
    port: { type: "string", short: "p", default: "3000" },
    model: { type: "string", short: "m", default: "gpt-4" },
    help: { type: "boolean", short: "h" }
  },
  allowPositionals: true
});

console.log("✅ Parsed arguments successfully:");
console.log("Command:", positionals[0]);
console.log("Port:", values.port);
console.log("Model:", values.model);