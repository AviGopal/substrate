/**
 * lessonbook (browser read/write) — CRUD over this vessel's curriculum store,
 * which lives in the shared SurrealDB now (`../lessonbook/store.ts`), not a
 * local file — every call here is therefore an SSH round trip and genuinely
 * async, unlike the schema-watch SQLite log's routes above. Nothing in this
 * router dispatches a goal; the browser still does that itself through
 * `/api/run-goal`, same as every other dispatch on this surface.
 */
import { Hono } from "hono";
import {
  addComment,
  addStep,
  addTestNote,
  createBook,
  deleteBook,
  deleteStep,
  getBook,
  insertMissingTests,
  listBooks,
  listComments,
  listTestNotes,
  resetBookRuns,
  resetStepRun,
  updateStepRun,
  type BookStepKind,
  type CommentTarget,
} from "../lessonbook/store.js";
import { corsHeaders } from "./proxy.js";

function asStepKind(v: unknown): BookStepKind | undefined {
  return v === "lesson" || v === "test" || v === "sublesson" || v === "redteam" ? v : undefined;
}

function asCommentTarget(v: unknown): CommentTarget | undefined {
  return v === "book" || v === "page" || v === "lesson" ? v : undefined;
}

export const lessonbookRouter = new Hono();

lessonbookRouter.options("/api/lessonbook/*", (c) => c.body(null, 204, corsHeaders(c.req.header("Origin"))));

lessonbookRouter.get("/api/lessonbook/books", async (c) =>
  c.json({ books: await listBooks() }, 200, corsHeaders(c.req.header("Origin"))),
);

lessonbookRouter.post("/api/lessonbook/books", async (c) => {
  const origin = c.req.header("Origin");
  const body = (await c.req.json().catch(() => null)) as null | Record<string, unknown>;
  const title = typeof body?.["title"] === "string" ? body["title"].trim() : "";
  const topic = typeof body?.["topic"] === "string" ? body["topic"].trim() : "";
  const description = typeof body?.["description"] === "string" ? body["description"].trim() : "";
  if (title.length === 0) {
    return c.json({ error: "title is required" }, 400, corsHeaders(origin));
  }
  const book = await createBook({ title, topic, description });
  return c.json({ book }, 201, corsHeaders(origin));
});

lessonbookRouter.get("/api/lessonbook/books/:id", async (c) => {
  const origin = c.req.header("Origin");
  const book = await getBook(c.req.param("id"));
  if (!book) return c.json({ error: "not found" }, 404, corsHeaders(origin));
  return c.json({ book }, 200, corsHeaders(origin));
});

lessonbookRouter.delete("/api/lessonbook/books/:id", async (c) => {
  await deleteBook(c.req.param("id"));
  return c.json({ ok: true }, 200, corsHeaders(c.req.header("Origin")));
});

lessonbookRouter.post("/api/lessonbook/books/:id/steps", async (c) => {
  const origin = c.req.header("Origin");
  const body = (await c.req.json().catch(() => null)) as null | Record<string, unknown>;
  const prompt = typeof body?.["prompt"] === "string" ? body["prompt"].trim() : "";
  if (prompt.length === 0) return c.json({ error: "prompt is required" }, 400, corsHeaders(origin));
  const kind = asStepKind(body?.["kind"]);
  const afterStepId = typeof body?.["afterStepId"] === "string" ? body["afterStepId"] : undefined;
  const parentId = typeof body?.["parentId"] === "string" ? body["parentId"] : undefined;
  try {
    const step = await addStep(c.req.param("id"), prompt, { ...(kind ? { kind } : {}), parentId, afterStepId });
    return c.json({ step }, 201, corsHeaders(origin));
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 400, corsHeaders(origin));
  }
});

/**
 * A sublesson is just `addStep` with `kind: "sublesson"`, `parentId` set to
 * the failed test, and inserted right BEFORE that test — its own endpoint
 * exists only so the UI's "Add sublesson" control has one obvious call
 * rather than having to know the generic route's parameter names.
 */
lessonbookRouter.post("/api/lessonbook/steps/:testStepId/sublesson", async (c) => {
  const origin = c.req.header("Origin");
  const body = (await c.req.json().catch(() => null)) as null | Record<string, unknown>;
  const prompt = typeof body?.["prompt"] === "string" ? body["prompt"].trim() : "";
  if (prompt.length === 0) return c.json({ error: "prompt is required" }, 400, corsHeaders(origin));
  const bookId = typeof body?.["bookId"] === "string" ? body["bookId"] : "";
  if (bookId.length === 0) return c.json({ error: "bookId is required" }, 400, corsHeaders(origin));
  const testStepId = c.req.param("testStepId");
  try {
    const step = await addStep(bookId, prompt, { kind: "sublesson", parentId: testStepId, beforeStepId: testStepId });
    return c.json({ step }, 201, corsHeaders(origin));
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 400, corsHeaders(origin));
  }
});

