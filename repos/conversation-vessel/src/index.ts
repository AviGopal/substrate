interface ParsedArgs {
  command?: string;
  port: number;
  model: string;
  help: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2); // Remove 'node' and script name
  
  const result: ParsedArgs = {
    port: 3000,
    model: 'gpt-3.5-turbo',
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    switch (arg) {
      case 'serve':
        result.command = 'serve';
        break;

      case '--port':
      case '-p': {
        const nextArg = args[i + 1];
        if (nextArg !== undefined) {
          const portValue = parseInt(nextArg, 10);
          if (isNaN(portValue) || portValue < 1 || portValue > 65535) {
            throw new Error(`Invalid port number: ${nextArg}. Must be between 1 and 65535.`);
          }
          result.port = portValue;
          i++;
        } else {
          throw new Error('--port requires a value');
        }
        break;
      }

      case '--model':
      case '-m': {
        const nextArg = args[i + 1];
        if (nextArg !== undefined) {
          result.model = nextArg;
          i++;
        } else {
          throw new Error('--model requires a value');
        }
        break;
      }

      case '--help':
      case '-h':
        result.help = true;
        break;

      default:
        if (arg.startsWith('--')) {
          throw new Error(`Unknown option: ${arg}`);
        } else if (!result.command) {
          result.command = arg;
        } else {
          throw new Error(`Unexpected argument: ${arg}`);
        }
        break;
    }
  }

  return result;
}

function showHelp(): void {
  console.log(`Usage: conversation-vessel [command] [options]

Commands:
  serve                      Start the conversation vessel server

Options:
  -p, --port <port>         Port number to run the server on (default: 3000)
  -m, --model <model>       AI model to use for conversations (default: gpt-3.5-turbo)
  -h, --help                Show this help message

Examples:
  conversation-vessel serve                    # Start server with default settings
  conversation-vessel serve --port 8080       # Start server on port 8080
  conversation-vessel serve --model gpt-4      # Use GPT-4 model
  conversation-vessel serve -p 3001 -m gpt-4  # Custom port and model
  conversation-vessel --help                  # Show this help message

Available models:
  - gpt-3.5-turbo
  - gpt-4
  - gpt-4-turbo
  (Check your AI provider for additional model options)
`);
}

function showBanner(): void {
  console.log(`
┌─────────────────────────────────────────────────────────────────┐
│                    ⚓ CONVERSATION VESSEL ⚓                    │
│              A conversational vessel implementing               │
│                    the minibob pattern                         │
└─────────────────────────────────────────────────────────────────┘
`);
}

function main() {
  try {
    const args = parseArgs(process.argv);
    
    // Always show banner on startup
    showBanner();
    
    if (args.help) {
      showHelp();
      process.exit(0);
    }
    
    if (args.command === 'serve') {
      console.log('🚢 Starting conversation vessel server...');
      console.log(`⚓ Port: ${args.port}`);
      console.log(`🤖 Model: ${args.model}`);
      console.log('');
      
      // Application logic will go here
    } else if (!args.command) {
      console.log('⚠️  No command specified.');
      console.log('💡 Use "serve" to start the server or --help for usage information.');
      console.log('');
      process.exit(1);
    } else {
      console.log(`❌ Unknown command: ${args.command}`);
      console.log('💡 Use --help for usage information.');
      console.log('');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Error:', error instanceof Error ? error.message : error);
    console.log('💡 Use --help for usage information.');
    console.log('');
    process.exit(1);
  }
}

// Run main if this file is executed directly
main();