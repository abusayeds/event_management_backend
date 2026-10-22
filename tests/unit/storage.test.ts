import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { promises as fs } from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import request from 'supertest';
import express from 'express';
import { spawnSync } from 'child_process';

const root = path.resolve('uploads');
test('image API diagnostics identify missing deployments, forbidden access, and proxy failures', async () => {
  const { readImageApiResponse } = await import('../../src/utils/imageApiResponse');
  await assert.rejects(
    readImageApiResponse(
      new Response(JSON.stringify({ message: 'Route not found' }), { status: 404 }),
      'Image API check (category)'
    ),
    /HTTP 404.*Restart\/deploy/
  );
  await assert.rejects(
    readImageApiResponse(
      new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 }),
      'Image API check'
    ),
    /HTTP 403.*active administrator/
  );
  await assert.rejects(
    readImageApiResponse(
      new Response('<html>Bad gateway</html>', { status: 502 }),
      'Dashboard branding'
    ),
    /HTTP 502/
  );
  await assert.rejects(
    readImageApiResponse(
      new Response('<html>Proxy page</html>', { status: 200 }),
      'Image API check'
    ),
    /invalid JSON/
  );
  assert.deepEqual(
    await readImageApiResponse(new Response(JSON.stringify({ data: [] })), 'Image API check'),
    { data: [] }
  );
});
const ready = (async () => {
  await fs.mkdir(root, { recursive: true });
  const dir = await fs.mkdtemp(path.join(root, '.storage-test-'));
  process.env.USE_AWS = 'false';
  process.env.REDIS_ENABLED = 'false';
  process.env.QUEUE_WORKERS_ENABLED = 'false';
  process.env.ENABLE_FILE_LOGGING = 'false';
  process.env.UPLOAD_DIR = dir;
  process.env.BACKEND_PUBLIC_URL = 'https://example.test';
  const storage = await import('../../src/utils/s3Upload');
  const local = await import('../../src/utils/localStorage');
  const { default: config } = await import('../../src/config');
  return { storage, local, config, dir };
})();

