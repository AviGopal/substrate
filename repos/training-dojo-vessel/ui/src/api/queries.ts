import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import {
  addBookStep,
  addSublesson,
  addTestNote,
  answerSolicitation,
  autotestBook,
  createBook,
  createTableRow,
  deleteBook,
  deleteBookStep,
  deleteTableRow,
  dispatchGoal,
  fetchActiveDispatches,
  fetchBook,
  fetchBooks,
  fetchCapability,
  fetchDbTargets,
  fetchFleetShapes,
  fetchGaps,
  fetchRenderPolicy,
  fetchSchemaDiffs,
  fetchSchemaSnapshot,
  fetchTableRows,
  fetchTestNotes,
  fetchWalkState,
  injectContext,
  resetBookRuns,
  scanSchemaNow,
  submitGrade,
  updateTableRow,
} from "./client";
import type { RenderPolicy } from "./client";
import type {
  ActiveDispatch,
  Book,
  BookSummary,
  DbTarget,
  DispatchRequest,
  FleetShapes,
  GoalWalkState,
  InterfaceGap,
  SchemaSnapshot,
  SchemaSnapshotDiff,
} from "./types";
import { recordDispatchVocabulary } from "../lib/shapeAttribution";

export const queryKeys = {
  board: ["activeDispatches"] as const,
  walk: (dispatchId: string) => ["goalWalkState", dispatchId] as const,
  shapes: ["fleetShapes"] as const,
  capability: (shape: string) => ["vesselCapability", shape] as const,
  renderPolicy: ["renderPolicy"] as const,
  interfaceGaps: ["interfaceGaps"] as const,
  schemaSnapshot: (targetKey: string | undefined) => ["schemaSnapshot", targetKey ?? ""] as const,
  schemaDiffs: (targetKey: string | undefined, limit: number) => ["schemaSnapshotDiff", targetKey ?? "", limit] as const,
  books: ["lessonbookBooks"] as const,
  book: (bookId: string) => ["lessonbookBook", bookId] as const,
};

/**
 * The board.
 *
 * `enabled` is how rule P6's freeze is implemented, and the choice matters:
 * with `enabled: false` TanStack Query stops refetching but KEEPS the cached
 * data, so a frozen region shows the last state it had rather than blanking.
 * Unmounting the query, or clearing it, would discard state the reader is in
 * the middle of reading — which is the same failure as moving the row.
 */
export function useBoard(opts: { enabled: boolean; intervalMs: number }): UseQueryResult<readonly ActiveDispatch[]> {
  return useQuery({
    queryKey: queryKeys.board,
    queryFn: fetchActiveDispatches,
    enabled: opts.enabled,
    refetchInterval: opts.enabled ? opts.intervalMs : false,
    refetchOnWindowFocus: false,
    staleTime: 0,
    // A poll that fails once must not blank a board the reader is using.
    placeholderData: (previous) => previous,
    // NO RETRY, and this is about honesty rather than about load.
    //
    // A retrying query re-enters `pending` on the way to each attempt, so
    // `isError` FLAPS: on a 2s poll against a dead upstream the region spent
    // roughly one second in three rendering "Reading the board…" over the top
    // of its own failure banner — a surface whose entire premise is that it
    // cannot report a status as an outcome, hiding its outage on a loop.
    // With retry off, a failed poll is a failed poll until the next one, and
    // the region reads `failureCount` rather than `isError` so even a
    // momentary return to `pending` cannot repaint the failure as loading.
    retry: false,
  });
}

export function useWalk(
  dispatchId: string | null,
  opts: { enabled: boolean; intervalMs: number },
): UseQueryResult<GoalWalkState> {
  return useQuery({
    queryKey: queryKeys.walk(dispatchId ?? ""),
    queryFn: () => fetchWalkState(dispatchId as string),
    enabled: Boolean(dispatchId) && opts.enabled,
    refetchInterval: opts.enabled ? opts.intervalMs : false,
    refetchOnWindowFocus: false,
    placeholderData: (previous) => previous,
  });
}

/**
 * The live shape vocabulary. Long stale time: the fleet's vocabulary changes on
 * the order of deployments, not seconds, and re-deriving starters underneath a
 * reader who is about to click one would move the target.
 */
