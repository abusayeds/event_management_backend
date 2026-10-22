Image uploads use the existing Multer middleware and a shared storage service. All category, subcategory, program, event, profile, and seed uploads use the same switch.

The dashboard Images page covers categories, subcategories, programs, events, user profiles, families, notifications, and six branding/login assets. It reads paginated admin-only GET `/api/v1/media/images/:model` inventories and uploads multipart `image` files to PATCH `/api/v1/media/images/:model/:id`. It invalidates dashboard caches after updates. The inventory includes archived records and exposes only names, IDs, image URLs, and catalog parents. Updates use a conditional database write and remove the new file if saving fails. Existing files remain available for recovery because another record may share them. User default pictures can be reset using JSON `{ "useDefault": true }` on the user image endpoint.

Family POST/PATCH also accepts multipart `imageUrl`; notification POST accepts multipart `image`. Family creation now persists its image field. Dashboard logos, favicon, and login illustrations come from public GET `/api/v1/media/assets`; authenticated admins replace them with multipart `image` on PATCH `/api/v1/media/assets/:key`. Original branding files live in backend `assets/dashboard`. Their relative local paths are persisted under `uploads/.dashboard-assets`, which is excluded from public static serving. Keep the uploads volume when deploying.

For the complete authenticated API repair, deploy/restart the changed backend, then run:

```sh
npm run images:upload-all -- --api-base=https://sabbir2001.ssh.bd
```

Alternatively run `npm run upload-images` from the dashboard. The command inventories every record across all seven database image models and dashboard assets. It preserves verified local admin images, uses the real workbook/reference originals for catalog repairs, and recovers other images from existing backend files or their remote URLs. Every changed database image is sent through the shared multipart API and its returned public URL must serve an image. Previous paths and each record's outcome are saved in `uploads/all-image-api-repair-*.jsonl`. It reports empty optional fields separately, reports unrecoverable originals and failed uploads, and exits unsuccessfully if anything remains unresolved. It does not replace unavailable personal/event originals with invented photographs. Credentials come from `ADMIN_EMAIL`/`ADMIN_PASSWORD` in the environment or adjacent dashboard `.env`.

```env
USE_AWS=false
BACKEND_PUBLIC_URL=https://sabbir2001.ssh.bd
UPLOAD_DIR=uploads
```

Restart the backend after changing these values. Local storage is the default, including when `USE_AWS` is unset. Multer receives the file and the service saves it under `UPLOAD_DIR`. The database stores a relative path such as `/uploads/categories/images/example.png`. The shared API response serializer adds `BACKEND_PUBLIC_URL`, returning `https://sabbir2001.ssh.bd/uploads/categories/images/example.png` to both the dashboard and main app. `/uploads` is publicly served with cross-origin image access. Keep the upload directory persistent and writable; Docker Compose mounts `./uploads`. Back up this directory with the database. The default profile asset is copied into it automatically.

Only an explicit `USE_AWS=true` keeps the existing S3 uploads, credentials, endpoint, metadata, and presigned URL behavior. Existing local images remain publicly accessible in AWS mode. In local mode, replacing an AWS image does not require AWS deletion; the old AWS object is preserved. Direct S3 presigning is only available in AWS mode; local uploads use the existing multipart endpoints.

To repair existing database records after restarting the backend, run from the backend directory:

In local mode, server startup automatically repairs legacy S3 category images before opening the API port. It finds real category reference photos in the prepared backend manifest/uploads directory, or copies them from the backend reference data, and updates each existing category's database value to its relative local path. Existing local admin uploads are preserved. Concurrent admin changes are protected by conditional database updates. Original URLs are backed up in `uploads/category-image-migration-*.jsonl`. Missing source images are reported and require a manual admin upload. You can also run `npm run images:repair-categories` independently.

```sh
npm run images:migrate-local
```

For the real reference photos, run `npm run images:upload-reference`. This assigns exact program photos and representative program photos to their workbook categories and subcategories, including records currently using placeholders. The workbook has no dedicated category photographs: Musical uses Piano, Sport uses Acrobatic Gymnastics, Art uses Calligraphy, and Food & Drink uses Baking. The Football/Rugby workbook entry uses Football.jpg. Every original is stored before database updates, and old record URLs are backed up in `uploads/reference-image-updates-*.jsonl`. `npm run images:upload-reference -- --prepare-only` stores the images on the backend without changing database records. The command does not copy images into the dashboard.

The repair checks local files, restores program images from `temp-reference-data/Reference Data/Program`, tries to recover remote originals, and uses the existing dashboard category assets for missing category/subcategory/program images. It copies recovered files into the backend upload directory and updates their database URLs. `npm run images:prepare-local` copies the reference and category assets into `uploads/catalog-assets` in advance, allowing the migration to run using the persistent uploads directory without the source directories. Otherwise, category assets must exist in the adjacent `Sharing-Event-Dashboard/public/images/categories` directory and original reference images must be available on the machine running the repair. It does not reseed or delete catalog entries, events, or users.

Each changed record's previous URL is saved before updating in `uploads/image-migration-*.jsonl`. The `.summary.json` report lists repaired files, category fallback replacements, and originals that could not be recovered. Unavailable personal images and event covers are left unchanged for manual re-upload; dashboard placeholders keep those failures visible without broken image elements. Missing originals cannot be recreated by changing the storage setting.

The dashboard preserves public image URLs returned by the backend, including AWS URLs, and resolves any relative paths through one shared URL helper. Changing `BACKEND_PUBLIC_URL` changes the URLs returned for local database paths without rewriting those paths. Legacy absolute database URLs remain compatible; `images:migrate-local` converts existing local references into relative paths where the files are present. Restart its dev server or rebuild the dashboard after changing `VITE_API_URL`.

Validation: `npm run typecheck` and `npm run test:storage` in the backend; `npm run build` and `npm run test:images` in the dashboard.

Catalog image flow: admin forms send multipart `imageUrl` files to POST/PATCH `/api/v1/categories`, `/api/v1/subcategories`, or `/api/v1/programs` (PATCH includes the record ID). Multer receives the file; the shared storage service saves it on disk or S3; the record stores the resulting relative local path (or absolute S3 URL in AWS mode). GET responses expose the constructed public `imageUrl` to the dashboard and main app. The dashboard renders only that API value for catalog images and refetches records after an admin update. A missing or broken image shows an unavailable indicator, without substituting a frontend category or reference photo.

If the backend is already running in a terminal that can reach PostgreSQL, reference images can be assigned through its authenticated admin API instead of connecting directly to the database:

```sh
npm run images:upload-reference -- --api-base=http://127.0.0.1:2001
```

This logs in using `ADMIN_EMAIL`/`ADMIN_PASSWORD` from the environment or adjacent dashboard `.env`, uploads each original through the existing multipart PATCH endpoints, and checks that the returned image URL is accessible. Each original record URL is saved in `uploads/reference-api-updates-*.jsonl`. It does not write any images into the dashboard project.

All dashboard category, subcategory, program, event, and profile upload forms and the upload script use `appendImageFile` from `src/utils/imageUpload.js`. The storage choice is made exclusively by the backend; the dashboard never uploads directly to S3.
