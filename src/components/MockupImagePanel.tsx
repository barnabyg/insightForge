import { useEffect, useState } from 'react'
import styles from './MockupImagePanel.module.css'

export interface MockupImageState {
  status: 'idle' | 'generating' | 'ready' | 'error'
  dataUrl?: string
  error?: string
  prompt?: string
}

interface Props {
  image: MockupImageState
  canGenerate: boolean
  disabled: boolean
  onGenerate: () => void
}

export default function MockupImagePanel({ image, canGenerate, disabled, onGenerate }: Props) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  useEffect(() => {
    if (!isPreviewOpen) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsPreviewOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => { window.removeEventListener('keydown', handleKeyDown) }
  }, [isPreviewOpen])

  function handleSaveAs() {
    if (!image.dataUrl) return
    const a = document.createElement('a')
    a.href = image.dataUrl
    a.download = 'insightforge-mockup.png'
    a.click()
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <p className={styles.title}>Mockup Image</p>
        <div className={styles.actions}>
          {image.status === 'ready' && image.dataUrl && (
            <>
              <button className={styles.btn} onClick={() => { setIsPreviewOpen(true) }}>
                Preview
              </button>
              <button className={styles.btn} onClick={handleSaveAs}>
                Save As…
              </button>
            </>
          )}
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={onGenerate}
            disabled={!canGenerate || disabled || image.status === 'generating'}
          >
            {image.status === 'generating'
              ? 'Generating…'
              : image.status === 'ready'
                ? 'Regenerate mockup image'
                : 'Generate mockup image'}
          </button>
        </div>
      </div>

      {image.status === 'idle' && (
        <p className={styles.message}>
          Generate a mockup preview from the completed Stage 3 prompt.
        </p>
      )}

      {image.status === 'generating' && (
        <div className={styles.waiting}>
          <div className={styles.spinner} />
          Generating image preview…
        </div>
      )}

      {image.status === 'error' && (
        <p className={styles.error}>
          {image.error ?? 'Image generation failed.'}
        </p>
      )}

      {image.status === 'ready' && (
        <p className={styles.message}>
          Image ready. Use <strong>Preview</strong> to inspect it or <strong>Save As…</strong> to download it.
        </p>
      )}

      {isPreviewOpen && image.dataUrl && (
        <div className={styles.lightbox} onClick={() => { setIsPreviewOpen(false) }}>
          <div className={styles.lightboxInner} onClick={(e) => { e.stopPropagation() }}>
            <button className={styles.closeBtn} onClick={() => { setIsPreviewOpen(false) }}>
              Close
            </button>
            <img
              src={image.dataUrl}
              alt="Generated product mockup preview"
              className={styles.preview}
            />
          </div>
        </div>
      )}
    </div>
  )
}
