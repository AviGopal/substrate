// Export main modules
export * from './types';
export * from './ai-provider';
export * from './stream';

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
    model: 'anthropic/claude-3-haiku-20240307',
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
  -m, --model <model>       AI model to use (default: anthropic/claude-3-haiku-20240307)
  -h, --help                Show this help message

Examples:
  conversation-vessel serve                              # Start server with defaults
  conversation-vessel serve --port 8080                 # Custom port
  conversation-vessel serve --model openai/gpt-4        # Use OpenAI GPT-4
  conversation-vessel serve -p 3001 -m anthropic/claude-3-sonnet-20240229

Available models:
  Anthropic: anthropic/claude-3-haiku-20240307, anthropic/claude-3-sonnet-20240229
  OpenAI: openai/gpt-3.5-turbo, openai/gpt-4, openai/gpt-4-turbo
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
      console.log('📡 Streaming: Enabled');
      console.log('');
      
      // Server implementation would go here
      console.log('✅ Server ready - streaming chat completions available');
    } else if (!args.command) {
      console.log('⚠️  No command specified.');
      console.log('💡 Use "serve" to start the server or --help for usage information.');
      process.exit(1);
    } else {
      console.log(`❌ Unknown command: ${args.command}`);
      console.log('💡 Use --help for usage information.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Error:', error instanceof Error ? error.message : error);
    console.log('💡 Use --help for usage information.');
    process.exit(1);
  }
}

// Run main if this file is executed directly
if (require.main === module) {
  main();
}