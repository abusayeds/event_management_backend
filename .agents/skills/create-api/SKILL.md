# Skill: Create API

## Purpose
Implement a new API endpoint/module following this project structure.

## Steps
1. Define request and response contracts in interfaces/validation.
2. Add validation schema in module validation file.
3. Implement repository for DB access.
4. Implement service for business logic.
5. Implement controller for request handling.
6. Wire routes in module routes file.
7. Register route in src/routes/index.ts.
8. Add Swagger docs and test cases.

## Rules
- Use asyncHandler and ApiResponse utilities.
- Keep controller simple.
- Throw ApiError for controlled failures.
- Ensure role/auth middleware is applied when needed.

## Done Criteria
- Typecheck passes.
- Endpoint is reachable and validated.
- Tests updated for success and failure cases.
