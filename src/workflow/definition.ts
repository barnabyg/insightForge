import type { Workflow } from './types'

export const INSIGHT_TRIAGE: Workflow = {
  id: 'insight-triage',
  name: 'Insight Triage',
  stages: [
    { id: 'stage-1', name: 'Insight → Design Brief', position: 0 },
    { id: 'stage-2', name: 'Design Brief → PRD', position: 1 },
  ],
}
