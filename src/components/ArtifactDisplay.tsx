import type { Artifact } from '../workflow/types'
import styles from './ArtifactDisplay.module.css'

interface Props {
  artifact: Artifact | undefined
  stageName: string
}

export default function ArtifactDisplay({ artifact, stageName }: Props) {
  if (!artifact || artifact.status === 'empty') {
    return <p className={styles.empty}>No output yet.</p>
  }

  if (artifact.status === 'waiting') {
    return (
      <div className={styles.waiting}>
        <div className={styles.spinner} />
        Waiting for first token…
      </div>
    )
  }

  if (artifact.status === 'skipped') {
    return (
      <div className={styles.skipped}>
        {artifact.error ?? 'This stage was skipped.'}
      </div>
    )
  }

  if (artifact.status === 'error') {
    return (
      <div className={styles.container}>
        {artifact.content && (
          <pre className={styles.content}>{artifact.content}</pre>
        )}
        <p style={{ color: 'var(--color-error)', fontSize: 13, margin: 0 }}>
          {artifact.error ?? 'An unknown error occurred.'}
        </p>
      </div>
    )
  }

  function handleDownload() {
    if (!artifact) return
    const blob = new Blob([artifact.content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${stageName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const isStreaming = artifact.status === 'streaming'

  return (
    <div className={styles.container}>
      <pre className={`${styles.content} ${isStreaming ? styles.streaming : ''}`}>
        {artifact.content}
      </pre>
      {artifact.status === 'complete' && (
        <div className={styles.actions}>
          <button className={styles.downloadBtn} onClick={handleDownload}>
            Download .txt
          </button>
        </div>
      )}
    </div>
  )
}
