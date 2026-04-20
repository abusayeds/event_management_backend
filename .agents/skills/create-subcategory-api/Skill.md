# Skill: Create Subcategory API

## Purpose
Create or extend Subcategory API using this project's modular pattern with validation, service business logic, Prisma repository, and file upload support.

## Model Context
Subcategory fields:
- id (uuid)
- categoryId (required FK -> Category)
- name (unique)
- imageUrl (optional)
- description (optional)
- isDeleted (soft delete)
- createdAt, updatedAt

## Required Behavior
- Use module path: src/modules/subcategory
- Layered flow: routes -> controller -> service -> repository
- Validate request body/query/params using zod
- Use auth middleware and role checks
- Use upload middleware for image field: image
- Upload image to S3 on create/update
- Delete old image from S3 on update success
- Best-effort delete image on soft delete
- Exclude deleted records from read/list
- Use pagination utils for list endpoint
- Throw ApiError for controlled errors

## Files To Create
- src/modules/subcategory/subcategory.interface.ts
- src/modules/subcategory/subcategory.validation.ts
- src/modules/subcategory/subcategory.repository.ts
- src/modules/subcategory/subcategory.service.ts
- src/modules/subcategory/subcategory.controller.ts
- src/modules/subcategory/subcategory.routes.ts

## Endpoint Blueprint
- POST /subcategories (ADMIN)
- GET /subcategories (ADMIN, USER)
- GET /subcategories/:id (ADMIN, USER)
- PATCH /subcategories/:id (ADMIN)
- DELETE /subcategories/:id (ADMIN) [soft delete]

## Service Rules
- Create:
  - Validate parent category exists and is not deleted
  - Ensure name uniqueness (case-insensitive)
  - Upload file if provided
  - Rollback uploaded image if DB create fails
- Update:
  - Ensure subcategory exists
  - Validate categoryId if being changed
  - Ensure name uniqueness if changed
  - Allow file-only update
  - Upload new file then update DB
  - Delete old image on success
  - Rollback new image on failure
- Delete:
  - Ensure subcategory exists
  - Best-effort delete image
  - Soft delete only

## Route Integration
Register in src/routes/index.ts:
- router.use('/subcategories', SubcategoryRoutes)

## Done Criteria
- Typecheck passes
- All endpoints wired and protected
- File upload and cleanup works in create/update/delete
- Soft delete respected in list/get
