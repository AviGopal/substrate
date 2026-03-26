# Metabob OpenCode Architectural Boundaries

**Status:** ENFORCED  
**Version:** 1.0  
**Last Updated:** 2026-02-27

## Overview

The `metabob-opencode` package is a general-purpose AI agent framework. It must maintain clean architectural boundaries to remain portable, testable, and reusable across different environments and infrastructure configurations.

## Core Principles

1. **Infrastructure Independence**: Framework code should not know about specific infrastructure (Docker, Kubernetes, SurrealDB, Redis, etc.)
2. **Transport Abstraction**: Communication mechanisms should use abstract interfaces, not concrete implementations
3. **Dependency Inversion**: High-level modules (framework) should not depend on low-level modules (infrastructure)
4. **Separation of Concerns**: Database, container orchestration, and deployment concerns belong in infrastructure layer

---

## Boundary Violations (PROHIBITED)

### ❌ Violation 1: Docker-Exec in ACP Delegate

**Location:** `packages/opencode/src/acp/transports/docker-transport.ts`

**Problem:**
```typescript
// ❌ BAD: Framework code spawns docker exec directly
import { spawn } from "bun"

const process = spawn({
  cmd: ["docker", "exec", "-i", this.containerName, "opencode", "acp", "--cwd", this.directory],
  stdin: "pipe",
  stdout: "pipe",
})
```

**Why It's Wrong:**
- Couples ACP protocol to Docker container runtime
- Prevents using ACP over SSH, HTTP, WebSocket, or other transports
- Makes framework untestable without Docker installed
- Violates transport abstraction - ACP should work with ANY transport layer
- Infrastructure concern (Docker) leaks into framework layer

**Correct Approach:**
- Use `@agentclientprotocol/sdk` ACPClient with pluggable transports
- Docker transport should be ONE transport option, not the ONLY option
- Transport selection happens at infrastructure layer (docker/, helm/, scripts/)

---

### ❌ Violation 2: SurrealDB Knowledge in Framework Code

**Location:** `packages/opencode/src/vessel/bootstrap.ts`

**Problem:**
```typescript
// ❌ BAD: Framework code knows about SurrealDB specifics
export async function registerVesselInSurrealDB(
  vessel_name: string,
  pod_ip: string,
  acp_port: number = 3000
): Promise<void> {
  const surreal_host = process.env.SURREAL_HOST || "localhost"
  const surreal_port = process.env.SURREAL_PORT || "8000"
  
  const query = `
    UPSERT vessel_registry:⟨${vessel_name}⟩ CONTENT {
      pod_name: "${vessel_name}",
      pod_ip: "${pod_ip}",
      ...
    };
  `
  
  const response = await fetch(`http://${surreal_host}:${surreal_port}/sql`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      "NS": surreal_ns,
      "DB": surreal_db,
      "Authorization": `Basic ${Buffer.from(...).toString("base64")}`
    },
    body: query
  })
}
```

**Why It's Wrong:**
- Framework code contains SurrealDB-specific SQL queries
- Hardcodes SurrealDB HTTP API, authentication, headers
- Makes framework untestable without SurrealDB running
- Prevents using other databases (Postgres, MongoDB, etc.)
- Violates abstraction - framework should use generic storage interface

**Correct Approach:**
- Define abstract `VesselRegistry` interface in framework
- Implement `SurrealDBVesselRegistry` in infrastructure layer
- Inject registry implementation at bootstrap via dependency injection
- Framework code calls `registry.register(vessel)`, doesn't know implementation

---

## Enforcement Architecture

### Layer 1: Framework (metabob-opencode)

**Location:** `repos/metabob-opencode/packages/opencode/src/`

**Allowed:**
- ✅ Abstract interfaces (VesselRegistry, Transport, Storage)
- ✅ Business logic (activity execution, session management, impulse resolution)
- ✅ Protocol implementations (ACP client using SDK)
- ✅ Generic utilities (logging, error handling, validation)

**Prohibited:**
- ❌ Direct database clients (surrealdb, pg, mongodb)
- ❌ Container runtime clients (docker, kubernetes)
- ❌ Infrastructure-specific configuration (SurrealDB env vars, Docker commands)
- ❌ Spawn/exec of system commands
- ❌ HTTP clients making infrastructure-specific API calls

---

### Layer 2: Infrastructure (infrastructure package or deployment code)

**Location:** `docker/`, `helm/`, `scripts/`, OR separate `packages/infrastructure/`

**Allowed:**
- ✅ Concrete implementations (SurrealDBVesselRegistry, DockerACPTransport)
- ✅ Database clients and connection management
- ✅ Container runtime clients
- ✅ Deployment scripts and configuration
- ✅ Infrastructure-specific environment variable handling

**Responsibilities:**
- Implement framework interfaces with infrastructure-specific logic
- Wire dependencies at application startup
- Handle infrastructure failures gracefully
- Provide configuration from environment

---

## Correct Implementation Pattern

### Example 1: ACP Transport Abstraction

**Framework Layer:**
```typescript
// packages/opencode/src/acp/transport.ts
export interface ACPTransport {
  connect(): Promise<{ stdin: WritableStream, stdout: ReadableStream }>
  close(): Promise<void>
  getMetadata(): { type: string; target: string }
}

