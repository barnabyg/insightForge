# InsightForge

InsightForge is a browser-based triage tool for rough product ideas. You paste an initial insight, run it through a fixed workflow, and get:

1. A Design Brief
2. A triage PRD
3. A mockup-image prompt that can optionally be sent to OpenAI image generation

It is a pure frontend SPA built with React and Vite. There is no backend, no server-side storage, and no hidden configuration layer. What you configure in the UI is what the app uses.

## What The App Actually Does

The workflow is hardcoded in [src/workflow/definition.ts](/C:/docs/git/insightForge/src/workflow/definition.ts):

1. `stage-1`: `Insight -> Design Brief`
2. `stage-2`: `Design Brief -> PRD`
3. `stage-3`: `PRD -> Mockup Prompt`

Each stage uses a prompt template from [src/prompts/stage1.txt](/C:/docs/git/insightForge/src/prompts/stage1.txt), [src/prompts/stage2.txt](/C:/docs/git/insightForge/src/prompts/stage2.txt), and [src/prompts/stage3.txt](/C:/docs/git/insightForge/src/prompts/stage3.txt). The templates are editable in the UI and can be saved to browser storage.

The app streams model output as it arrives. If you edit the original insight or rerun a stage, that stage and every downstream artifact are cleared before execution. That cascade behavior lives in [src/workflow/session.reducer.ts](/C:/docs/git/insightForge/src/workflow/session.reducer.ts) and [src/components/App.tsx](/C:/docs/git/insightForge/src/components/App.tsx).

## Requirements

- Node.js 20+
- npm 9+
- One of:
- OpenAI API access
- A local KoboldCPP instance listening on `http://localhost:5001`

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

Available scripts:

```bash
npm run dev
npm run build
npm run preview
npm test
npm run test:watch
npm run lint
npm run lint:fix
npm run format
```

## Configuration

This project does not use `.env` files or server-side config. Runtime configuration is handled entirely in the browser UI and persisted to `localStorage`.

### Where Configuration Lives

InsightForge stores two local keys:

| Key | Purpose | Source |
|---|---|---|
| `insightforge:settings` | Active provider settings | [src/storage/settings.ts](/C:/docs/git/insightForge/src/storage/settings.ts) |
| `insightforge:prompts` | Saved prompt templates by stage id | [src/storage/prompts.ts](/C:/docs/git/insightForge/src/storage/prompts.ts) |

Current defaults:

- Provider: `kobold`
- Kobold prompt format: `none`
- OpenAI API key: unset
- Prompt templates: built-in files under `src/prompts/`

If stored settings are malformed or no longer match the expected shape, the app falls back to defaults instead of trying to recover partial state.

### What Is Persisted And What Is Not

| Data | Persisted? | Notes |
|---|---|---|
| Provider choice | Yes | Stored in `localStorage` |
| OpenAI API key | Yes | Stored in `localStorage` |
| Kobold prompt format | Yes | Stored in `localStorage` |
| Prompt templates | Yes | Stored in `localStorage`, plus JSON export/import |
| Generated artifacts | No | In-memory session state only |
| Generated mockup image | No | In-memory session state only, downloadable via `Save As...` |
| Workflow definition | No | Hardcoded in source |

Reloading the page keeps your provider settings and saved prompt templates. It does not keep the generated Design Brief or PRD.

### How To Reset Configuration

There is no built-in "reset settings" button yet. To fully reset the app:

1. Open browser DevTools.
2. Remove `insightforge:settings` and `insightforge:prompts` from local storage for the app origin.
3. Reload the page.

## Provider Setup

The provider UI is implemented in [src/components/ProviderSettings.tsx](/C:/docs/git/insightForge/src/components/ProviderSettings.tsx). Only two providers exist today: `kobold` and `openai`.

### KoboldCPP

Kobold is the default provider. The app sends requests to:

- `POST http://localhost:5001/api/extra/generate/stream`

Behavior:

- Streaming is expected.
- Requests time out after 120 seconds.
- `max_length` is fixed at `2048`.
- If the request fails, the UI surfaces `Cannot connect to KoboldCPP on localhost:5001 - is KoboldCPP running?`

