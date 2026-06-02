/**
 * In-memory store for panels, feedback, and recent interactor observations.
 * No persistence — scaffold only. Substrate is free to extend.
 */

export type AskType = "text" | "choice" | "number";

export interface Ask {
  id: string;
  prompt: string;
  type: AskType;
  choices?: string[];
}

export interface Panel {
  id: string;
  title: string;
  body: string;
  kind: string; // "info" | "question" | "warning" | …
  importance: string; // "low" | "medium" | "high"
  asks?: Ask[];
  createdAt: number;
  updatedAt: number;
}

export interface Feedback {
  panelId: string;
  askId?: string;
  value: unknown;
  kind: "answer" | "reaction" | "dismiss";
  receivedAt: number;
}

export interface Observation {
  type: "click" | "dwell" | "scroll" | "focus";
  panelId?: string;
  askId?: string;
  durationMs?: number;
  position?: { x: number; y: number };
  observedAt: number;
}

const panels = new Map<string, Panel>();
const feedback: Feedback[] = [];
const observations: Observation[] = [];
const MAX_HISTORY = 500;

type Listener = (event: { event: string; data: unknown }) => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(event: string, data: unknown): void {
  for (const l of listeners) {
    try { l({ event, data }); } catch { /* ignore */ }
  }
}

export function upsertPanel(p: Omit<Panel, "createdAt" | "updatedAt"> & { createdAt?: number }): Panel {
  const now = Date.now();
  const existing = panels.get(p.id);
  const stored: Panel = {
    ...p,
    createdAt: existing?.createdAt ?? p.createdAt ?? now,
    updatedAt: now,
  };
  panels.set(p.id, stored);
  emit(existing ? "panel_updated" : "panel_added", stored);
  return stored;
}

export function listPanels(): Panel[] {
  return Array.from(panels.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function recordFeedback(f: Omit<Feedback, "receivedAt">): Feedback {
  const entry: Feedback = { ...f, receivedAt: Date.now() };
  feedback.push(entry);
  if (feedback.length > MAX_HISTORY) feedback.shift();
  emit("feedback_received", entry);
  return entry;
}

export function recentFeedback(limit = 50): Feedback[] {
  return feedback.slice(-limit).reverse();
}

export function recordObservation(o: Omit<Observation, "observedAt">): Observation {
  const entry: Observation = { ...o, observedAt: Date.now() };
  observations.push(entry);
  if (observations.length > MAX_HISTORY) observations.shift();
  return entry;
}

export function recentObservations(limit = 50): Observation[] {
  return observations.slice(-limit).reverse();
}
