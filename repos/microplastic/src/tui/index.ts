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
  type ToolCallDisplay,
  type ImpulseDisplay,
} from "./state.ts";

// Region manager
export {
  RegionManager,
  REGION_PRIORITY,
  createInputRegion,
  createActivityRegion,
  createErrorRegion,
  createSummaryRegion,
  createImpulseRegion,
  createTraceRegion,
  type Region,
  type RegionState,
  type RegionShape,
  type RegionDisplay,
  type RegionContent,
  type RegionManagerEvents,
} from "./regions.ts";

// Region components
export {
  renderRegion,
  renderLayout,
  type RenderContext,
  type RenderedRegion,
} from "./components.ts";

// Renderer
export {
  TextRenderer,
  NarrativeRenderer,
  RegionRenderer,
  PHASE_STYLES,
  type RenderMode,
} from "./renderer.ts";

// Narrative generator
export {
  NarrativeGenerator,
  NarrativeStream,
  type NarrativeEventType,
  type NarrativeEvent,
  type GeneratedNarrative,
  type NarrativePattern,
} from "./narrative.ts";

// Execution bridge
export {
  ExecutionBridge,
  createExecutionBridge,
  type ExecutionBridgeOptions,
} from "./execution-bridge.ts";

// Vessel
export {
  TUIVessel,
  TUI_POINTER_TYPES,
  isTUIPointerType,
  type TUIPointerType,
  type TUIVesselOptions,
} from "./vessel.ts";
