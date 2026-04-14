# Skill: Other Work

## Purpose
Handle refactors, bug fixes, infra/config updates, and non-feature tasks.

## Workflow
1. Identify impacted files using search.
2. Make smallest possible safe changes.
3. Preserve existing patterns and naming style.
4. Validate with typecheck and relevant script.

## Typical Tasks
- Config and environment cleanup
- Performance and cache improvements
- Logging and monitoring updates
- Queue/worker reliability improvements
- Documentation updates

## Safety Checklist
- No destructive DB operation without explicit user confirmation.
- No unrelated formatting-only changes.
- Keep migration and generated artifacts in sync when schema changes.