export function useFleetShapes(): UseQueryResult<FleetShapes> {
  return useQuery({
    queryKey: queryKeys.shapes,
    queryFn: fetchFleetShapes,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

/** Producer verification for ONE starter. Refines a chip already on screen. */
export function useCapability(shape: string, enabled: boolean): UseQueryResult<boolean> {
  return useQuery({
    queryKey: queryKeys.capability(shape),
    queryFn: () => fetchCapability(shape),
    enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export function useDispatchGoal() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (req: DispatchRequest & { checkSurfaceIntent?: boolean }) =>
      dispatchGoal(req, { checkSurfaceIntent: req.checkSurfaceIntent }),
    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: queryKeys.board });
      if (result.kind === "accepted") {
        // The only instant "before this run" and "before this run's own new
        // shapes were registered" are still the same moment — capture it now
        // or the detail page can never attribute a new shape to this run.
        void fetchFleetShapes()
          .then((fleet) => recordDispatchVocabulary(result.dispatchId, fleet.shapes))
          .catch(() => {
            /* best-effort: a failed capture just means this run reads "not recorded" later */
          });
      }
    },
  });
}

export function useSubmitGrade() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: submitGrade,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.board });
    },
  });
}

export function useAnswerSolicitation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: answerSolicitation,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.board });
    },
  });
}

export function useInjectContext() {
  return useMutation({ mutationFn: injectContext });
}

/* ────────────────────────── schema watch ──────────────────────────────────
 *
 * `staleTime: 0` and no polling by default: the Tables page reads whatever
 * the last tick (or the last "Scan now") wrote, and a mutation invalidates it
 * — there is no reason to poll a value that only changes once every ~4
 * minutes at most, and polling it anyway would just be load for no signal.
 */
/**
 * `poll`: while a scan is known to be in flight (see `useScanNow`'s
 * `scanning` return value), the caller passes a short interval here so the
 * page picks up the new snapshot the moment the background scan finishes,
 * without polling at all the rest of the time.
 */
export function useDbTargets(): UseQueryResult<readonly DbTarget[]> {
  return useQuery({
    queryKey: ["dbTargets"],
    queryFn: fetchDbTargets,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useSchemaSnapshot(targetKey: string | undefined, poll?: number | false): UseQueryResult<SchemaSnapshot | null> {
  return useQuery({
    queryKey: queryKeys.schemaSnapshot(targetKey),
    queryFn: () => fetchSchemaSnapshot(targetKey),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: poll ?? false,
    retry: false,
  });
}

export function useSchemaDiffs(targetKey: string | undefined, limit = 50): UseQueryResult<readonly SchemaSnapshotDiff[]> {
  return useQuery({
    queryKey: queryKeys.schemaDiffs(targetKey, limit),
    queryFn: () => fetchSchemaDiffs(targetKey, limit),
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * "Scan now" — the same `db_admin`/`schema_snapshot` operation the periodic
 * timer calls, just on demand. Invalidates BOTH the snapshot and the diff
 * list, because a scan that changed anything writes a new diff row too.
 */
export function useScanNow() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (targetKey?: string) => scanSchemaNow(targetKey),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["schemaSnapshot"] });
      void client.invalidateQueries({ queryKey: ["schemaSnapshotDiff"] });
    },
  });
}


/**
 * The interface's own gap store — the substrate's legibility findings and
 * human complaints, one keyspace. Shared by `GapBadge` (every page) and
 * `GapStrip` (the full `/gaps` page) so the two agree and a visit to one
 * primes the cache for the other.
 */
export function useInterfaceGaps(opts: {
  enabled: boolean;
  intervalMs: number;
}): UseQueryResult<readonly InterfaceGap[]> {
  return useQuery({
    queryKey: queryKeys.interfaceGaps,
    queryFn: fetchGaps,
    enabled: opts.enabled,
    refetchInterval: opts.enabled ? opts.intervalMs : false,
    refetchOnWindowFocus: false,
    staleTime: 0,
    placeholderData: (previous) => previous,
  });
}

/**
 * Rendering behaviour, re-read on the live cadence. Freezes with everything
 * else when the reader pauses — a policy change must not move the surface under
 * someone who has deliberately stopped it.
 */
