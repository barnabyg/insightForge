# InsightForge — Implementation Plan

**Based on:** PRD v1.1  
**Date:** April 2026  
**Stack:** React + Vite + TypeScript (strict) + CSS Modules + Vitest

---

## Open Questions / Pre-Build Checks

- **OpenAI model string**: Plan uses `gpt-5.4-mini` as specified. Verify this is the exact string accepted by the OpenAI Chat Completions API before wiring it up — it doesn't match any model in my training data and may have a different identifier.
- **KoboldCPP streaming endpoint**: Assumed `POST http://localhost:5001/api/extra/generate/stream` with SSE. Verify against your KoboldCPP version if it differs.

---

## Directory Structure

```
insightForge/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── package.json
├── eslint.config.js
├── .prettierrc
├── README.md
├── public/
└── src/
    ├── main.tsx
    ├── providers/
    │   ├── types.ts              # LLMProvider interface
    │   ├── openai.provider.ts    # OpenAI implementation
    │   ├── kobold.provider.ts    # KoboldCPP implementation
    │   └── index.ts              # getProvider() factory
    ├── workflow/
    │   ├── types.ts              # Domain types: Stage, Artifact, StageStatus, etc.
    │   ├── definition.ts         # Hardcoded "Insight Triage" workflow
    │   └── engine.ts             # runStage(), runAll() orchestration logic
    ├── storage/
    │   ├── prompts.ts            # Load/save prompt templates (localStorage + JSON file)
    │   └── settings.ts           # Load/save provider config (localStorage)
    ├── prompts/
    │   ├── stage1.txt            # Default prompt: Insight → Design Brief
    │   └── stage2.txt            # Default prompt: Design Brief → PRD
    ├── components/
    │   ├── App.tsx + App.module.css
    │   ├── WorkflowView.tsx + WorkflowView.module.css
    │   ├── StageCard.tsx + StageCard.module.css
    │   ├── InsightInput.tsx + InsightInput.module.css
    │   ├── ArtifactDisplay.tsx + ArtifactDisplay.module.css
    │   ├── PromptEditor.tsx + PromptEditor.module.css
    │   ├── ProviderSettings.tsx + ProviderSettings.module.css
    │   └── StatusBadge.tsx + StatusBadge.module.css
    └── __tests__/
        ├── engine.test.ts
        ├── prompts.storage.test.ts
        ├── settings.storage.test.ts
        ├── openai.provider.test.ts
        └── kobold.provider.test.ts
```

---

## Phase 1 — Project Scaffold

**Goal:** Working Vite + React + TypeScript project with linting, formatting, and testing configured. No app logic yet.

### Steps

1. Initialise project: `npm create vite@latest . -- --template react-ts`
2. Install dev dependencies:
   - `vitest`, `@vitest/ui`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`
   - `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-plugin-react-hooks`
   - `prettier`, `eslint-config-prettier`
3. Install runtime dependencies:
   - `openai` (official SDK, browser-compatible in v4+)
4. Configure `vite.config.ts` — add Vitest config block (environment: `jsdom`)
5. Configure `tsconfig.json` — strict mode, path aliases if needed
6. Configure ESLint and Prettier
7. Add npm scripts: `test`, `test:watch`, `lint`, `lint:fix`, `format`, `build`, `dev`
8. Verify scaffold: `npm run dev` renders default Vite page, `npm test` runs empty suite

**Deliverable:** Green CI baseline — dev server works, test runner works, linter clean.

---

## Phase 2 — Core Types and Domain Model

**Goal:** Establish the type system everything else builds on. No implementation, just contracts.

### `src/providers/types.ts`

```typescript
export type ProviderName = 'openai' | 'kobold';

export interface ProviderSettings {
  provider: ProviderName;
  apiKey?: string; // Only used by OpenAI
}

export interface LLMProvider {
  readonly name: ProviderName;
  configure(settings: ProviderSettings): void;
  execute(prompt: string, signal?: AbortSignal): AsyncIterable<string>;
}
```

### `src/workflow/types.ts`

```typescript
export type StageStatus = 'empty' | 'waiting' | 'streaming' | 'complete' | 'error';

export interface Stage {
  readonly id: string;
  readonly name: string;
  readonly position: number; // 0-indexed, determines cascade order
}

