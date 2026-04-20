# Skill: Create Program API

## Purpose
Create or extend Program API in this codebase pattern with strict validation, relation checks, soft delete, and image upload support.

## Model Context
Program fields:
- id (uuid)
- categoryId (optional FK -> Category)
- subcategoryId (optional FK -> Subcategory)
- name (unique)
- description (optional)
- imageUrl (optional)
- isDeleted (soft delete)
- createdAt, updatedAt

## Required Behavior
- Use module path: src/modules/program
- Layered flow: routes -> controller -> service -> repository
- Validate all payloads with zod
- Use auth + role middleware
- Use upload middleware for image field: image
- Use S3 upload/delete logic for image lifecycle
- Exclude deleted records from list/get
- Use pagination helpers
- Throw ApiError with proper status codes

## Important Validation Rules
- At least one of categoryId or subcategoryId is required on create
- If subcategoryId is provided, subcategory must exist and not deleted
- If categoryId is provided, category must exist and not deleted
- If both categoryId and subcategoryId are provided, they must be consistent
- On update, validate relation consistency the same way
- Allow file-only update

## Files To Create
- src/modules/program/program.interface.ts
- src/modules/program/program.validation.ts
- src/modules/program/program.repository.ts
- src/modules/program/program.service.ts
- src/modules/program/program.controller.ts
- src/modules/program/program.routes.ts

## Endpoint Blueprint
- POST /programs (ADMIN)
- GET /programs (ADMIN, USER)
- GET /programs/:id (ADMIN, USER)
- PATCH /programs/:id (ADMIN)
- DELETE /programs/:id (ADMIN) [soft delete]

## Service Rules
- Create:
  - Normalize and enforce unique name
  - Validate category/subcategory relationships
  - Upload image if provided
  - Rollback image if DB create fails
- Update:
  - Ensure program exists
  - Validate uniqueness for changed name
  - Validate relation consistency for changed references
  - Upload new image and remove old image after success
  - Rollback new image if update fails
- Delete:
  - Ensure program exists
  - Best-effort image delete
  - Soft delete only

## Route Integration
Register in src/routes/index.ts:
- router.use('/programs', ProgramRoutes)

## Done Criteria
- Typecheck passes
- All endpoints wired and protected
- Relation checks enforced correctly
- File upload and cleanup works
- Soft delete behavior respected
