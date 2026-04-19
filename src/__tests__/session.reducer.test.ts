import { describe, it, expect } from 'vitest'
import { sessionReducer, INITIAL_SESSION } from '../workflow/session.reducer'
import type { SessionState } from '../workflow/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function withInsight(insight: string): SessionState {
  return { ...INITIAL_SESSION, insight }
}

function stateWithArtifacts(
  insight: string,
  artifacts: SessionState['artifacts'],
): SessionState {
  return { insight, artifacts }
}

// ---------------------------------------------------------------------------
// SET_INSIGHT
// ---------------------------------------------------------------------------

describe('SET_INSIGHT', () => {
  it('updates the insight text', () => {
    const next = sessionReducer(INITIAL_SESSION, { type: 'SET_INSIGHT', insight: 'my idea' })
    expect(next.insight).toBe('my idea')
  })

  it('clears all artifacts when insight changes', () => {
    const state = stateWithArtifacts('old', {
      'stage-1': { stageId: 'stage-1', content: 'done', status: 'complete' },
      'stage-2': { stageId: 'stage-2', content: 'done2', status: 'complete' },
    })
    const next = sessionReducer(state, { type: 'SET_INSIGHT', insight: 'new idea' })
    expect(next.artifacts).toEqual({})
  })

  it('setting insight to same value still clears artifacts', () => {
    const state = stateWithArtifacts('same', {
      'stage-1': { stageId: 'stage-1', content: 'x', status: 'complete' },
    })
    const next = sessionReducer(state, { type: 'SET_INSIGHT', insight: 'same' })
    expect(next.artifacts).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// CLEAR_FROM_STAGE
// ---------------------------------------------------------------------------

describe('CLEAR_FROM_STAGE', () => {
  const baseState = stateWithArtifacts('insight', {
    'stage-1': { stageId: 'stage-1', content: 'a', status: 'complete' },
    'stage-2': { stageId: 'stage-2', content: 'b', status: 'complete' },
  })

  it('clears all artifacts when fromPosition is 0', () => {
    const next = sessionReducer(baseState, { type: 'CLEAR_FROM_STAGE', fromPosition: 0 })
    expect(next.artifacts).toEqual({})
  })

  it('clears only stage-2 when fromPosition is 1', () => {
    const next = sessionReducer(baseState, { type: 'CLEAR_FROM_STAGE', fromPosition: 1 })
    expect(next.artifacts['stage-1']).toBeDefined()
    expect(next.artifacts['stage-2']).toBeUndefined()
  })

  it('does not clear anything when fromPosition exceeds all stages', () => {
    const next = sessionReducer(baseState, { type: 'CLEAR_FROM_STAGE', fromPosition: 99 })
    expect(next.artifacts).toEqual(baseState.artifacts)
  })

  it('preserves insight text', () => {
    const next = sessionReducer(baseState, { type: 'CLEAR_FROM_STAGE', fromPosition: 0 })
    expect(next.insight).toBe('insight')
  })
})

// ---------------------------------------------------------------------------
// SET_ARTIFACT_WAITING
// ---------------------------------------------------------------------------

describe('SET_ARTIFACT_WAITING', () => {
  it('creates an artifact with empty content and waiting status', () => {
    const next = sessionReducer(withInsight('x'), { type: 'SET_ARTIFACT_WAITING', stageId: 'stage-1' })
    expect(next.artifacts['stage-1']).toEqual({
      stageId: 'stage-1',
      content: '',
      status: 'waiting',
    })
  })

  it('does not affect other artifacts', () => {
    const state = stateWithArtifacts('x', {
      'stage-1': { stageId: 'stage-1', content: 'done', status: 'complete' },
    })
    const next = sessionReducer(state, { type: 'SET_ARTIFACT_WAITING', stageId: 'stage-2' })
    expect(next.artifacts['stage-1']?.status).toBe('complete')
  })
})

// ---------------------------------------------------------------------------
// APPEND_ARTIFACT_CHUNK
// ---------------------------------------------------------------------------

describe('APPEND_ARTIFACT_CHUNK', () => {
  it('appends chunk to empty content and sets status to streaming', () => {
    const state = stateWithArtifacts('x', {
      'stage-1': { stageId: 'stage-1', content: '', status: 'waiting' },
    })
    const next = sessionReducer(state, { type: 'APPEND_ARTIFACT_CHUNK', stageId: 'stage-1', chunk: 'Hello' })
    expect(next.artifacts['stage-1']?.content).toBe('Hello')
    expect(next.artifacts['stage-1']?.status).toBe('streaming')
  })

  it('appends to existing content', () => {
    const state = stateWithArtifacts('x', {
      'stage-1': { stageId: 'stage-1', content: 'Hello', status: 'streaming' },
    })
    const next = sessionReducer(state, { type: 'APPEND_ARTIFACT_CHUNK', stageId: 'stage-1', chunk: ' world' })
    expect(next.artifacts['stage-1']?.content).toBe('Hello world')
  })

  it('creates artifact if it did not exist', () => {
    const next = sessionReducer(withInsight('x'), { type: 'APPEND_ARTIFACT_CHUNK', stageId: 'stage-1', chunk: 'tok' })
    expect(next.artifacts['stage-1']?.content).toBe('tok')
    expect(next.artifacts['stage-1']?.status).toBe('streaming')
  })

  it('clears any previous error on chunk append', () => {
    const state = stateWithArtifacts('x', {
      'stage-1': { stageId: 'stage-1', content: 'partial', status: 'error', error: 'old error' },
    })
    const next = sessionReducer(state, { type: 'APPEND_ARTIFACT_CHUNK', stageId: 'stage-1', chunk: ' more' })
    expect(next.artifacts['stage-1']?.error).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// SET_ARTIFACT_STATUS
// ---------------------------------------------------------------------------

describe('SET_ARTIFACT_STATUS', () => {
  it('sets artifact status to complete', () => {
    const state = stateWithArtifacts('x', {
      'stage-1': { stageId: 'stage-1', content: 'text', status: 'streaming' },
    })
    const next = sessionReducer(state, { type: 'SET_ARTIFACT_STATUS', stageId: 'stage-1', status: 'complete' })
    expect(next.artifacts['stage-1']?.status).toBe('complete')
    expect(next.artifacts['stage-1']?.content).toBe('text') // content preserved
  })

  it('is a no-op when artifact does not exist', () => {
    const next = sessionReducer(withInsight('x'), { type: 'SET_ARTIFACT_STATUS', stageId: 'stage-99', status: 'complete' })
    expect(next.artifacts['stage-99']).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// SET_ARTIFACT_ERROR
// ---------------------------------------------------------------------------

describe('SET_ARTIFACT_ERROR', () => {
  it('sets status to error and stores the message', () => {
    const state = stateWithArtifacts('x', {
      'stage-1': { stageId: 'stage-1', content: 'partial', status: 'streaming' },
    })
    const next = sessionReducer(state, { type: 'SET_ARTIFACT_ERROR', stageId: 'stage-1', error: 'timeout' })
    expect(next.artifacts['stage-1']?.status).toBe('error')
    expect(next.artifacts['stage-1']?.error).toBe('timeout')
  })

  it('preserves partial content on error', () => {
    const state = stateWithArtifacts('x', {
      'stage-1': { stageId: 'stage-1', content: 'partial text', status: 'streaming' },
    })
    const next = sessionReducer(state, { type: 'SET_ARTIFACT_ERROR', stageId: 'stage-1', error: 'network error' })
    expect(next.artifacts['stage-1']?.content).toBe('partial text')
  })

  it('does not affect other stage artifacts', () => {
    const state = stateWithArtifacts('x', {
      'stage-1': { stageId: 'stage-1', content: 'done', status: 'complete' },
      'stage-2': { stageId: 'stage-2', content: 'streaming', status: 'streaming' },
    })
    const next = sessionReducer(state, { type: 'SET_ARTIFACT_ERROR', stageId: 'stage-2', error: 'err' })
    expect(next.artifacts['stage-1']?.status).toBe('complete')
    expect(next.artifacts['stage-2']?.status).toBe('error')
  })

  it('creates artifact with error status if it did not exist', () => {
    const next = sessionReducer(withInsight('x'), { type: 'SET_ARTIFACT_ERROR', stageId: 'stage-1', error: 'fail' })
    expect(next.artifacts['stage-1']?.status).toBe('error')
    expect(next.artifacts['stage-1']?.error).toBe('fail')
    expect(next.artifacts['stage-1']?.content).toBe('')
  })
})

// ---------------------------------------------------------------------------
// SET_ARTIFACT_SKIPPED
// ---------------------------------------------------------------------------

describe('SET_ARTIFACT_SKIPPED', () => {
  it('creates a skipped artifact with an optional reason', () => {
    const next = sessionReducer(withInsight('x'), {
      type: 'SET_ARTIFACT_SKIPPED',
      stageId: 'stage-3',
      reason: 'OpenAI required',
    })
    expect(next.artifacts['stage-3']).toEqual({
      stageId: 'stage-3',
      content: '',
      status: 'skipped',
      error: 'OpenAI required',
    })
  })

  it('overwrites an existing artifact with skipped state', () => {
    const state = stateWithArtifacts('x', {
      'stage-3': { stageId: 'stage-3', content: 'partial', status: 'streaming' },
    })
    const next = sessionReducer(state, {
      type: 'SET_ARTIFACT_SKIPPED',
      stageId: 'stage-3',
    })
    expect(next.artifacts['stage-3']).toEqual({
      stageId: 'stage-3',
      content: '',
      status: 'skipped',
      error: undefined,
    })
  })
})
