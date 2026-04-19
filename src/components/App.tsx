import { useReducer, useState, useCallback, useRef, useEffect } from 'react'
import { INSIGHT_TRIAGE } from '../workflow/definition'
import { sessionReducer, INITIAL_SESSION } from '../workflow/session.reducer'
import { runStage } from '../workflow/engine'
import { getProvider } from '../providers'
import type { ProviderSettings } from '../providers/types'
import { generateOpenAIImage } from '../providers/openai-image'
import { loadSettings, saveSettings } from '../storage/settings'
import {
  loadPrompts,
  savePrompts,
  exportPromptsAsJSON,
  importPromptsFromJSON,
} from '../storage/prompts'
import stage1Default from '../prompts/stage1.txt?raw'
import stage2Default from '../prompts/stage2.txt?raw'
import stage3Default from '../prompts/stage3.txt?raw'
import ProviderSettingsPanel from './ProviderSettings'
import WorkflowView from './WorkflowView'
import MockupImagePanel, { type MockupImageState } from './MockupImagePanel'
import styles from './App.module.css'

const WORKFLOW = INSIGHT_TRIAGE

const PROMPT_DEFAULTS: Record<string, string> = {
  'stage-1': stage1Default,
  'stage-2': stage2Default,
  'stage-3': stage3Default,
}

const MOCKUP_STAGE_ID = 'stage-3'
const MOCKUP_SKIP_REASON = 'Image prompt generation requires OpenAI. Switch provider to OpenAI to enable this stage.'

