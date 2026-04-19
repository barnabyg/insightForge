import type { ReactNode } from 'react'
import type { Workflow, SessionState } from '../workflow/types'
import InsightInput from './InsightInput'
import StageCard from './StageCard'
import styles from './WorkflowView.module.css'

interface Props {
  workflow: Workflow
  session: SessionState
  templates: Record<string, string>
  isRunning: boolean
  onInsightChange: (value: string) => void
  onRunAll: () => void
  onCancel: () => void
  onRunStage: (stageId: string) => void
  onRetryStage: (stageId: string) => void
  onTemplateChange: (stageId: string, value: string) => void
  onTemplateSave: (stageId: string) => void
  onTemplateExport: (stageId: string) => void
  onTemplateImport: (stageId: string, file: File) => void
  getRunLabel?: (stageId: string) => string | undefined
  getUnavailableReason?: (stageId: string) => string | undefined
  renderExtraContent?: (stageId: string) => ReactNode
}

export default function WorkflowView({
  workflow,
  session,
  templates,
  isRunning,
  onInsightChange,
  onRunAll,
  onCancel,
  onRunStage,
  onRetryStage,
  onTemplateChange,
  onTemplateSave,
  onTemplateExport,
  onTemplateImport,
  getRunLabel,
  getUnavailableReason,
  renderExtraContent,
}: Props) {
  const canRunAll = session.insight.trim().length > 0 && !isRunning

  function canRunStage(stageId: string): boolean {
    if (isRunning) return false
    if (getUnavailableReason?.(stageId)) return false
    const stage = workflow.stages.find((s) => s.id === stageId)
    if (!stage) return false
    if (stage.position === 0) return session.insight.trim().length > 0
    const prevStage = workflow.stages.find((s) => s.position === stage.position - 1)
    if (!prevStage) return false
    return session.artifacts[prevStage.id]?.status === 'complete'
  }

  return (
    <div className={styles.container}>
      <InsightInput
        value={session.insight}
        onChange={onInsightChange}
        disabled={isRunning}
      />

      <div className={styles.header}>
        <span />
        {isRunning ? (
          <button className={styles.cancelBtn} onClick={onCancel}>
            Cancel
          </button>
        ) : (
          <button className={styles.runAllBtn} onClick={onRunAll} disabled={!canRunAll}>
            Run All
          </button>
        )}
      </div>

      <div className={styles.stages}>
        {workflow.stages.map((stage, i) => (
          <div key={stage.id}>
            {i > 0 && <div className={styles.connector}>↓</div>}
            <StageCard
              stage={stage}
              artifact={session.artifacts[stage.id]}
              template={templates[stage.id] ?? ''}
              isRunning={isRunning}
              canRun={canRunStage(stage.id)}
              runLabel={getRunLabel?.(stage.id)}
              unavailableReason={getUnavailableReason?.(stage.id)}
              extraContent={renderExtraContent?.(stage.id)}
              onRun={() => { onRunStage(stage.id); }}
              onRetry={() => { onRetryStage(stage.id); }}
              onTemplateChange={(v) => { onTemplateChange(stage.id, v); }}
              onTemplateSave={() => { onTemplateSave(stage.id); }}
              onTemplateExport={() => { onTemplateExport(stage.id); }}
              onTemplateImport={(f) => { onTemplateImport(stage.id, f); }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
