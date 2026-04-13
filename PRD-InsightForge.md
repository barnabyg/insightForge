# InsightForge — Product Requirements Document

**Version:** 1.1
**Date:** April 2026
**Author:** Barnaby

---

## 1. Problem & User Definition

### Problem Statement

Product-minded individuals generate insights regularly but face a high activation energy barrier to properly evaluating them. Without a structured evaluation process, ideas either go unexamined or absorb significant time before fundamental viability issues surface.

The core problem is not a lack of analytical ability — it is the friction involved in imposing structure on a raw idea. Users need a tool that forces them through an evaluation framework they would otherwise skip, producing a structured brief that improves their own thinking rather than providing an automated verdict.

### Target User

The primary user is a solo practitioner with product ideas who wants to rapidly triage them against a structured framework. They are technically literate, comfortable with LLMs, and value speed and directness over polish.

### What Good Output Looks Like

A successful run produces a structured brief covering market context, differentiation angles, monetisation routes, and effort/complexity assessment. The output enables the user to make an informed decision about whether to invest further time — it does not make that decision for them. The LLM acts as a thinking partner that suggests strategic options (build and test demand, sell the concept, partner, pivot) but the human retains judgement.

### Secondary Goal

The project will be open-sourced on GitHub to demonstrate practical AI utility. This means code quality, clean architecture, and legibility to other developers are first-class concerns.

---

## 2. Core Concepts & Domain Model

### Entities

**Workflow** — An ordered sequence of Stages defining a pipeline. Initially one workflow is hardcoded; the model should accommodate multiple workflows in future.

**Stage** — A named transformation step with a fixed position in a Workflow. Each Stage owns a Prompt Template, takes one Artifact as input, and produces one Artifact as output.

**Prompt Template** — An editable text template associated with a Stage. Contains an `{{input}}` placeholder that is replaced with the input Artifact's content at execution time. Stored as a single text blob (no system/user prompt split). Persisted in localStorage and exportable/importable as files.

**Artifact** — A text blob produced by a Stage, or entered by the user as the initial input (the Insight). Exists only in the browser session (in-memory). Can be downloaded as a text file.

**Session** — Ephemeral in-browser state holding the current set of Artifacts for a workflow run. No persistence beyond the browser session.

### Relationships

- A Workflow contains many Stages (ordered).
- A Stage has exactly one Prompt Template.
- A Stage produces exactly one Artifact.
- Each Stage's input is the preceding Stage's output, except Stage 1 which takes the user-provided Insight.

### Cascade Rule

Editing the Insight or rerunning any Stage clears all downstream Artifacts. This prevents the user from reviewing stale data without realising it.

---

## 3. User Stories & Workflows

### US1 — Full Pipeline Run

The user opens the app, sees the workflow stages laid out visually, and types an insight into a text area. They trigger "Run All." Each stage executes sequentially, streaming output as it generates. Once complete, all artifacts are displayed and reviewable. The user can save any artifact locally as a text file.

### US2 — Prompt Iteration

The user has completed a full pipeline run and is dissatisfied with a stage's output. They open the prompt template for that stage (a textarea), edit it, and rerun just that stage. All downstream artifacts are cleared. The user reviews the new output and selectively reruns downstream stages as needed.

### US3 — Insight Editing

The user has completed a full pipeline run but realises their initial insight was too vague. They edit the insight text. All downstream artifacts are cleared. They rerun the pipeline.

### US4 — Prompt Management

The user saves prompt templates to localStorage so they persist between sessions. They can also export prompt templates as files and import them back, enabling sharing and backup.

### US5 — Error Recovery

An LLM call fails (network error, rate limit, timeout, provider unavailable). The error is displayed inline against the failed stage. All existing artifacts and the user's insight text are preserved. The user can retry the failed stage.

### UX Principles

- Workflow stages are visually navigable with a clear sequential progression.
- Each stage displays its current status at a glance: empty, waiting for response, streaming, complete, or error.
- Common operations (edit prompt, run stage, run all) are immediately accessible, not buried in menus.
- Prompts will typically be large, so prompt edit area should be large.
- Streaming output provides real-time feedback during execution.
- The UI should clearly distinguish between "waiting for first token" and "actively streaming tokens."

---

## 4. System Architecture

### Application Type

Pure frontend single-page application. No backend. Deployable as static files.

### Tech Stack