// packages/opencode/src/tool/acp-delegate.ts
export class ACPDelegateTool {
  async execute(params: { target: string; prompt: string }) {
    // Parse connection string to determine transport type
    const transport = TransportFactory.create(params.target)
    
    // Use ACP SDK with transport (no docker-exec knowledge!)
    const client = new ACPClient({ transport })
    await client.connect()
    // ... rest of ACP protocol logic
  }
}
```

**Infrastructure Layer:**
```typescript
// packages/infrastructure/src/transports/docker-transport.ts
export class DockerACPTransport implements ACPTransport {
  constructor(private containerName: string) {}
  
  async connect() {
    // Docker-specific implementation
    const process = spawn({ cmd: ["docker", "exec", "-i", this.containerName, ...] })
    return { stdin: process.stdin, stdout: process.stdout }
  }
}

// packages/infrastructure/src/transports/http-transport.ts
export class HTTPACPTransport implements ACPTransport {
  constructor(private url: string) {}
  
  async connect() {
    // HTTP WebSocket implementation
    const ws = new WebSocket(this.url)
    return { stdin: ws.writable, stdout: ws.readable }
  }
}
```

---

### Example 2: Vessel Registry Abstraction

**Framework Layer:**
```typescript
// packages/opencode/src/vessel/registry.ts
export interface VesselRegistry {
  register(vessel: VesselInfo): Promise<void>
  unregister(vesselId: string): Promise<void>
  list(): Promise<VesselInfo[]>
  get(vesselId: string): Promise<VesselInfo | null>
}

// packages/opencode/src/vessel/bootstrap.ts
export class BootstrapManager {
  constructor(
    private registry: VesselRegistry,
    private backend: BackendClient
  ) {}
  
  async bootstrap() {
    // Register with backend (primary)
    const vesselId = await this.backend.register(...)
    
    // Register with vessel registry (for peer discovery)
    await this.registry.register({
      vesselId,
      podName: process.env.VESSEL_NAME,
      acpEndpoint: `${process.env.VESSEL_NAME}.devbob-headless:3000`
    })
  }
}
```

**Infrastructure Layer:**
```typescript
// packages/infrastructure/src/registry/surrealdb-registry.ts
import { Surreal } from "surrealdb"

export class SurrealDBVesselRegistry implements VesselRegistry {
  private db: Surreal
  
  async register(vessel: VesselInfo): Promise<void> {
    await this.db.query(`
      UPSERT vessel_registry:⟨${vessel.vesselId}⟩ 
      CONTENT ${JSON.stringify(vessel)}
    `)
  }
  
  async list(): Promise<VesselInfo[]> {
    const result = await this.db.query("SELECT * FROM vessel_registry")
    return result.map(r => r as VesselInfo)
  }
}

// docker/devbob/bootstrap.ts (entrypoint)
import { BootstrapManager } from "@metabob/opencode"
import { SurrealDBVesselRegistry } from "@metabob/infrastructure"

const registry = new SurrealDBVesselRegistry({
  host: process.env.SURREAL_HOST,
  port: process.env.SURREAL_PORT,
  // ... config
})

