import type { KoboldPromptFormat, ProviderSettings } from '../providers/types'
import styles from './ProviderSettings.module.css'

const FORMAT_LABELS: Record<KoboldPromptFormat, string> = {
  none: 'None (raw text)',
  gemma4: 'Gemma 4',
  chatml: 'ChatML',
}

interface Props {
  settings: ProviderSettings
  onChange: (settings: ProviderSettings) => void
  disabled: boolean
}

export default function ProviderSettingsPanel({ settings, onChange, disabled }: Props) {
  return (
    <div className={styles.panel}>
      <p className={styles.title}>LLM Provider</p>

      <div className={styles.row}>
        <div className={styles.radioGroup}>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="provider"
              value="kobold"
              checked={settings.provider === 'kobold'}
              onChange={() => { onChange({ ...settings, provider: 'kobold' }); }}
              disabled={disabled}
            />
            KoboldCPP (local)
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="provider"
              value="openai"
              checked={settings.provider === 'openai'}
              onChange={() => { onChange({ ...settings, provider: 'openai' }); }}
              disabled={disabled}
            />
            OpenAI
          </label>
        </div>
      </div>

      {settings.provider === 'kobold' && (
        <>
          <div className={styles.formatRow}>
            <label className={styles.apiKeyLabel} htmlFor="kobold-format">
              Prompt format
            </label>
            <select
              id="kobold-format"
              className={styles.select}
              value={settings.koboldFormat ?? 'none'}
              onChange={(e) => {
                onChange({ ...settings, koboldFormat: e.target.value as KoboldPromptFormat })
              }}
              disabled={disabled}
            >
              {(Object.keys(FORMAT_LABELS) as KoboldPromptFormat[]).map((fmt) => (
                <option key={fmt} value={fmt}>
                  {FORMAT_LABELS[fmt]}
                </option>
              ))}
            </select>
          </div>
          <p className={styles.hint}>
            Expects KoboldCPP running at localhost:5001.{' '}
            {settings.koboldFormat === 'none'
              ? 'Prompt sent as raw text — only suitable for base (non-instruct) models.'
              : `Prompt will be wrapped in ${FORMAT_LABELS[settings.koboldFormat ?? 'none']} format before sending.`}
          </p>
        </>
      )}

      {settings.provider === 'openai' && (
        <div className={styles.apiKeyRow}>
          <label className={styles.apiKeyLabel} htmlFor="api-key-input">
            API Key
          </label>
          <input
            id="api-key-input"
            type="password"
            className={styles.apiKeyInput}
            value={settings.apiKey ?? ''}
            onChange={(e) => { onChange({ ...settings, apiKey: e.target.value }); }}
            placeholder="sk-…"
            disabled={disabled}
            autoComplete="off"
          />
        </div>
      )}

      {settings.provider === 'openai' && (
        <p className={styles.hint}>
          API key is stored in localStorage. Do not use on shared machines.
        </p>
      )}
    </div>
  )
}