export interface Workflow {
  readonly id: string;
  readonly name: string;
  readonly stages: readonly Stage[];
}

export interface Artifact {
  readonly stageId: string;
  content: string;
  status: StageStatus;
  error?: string;
}

export interface SessionState {
  insight: string;
  artifacts: Map<string, Artifact>;
}
```

**Deliverable:** Types compile with strict mode. No tests needed for pure type files.

---

## Phase 3 — Storage Layer

**Goal:** Persist and restore prompt templates and provider settings via localStorage.

### `src/storage/settings.ts`

- `loadSettings(): ProviderSettings` — reads from localStorage, defaults to `{ provider: 'kobold' }`
- `saveSettings(settings: ProviderSettings): void` — writes to localStorage
- Key: `insightforge:settings`

### `src/storage/prompts.ts`

- `loadPrompts(workflow: Workflow, defaults: Record<string, string>): Record<string, string>`  
  Reads from localStorage, falls back to provided defaults for any missing stage.
- `savePrompts(templates: Record<string, string>): void` — writes all templates to localStorage
- `exportPromptsAsJSON(workflow: Workflow, templates: Record<string, string>): string`  
  Returns a JSON string in the export format (see below).
- `importPromptsFromJSON(json: string): Record<string, string>`  
  Parses and validates the JSON, throws on invalid format.
- Key: `insightforge:prompts`

**Prompt JSON export format:**
```json
{
  "version": 1,
  "workflow": "insight-triage",
  "templates": {
    "stage-1": "...",
    "stage-2": "..."
  }
}
```

### Tests (`__tests__/prompts.storage.test.ts`, `settings.storage.test.ts`)

- localStorage is mocked via `vitest`'s `vi.stubGlobal` or a simple in-memory mock
- Test: load with no stored data → returns defaults
- Test: save then load → round-trips correctly
- Test: export → valid JSON structure
- Test: import valid JSON → correct templates extracted
- Test: import malformed JSON → throws with useful message
- Test: import wrong version → throws

**Deliverable:** Storage layer with full test coverage.

---

## Phase 4 — Workflow Definition and Default Prompts

**Goal:** Hardcode the "Insight Triage" workflow and provide default prompts.

### `src/workflow/definition.ts`

```typescript
import { Workflow } from './types';

export const INSIGHT_TRIAGE: Workflow = {
  id: 'insight-triage',
  name: 'Insight Triage',
  stages: [
    { id: 'stage-1', name: 'Insight → Design Brief', position: 0 },
    { id: 'stage-2', name: 'Design Brief → PRD', position: 1 },
  ],
};
```

### `src/prompts/stage1.txt` and `stage2.txt`

- Imported at build time using Vite's `?raw` suffix: `import stage1 from './prompts/stage1.txt?raw'`
- stage1.txt: A prompt instructing the LLM to transform a raw product insight into a structured design brief, covering problem statement, target user, proposed solution, key assumptions, and open questions. Must include `{{input}}` placeholder.
- stage2.txt: A prompt instructing the LLM to transform a design brief into a full PRD covering market context, differentiation, monetisation routes, effort/complexity, and strategic options. Must include `{{input}}` placeholder.

### `src/workflow/engine.ts` — Template substitution helper

```typescript
export function buildPrompt(template: string, input: string): string {
  if (!template.includes('{{input}}')) {
    throw new Error('Prompt template missing {{input}} placeholder');
  }
  return template.replace('{{input}}', input);
}
```

Test this function — edge cases: missing placeholder, multiple placeholders (replace only first? all? — replace all).

**Deliverable:** Workflow defined, default prompts authored, `buildPrompt` tested.

---

## Phase 5 — LLM Provider Implementations

**Goal:** Two working provider implementations behind the shared interface.

### `src/providers/openai.provider.ts`

- Uses the `openai` npm package (v4+, browser-compatible)
- Model: `gpt-5.4-mini` (hardcoded — verify exact API string)
- `configure()` re-initialises the `OpenAI` client with the provided API key and `dangerouslyAllowBrowser: true`
- `execute()` calls `client.chat.completions.create()` with `stream: true`, yields each `chunk.choices[0]?.delta?.content ?? ''`
- Timeout: set via `AbortSignal` (120 seconds minimum per NFR)
- API key must not appear in any thrown error messages — catch and rethrow with sanitised message
- KoboldCPP-specific error not applicable here

### `src/providers/kobold.provider.ts`

- Uses `fetch` + `ReadableStream` to consume SSE from `POST http://localhost:5001/api/extra/generate/stream`
- Request body:
  ```json
  { "prompt": "...", "max_length": 2048 }
  ```
