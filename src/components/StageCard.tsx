import type { ReactNode } from 'react'
import type { Artifact, Stage } from '../workflow/types'
import StatusBadge from './StatusBadge'
import ArtifactDisplay from './ArtifactDisplay'
import PromptEditor from './PromptEditor'
import styles from './StageCard.module.css'

interface Props {
  stage: Stage
  artifact: Artifact | undefined
  template: string
  isRunning: boolean
  canRun: boolean
  runLabel?: string
  unavailableReason?: string
  extraContent?: ReactNode
  onRun: () => void
  onRetry: () => void
  onTemplateChange: (value: string) => void
  onTemplateSave: () => void
  onTemplateExport: () => void
  onTemplateImport: (file: File) => void
}

export default function StageCard({
  stage,
  artifact,
  template,
  isRunning,
  canRun,
  runLabel = 'Run this stage',
  unavailableReason,
  extraContent,
  onRun,
  onRetry,
  onTemplateChange,
  onTemplateSave,
  onTemplateExport,
  onTemplateImport,
}: Props) {
  const status = artifact?.status ?? 'empty'
  const isActive = status === 'waiting' || status === 'streaming'

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.position}>{stage.position + 1}</div>
        <h2 className={styles.title}>{stage.name}</h2>
        <StatusBadge status={status} />
      </div>

      <hr className={styles.divider} />

      <PromptEditor
        value={template}
        onChange={onTemplateChange}
        onSave={onTemplateSave}
        onExport={onTemplateExport}
        onImport={onTemplateImport}
        disabled={isRunning}
      />

      <ArtifactDisplay artifact={artifact} stageName={stage.name} />
      {extraContent}
      {unavailableReason && (
        <p className={styles.note}>{unavailableReason}</p>
      )}

      <div className={styles.actions}>
        {status === 'error' && (
          <button className={`${styles.btn} ${styles.btnDanger}`} onClick={onRetry} disabled={isRunning}>
            Retry
          </button>
        )}
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={onRun}
          disabled={!canRun || isActive}
        >
          {isActive ? 'Running…' : runLabel}
        </button>
      </div>
    </div>
  )
}
