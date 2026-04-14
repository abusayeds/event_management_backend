# Copilot Instructions

## Project Focus
Dawabuyi Event Management Backend.

## Coding Standards
- Use TypeScript strict-safe patterns.
- Follow modular architecture in src/modules.
- Keep controllers thin and move logic to services.
- Use centralized error handling and response utilities.

## API Rules
- Validate all payloads before business logic.
- Protect sensitive endpoints with auth and role middleware.
- Keep pagination, filtering, and sorting consistent with existing utilities.

## Data Layer Rules
- Use Prisma for DB access.
- After schema changes, regenerate Prisma client.
- Keep migrations reviewed and descriptive.

## Reliability
- Prefer explicit logs for startup and shutdown paths.
- Use Redis/BullMQ patterns already present in jobs and workers.
- Keep socket initialization optional via config flag.

## Validation Before Finish
- Run typecheck for code changes.
- Ensure edited routes and imports resolve.
- Update docs when behavior/config changes.