Implementation: [src/providers/kobold.provider.ts](/C:/docs/git/insightForge/src/providers/kobold.provider.ts)

#### Kobold Prompt Format

This matters more than the current README suggests. The selected format controls how the raw prompt is wrapped before being sent to the model.

Supported values:

- `none`: sends raw text unchanged
- `gemma4`: wraps prompt in Gemma 4 instruct format
- `chatml`: wraps prompt in ChatML format

Formatting logic lives in [src/providers/prompt-formats.ts](/C:/docs/git/insightForge/src/providers/prompt-formats.ts).

Use the right format for the model you are actually running:

- `none` is only suitable for base or non-instruct models.
- `gemma4` is for Gemma 4-style instruct models.
- `chatml` is for models trained around ChatML conventions.

If you pick the wrong format, the model will usually still return text, but the output quality will degrade or the instruction-following will become erratic. That is a prompt-format mismatch, not an app bug.

For `gemma4`, the app also strips the model's thinking channel from the streamed response before displaying it.

### OpenAI

OpenAI is configured by entering an API key in the UI. The app uses the official `openai` npm package directly in the browser with `dangerouslyAllowBrowser: true`.

Current behavior:

- Model is fixed to `gpt-5.4-mini`
- Requests stream token chunks into the UI
- Timeout is 120 seconds
- API key is redacted from surfaced error messages where possible

Implementation: [src/providers/openai.provider.ts](/C:/docs/git/insightForge/src/providers/openai.provider.ts)

This design is acceptable for a personal tool. It is not suitable if you need proper secret management. The API key lives in browser storage and is accessible to anyone with access to that browser profile.

### OpenAI Mockup Image Generation

Stage 3 generates a text prompt, not an image artifact. After Stage 3 completes, the UI exposes a separate `Generate mockup image` action that uses OpenAI image generation outside the normal text workflow.

Current behavior:

- OpenAI-only
- one image per generated prompt
- session-only persistence
- `Save As...` downloads the current image as a PNG
- clicking `Preview` opens the image in a lightbox
- if Stage 3 is rerun or invalidated, the generated image is cleared

Under `kobold`, Stage 3 is still shown but disabled for direct use, and `Run All` marks it as skipped.

## Prompt Template Management

Each stage card has an `Edit prompt template` panel. Prompt editing is local to the browser unless you explicitly export the templates.

### Required Placeholder

Every template must include `{{input}}`.

That requirement is enforced in [src/workflow/engine.ts](/C:/docs/git/insightForge/src/workflow/engine.ts). If the placeholder is missing, stage execution fails with:

```text
Prompt template is missing the {{input}} placeholder
```

### Save, Export, Import

Prompt handling lives in [src/storage/prompts.ts](/C:/docs/git/insightForge/src/storage/prompts.ts).

- `Save` writes the current template set to `localStorage`
- `Export JSON` exports all templates for the workflow, not just the visible stage
- `Import JSON` merges imported templates into the current set

The export format is versioned. Current shape:

```json
{
  "version": 1,
  "workflow": "insight-triage",
  "templates": {
    "stage-1": ".... {{input}} ....",
    "stage-2": ".... {{input}} ....",
    "stage-3": ".... {{input}} ...."
  }
}
```

Important detail: import validation checks `version` and that every template value is a string, but it does not enforce the `workflow` id. At the moment that means a valid export from a different workflow shape could still import if the stage ids happen to line up.

### Built-In Prompt Sources

Default prompt files:

- [src/prompts/stage1.txt](/C:/docs/git/insightForge/src/prompts/stage1.txt)
- [src/prompts/stage2.txt](/C:/docs/git/insightForge/src/prompts/stage2.txt)
- [src/prompts/stage3.txt](/C:/docs/git/insightForge/src/prompts/stage3.txt)

If no saved prompt state exists, these are what the UI loads.

## Runtime Behavior

### Stage Execution Rules

