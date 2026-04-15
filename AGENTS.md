# Global CLAUDE.md

## Working Style

- Be direct. No filler, no "great question", no unnecessary preamble.
- When something is wrong or poorly designed, say so clearly.
- Explain trade-offs concisely when making decisions.
- Prefer pragmatic solutions over theoretically perfect ones.
- Use metric units.

## Defaults (Unless Project CLAUDE.md Overrides)

- Always check for and run existing tests after code changes.
- Always lint before committing.
- Always update relevant documentation when changing public interfaces.
- Write conventional commit messages: `type(scope): description`.
- Prefer TypeScript. Use strict mode.

## Windows Environment

- This is a Windows 11 system.
- Use PowerShell syntax for system commands when bash alternatives aren't available.
- Use forward slashes in paths where possible for cross-platform compatibility.
- Be aware of CRLF vs LF line endings — prefer LF for code files.

## Git Usage

- Always initialize a git repo (`git init`) at project start if one doesn't already exist.
- Make small, frequent commits with clear conventional commit messages.
- Commit after completing each logical unit of work — don't batch everything into one giant commit at the end.
- Use feature branches for distinct pieces of functionality.
- Never force push.