export function useRenderPolicy(opts: {
  enabled: boolean;
  intervalMs: number;
}): UseQueryResult<RenderPolicy> {
  return useQuery({
    queryKey: queryKeys.renderPolicy,
    queryFn: fetchRenderPolicy,
    enabled: opts.enabled,
    refetchInterval: opts.enabled ? opts.intervalMs : false,
    refetchOnWindowFocus: false,
    staleTime: 0,
    placeholderData: (previous) => previous,
  });
}

/* ────────────────────────────── lessonbook ──────────────────────────────── */

export function useBooks(): UseQueryResult<readonly BookSummary[]> {
  return useQuery({
    queryKey: queryKeys.books,
    queryFn: fetchBooks,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

/**
 * `poll`: while a run is in flight, `LessonbookDetailPage`'s own runner is
 * already polling `goalWalkState` directly and writing outcomes back through
 * `recordBookStepRun` — this query just needs to pick up THOSE writes after
 * each one lands, on the same short interval, rather than trusting its own
 * cache to notice a mutation made through a different hook.
 */
export function useBook(bookId: string | null, poll?: number | false): UseQueryResult<Book> {
  return useQuery({
    queryKey: queryKeys.book(bookId ?? ""),
    queryFn: () => fetchBook(bookId as string),
    enabled: Boolean(bookId),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: poll ?? false,
  });
}

export function useCreateBook() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createBook,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.books });
    },
  });
}

export function useDeleteBook() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteBook,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.books });
    },
  });
}

export function useAddBookStep(bookId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (args: { prompt: string; afterStepId?: string }) =>
      addBookStep(bookId, args.prompt, { afterStepId: args.afterStepId }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.book(bookId) });
      void client.invalidateQueries({ queryKey: queryKeys.books });
    },
  });
}

export function useDeleteBookStep(bookId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteBookStep,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.book(bookId) });
      void client.invalidateQueries({ queryKey: queryKeys.books });
    },
  });
}

export function useResetBookRuns(bookId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => resetBookRuns(bookId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.book(bookId) });
      void client.invalidateQueries({ queryKey: queryKeys.books });
    },
  });
}

export function useAddSublesson(bookId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (args: { testStepId: string; prompt: string }) => addSublesson(args.testStepId, bookId, args.prompt),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.book(bookId) });
      void client.invalidateQueries({ queryKey: queryKeys.books });
    },
  });
}

export function useAutotestBook(bookId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => autotestBook(bookId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.book(bookId) });
      void client.invalidateQueries({ queryKey: queryKeys.books });
    },
  });
}

/* ────────────────────────────── table explorer ──────────────────────────────
 *
 * A mutation, not a query — the whole point is that nothing runs until the
 * reader presses Fetch. `useMutation` never fires on its own; a `useQuery`
 * would need `enabled: false` plus a manual `refetch()` to get the same
 * guarantee, for no benefit here since results are never cached across a
 * table/limit change anyway.
 */
export function useTableRows() {
  return useMutation({
    mutationFn: (args: { table: string; limit: number; targetKey?: string }) =>
      fetchTableRows(args.table, args.limit, args.targetKey),
  });
}

/** Refused server-side for any non-editable target — see `explore.ts`. */
export function useCreateTableRow() {
  return useMutation({
    mutationFn: (args: { table: string; targetKey: string; fields: Record<string, unknown> }) =>
      createTableRow(args.table, args.targetKey, args.fields),
  });
}

export function useUpdateTableRow() {
  return useMutation({
    mutationFn: (args: { table: string; targetKey: string; recordId: string; fields: Record<string, unknown> }) =>
      updateTableRow(args.table, args.targetKey, args.recordId, args.fields),
  });
}

export function useDeleteTableRow() {
  return useMutation({
    mutationFn: (args: { table: string; targetKey: string; recordId: string }) =>
      deleteTableRow(args.table, args.targetKey, args.recordId),
  });
}

/* ────────────────────────────── test notes ────────────────────────────────── */

export function useTestNotes(stepId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["testNotes", stepId ?? ""],
    queryFn: () => fetchTestNotes(stepId as string),
    enabled: Boolean(stepId) && enabled,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useAddTestNote(stepId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (args: { note: string; author?: string }) => addTestNote(stepId, args.note, args.author),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["testNotes", stepId] });
    },
  });
}
