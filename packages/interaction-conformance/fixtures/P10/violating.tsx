// P10 VIOLATION: acceptance collapses into completion and silence has no state
// of its own, so a run that stopped being answered still reads as running.
export type RunState = 'running' | 'waiting' | 'completed' | 'failed';
