import type { Artifact, SessionState, StageStatus } from './types'
import { getCascadeIds } from './engine'
import { INSIGHT_TRIAGE } from './definition'

export type SessionAction =
  | { type: 'SET_INSIGHT'; insight: string }
  | { type: 'CLEAR_FROM_STAGE'; fromPosition: number }
  | { type: 'SET_ARTIFACT_WAITING'; stageId: string }
  | { type: 'APPEND_ARTIFACT_CHUNK'; stageId: string; chunk: string }
  | { type: 'SET_ARTIFACT_STATUS'; stageId: string; status: StageStatus }
  | { type: 'SET_ARTIFACT_ERROR'; stageId: string; error: string }
  | { type: 'SET_ARTIFACT_SKIPPED'; stageId: string; reason?: string }

export const INITIAL_SESSION: SessionState = {
  insight: '',
  artifacts: {},
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'SET_INSIGHT': {
      return {
        insight: action.insight,
        artifacts: {},
      }
    }

    case 'CLEAR_FROM_STAGE': {
      const idsToRemove = new Set(getCascadeIds(INSIGHT_TRIAGE, action.fromPosition))
      const artifacts: Partial<Record<string, Artifact>> = Object.fromEntries(
        Object.entries(state.artifacts).filter(([id]) => !idsToRemove.has(id)),
      )
      return { ...state, artifacts }
    }

    case 'SET_ARTIFACT_WAITING': {
      return {
        ...state,
        artifacts: {
          ...state.artifacts,
          [action.stageId]: {
            stageId: action.stageId,
            content: '',
            status: 'waiting',
          },
        },
      }
    }

    case 'APPEND_ARTIFACT_CHUNK': {
      const existing = state.artifacts[action.stageId]
      return {
        ...state,
        artifacts: {
          ...state.artifacts,
          [action.stageId]: {
            stageId: action.stageId,
            content: (existing?.content ?? '') + action.chunk,
            status: 'streaming',
            error: undefined,
          },
        },
      }
    }

    case 'SET_ARTIFACT_STATUS': {
      const existing = state.artifacts[action.stageId]
      if (!existing) return state
      return {
        ...state,
        artifacts: {
          ...state.artifacts,
          [action.stageId]: { ...existing, status: action.status },
        },
      }
    }

    case 'SET_ARTIFACT_ERROR': {
      const existing = state.artifacts[action.stageId]
      return {
        ...state,
        artifacts: {
          ...state.artifacts,
          [action.stageId]: {
            stageId: action.stageId,
            content: existing?.content ?? '',
            status: 'error',
            error: action.error,
          },
        },
      }
    }

    case 'SET_ARTIFACT_SKIPPED': {
      return {
        ...state,
        artifacts: {
          ...state.artifacts,
          [action.stageId]: {
            stageId: action.stageId,
            content: '',
            status: 'skipped',
            error: action.reason,
          },
        },
      }
    }
  }
}