- SSE parsing: split response stream by `\n`, extract `data:` lines, parse JSON, yield `token` field
- End condition: SSE stream closes or `finish: true` received
- If `fetch` throws (network error): catch and rethrow as `new Error('Cannot connect to KoboldCPP on localhost:5001 — is KoboldCPP running?')`
- Timeout: 120 seconds via `AbortSignal`

### `src/providers/index.ts`

```typescript
export function getProvider(settings: ProviderSettings): LLMProvider {
  switch (settings.provider) {
    case 'openai': return new OpenAIProvider(settings);
    case 'kobold': return new KoboldProvider();
    default: throw new Error(`Unknown provider: ${settings.provider}`);
  }
}
```

### Tests

- Mock `fetch` for KoboldCPP tests — test: normal SSE stream yields correct tokens, test: network failure produces correct error message, test: `AbortSignal` cancels the request
- Mock the `openai` module for OpenAI tests — test: API key not in error messages, test: stream yields tokens correctly
- Both: test the interface contract — `execute()` returns an `AsyncIterable<string>`

**Deliverable:** Both providers implemented and tested with mocked network calls.

---

## Phase 6 — Workflow Engine (Orchestration)

**Goal:** The engine that runs stages, handles cascade invalidation, and exposes a clean API to the UI.

### `src/workflow/engine.ts` (extended)

```typescript
export function getCascadeIds(workflow: Workflow, fromPosition: number): string[] {
  // Returns IDs of all stages at position >= fromPosition
}

export async function* runStage(
  stage: Stage,
  inputContent: string,
  template: string,
  provider: LLMProvider,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  // 1. Build prompt from template + input
  // 2. Call provider.execute()
  // 3. Yield each chunk
}
```

The UI is responsible for managing `SessionState` and calling `getCascadeIds` to clear downstream artifacts when triggering a rerun. The engine is stateless — it takes inputs and returns an async generator. This keeps it pure and easily testable.

### Tests (`__tests__/engine.test.ts`)

- `getCascadeIds`: returns correct IDs for each trigger position
- `buildPrompt`: placeholder substitution, missing placeholder throws
- `runStage`: with a mock provider, yields all chunks in order
- `runStage`: AbortSignal cancellation stops iteration
- `runStage`: provider error propagates as thrown error

**Deliverable:** Engine fully tested with mocked providers.

---

## Phase 7 — UI Components

**Goal:** Full working UI. Build bottom-up from leaf components to root.

### Component Breakdown

**`StatusBadge`** — Visual pill showing stage status. Props: `status: StageStatus`. Pure display, no logic.

**`ArtifactDisplay`** — Renders artifact content as preformatted text. Shows "waiting for first token..." state distinct from "streaming" (content present but incomplete). Props: `artifact: Artifact | undefined`. Includes a Download button (triggers `URL.createObjectURL` with a `.txt` blob) when status is `complete`.

**`PromptEditor`** — A large `<textarea>` (full-width, minimum 10 rows) for editing a prompt template. Props: `value`, `onChange`, `onSave`, `disabled`. Shows a save indicator. Expandable — collapses when not focused/editing to save vertical space.

**`InsightInput`** — Textarea for the user's initial insight. Props: `value`, `onChange`, `disabled`. `onChange` triggers cascade clear in the parent — the component itself just reports changes.

**`StageCard`** — The main stage UI unit. Contains:
- Stage name + position indicator
- `StatusBadge`
- `PromptEditor` (collapsible)
- `ArtifactDisplay`
- Action buttons: "Run This Stage" (disabled if previous stage incomplete or no insight), "Retry" (only on error)
- Prompt export/import controls (import opens a file picker, export triggers download)

