## ADDED Requirements

### Requirement: browser.ts exports createMinibobEngine
`repos/minibob/browser.ts` SHALL be a new entry-point file that exports a `createMinibobEngine(opts: BrowserEngineOptions): MinibobEngine` factory. It SHALL wire `BrowserAdapter` and expose the activity execution surface without any Bun-specific imports.

```typescript
interface BrowserEngineOptions {
  endpoint: string;           // activity-api base URL
  apiKey: string;             // HMAC API key
  bashProxyUrl?: string;      // wss:// URL for bash proxy; omit to disable bash
  directoryHandle?: FileSystemDirectoryHandle;  // granted FS handle
  onAsk?: (question: string, options?: string[]) => Promise<string>;
  config?: Partial<MinibobConfig>;
}

interface MinibobEngine {
  executeGoal(goal: string, opts?: GoalOpts): Promise<ExecutionResult>;
  executeActivity(templateId: string, impulses: Impulse[]): Promise<ExecutionResult>;
  getTemplates(): Promise<ActivityTemplate[]>;
  resolveImpulse(pointer: ImpulsePointer): Promise<unknown>;
  on(event: string, handler: (payload: unknown) => void): () => void;
}
```

#### Scenario: Engine created with minimal config
- **WHEN** `createMinibobEngine({ endpoint, apiKey })` is called from a browser
- **THEN** it SHALL return a `MinibobEngine` with `process.supported = false` and all other capabilities operational

#### Scenario: Engine created with full config
- **WHEN** `createMinibobEngine({ endpoint, apiKey, bashProxyUrl, directoryHandle, onAsk })` is called
- **THEN** `executeGoal` SHALL be able to run activities that include bash tasks (via proxy) and file-read tasks (via FS handle)

#### Scenario: No Bun import transitively reachable
- **WHEN** a bundler traces all imports from `browser.ts`
- **THEN** no file in the transitive closure SHALL import from `bun`, `bun:test`, or `node:*` built-in modules

### Requirement: package.json exports field includes browser entry
`repos/minibob/package.json` SHALL add a conditional `exports` entry so bundlers resolve the browser-safe build:

```json
{
  "exports": {
    ".": {
      "bun": "./index.ts",
      "browser": "./browser.ts",
      "default": "./index.ts"
    },
    "./browser": "./browser.ts"
  }
}
```

#### Scenario: Vite resolves browser.ts automatically
- **WHEN** a Vite project `import`s `minibob` (the package)
- **THEN** Vite SHALL resolve to `browser.ts` via the `browser` condition without any alias configuration

#### Scenario: Bun resolves index.ts
- **WHEN** `bun run` imports `minibob`
- **THEN** Bun SHALL resolve to `index.ts` via the `bun` condition

### Requirement: /ws/bash WebSocket endpoint on the Bun server
`repos/minibob/index.ts` SHALL expose a `GET /ws/bash` route that upgrades to WebSocket and handles `{ type: 'spawn', cmd: string[], cwd: string }` messages by running `BashTool` and returning `{ type: 'result', exitCode, stdout, stderr }`.

#### Scenario: Authenticated spawn request
- **WHEN** a WebSocket client sends `{ type: 'spawn', cmd: ['echo', 'hi'], cwd: '/tmp' }` with a valid API key in the upgrade headers
- **THEN** the server SHALL execute the command, and send back `{ type: 'result', exitCode: 0, stdout: 'hi\n', stderr: '' }`

#### Scenario: Unauthenticated request is rejected
- **WHEN** a WebSocket upgrade to `/ws/bash` arrives without a valid `Authorization: ApiKey` header
- **THEN** the server SHALL reject the upgrade with HTTP 401

#### Scenario: Disallowed command is rejected
- **WHEN** the spawn request contains a command not on the `BashTool` allowlist
- **THEN** the server SHALL send `{ type: 'error', message: 'command not allowed' }` and close the connection

### Requirement: Embedded templates load via static imports
`src/embedded-templates/index.ts` SHALL import all template JSON files statically (using `import ... assert { type: 'json' }` or equivalent bundler syntax) rather than reading them with `Bun.file()`. The exported `getTemplate(id)` and `getAllTemplates()` functions SHALL continue to return the same template objects.

#### Scenario: Template available without filesystem access
- **WHEN** `getTemplate('slot-binding')` is called in a browser environment with no file access
- **THEN** it SHALL return the correct template object from the static import

#### Scenario: Bun path is unchanged
- **WHEN** `getTemplate('slot-binding')` is called in the Bun environment
- **THEN** it SHALL return the same template object as before the refactor, with no observable difference