export default function App() {
  const [session, dispatch] = useReducer(sessionReducer, INITIAL_SESSION)
  const [providerSettings, setProviderSettings] = useState<ProviderSettings>(loadSettings)
  const [templates, setTemplates] = useState<Record<string, string>>(() =>
    loadPrompts(WORKFLOW, PROMPT_DEFAULTS),
  )
  const [isRunning, setIsRunning] = useState(false)
  const [mockupImage, setMockupImage] = useState<MockupImageState>({ status: 'idle' })
  const abortControllerRef = useRef<AbortController | null>(null)
  const imageAbortControllerRef = useRef<AbortController | null>(null)
  // Always reflects the latest session state — used by async callbacks to
  // avoid reading stale closure values during multi-stage pipeline runs.
  const sessionRef = useRef(session)
  sessionRef.current = session

  // Persist provider settings whenever they change
  useEffect(() => {
    saveSettings(providerSettings)
  }, [providerSettings])

  useEffect(() => {
    const artifact = session.artifacts[MOCKUP_STAGE_ID]
    if (artifact?.status !== 'complete' || artifact.content !== mockupImage.prompt) {
      if (mockupImage.status !== 'idle') {
        setMockupImage({ status: 'idle' })
      }
    }
  }, [session.artifacts, mockupImage.prompt, mockupImage.status])

  function handleInsightChange(value: string) {
    clearMockupImage()
    dispatch({ type: 'SET_INSIGHT', insight: value })
  }

  function handleTemplateChange(stageId: string, value: string) {
    if (stageId === MOCKUP_STAGE_ID) clearMockupImage()
    setTemplates((prev) => ({ ...prev, [stageId]: value }))
  }

  function handleTemplateSave(stageId: string) {
    // Save all templates to localStorage (single key)
    const updated = { ...templates }
    savePrompts(updated)
    void stageId // stageId used for UI feedback in PromptEditor
  }

  function handleTemplateExport(stageId: string) {
    void stageId
    const json = exportPromptsAsJSON(WORKFLOW, templates)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'insightforge-prompts.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleTemplateImport(_stageId: string, file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const imported = importPromptsFromJSON(reader.result as string)
        if (Object.prototype.hasOwnProperty.call(imported, MOCKUP_STAGE_ID)) {
          clearMockupImage()
        }
        setTemplates((prev) => ({ ...prev, ...imported }))
        savePrompts({ ...templates, ...imported })
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to import prompts')
      }
    }
    reader.readAsText(file)
  }

  const executeStage = useCallback(
    async (stageId: string, signal: AbortSignal) => {
      // Read the latest session via ref — avoids stale closure values when
      // called sequentially from handleRunAll after the previous stage updated state.
      const currentSession = sessionRef.current

      const stage = WORKFLOW.stages.find((s) => s.id === stageId)
      if (!stage) return

      const prevStage = stage.position === 0
        ? null
        : WORKFLOW.stages[stage.position - 1] ?? null
      if (stage.position > 0 && !prevStage) return
      const prevStageId = prevStage?.id ?? ''

      let inputContent = currentSession.insight
      if (stage.position > 0) {
        inputContent = currentSession.artifacts[prevStageId]?.content ?? ''
      }

      const template = templates[stageId] ?? ''
      const provider = getProvider(providerSettings)

      // Clear this stage and all downstream before starting
      dispatch({ type: 'CLEAR_FROM_STAGE', fromPosition: stage.position })
      dispatch({ type: 'SET_ARTIFACT_WAITING', stageId })

      try {
        for await (const chunk of runStage(stage, inputContent, template, provider, signal)) {
          if (signal.aborted) break
          dispatch({ type: 'APPEND_ARTIFACT_CHUNK', stageId, chunk })
        }
        if (!signal.aborted) {
          dispatch({ type: 'SET_ARTIFACT_STATUS', stageId, status: 'complete' })
        }
      } catch (err) {
        if (signal.aborted) return
        const message = err instanceof Error ? err.message : 'An unknown error occurred'
        dispatch({ type: 'SET_ARTIFACT_ERROR', stageId, error: message })
      }
    },
    [templates, providerSettings],  // session removed — read via sessionRef instead
  )

  async function handleRunStage(stageId: string) {
    if (stageId === MOCKUP_STAGE_ID && providerSettings.provider !== 'openai') return
    clearMockupImage()
    cancel()
    const controller = new AbortController()
    abortControllerRef.current = controller
    setIsRunning(true)
    try {
      await executeStage(stageId, controller.signal)
    } finally {
      if (abortControllerRef.current === controller) {
        setIsRunning(false)
        abortControllerRef.current = null
      }
    }
  }

  async function handleRunAll() {
    clearMockupImage()
    cancel()
    const controller = new AbortController()
    abortControllerRef.current = controller
    setIsRunning(true)

    try {
      for (const stage of WORKFLOW.stages) {
        if (controller.signal.aborted) break

        if (stage.id === MOCKUP_STAGE_ID && providerSettings.provider !== 'openai') {
          dispatch({
            type: 'SET_ARTIFACT_SKIPPED',
            stageId: MOCKUP_STAGE_ID,
            reason: MOCKUP_SKIP_REASON,
          })
          break
        }

        await executeStage(stage.id, controller.signal)

        // Check if the stage errored — stop pipeline if so
        const artifact = sessionRef.current.artifacts[stage.id]
        if (artifact?.status === 'error') break
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setIsRunning(false)
        abortControllerRef.current = null
      }
    }
  }

  function cancel() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsRunning(false)
  }

  function handleRetryStage(stageId: string) {
    void handleRunStage(stageId)
  }

  function clearMockupImage() {
    if (imageAbortControllerRef.current) {
      imageAbortControllerRef.current.abort()
      imageAbortControllerRef.current = null
    }
    setMockupImage({ status: 'idle' })
  }

  async function handleGenerateMockupImage() {
    const artifact = sessionRef.current.artifacts[MOCKUP_STAGE_ID]
    const prompt = artifact ? artifact.content.trim() : ''
    if (!prompt) return
    if (providerSettings.provider !== 'openai') return

    if (imageAbortControllerRef.current) {
      imageAbortControllerRef.current.abort()
    }

    const controller = new AbortController()
    imageAbortControllerRef.current = controller
    setMockupImage({ status: 'generating', prompt })

    try {
      const result = await generateOpenAIImage(
        providerSettings.apiKey ?? '',
        prompt,
        controller.signal,
      )

      if (imageAbortControllerRef.current !== controller) return
      setMockupImage({
        status: 'ready',
        dataUrl: result.dataUrl,
        prompt,
      })
    } catch (err) {
      if (controller.signal.aborted) return
      if (imageAbortControllerRef.current !== controller) return
      setMockupImage({
        status: 'error',
        error: err instanceof Error ? err.message : 'Image generation failed',
        prompt,
      })
    } finally {
      if (imageAbortControllerRef.current === controller) {
        imageAbortControllerRef.current = null
      }
    }
  }

  // Cascade clear when insight changes: handled inside reducer (SET_INSIGHT clears all)
  // When a stage reruns, cascade is handled inside executeStage via CLEAR_FROM_STAGE

  return (
    <div className={styles.layout}>
      <div className={styles.masthead}>
        <h1 className={styles.title}>InsightForge</h1>
        <p className={styles.subtitle}>
          Structured triage for product ideas — powered by {providerSettings.provider === 'openai' ? 'OpenAI' : 'KoboldCPP'}
        </p>
      </div>

      <ProviderSettingsPanel
        settings={providerSettings}
        onChange={setProviderSettings}
        disabled={isRunning}
      />

      <WorkflowView
        workflow={WORKFLOW}
        session={session}
        templates={templates}
        isRunning={isRunning}
        onInsightChange={handleInsightChange}
        onRunAll={() => void handleRunAll()}
        onCancel={cancel}
        onRunStage={(id) => void handleRunStage(id)}
        onRetryStage={handleRetryStage}
        onTemplateChange={handleTemplateChange}
        onTemplateSave={handleTemplateSave}
        onTemplateExport={handleTemplateExport}
        onTemplateImport={handleTemplateImport}
        getRunLabel={(stageId) => stageId === MOCKUP_STAGE_ID ? 'Generate mockup prompt' : undefined}
        getUnavailableReason={(stageId) =>
          stageId === MOCKUP_STAGE_ID && providerSettings.provider !== 'openai'
            ? MOCKUP_SKIP_REASON
            : undefined}
        renderExtraContent={(stageId) =>
          stageId === MOCKUP_STAGE_ID && session.artifacts[MOCKUP_STAGE_ID]?.status === 'complete'
            ? (
                <MockupImagePanel
                  image={mockupImage}
                  canGenerate={providerSettings.provider === 'openai'}
                  disabled={isRunning}
                  onGenerate={() => { void handleGenerateMockupImage() }}
                />
              )
            : null}
      />
    </div>
  )
}