test('admin media API covers every schema image field, stores relative paths, and serves original bytes', async () => {
  const { local, config } = await ready;
  const { MediaRoutes, imageModels } = await import('../../src/modules/media/media.routes');
  const { database } = await import('../../src/config/database');
  const { UserRepository } = await import('../../src/modules/user/user.repository');
  const { generateAccessToken } = await import('../../src/utils/generateToken');
  const { default: errorHandler } = await import('../../src/middleware/errorHandler.middleware');
  const originalUser = UserRepository.getUserByIdPublic;
  let role = 'ADMIN';
  UserRepository.getUserByIdPublic = (async () => ({
    id: 'admin',
    role,
    status: 'ACTIVE',
    email: 'admin@example.test',
  })) as typeof originalUser;
  const token = generateAccessToken('admin', 'admin@example.test', 'ADMIN');
  const authorization = `Bearer ${token}`;
  const app = express();
  app.use(express.json());
  app.use('/uploads', express.static(local.uploadRoot));
  app.use('/api/v1/media', MediaRoutes);
  app.use(errorHandler);
  const bytes = await fs.readFile('assets/dashboard/logo.png');
  const schemaImages: string[] = [];
  for (const file of await fs.readdir('prisma/schema')) {
    const source = await fs.readFile(path.join('prisma/schema', file), 'utf8');
    for (const block of source.matchAll(/model\s+(\w+)\s*\{([^}]+)\}/g)) {
      if (/\b(imageUrl|coverImage|profilePicture|image)\s+String/.test(block[2]))
        schemaImages.push(block[1].toLowerCase());
    }
  }
  assert.deepEqual(schemaImages.sort(), Object.keys(imageModels).sort());
  try {
    await request(app).get('/api/v1/media/images/category').expect(401);
    role = 'USER';
    await request(app)
      .get('/api/v1/media/images/category')
      .set('Authorization', authorization)
      .expect(403);
    role = 'ADMIN';
    await request(app)
      .get('/api/v1/media/images/__proto__')
      .set('Authorization', authorization)
      .expect(400);
    for (const model of Object.keys(imageModels) as (keyof typeof imageModels)[]) {
      const repository = database[model];
      const originals = {
        findMany: repository.findMany,
        findUnique: repository.findUnique,
        count: repository.count,
        updateMany: repository.updateMany,
      };
      const { field, name } = imageModels[model];
      const row: Record<string, unknown> = {
        id: 'image-record',
        [name]: model,
        [field]: 'https://old.example/image.png',
      };
      let conflict = false;
      repository.findMany = (async () => [row]) as typeof repository.findMany;
      repository.findUnique = (async () => row) as typeof repository.findUnique;
      repository.count = (async () => 1) as typeof repository.count;
      repository.updateMany = (async (args: {
        data: Record<string, unknown>;
        where: Record<string, unknown>;
      }) => {
        assert.equal(args.where[field], row[field]);
        if (conflict) return { count: 0 };
        Object.assign(row, args.data);
        return { count: 1 };
      }) as typeof repository.updateMany;
      try {
        const result = await request(app)
          .patch(`/api/v1/media/images/${model}/image-record`)
          .set('Authorization', authorization)
          .attach('image', bytes, 'real.png')
          .expect(200);
        assert.match(String(row[field]), /^\/uploads\//);
        assert.equal(result.body.data.imageUrl, `${config.backend.baseUrl}${row[field]}`);
        const file = await request(app).get(String(row[field])).expect(200);
        assert.deepEqual(file.body, bytes);
        const listed = await request(app)
          .get(`/api/v1/media/images/${model}`)
          .set('Authorization', authorization)
          .expect(200);
        assert.equal(listed.body.data[0].imageUrl, result.body.data.imageUrl);
        assert.equal(listed.body.meta.total, 1);
        const oldFiles = await fs.readdir(
          path.dirname(local.localPath(decodeURIComponent(String(row[field]).slice(9))))
        );
        conflict = true;
        await request(app)
          .patch(`/api/v1/media/images/${model}/image-record`)
          .set('Authorization', authorization)
          .attach('image', bytes, 'conflict.png')
          .expect(409);
        const newFiles = await fs.readdir(
          path.dirname(local.localPath(decodeURIComponent(String(row[field]).slice(9))))
        );
        assert.deepEqual(
          newFiles.sort(),
          oldFiles.sort(),
          'Failed update must clean up its newly uploaded file.'
        );
      } finally {
        Object.assign(repository, originals);
      }
    }
    const assets = await request(app).get('/api/v1/media/assets').expect(200);
    assert.equal(assets.body.data.length, 6);
    for (const asset of assets.body.data)
      await request(app).get(new URL(asset.imageUrl).pathname).expect(200);
    const saved = await request(app)
      .patch('/api/v1/media/assets/logo')
      .set('Authorization', authorization)
      .attach('image', bytes, 'logo.png')
      .expect(200);
    const reloaded = await request(app).get('/api/v1/media/assets').expect(200);
    assert.equal(
      reloaded.body.data.find((item: { id: string }) => item.id === 'logo').imageUrl,
      saved.body.data.imageUrl
    );
    await request(app).get('/uploads/.dashboard-assets/logo.json').expect(404);
  } finally {
    UserRepository.getUserByIdPublic = originalUser;
  }
});