- `Run All` is enabled only when the insight field is non-empty.
- Stage 1 can run when the insight field is non-empty.
- Stage 2 can run only when Stage 1 has completed successfully.
- Stage 3 can run only when Stage 2 has completed successfully and the active provider is OpenAI.
- Only one active run is supported at a time.
- Changing provider settings or prompt text while a run is in progress is disabled in the UI.
- When `Run All` is used under Kobold, Stage 3 is marked as skipped rather than left empty.

### Cancellation

Clicking `Cancel` aborts the active request. The app uses `AbortController` for both OpenAI and Kobold requests.

### Error Handling

Errors are shown per stage. Typical failure cases:

- missing `{{input}}` in a prompt template
- no OpenAI API key configured
- OpenAI network/API errors
- KoboldCPP not running on `localhost:5001`
- malformed provider response

If a stage fails during `Run All`, the pipeline stops at that stage.

## Architecture

The codebase is split into three practical layers:

- UI components in `src/components/`
- workflow orchestration and reducer logic in `src/workflow/`
- provider implementations in `src/providers/`

Key files:

- [src/components/App.tsx](/C:/docs/git/insightForge/src/components/App.tsx): top-level orchestration, persistence hooks, run/cancel flow
- [src/workflow/engine.ts](/C:/docs/git/insightForge/src/workflow/engine.ts): prompt building and stage execution
- [src/workflow/session.reducer.ts](/C:/docs/git/insightForge/src/workflow/session.reducer.ts): cascade clearing rules
- [src/storage/settings.ts](/C:/docs/git/insightForge/src/storage/settings.ts): provider settings validation and persistence
- [src/storage/prompts.ts](/C:/docs/git/insightForge/src/storage/prompts.ts): prompt persistence and JSON import/export
- [src/providers/index.ts](/C:/docs/git/insightForge/src/providers/index.ts): provider factory

## Extending Configuration

If you add a new provider or new provider-specific settings, there are several places to update. The old README only covered the provider class itself; that is incomplete.

For a new provider:

1. Add the provider name to [src/providers/types.ts](/C:/docs/git/insightForge/src/providers/types.ts).
2. Implement `LLMProvider` in a new provider file under `src/providers/`.
3. Register it in [src/providers/index.ts](/C:/docs/git/insightForge/src/providers/index.ts).
4. Add UI controls in [src/components/ProviderSettings.tsx](/C:/docs/git/insightForge/src/components/ProviderSettings.tsx).
5. Update `isProviderSettings` in [src/storage/settings.ts](/C:/docs/git/insightForge/src/storage/settings.ts) so persisted settings validate correctly.
6. Add or update tests under `src/__tests__/`.

If you add a new config field to an existing provider:

1. Extend `ProviderSettings`.
2. Update the settings UI.
3. Update storage validation in `src/storage/settings.ts`.
4. Ensure the provider reads the new setting in `configure()`.
5. Add tests for load/save fallback behavior.

If you skip step 5 in either case, the app may silently discard stored settings by falling back to defaults.

## Testing

Tests live under [src/__tests__](/C:/docs/git/insightForge/src/__tests__).

Relevant coverage already exists for:

- settings storage fallback and persistence
- prompt storage and import/export validation
- workflow reducer behavior
- provider streaming behavior
- OpenAI image generation helper behavior

Run them with:

```bash
npm test
```

Lint with:

```bash
npm run lint
```

## Security

The security model is simple:

- OpenAI API keys are stored in `localStorage`
- all LLM calls are made directly from the browser
- there is no backend proxy

That is fine for local personal use. It is the wrong design for a shared deployment, team environment, or anything that needs proper secret isolation.

If you need stronger controls, add a backend and move provider credentials server-side.

## Deployment

Because this is a static SPA, a production build is just:

```bash
npm run build
```

The output goes to `dist/`. You can host that on any static file host. The main constraint is operational, not build-related: the deployed browser still needs direct access to whichever provider you selected.

In practice:

- OpenAI works anywhere the browser can reach the OpenAI API and the user is willing to expose a key in-browser.
- Kobold only works when the browser can reach the local or networked KoboldCPP instance configured by the code. Right now that endpoint is hardcoded to `http://localhost:5001`.

## Licence

MIT
