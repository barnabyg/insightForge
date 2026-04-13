# InsightForge

A structured triage tool for product ideas. Paste a raw insight, run it through a two-stage LLM pipeline, and get a Design Brief followed by a full PRD — not as a verdict, but as a thinking framework that forces the important questions to the surface.

Built as a pure frontend SPA with no backend. Deployable as static files.

---

## Setup

### Prerequisites

- Node.js 20+
- npm 9+
- Either: an OpenAI API key, or [KoboldCPP](https://github.com/LostRuins/koboldcpp) running locally on port 5001

### Install and run

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### Configure your LLM provider

In the settings panel at the top of the page:

- **KoboldCPP (local)** — default. Expects KoboldCPP running at `localhost:5001`. No API key needed.
- **OpenAI** — enter your API key. The key is stored in localStorage (see [Security](#security)).

---

## Usage

1. Type or paste your product insight into the text area.
2. Click **Run All** to execute the full pipeline, or **Run this stage** on any individual stage.
3. Each stage streams its output in real time.
4. Edit any prompt template via the **Edit prompt template** toggle on each stage card.
5. Click **Save** to persist a template to localStorage. Use **Export JSON** / **Import JSON** to share or back up templates.
6. Download any completed output as a `.txt` file.

If you edit the insight or rerun a stage, all downstream outputs are cleared automatically.

---

## Architecture

The codebase is organised into three distinct layers:

```
┌─────────────────────────────────────────────┐
│                   UI Layer                  │
│  App → WorkflowView → StageCard             │
│  (React, CSS Modules, useReducer)           │
└────────────────────┬────────────────────────┘
                     │ calls
┌────────────────────▼────────────────────────┐
│             Orchestration Layer             │
│  session.reducer.ts  (cascade rule)         │
│  engine.ts           (runStage, buildPrompt)│
│  storage/            (localStorage I/O)     │
└────────────────────┬────────────────────────┘
                     │ calls
┌────────────────────▼────────────────────────┐
│           LLM Provider Layer                │
│  LLMProvider interface                      │
│  OpenAIProvider  (openai npm package)       │
│  KoboldProvider  (raw fetch + SSE)          │
└─────────────────────────────────────────────┘
```

**UI layer** — React components with CSS Modules. `App.tsx` owns all session state via `useReducer`. No global state library.

**Orchestration layer** — Pure functions and a pure reducer. `sessionReducer` handles the cascade rule: editing the insight or rerunning any stage clears all downstream artifacts. `engine.ts` provides `buildPrompt` (template substitution) and `runStage` (async generator that delegates to the provider).

**Provider layer** — `LLMProvider` interface. Both implementations are isolated in their own files. Adding a new provider requires only implementing the interface and registering it in `getProvider()`.

### Data storage

| Data | Storage | Persistence |
|---|---|---|
| Prompt templates | localStorage + JSON file export/import | Across sessions |
| LLM config (provider, API key) | localStorage | Across sessions |
| Artifacts (generated text) | React in-memory state | Session only |
| Workflow definition | Hardcoded in `src/workflow/definition.ts` | N/A |

---

## Adding a new LLM provider

1. **Implement the interface** — create `src/providers/myprovider.provider.ts`:

```typescript
import type { LLMProvider, ProviderSettings } from './types'

export class MyProvider implements LLMProvider {
  readonly name = 'myprovider' as const

  configure(settings: ProviderSettings): void {
    // Store API key, initialise client, etc.
  }

  async *execute(prompt: string, signal?: AbortSignal): AsyncIterable<string> {
    // Call your API, yield text chunks.
    // Honour the AbortSignal for cancellation.
    // Throw descriptive errors on failure.
  }
}
```

2. **Add the provider name to the union type** — in `src/providers/types.ts`:

```typescript
export type ProviderName = 'openai' | 'kobold' | 'myprovider'
```

3. **Register in the factory** — in `src/providers/index.ts`, add a case to `getProvider()`:

```typescript
case 'myprovider':
  return new MyProvider()
```

4. **Add to the settings UI** — in `src/components/ProviderSettings.tsx`, add a radio option for `'myprovider'`.

5. **Write tests** — create `src/__tests__/myprovider.provider.test.ts`. Mock `fetch` or the SDK, test the happy path, network errors, and AbortSignal behaviour. See `kobold.provider.test.ts` for a reference.

---

## Development

```bash
npm run dev          # start dev server (hot reload)
npm test             # run full test suite
npm run test:watch   # run tests in watch mode
npm run lint         # lint with ESLint (strict TypeScript rules)
npm run lint:fix     # auto-fix lint issues
npm run format       # format with Prettier
npm run build        # production build (tsc + vite)
```

---

## Security

**API keys are stored in localStorage.** This is intentional for a personal, single-user tool. It means:

- Anyone with access to your browser's DevTools can read your API key.
- Do not use this on shared or public machines.
- API keys are never logged or included in error messages (the provider implementations sanitise errors before surfacing them).

If you need stronger key security, host this behind a backend that proxies LLM calls and handles auth server-side.

---

## Licence

MIT