test('family creation and image-only updates and notification creation persist multipart images', async () => {
  const { local } = await ready;
  const { database } = await import('../../src/config/database');
  const { UserRepository } = await import('../../src/modules/user/user.repository');
  const { FamilyRepository } = await import('../../src/modules/family/family.repository');
  const { NotificationRepository } =
    await import('../../src/modules/notification/notification.repository');
  const { default: queue } = await import('../../src/jobs/queues/notification.queue');
  const { FamilyRoutes } = await import('../../src/modules/family/family.routes');
  const { NotificationRoutes } = await import('../../src/modules/notification/notification.routes');
  const { generateAccessToken } = await import('../../src/utils/generateToken');
  const { default: errorHandler } = await import('../../src/middleware/errorHandler.middleware');
  const saved = {
    publicUser: UserRepository.getUserByIdPublic,
    user: UserRepository.getUserById,
    familyName: FamilyRepository.getFamilyByName,
    family: FamilyRepository.getFamily,
    create: database.family.create,
    update: database.family.update,
    notification: NotificationRepository.createNotification,
    unread: NotificationRepository.getUnreadCount,
    add: queue.add,
  };
  let role = 'USER';
  UserRepository.getUserByIdPublic = (async () => ({
    role,
    status: 'ACTIVE',
    email: 'admin@example.test',
  })) as typeof saved.publicUser;
  UserRepository.getUserById = (async () => ({ hasSeparateAccount: true })) as typeof saved.user;
  FamilyRepository.getFamilyByName = (async () => null) as typeof saved.familyName;
  FamilyRepository.getFamily = (async () => ({
    id: 'family',
    name: 'Family',
  })) as typeof saved.family;
  database.family.create = (async (args: { data: object }) => ({
    id: 'family',
    ...args.data,
  })) as typeof saved.create;
  database.family.update = (async (args: { data: object }) => ({
    id: 'family',
    ...args.data,
  })) as typeof saved.update;
  NotificationRepository.createNotification = (async (payload: object) => ({
    id: 'notification',
    ...payload,
  })) as typeof saved.notification;
  NotificationRepository.getUnreadCount = (async () => 0) as typeof saved.unread;
  queue.add = (async () => ({})) as typeof saved.add;
  const app = express();
  app.use('/uploads', express.static(local.uploadRoot));
  app.use('/families', FamilyRoutes);
  app.use('/notifications', NotificationRoutes);
  app.use(errorHandler);
  const auth = `Bearer ${generateAccessToken('admin', 'admin@example.test', 'ADMIN')}`;
  const bytes = await fs.readFile('assets/dashboard/logo.png');
  try {
    const created = await request(app)
      .post('/families')
      .set('Authorization', auth)
      .field('name', 'Family')
      .attach('imageUrl', bytes, 'family.png')
      .expect(201);
    assert.match(created.body.data.imageUrl, /\/uploads\/families\/images\//);
    await request(app).get(new URL(created.body.data.imageUrl).pathname).expect(200);
    const updated = await request(app)
      .patch('/families/family')
      .set('Authorization', auth)
      .attach('imageUrl', bytes, 'replacement.png')
      .expect(200);
    assert.notEqual(updated.body.data.imageUrl, created.body.data.imageUrl);
    await request(app).get(new URL(updated.body.data.imageUrl).pathname).expect(200);
    role = 'ADMIN';
    const notification = await request(app)
      .post('/notifications')
      .set('Authorization', auth)
      .field('recipientId', 'c58a5720-6f98-4a78-b70f-9a0ecbd5f4a2')
      .field('type', 'System')
      .field('title', 'Announcement')
      .field('message', 'Image test')
      .attach('image', bytes, 'notice.png');
    assert.equal(notification.status, 201, JSON.stringify(notification.body));
    assert.match(notification.body.data.image, /\/uploads\/notifications\/images\//);
    await request(app).get(new URL(notification.body.data.image).pathname).expect(200);
  } finally {
    UserRepository.getUserByIdPublic = saved.publicUser;
    UserRepository.getUserById = saved.user;
    FamilyRepository.getFamilyByName = saved.familyName;
    FamilyRepository.getFamily = saved.family;
    database.family.create = saved.create;
    database.family.update = saved.update;
    NotificationRepository.createNotification = saved.notification;
    NotificationRepository.getUnreadCount = saved.unread;
    queue.add = saved.add;
  }
});

test('AWS is opt-in: unset, false, and invalid values all default to local storage', async () => {
  const { dir } = await ready;
  for (const value of [undefined, 'false', 'invalid', 'true']) {
    const env = { ...process.env };
    if (value === undefined) delete env.USE_AWS;
    else env.USE_AWS = value;
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        '-e',
        `console.log('storage-mode=' + require(${JSON.stringify(path.resolve('src/config/index.ts'))}).default.storage.useAws)`,
      ],
      { cwd: dir, env, encoding: 'utf8' }
    );
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes(`storage-mode=${value === 'true'}`));
  }
});

