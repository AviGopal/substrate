import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { Surface } from "./Surface";
import { LessonsPage } from "./pages/LessonsPage";
import { TraceLogPage } from "./pages/TraceLogPage";
import { TablesPage } from "./pages/TablesPage";
import { DiffHistoryPage } from "./pages/DiffHistoryPage";
import { GapsPage } from "./pages/GapsPage";
import { LessonbookPage } from "./pages/LessonbookPage";
import { LessonbookDetailPage } from "./pages/LessonbookDetailPage";
import { TableExplorerPage } from "./pages/TableExplorerPage";

/**
 * `Surface` is the shared layout (render-policy read, the hidden `h1`, the
 * gap badge, the four-page nav) — it renders an `<Outlet/>` for whichever
 * page below matched.
 */
const rootRoute = createRootRoute({ component: Surface });

/**
 * `redo`: carries a goal from the Trace/Log page's "Teach a correction"
 * button back into the lesson box, pre-filled rather than pre-sent — the P2
 * rule this whole surface follows for every other suggestion (starter chips,
 * DB templates) applies here too: arriving from a correction link still
 * requires the reader's own submit.
 */
const lessonsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LessonsPage,
  validateSearch: (search: Record<string, unknown>): { redo?: string } => ({
    redo: typeof search["redo"] === "string" ? search["redo"] : undefined,
  }),
});

/**
 * The trace/log view is a ROUTE, not embedded state, for the same reason
 * human-surface's detail panel is one: a lesson a reader is watching survives
 * a reload, can be linked to, and is where the browser's back button expects
 * it to be. See `pages/TraceLogPage.tsx`.
 */
const traceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/trace/$dispatchId",
  component: TraceLogPage,
});

const tablesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tables",
  component: TablesPage,
});

const diffsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/diffs",
  component: DiffHistoryPage,
});

const gapsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/gaps",
  component: GapsPage,
});

const lessonbookRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/lessonbook",
  component: LessonbookPage,
});

const lessonbookDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/lessonbook/$bookId",
  component: LessonbookDetailPage,
});

const explorerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/explorer",
  component: TableExplorerPage,
});

const routeTree = rootRoute.addChildren([
  lessonsRoute,
  traceRoute,
  tablesRoute,
  diffsRoute,
  gapsRoute,
  lessonbookRoute,
  lessonbookDetailRoute,
  explorerRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
