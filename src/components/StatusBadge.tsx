import type { StageStatus } from '../workflow/types'
import styles from './StatusBadge.module.css'

const LABELS: Record<StageStatus, string> = {
  empty: 'Empty',
  waiting: 'Waiting',
  streaming: 'Streaming',
  complete: 'Complete',
  error: 'Error',
  skipped: 'Skipped',
}

interface Props {
  status: StageStatus
}

export default function StatusBadge({ status }: Props) {
  const isPulsing = status === 'waiting' || status === 'streaming'
  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      <span className={`${styles.dot} ${isPulsing ? styles.pulse : ''}`} />
      {LABELS[status]}
    </span>
  )
}
