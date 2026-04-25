# Local Development with MiniBob

## Local MiniBob Integration

### Prerequisites

- `~/.metabob/config.json` with a valid `metabob.apiKey`
- `minibob` available in PATH (or run via `bun run index.ts` from `repos/minibob/`)
- discovery-vessel available (from `repos/discovery-vessel/`)

### Start the stack

**1. Start discovery-vessel** (port 8080):

```bash
cd repos/discovery-vessel
bun run start
```

**2. Start react-renderer** (port 3000):

```bash
cd repos/react-renderer
DISCOVERY_ENABLED=true bun run dev
```

**3. Dispatch a render activity** (in a third terminal):

```bash
minibob --single "render the file tree for /home/avi/documents/work/exp-repo"
```

**4. Open the view** in a browser:

```
http://localhost:3000/view
```

A data table with the file tree should appear within a few seconds.

### Automated integration test

```bash
cd repos/react-renderer
bun test --grep @local-only
```

Requires both servers running (steps 1 and 2 above) and a valid config file. The test posts a synthetic impulse directly to `/impulses` and asserts the view updates.