**`ProviderSettings`** — Global settings panel:
- Radio/toggle: OpenAI / KoboldCPP
- API key input (only shown when OpenAI selected) — type=password, never logged
- "Run All" button lives here or in `WorkflowView` header (prefer `WorkflowView`)

**`WorkflowView`** — Lays out `InsightInput` + all `StageCard`s vertically. Owns the "Run All" button. Renders stages in order.

**`App`** — Root component. Owns all state:
- `SessionState` (insight + artifacts map) — in-memory, not persisted
- `ProviderSettings` — loaded from/saved to localStorage
- `templates: Record<string, string>` — loaded from localStorage, with file defaults as fallback
- Instantiates the correct `LLMProvider` when settings change
- Handles abort controller lifecycle (cancel in-flight requests on cascade clear or rerun)
- Passes callbacks down to children

### State Management Notes

- Use `useReducer` in `App` for `SessionState` — the cascade rule is a state transition that benefits from explicit action types: `SET_INSIGHT`, `SET_ARTIFACT_CHUNK`, `SET_ARTIFACT_STATUS`, `CLEAR_FROM_STAGE`
- Streaming update pattern: call `dispatch({ type: 'SET_ARTIFACT_CHUNK', stageId, chunk })` for each chunk in the async generator loop

### UX Details

- "Waiting for first token": artifact status is `waiting` (spinner, no content)
- "Streaming": artifact status is `streaming` (content present, cursor/spinner indicator)
- Stage "Run" button is disabled if: the stage's input artifact is not `complete`, or a run is in progress
- "Run All" cancels any in-progress run (via AbortController) then starts fresh

**Deliverable:** Fully functional UI. Manual testing of all 5 user stories from PRD.

---

## Phase 8 — README and Final Polish

### README.md must cover

1. **What it is** — one paragraph
2. **Setup** — `npm install`, `npm run dev`, provider config steps
3. **Architecture overview** — three-layer diagram (UI / Engine / Providers) with brief description of each
4. **Adding a new LLM provider** — step-by-step: implement `LLMProvider`, register in `getProvider()`, add to settings UI
5. **Security note** — API keys stored in localStorage, known limitation for personal use tool
6. **Licence**

### Final checks

- `npm test` — all tests pass
- `npm run lint` — clean
- `npm run build` — production bundle builds without errors
- Manual walkthrough of US1–US5 from PRD

---

## Build Sequence Summary

| Phase | Deliverable | Tests |
|---|---|---|
| 1 | Project scaffold | Vitest runs |
| 2 | Type definitions | None (types only) |
| 3 | Storage layer | ✅ Full coverage |
| 4 | Workflow definition + default prompts | ✅ `buildPrompt` |
| 5 | LLM provider implementations | ✅ Mocked network |
| 6 | Workflow engine (orchestration) | ✅ Full coverage |
| 7 | UI components | Manual (+ component tests if time allows) |
| 8 | README + polish | — |

---

## Key Design Decisions and Trade-offs

**Engine is stateless.** The engine functions (`runStage`, `getCascadeIds`) are pure functions / async generators with no internal state. State lives entirely in `App` via `useReducer`. This makes the engine trivially testable and keeps the UI the single source of truth.

**No React Context for provider/templates.** Given the component tree is shallow (App → WorkflowView → StageCard), prop drilling is acceptable. Context would add indirection without benefit at this scale.

**`openai` npm package over raw fetch for OpenAI.** The official SDK handles SSE framing, retries on transient errors, and type safety. For KoboldCPP, raw fetch is used because no official SDK exists — this makes the contrast instructive for the open-source audience.

**CSS Modules over Tailwind.** No runtime overhead, no config, scoped by default. Appropriate for a single-developer project without a design system.

**`useReducer` for session state.** The cascade rule (`CLEAR_FROM_STAGE`) is a non-trivial state transition. Encoding it as an explicit action in a reducer makes it auditable and testable outside of React. `useState` would scatter the cascade logic across callbacks.

**Artifact streaming via async generator + dispatch loop.** Each `SET_ARTIFACT_CHUNK` dispatch triggers a React re-render with the new content appended. This is straightforward but means one render per token. For typical LLM token rates (10–50 tokens/sec) this is fine; batching is unnecessary complexity at this scale.
