#!/usr/bin/env bun
import { parseArgs } from "util";
import { serve } from "./server";

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    port: {
      type: "string",
      short: "p",
      default: "3000",
    },
    model: {
      type: "string",
      short: "m",
      default: "gpt-4",
    },
    help: {
      type: "boolean",
      short: "h",
    },
  },
  allowPositionals: true,
});

if (values.help) {
  console.log(`
Usage: conversation-vessel [command] [options]

Commands:
  serve    Start the conversation vessel server (default)

Options:
  -p, --port <port>    Server port (default: 3000)
  -m, --model <model>  LLM model to use (default: gpt-4)
  -h, --help          Show this help message

Examples:
  conversation-vessel serve --port 8080 --model gpt-3.5-turbo
  conversation-vessel --port 3001
`);
  process.exit(0);
}

const command = positionals[0] || "serve";

switch (command) {
  case "serve":
    const port = parseInt(values.port || "3000");
    console.log(`Starting conversation vessel on port ${port} with model ${values.model}`);
    await serve({
      port,
      model: values.model || "gpt-4",
    });
    break;
  default:
    console.error(`Unknown command: ${command}`);
    console.error("Use --help for usage information");
    process.exit(1);
}