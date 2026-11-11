// Measured from the 3.5s WebM (Persona_5_Stinger_Transition.webm): fully opaque at ~1.3–2.2s.
// Swap well inside that window so neither page change nor scroll reset shows.
export const STINGER_SWITCH_TIME = 1.5

export function getStingerCue(mediaTime: number): 'wait' | 'covered' | 'fallback' {
  // A heavily delayed frame must use the CSS cover instead of swapping after
  // the video's transparent reveal has already started.
  if (mediaTime >= 2.2) return 'fallback'
  return mediaTime >= STINGER_SWITCH_TIME ? 'covered' : 'wait'
}

// Pure state changes keep the outgoing page mounted until the wipe covers it.
export type NavigationState = {
  page: string | null
  transition: {
    target: string | null
    label: string
    phase: 'cover' | 'reveal'
  } | null
}

export type NavigationAction =
  | { type: 'navigate'; target: string | null; label: string; reducedMotion: boolean }
  | { type: 'covered' }
  | { type: 'finished' }

export const initialNavigation: NavigationState = { page: null, transition: null }

export function navigationReducer(state: NavigationState, action: NavigationAction): NavigationState {
  switch (action.type) {
    case 'navigate':
      if (state.transition || action.target === state.page) return state
      if (action.reducedMotion) return { page: action.target, transition: null }
      return { ...state, transition: { target: action.target, label: action.label, phase: 'cover' } }
    case 'covered':
      if (state.transition?.phase !== 'cover') return state
      return { page: state.transition.target, transition: { ...state.transition, phase: 'reveal' } }
    case 'finished':
      if (state.transition?.phase !== 'reveal') return state
      return { ...state, transition: null }
  }
}
