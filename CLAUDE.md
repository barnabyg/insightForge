# CLAUDE.md

## Identity

You are working with Barnaby, a technically experienced developer. Be direct, skip preamble, and focus on outcomes. If something looks wrong, say so immediately.

## Project Context

<!-- Update these per project -->
- **Language**: TypeScript
- **Runtime**: Node.js
- **Package manager**: npm
- **Test framework**: Vitest (or Jest — update as needed)
- **Linter**: ESLint
- **Formatter**: Prettier
- **Build tool**: (Vite / tsc / esbuild — update as needed)

## Core Rules

### 1. Testing — Non-Negotiable

- **Every new function, module, or feature must have tests before the work is considered complete.**
- Run `npm test` after any non-trivial code change. Do not wait until the end.
- If existing tests break, fix them immediately. Never skip or comment out failing tests.
- Aim for meaningful coverage, not vanity metrics. Test behaviour, not implementation details.
- For new modules, create a corresponding test file: `src/foo.ts` → `src/__tests__/foo.test.ts` (adjust path convention per project).
- When fixing a bug, write a failing test that reproduces it first, then fix the code.

### 2. Code Quality — Automated and Enforced

- Run `npm run lint` after making code changes. Fix all errors before committing.
- Run `npm run format` (or `npx prettier --write .`) after editing files. No formatting noise in diffs.
- Follow existing code patterns and conventions in the project. When in doubt, match the surrounding code style.
- No `any` types in TypeScript unless there is a documented reason.
- No `console.log` left in production code — use the project's logging solution.
- Prefer small, focused commits over large sweeping changes.

### 3. Documentation — Updated Continuously

- **After completing a feature or significant change, update the relevant documentation before committing.**
- This includes: README.md, API docs, JSDoc/TSDoc comments, CHANGELOG.md (if the project uses one).
- If a public function's signature or behaviour changes, update its doc comments immediately.
- For new modules, add a brief description of purpose and usage at the top of the file or in the relevant docs.
- Keep documentation factual and concise. Don't pad it.

### 4. Git Discipline

- Write clear, conventional commit messages: `type(scope): description` (e.g. `feat(auth): add JWT refresh token rotation`).
- Do not commit generated files, build output, or `node_modules`.
- Commit logically — one concern per commit where practical.
- Before committing, ensure: tests pass, linter is clean, formatter has run.

## Workflow Expectations

- **Read before writing.** Understand the existing code before modifying it. Use Grep/Glob/Read to orient yourself.
- **Ask if genuinely uncertain.** Don't guess at requirements. If a task is ambiguous, ask me to clarify rather than making assumptions that could waste effort.
- **Explain trade-offs briefly** when making architectural decisions. I want to know *why*, not just *what*.
- **Don't over-engineer.** Build the simplest thing that solves the problem correctly.

## Common Commands

<!-- Update these per project -->
```
npm test              # run full test suite
npm run test:watch    # run tests in watch mode
npm run lint          # lint the codebase
npm run lint:fix      # auto-fix lint issues
npm run format        # format with prettier
npm run build         # production build
npm run dev           # development server
```

## Things to Never Do

- Never delete or overwrite `.env` files.
- Never commit secrets, API keys, or credentials.
- Never run `npm publish` without explicit confirmation from me.
- Never force-push to any branch.
- Never modify CI/CD pipeline files without asking me first.