test('local mode never contacts AWS even when AWS credentials are configured', async () => {
  const { storage } = await ready;
  const send = S3Client.prototype.send;
  let calls = 0;
  S3Client.prototype.send = (async () => {
    calls++;
    throw new Error('Unexpected AWS request');
  }) as typeof send;
  try {
    const bytes = Buffer.from('local only');
    const result = await storage.uploadSingleFileToS3(
      {
        originalname: 'local.png',
        mimetype: 'image/png',
        size: bytes.length,
        buffer: bytes,
      } as Express.Multer.File,
      'profiles'
    );
    assert.match(result.url, /^\/uploads\/profiles\//);
    assert.equal(
      await storage.uploadBufferWithKey(bytes, 'programs/images/local-buffer.png', 'image/png'),
      '/uploads/programs/images/local-buffer.png'
    );
    assert.equal(calls, 0);
  } finally {
    S3Client.prototype.send = send;
  }
});

test('API serialization constructs nested image URLs without modifying database values or dates', async () => {
  const { config } = await ready;
  const { serializeImageUrls } = await import('../../src/utils/imageUrls');
  const date = new Date('2026-10-06T00:00:00Z');
  const aws = 'https://bucket.s3.us-east-1.amazonaws.com/uploads/images/image.png';
  const record = {
    imageUrl: '/uploads/categories/images/original.png',
    createdAt: date,
    creator: { profilePicture: '/uploads/profiles/images/default-user.svg' },
    coverImage: aws,
    registrationPortal: '/uploads/other-route',
  };
  const result = serializeImageUrls({ data: [record] });
  assert.equal(result.data[0].imageUrl, `https://example.test${record.imageUrl}`);
  assert.equal(
    result.data[0].creator.profilePicture,
    'https://example.test/uploads/profiles/images/default-user.svg'
  );
  assert.equal(result.data[0].coverImage, aws);
  assert.equal(result.data[0].registrationPortal, record.registrationPortal);
  assert.equal(result.data[0].createdAt, date);
  assert.equal(record.imageUrl, '/uploads/categories/images/original.png');
  const previousBase = config.backend.baseUrl;
  try {
    config.backend.baseUrl = 'https://new-backend.test';
    assert.equal(
      serializeImageUrls(record).imageUrl,
      'https://new-backend.test/uploads/categories/images/original.png'
    );
  } finally {
    config.backend.baseUrl = previousBase;
  }
});

test('Multer upload persists bytes and public static route serves cross-origin images', async () => {
  const { storage } = await ready;
  const { upload } = await import('../../src/middleware/upload.middleware');
  const { default: app } = await import('../../src/app');
  const testApp = express();
  testApp.post('/test-upload', upload.single('imageUrl'), async (req, res) => {
    res.json(await storage.uploadSingleFileToS3(req.file!, 'categories'));
  });
  testApp.use(app);
  const bytes = Buffer.from('image fixture');
  const result = await request(testApp)
    .post('/test-upload')
    .attach('imageUrl', bytes, { filename: 'My photo.png', contentType: 'image/png' })
    .expect(200);
  assert.match(result.body.url, /^\/uploads\/categories\/images\/my-photo-/);
  assert.equal(result.body.size, bytes.length);
  assert.equal(await storage.checkFileExists(result.body.key), true);
  const image = await request(testApp).get(result.body.url).expect(200);
  assert.deepEqual(image.body, bytes);
  assert.equal(image.headers['cross-origin-resource-policy'], 'cross-origin');
  await storage.deleteFileFromS3(result.body.url);
  await request(testApp).get(result.body.url).expect(404);
});

test('category multipart update saves an API image URL and serves the new image', async () => {
  const { storage, dir } = await ready;
  const { CategoryRepository } = await import('../../src/modules/category/category.repository');
  const { CategoryController } = await import('../../src/modules/category/category.controller');
  const { upload } = await import('../../src/middleware/upload.middleware');
  const { default: app } = await import('../../src/app');
  const first = Buffer.from('original category image');
  const next = Buffer.from('admin replacement image');
  const original = await storage.uploadBufferWithKey(
    first,
    'categories/images/original.png',
    'image/png'
  );
  let record = {
    id: 'category-test',
    name: 'Musical',
    description: null,
    imageUrl: original,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const methods = {
    getCategoryById: CategoryRepository.getCategoryById,
    updateCategoryById: CategoryRepository.updateCategoryById,
    getAllCategories: CategoryRepository.getAllCategories,
  };
  CategoryRepository.getCategoryById = async () => ({ ...record });
  CategoryRepository.updateCategoryById = async (_id, payload) => {
    record = { ...record, ...payload };
    return { ...record };
  };
  CategoryRepository.getAllCategories = async () => ({
    data: [{ ...record }],
    meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
  });
  try {
    const testApp = express();
    // Production controllers, Multer, storage, and static serving; DB isolated in memory.
    testApp.patch('/categories/:id', upload.single('imageUrl'), CategoryController.updateCategory);
    testApp.get('/categories', CategoryController.getAllCategories);
    testApp.use(app);
    const result = await request(testApp)
      .patch('/categories/category-test')
      .attach('imageUrl', next, { filename: 'updated.png', contentType: 'image/png' })
      .expect(200);
    assert.match(record.imageUrl, /^\/uploads\//);
    assert.equal(result.body.data.imageUrl, `https://example.test${record.imageUrl}`);
    assert.notEqual(record.imageUrl, original);
    const list = await request(testApp).get('/categories').expect(200);
    assert.equal(list.body.data[0].imageUrl, `https://example.test${record.imageUrl}`);
    const image = await request(testApp).get(record.imageUrl).expect(200);
    assert.deepEqual(image.body, next);
    await request(testApp).get(original).expect(404);
    const { uploadReferenceViaApi } = await import('../../src/utils/uploadReferenceViaApi');
    const sourcePath = path.join(dir, 'api-source.png');
    const referenceBytes = Buffer.from('original reference image sent through API');
    await fs.writeFile(sourcePath, referenceBytes);
    const apiApp = express();
    apiApp.use(express.json());
    apiApp.post('/api/v1/auth/login', (_req, res) =>
      res.json({ data: { tokens: { accessToken: 'test-token' } } })
    );
    apiApp.get('/api/v1/subcategories', (_req, res) =>
      res.json({ data: [], meta: { totalPages: 0 } })
    );
    apiApp.get('/api/v1/programs', (_req, res) => res.json({ data: [], meta: { totalPages: 0 } }));
    apiApp.use('/api/v1', testApp);
    apiApp.use(app);
    const server = apiApp.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const previousEmail = process.env.ADMIN_EMAIL;
    const previousPassword = process.env.ADMIN_PASSWORD;
    process.env.ADMIN_EMAIL = 'test@example.test';
    process.env.ADMIN_PASSWORD = 'test-password';
    try {
      await uploadReferenceViaApi(`http://127.0.0.1:${address.port}`, [
        {
          model: 'category',
          name: 'Musical',
          categoryName: 'Musical',
          programName: 'Piano',
          filePath: sourcePath,
        },
      ]);
      assert.match(record.imageUrl, /^\/uploads\//);
      const saved = await request(app).get(record.imageUrl).expect(200);
      assert.deepEqual(saved.body, referenceBytes);
    } finally {
      if (previousEmail === undefined) delete process.env.ADMIN_EMAIL;
      else process.env.ADMIN_EMAIL = previousEmail;
      if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
      else process.env.ADMIN_PASSWORD = previousPassword;
      await new Promise<void>((resolve, reject) =>
        server.close(error => (error ? reject(error) : resolve()))
      );
    }
  } finally {
    Object.assign(CategoryRepository, methods);
  }
});

test('the four legacy S3 categories are persisted locally and returned through the category API', async () => {
  const { local, config } = await ready;
  const { repairCategoryImages } = await import('../../src/utils/repairCategoryImages');
  const { CategoryRepository } = await import('../../src/modules/category/category.repository');
  const { CategoryController } = await import('../../src/modules/category/category.controller');
  const { default: app } = await import('../../src/app');
  const rows = [
    {
      id: 'c58a5720-6f98-4a78-b70f-9a0ecbd5f4a2',
      name: 'Food & Drink',
      imageUrl:
        'https://areawins.s3.us-east-2.amazonaws.com/categories/images/food-drink-1785730230522-4f587433.png',
    },
    {
      id: '3910f703-a3bf-44f6-841a-2c9f950b4010',
      name: 'Art',
      imageUrl:
        'https://areawins.s3.us-east-2.amazonaws.com/categories/images/arts-1785730235642-53fea627.png',
    },
    {
      id: '9778eb4c-69cd-4875-8801-897c446765f8',
      name: 'Sport',
      imageUrl:
        'https://areawins.s3.us-east-2.amazonaws.com/categories/images/sports-1785730240340-04851c18.png',
    },
    {
      id: '63a30bd0-2768-4341-84fb-0ac7f9879520',
      name: 'Musical',
      imageUrl:
        'https://areawins.s3.us-east-2.amazonaws.com/categories/images/images-1785730601196-f07c8a9c.jpg',
    },
  ];
  const sourceManifest = JSON.parse(
    await fs.readFile(path.resolve('uploads/reference-image-manifest.json'), 'utf8')
  ) as { model: string; name: string; key: string }[];
  const manifest = sourceManifest.filter(item => item.model === 'category');
  for (const item of manifest) {
    await local.writeLocalFile(await fs.readFile(path.resolve('uploads', item.key)), item.key);
  }
  await fs.writeFile(
    path.join(local.uploadRoot, 'reference-image-manifest.json'),
    JSON.stringify(manifest)
  );
  const store = {
    list: async () => rows.map(row => ({ ...row })),
    updateIfUnchanged: async (id: string, oldPath: string | null, newPath: string) => {
      const row = rows.find(item => item.id === id && item.imageUrl === oldPath);
      if (!row) return false;
      row.imageUrl = newPath;
      return true;
    },
  };
  const result = await repairCategoryImages(store);
  assert.equal(result.repaired, 4);
  assert.deepEqual(result.unavailable, []);
  assert.ok(
    rows.every(row => row.imageUrl.startsWith(`/uploads/categories/images/imported-${row.id}`))
  );
  const previousList = CategoryRepository.getAllCategories;
  CategoryRepository.getAllCategories = (async () => ({
    data: rows,
    meta: { total: 4, page: 1, limit: 10, totalPages: 1 },
  })) as typeof previousList;
  try {
    const testApp = express();
    testApp.get('/categories', CategoryController.getAllCategories);
    testApp.use(app);
    const response = await request(testApp).get('/categories').expect(200);
    for (const row of response.body.data) {
      assert.ok(
        row.imageUrl.startsWith(`https://example.test/uploads/categories/images/imported-${row.id}`)
      );
      await request(testApp).get(new URL(row.imageUrl).pathname).expect(200);
    }
    assert.equal((await repairCategoryImages(store)).repaired, 0);
    const adminPath = await local.writeLocalFile(
      Buffer.from('admin image'),
      'categories/images/admin-custom.png'
    );
    rows[0].imageUrl = adminPath;
    assert.equal((await repairCategoryImages(store)).repaired, 0);
    assert.equal(rows[0].imageUrl, adminPath);
    config.storage.useAws = true;
    rows[1].imageUrl =
      'https://areawins.s3.us-east-2.amazonaws.com/categories/images/keep-in-aws.png';
    assert.equal((await repairCategoryImages(store)).repaired, 0);
    assert.ok(rows[1].imageUrl.startsWith('https://areawins.s3.'));
  } finally {
    config.storage.useAws = false;
    CategoryRepository.getAllCategories = previousList;
  }
});

test('local keys cannot escape the upload directory; old AWS deletion is skipped in local mode', async () => {
  const { storage, local } = await ready;
  for (const key of ['../escape.png', '/escape.png', 'x/../../escape.png', 'x\\escape.png']) {
    assert.throws(() => local.localPath(key));
  }
  await storage.deleteFileFromS3('https://bucket.s3.us-east-1.amazonaws.com/old.png');
  await storage.deleteFileFromS3(storage.getDefaultProfilePictureUrl());
  assert.equal(await storage.checkFileExists(storage.DEFAULT_PROFILE_PICTURE_KEY), true);
  await assert.rejects(storage.generatePresignedUrl('photo.png', 'image/png'), /multipart upload/);
});

test('AWS mode still sends S3 metadata and local URLs can still be deleted after switching', async () => {
  const { storage, local, config } = await ready;
  const originalSend = S3Client.prototype.send;
  const sent: unknown[] = [];
  S3Client.prototype.send = (async (command: unknown) => {
    sent.push(command);
    return {};
  }) as typeof originalSend;
  const previousAws = { ...config.aws };
  Object.assign(config.aws, {
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    bucketName: 'test-bucket',
  });
  config.storage.useAws = true;
  try {
    const bytes = Buffer.from('aws fixture');
    const result = await storage.uploadSingleFileToS3(
      {
        originalname: 'image.png',
        mimetype: 'image/png',
        size: bytes.length,
        buffer: bytes,
      } as Express.Multer.File,
      'programs'
    );
    assert.match(result.url, /test-bucket.*programs\/images\//);
    assert.ok(sent[0] instanceof PutObjectCommand);
    assert.deepEqual((sent[0] as PutObjectCommand).input.Body, bytes);
    assert.equal((sent[0] as PutObjectCommand).input.Metadata?.originalName, 'image.png');
    await storage.deleteFileFromS3(result.url);
    assert.ok(sent[1] instanceof DeleteObjectCommand);
    const url = await local.writeLocalFile(bytes, 'programs/images/local.png');
    await storage.deleteFileFromS3(url);
    await assert.rejects(fs.access(local.localPath('programs/images/local.png')));
    assert.equal(sent.length, 2);
  } finally {
    S3Client.prototype.send = originalSend;
    config.storage.useAws = false;
    Object.assign(config.aws, previousAws);
  }
});

after(async () => {
  const { dir } = await ready;
  // Remove only the unique test directory created within the project's uploads root.
  assert.ok(dir.startsWith(`${root}${path.sep}.storage-test-`));
  await fs.rm(dir, { recursive: true, force: true });
});
