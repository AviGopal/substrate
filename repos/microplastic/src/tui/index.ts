/**
 * TUI Module
 *
 * Narrative TUI for microplastic.
 * Provides user interaction, state management, and display rendering.
 */

// State machine
export {
  TUIState,
  TransitionRecorder,
  type NarrativePhase,
  type InputState,
  type ProgressState,
  type NarrativeContent,
  type TUISnapshot,
  type StateTransition,
  type TUIStateEvents,
} from "./state.ts";

// Renderer
export {
  TextRenderer,
  NarrativeRenderer,
  PHASE_STYLES,
  type RenderMode,
} from "./renderer.ts";

// Vessel
export {
  TUIVessel,
  TUI_POINTER_TYPES,
  isTUIPointerType,
  type TUIPointerType,
  type TUIVesselOptions,
} from "./vessel.ts";
