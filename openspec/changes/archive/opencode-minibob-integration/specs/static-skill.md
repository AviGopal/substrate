# Static Skill Specification

**Component:** `packages/opencode/src/metabob/index.ts` (skill registration)
**Status:** ❌ NOT IMPLEMENTED
**LOC:** ~40 lines
**Owner:** OpenCode Integration

---

## Purpose

Register ONE static `/minibob` skill that calls backend for all intelligence.

## Key Principle

**Minimal OpenCode Changes:** The skill is just a thin wrapper that:
1. Gathers context
2. Calls backend
3. Displays response

All decision-making, recommendations, and formatting happen in the backend.

---

## Implementation

```typescript
import { Skill } from '@/skill';
import { Session } from '@/session';
import { File } from '@/file';
import { MCPClient } from '@metabob/minibob';

export function registerMiniBobSkill(client: MCPClient) {
  Skill.register({
    name: 'minibob',
    description: 'Get help from MiniBob (recommendations, execution, guidance)',
    handler: async (message?: string) => {
      const session = Session.current();

      // Gather context for backend
      const context = await gatherContext(session);

      // Call backend - it does everything
      const response = await client.call('minibob_help', {
        message,
        context
      });

      // Display whatever backend returns
      return response.message;
    }
  });
}

async function gatherContext(session: Session.Info | null) {
  if (!session) {
    return {
      sessionId: null,
      directory: process.cwd(),
      messages: [],
      files: []
    };
  }

  return {
    sessionId: session.id,
    directory: session.directory,
    messages: await Session.getMessages(session.id),
    files: await File.list(session.directory)
  };
}
```

---

## User Experience

```
User: /minibob add authentication

      ↓ Skill gathers context

Context: {
  sessionId: "sess_abc123",
  directory: "/app",
  messages: [
    { role: "user", content: "Add authentication" }
  ],
  files: ["src/index.ts", "package.json", ...]
}

      ↓ Calls backend.minibob_help()

Backend: Detects intent, runs Thompson Sampling, formats response

      ↓ Returns formatted message

MiniBob: I can help with that using a proven template: **add-auth-v3**
         (78% success rate, avg 45s)

         What it will do:
         1. Read existing API structure
         2. Create auth module
         3. Add middleware
         4. Run tests

         Would you like me to execute this template?
         - Reply "yes" to execute automatically
         - Or follow along manually - I'll guide you step by step

      ↓ User sees formatted message

User: yes

      ↓ Calls backend.execute_template()

MiniBob: ✅ Template executed successfully!
         - Created: src/auth.ts
         - Modified: src/index.ts
         - Tests: 12 passed
         - Duration: 43s
```

---

## Backend API

### `minibob_help(message, context)`

**Request:**
```typescript
{
  message: string | undefined,  // Explicit user message or undefined
  context: {
    sessionId: string | null,
    directory: string,
    messages: Message[],
    files: string[]
  }
}
```

**Response:**
```typescript
{
  message: string,              // Markdown-formatted message for user
  actions: Action[]             // Possible next actions
}

type Action =
  | { type: 'execute_template', templateId: string }
  | { type: 'execute_goal', goal: string, impulses: Impulse[] }
  | { type: 'improvise', goal: string }
```

---

## Context Gathering

**What we send to backend:**

```typescript
{
  sessionId: "sess_abc123",
  directory: "/app/project",
  messages: [
    {
      role: "user",
      content: "Add authentication to the API"
    },
    {
      role: "assistant",
      content: "I'll help you add authentication...",
      parts: [
        { type: "tool", tool: "read", input: "src/index.ts", output: "..." }
      ]
    }
  ],
  files: [
    "src/index.ts",
    "src/auth.ts",
    "package.json",
    "tsconfig.json",
    ...
  ]
}
```

**Backend uses this to:**
- Detect intent (what user wants)
- Find matching templates (Thompson Sampling)
- Format response (user-friendly message)

---

## Error Handling

```typescript
export function registerMiniBobSkill(client: MCPClient) {
  Skill.register({
    name: 'minibob',
    description: 'Get help from MiniBob',
    handler: async (message?: string) => {
      try {
        const context = await gatherContext(Session.current());
        const response = await client.call('minibob_help', { message, context });
        return response.message;
      } catch (error) {
        if (error instanceof NetworkError) {
          return 'MiniBob backend is currently unavailable. Please try again later.';
        }
        throw error;
      }
    }
  });
}
```

---

## Testing

```typescript
describe('MiniBob Skill', () => {
  it('calls backend with context', async () => {
    const mockClient = createMockClient();
    mockClient.call.mockResolvedValue({
      message: 'Test response'
    });

    registerMiniBobSkill(mockClient);
    const result = await Skill.invoke('minibob', 'test message');

    expect(mockClient.call).toHaveBeenCalledWith(
      'minibob_help',
      expect.objectContaining({
        message: 'test message',
        context: expect.any(Object)
      })
    );

    expect(result).toBe('Test response');
  });

  it('handles backend unavailable gracefully', async () => {
    const mockClient = createMockClient();
    mockClient.call.mockRejectedValue(new NetworkError());

    registerMiniBobSkill(mockClient);
    const result = await Skill.invoke('minibob', 'test');

    expect(result).toContain('unavailable');
  });
});
```

---

## What Skill Does NOT Do

- ❌ Detect intent (backend does this)
- ❌ Query for recommendations (backend does this)
- ❌ Format responses (backend does this)
- ❌ Execute templates (backend does this)
- ❌ Store traces (backend does this)

**All intelligence lives in the backend.**

The skill is just a thin wrapper: gather context → call backend → display response.

---

## Comparison: Old vs New

**OLD (Complex, 200+ LOC):**
- ✅ Parse user intent locally
- ✅ Query backend for recommendations
- ✅ Create dynamic skill per recommendation type
- ✅ Format instructions for each mode
- ✅ Register/unregister skills dynamically

**NEW (Simple, 40 LOC):**
- ✅ ONE static skill
- ✅ Call backend with context
- ✅ Display backend response
- ✅ That's it!

**Result:** 80% reduction in OpenCode code, all intelligence in backend where it belongs.

---

## References

- [design.md](../design.md#2-static-skill-indexts---40-loc) - Architecture
- [openspec/meta/improvisation-spectrum.md](../../../meta/improvisation-spectrum.md) - Execution modes (all handled by backend)
- OpenCode Skill system: `repos/metabob-opencode/packages/opencode/src/skill/index.ts`
