// src/core/launch-state.ts
import type { LaunchState } from '../shared/ipc.js';

export interface StateInputs {
  loggedIn: boolean;
  installed: boolean;
  syncNeeded: boolean;
}

/** Decide the main action-button state. 'updating'/'launching' are set transiently by the service. */
export function deriveLaunchState(i: StateInputs): LaunchState {
  if (!i.loggedIn) return 'logged-out';
  if (!i.installed || i.syncNeeded) return 'update-available';
  return 'play';
}
