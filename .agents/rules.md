# Agent Rules

## Core Principles
- Keep changes minimal and scoped to the user request.
- Prefer type-safe implementations in TypeScript.
- Do not remove or rewrite unrelated code.
- Keep API responses consistent with existing response utilities.

## Backend Conventions
- Use module-based structure under src/modules.
- Keep controller thin and move logic to service/repository.
- Use validation schema before controller handlers.
- Reuse existing middleware for auth, role, and error handling.

## Quality Gate
- Run typecheck after meaningful changes.
- Keep lint clean for edited files.
- Add or update tests when behavior changes.

## Safety
- Avoid destructive commands and schema resets unless explicitly requested.
- For Prisma schema changes, regenerate Prisma client.
- For startup/runtime config changes, update .env.example documentation.