- **Framework:** React
- **Build tool:** Vite
- **Styling:** Lightweight — no heavy component library
- **State management:** React state (in-memory for artifacts, localStorage for config and prompts)

### LLM Abstraction Layer

A provider interface with two implementations:

```
LLMProvider
  - name: string
  - configure(settings): void
  - execute(prompt: string): AsyncStream<string>
```

**OpenAIProvider** — Calls the OpenAI API using a user-provided API key. Model hardcoded for MVP.

**LocalProvider** — Calls the KoboldCPP API on localhost port 5001. Model hardcoded for MVP.

Provider selection is global (all stages use the same provider). The abstraction is designed so that adding a new provider requires only implementing the interface.

Provider defaults to LocalProvider.

### Data Flow

```
User Input (Insight)
    ↓
Stage 1: Template.replace("{{input}}", insight) → LLMProvider.execute() → Artifact 1
    ↓
Stage 2: Template.replace("{{input}}", artifact1) → LLMProvider.execute() → Artifact 2
    ↓
(future stages follow the same pattern)
```

### Storage Model

| Data | Storage | Persistence |
|---|---|---|
| Prompt Templates | localStorage + file export/import | Across sessions |
| LLM Configuration | localStorage (provider, API key) | Across sessions |
| Artifacts | React in-memory state | Session only |
| Workflow Definitions | Hardcoded in source | N/A |

### Streaming

Both the OpenAI API and KoboldCPP support server-sent events for streaming responses. The `execute` method returns an async iterable of text chunks. The UI renders these incrementally into the artifact display area.

---

## 5. Scope & Prioritisation

### MVP — In Scope

- Single hardcoded workflow: Insight → Design Brief → PRD
- Free-text insight input with in-session editing
- Run All and Run Single Stage execution modes
- Downstream artifact clearing on edit or rerun (cascade rule)
- Streaming LLM output with visual feedback
- Prompt template editing via textarea
- Prompt persistence in localStorage
- Prompt export/import as files
- Initial prompts are loaded from files that contain example prompts
- Artifact display per stage
- Artifact download as text files
- Global LLM provider toggle (OpenAI API / KoboldCPP)
- API key configuration stored in localStorage
- Inline error display with retry capability
- Stage status indicators (empty, waiting, streaming, complete, error)

### Deferred — Acknowledged, Not Built

- User-configurable workflows (custom stage sequences)
- Per-stage provider or model selection
- Model selection as a user-facing setting
- System/user prompt split in templates
- Artifact versioning or history
- Staleness tracking and visual indicators across stages
- Multiple concurrent workflows or sessions
- Backend server
- Authentication or multi-user support
- Persistence beyond localStorage (database, cloud sync)

---

## 6. Non-functional Requirements

### Resilience

- LLM call failures must never lose user work. The insight text, prompt edits, and all previously generated artifacts must survive any error.
- Network timeouts should use a generous default (120 seconds minimum) to accommodate large local models that may take significant time before producing the first token.
- KoboldCPP connectivity failures should produce a specific, helpful error message (e.g., "Cannot connect to KoboldCPP on localhost:5001 — is KoboldCPP running?") rather than a generic network error.

### Performance

- All non-LLM interactions (navigation, prompt editing, saving, loading) must feel instant.
- Streaming should begin rendering as soon as the first token arrives from the provider.
- No scaling concerns — this is a single-user tool.

### Security

- API key storage in localStorage is acceptable for personal use.
- This is a known limitation and must be documented in the project README for open-source consumers.
- API keys must never appear in console logs, error messages, or network error displays.

### Code Quality

- Clean separation between three layers: UI components, workflow orchestration, and LLM provider abstraction.
- The LLM provider interface must be obvious enough that a developer can add a new provider by reading one existing implementation.
- Project README must include: setup instructions, architecture overview, and a guide for adding new providers.

### Browser Compatibility

Modern browsers only (current versions of Chrome, Firefox, Safari, Edge). No legacy browser support.

---

## Appendix: Initial Workflow Definition

The MVP ships with one hardcoded workflow:

**Workflow:** Insight Triage

| Stage | Name | Input | Output |
|---|---|---|---|
| 1 | Insight → Design Brief | User-provided Insight (free text) | Design Brief |
| 2 | Design Brief → PRD | Design Brief (from Stage 1) | PRD |

Default prompt templates should be provided for both stages and can be overridden by the user.