lessonbookRouter.delete("/api/lessonbook/steps/:stepId", async (c) => {
  await deleteStep(c.req.param("stepId"));
  return c.json({ ok: true }, 200, corsHeaders(c.req.header("Origin")));
});

lessonbookRouter.post("/api/lessonbook/steps/:stepId/reset", async (c) => {
  await resetStepRun(c.req.param("stepId"));
  return c.json({ ok: true }, 200, corsHeaders(c.req.header("Origin")));
});

/**
 * Recorded by the BROWSER as it polls a step's dispatch — this route never
 * polls goal-host itself. The browser already has the walk state (it is
 * driving the run), so this is a write of the outcome it already knows, not a
 * second read of the same fact.
 */
lessonbookRouter.patch("/api/lessonbook/steps/:stepId/run", async (c) => {
  const origin = c.req.header("Origin");
  const body = (await c.req.json().catch(() => null)) as null | Record<string, unknown>;
  const dispatchId = typeof body?.["dispatchId"] === "string" ? body["dispatchId"] : "";
  const status = body?.["status"];
  if (dispatchId.length === 0 || (status !== "running" && status !== "completed" && status !== "failed")) {
    return c.json({ error: "dispatchId and a valid status are required" }, 400, corsHeaders(origin));
  }
  const reached = typeof body?.["reached"] === "boolean" ? body["reached"] : null;
  const reason = typeof body?.["reason"] === "string" ? body["reason"] : null;
  const step = await updateStepRun(c.req.param("stepId"), { dispatchId, status, reached, reason });
  return c.json({ ok: true, step }, 200, corsHeaders(origin));
});

lessonbookRouter.post("/api/lessonbook/books/:id/reset", async (c) => {
  await resetBookRuns(c.req.param("id"));
  return c.json({ ok: true }, 200, corsHeaders(c.req.header("Origin")));
});

/** Retrofit unit tests every 5 lessons, or fill any gap new lessons opened up. */
lessonbookRouter.post("/api/lessonbook/books/:id/autotest", async (c) => {
  const inserted = await insertMissingTests(c.req.param("id"));
  return c.json({ inserted }, 200, corsHeaders(c.req.header("Origin")));
});

/* ────────────────────────────── test notes ────────────────────────────────
 *
 * Fetched ONLY when a reader expands a test row — same "don't preload"
 * posture as Table Explorer's rows, not embedded in the main book payload.
 */
lessonbookRouter.get("/api/lessonbook/steps/:stepId/notes", async (c) => {
  const notes = await listTestNotes(c.req.param("stepId"));
  return c.json({ notes }, 200, corsHeaders(c.req.header("Origin")));
});

lessonbookRouter.post("/api/lessonbook/steps/:stepId/notes", async (c) => {
  const origin = c.req.header("Origin");
  const body = (await c.req.json().catch(() => null)) as null | Record<string, unknown>;
  const note = typeof body?.["note"] === "string" ? body["note"].trim() : "";
  const author = typeof body?.["author"] === "string" && body["author"].trim().length > 0 ? body["author"].trim() : "operator";
  if (note.length === 0) return c.json({ error: "note is required" }, 400, corsHeaders(origin));
  const created = await addTestNote(c.req.param("stepId"), author, note);
  return c.json({ note: created }, 201, corsHeaders(origin));
});

/* ────────────────────────────── comments ─────────────────────────────────── */

lessonbookRouter.get("/api/lessonbook/comments", async (c) => {
  const origin = c.req.header("Origin");
  const target = asCommentTarget(c.req.query("target"));
  const targetId = c.req.query("targetId");
  if (!target || !targetId) return c.json({ error: "target and targetId are required" }, 400, corsHeaders(origin));
  const comments = await listComments(target, targetId);
  return c.json({ comments }, 200, corsHeaders(origin));
});

lessonbookRouter.post("/api/lessonbook/comments", async (c) => {
  const origin = c.req.header("Origin");
  const body = (await c.req.json().catch(() => null)) as null | Record<string, unknown>;
  const target = asCommentTarget(body?.["target"]);
  const targetId = typeof body?.["targetId"] === "string" ? body["targetId"] : "";
  const commentBody = typeof body?.["body"] === "string" ? body["body"].trim() : "";
  const author = typeof body?.["author"] === "string" && body["author"].trim().length > 0 ? body["author"].trim() : "operator";
  if (!target || targetId.length === 0 || commentBody.length === 0) {
    return c.json({ error: "target, targetId, and body are required" }, 400, corsHeaders(origin));
  }
  const comment = await addComment(target, targetId, author, commentBody);
  return c.json({ comment }, 201, corsHeaders(origin));
});

export default lessonbookRouter;
