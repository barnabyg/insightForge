import { useState, useEffect } from 'react'
import styles from './PromptEditor.module.css'

interface Props {
  value: string
  onChange: (value: string) => void
  onSave: () => void
  onExport: () => void
  onImport: (file: File) => void
  disabled: boolean
}

export default function PromptEditor({ value, onChange, onSave, onExport, onImport, disabled }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [showSaved, setShowSaved] = useState(false)

  useEffect(() => {
    if (!showSaved) return
    const id = setTimeout(() => { setShowSaved(false); }, 1500)
    return () => { clearTimeout(id); }
  }, [showSaved])

  function handleSave() {
    onSave()
    setShowSaved(true)
  }

  function handleImportClick() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (file) onImport(file)
    }
    input.click()
  }

  return (
    <div className={styles.container}>
      <button className={styles.toggle} onClick={() => { setIsOpen((v) => !v); }}>
        <span className={`${styles.chevron} ${isOpen ? styles.open : ''}`}>›</span>
        Edit prompt template
      </button>

      {isOpen && (
        <div className={styles.editor}>
          <textarea
            className={styles.textarea}
            value={value}
            onChange={(e) => { onChange(e.target.value); }}
            disabled={disabled}
            spellCheck={false}
          />
          <div className={styles.actions}>
            <span className={`${styles.savedMsg} ${showSaved ? styles.visible : ''}`}>Saved</span>
            <button className={styles.btn} onClick={onExport} disabled={disabled}>
              Export JSON
            </button>
            <button className={styles.btn} onClick={handleImportClick} disabled={disabled}>
              Import JSON
            </button>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave} disabled={disabled}>
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
