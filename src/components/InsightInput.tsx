import styles from './InsightInput.module.css'

interface Props {
  value: string
  onChange: (value: string) => void
  disabled: boolean
}

export default function InsightInput({ value, onChange, disabled }: Props) {
  return (
    <div className={styles.container}>
      <label className={styles.label} htmlFor="insight-input">
        Your Insight
      </label>
      <textarea
        id="insight-input"
        className={styles.textarea}
        value={value}
        onChange={(e) => { onChange(e.target.value); }}
        disabled={disabled}
        placeholder="Describe the product idea, opportunity, or observation you want to evaluate…"
        spellCheck
      />
      {value && (
        <p className={styles.hint}>Editing this will clear all generated outputs.</p>
      )}
    </div>
  )
}
