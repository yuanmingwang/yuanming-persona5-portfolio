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