const bootstrap = new BootstrapManager(registry, backend)
await bootstrap.bootstrap()
```

---

## Validation Strategy

### Static Analysis (Automated)

```bash
# Check for docker-exec violations
cd repos/metabob-opencode
rg "docker.*exec|spawn.*docker" packages/opencode/src/ && echo "❌ VIOLATION: docker-exec found" || echo "✅ PASS"

# Check for SurrealDB violations
rg "surrealdb|SurrealDB" packages/opencode/src/ --type-add 'ts:*.ts' --type ts && echo "❌ VIOLATION: SurrealDB found" || echo "✅ PASS"

# Check package.json dependencies
jq '.dependencies | keys[] | select(test("surrealdb|docker"))' packages/opencode/package.json && echo "❌ VIOLATION" || echo "✅ PASS"
```

### Manual Code Review Checklist

**For each new file in `packages/opencode/src/`:**
- [ ] Does it import any database clients? (surrealdb, pg, mongodb)
- [ ] Does it spawn system processes? (child_process, spawn)
- [ ] Does it make HTTP calls to infrastructure APIs? (SurrealDB, Redis, K8s)
- [ ] Does it read infrastructure-specific env vars? (SURREAL_HOST, DOCKER_HOST)
- [ ] Could this code run in a different environment without modification?

**If any answer is YES, refactor to use abstraction.**

---

## Migration Plan

### Phase 1: Create Abstractions (CURRENT)
1. ✅ Define `ACPTransport` interface
2. ✅ Define `VesselRegistry` interface
3. ✅ Move `DockerTransport` to separate file (partially done)
4. ⏳ Extract `SurrealDBVesselRegistry` to infrastructure layer

### Phase 2: Refactor Framework Code
1. ⏳ Update `acp-delegate.ts` to use `ACPTransport` interface only
2. ⏳ Update `bootstrap.ts` to accept `VesselRegistry` via dependency injection
3. ⏳ Remove direct SurrealDB imports from framework code
4. ⏳ Remove `registerVesselInSurrealDB` function from bootstrap.ts

### Phase 3: Create Infrastructure Package
1. ⏳ Create `packages/infrastructure/` package
2. ⏳ Move `docker-transport.ts` to infrastructure
3. ⏳ Move `SurrealDBVesselRegistry` to infrastructure
4. ⏳ Create HTTP/WebSocket transport implementations
5. ⏳ Export transport factory for easy wiring

### Phase 4: Update Deployment Code
1. ⏳ Update `docker/devbob/bootstrap.ts` to wire dependencies
2. ⏳ Update helm charts to provide infrastructure configuration
3. ⏳ Update test harnesses to use mock implementations

---

## Benefits of Clean Boundaries

1. **Portability:** Framework works in any environment (local, Docker, K8s, cloud, edge)
2. **Testability:** Mock implementations for fast unit tests without infrastructure
3. **Flexibility:** Swap SurrealDB for Postgres, Docker for Podman, etc. without changing framework
4. **Reusability:** Framework can be used in projects without Metabob infrastructure
5. **Maintainability:** Clear separation of concerns, easier to debug and modify
6. **Open Source Ready:** Framework can be open-sourced without exposing infrastructure details

---

## References

- **Clean Architecture** (Robert C. Martin): Dependency Inversion Principle
- **Hexagonal Architecture** (Alistair Cockburn): Ports and Adapters pattern
- **SOLID Principles**: Dependency Inversion, Interface Segregation
- **12-Factor App**: Config, Backing Services as attached resources

---

## Enforcement Status

| Violation | Status | Files Affected | Action Required |
|-----------|--------|----------------|-----------------|
| Docker-exec in ACP | 🟡 PARTIAL | `acp/transports/docker-transport.ts` | Move to infrastructure package |
| SurrealDB in bootstrap | 🔴 ACTIVE | `vessel/bootstrap.ts` | Extract to infrastructure layer |
| No VesselRegistry abstraction | 🔴 ACTIVE | `vessel/bootstrap.ts` | Create interface, inject implementation |
| No Transport factory | 🟡 PARTIAL | `tool/acp-delegate.ts` | Add TransportFactory with plugin system |

**Next Action:** Execute refactoring to move infrastructure code out of framework layer.
