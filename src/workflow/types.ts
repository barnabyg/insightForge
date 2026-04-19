export type StageStatus = 'empty' | 'waiting' | 'streaming' | 'complete' | 'error' | 'skipped'

export interface Stage {
  readonly id: string
  readonly name: string
  readonly position: number
}

export interface Workflow {
  readonly id: string
  readonly name: string
  readonly stages: readonly Stage[]
}

export interface Artifact {
  readonly stageId: string
  content: string
  status: StageStatus
  error?: string
}

export interface SessionState {
  insight: string
  artifacts: Partial<Record<string, Artifact>>
}
