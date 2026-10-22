import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { uploadRoot } from './localStorage';
import { uploadBufferWithKey } from './s3Upload';

export const dashboardAssetFiles = {
  logo: 'logo.png',
  authLogo: 'auth-logo.png',
  signinImage: 'signIn.png',
  otpImage: 'otp.png',
  forgetPasswordImage: 'forget.png',
  changePasswordImage: 'changePassword.png',
} as const;
export type DashboardAssetKey = keyof typeof dashboardAssetFiles;
const manifestPath = (key: DashboardAssetKey) =>
  path.join(uploadRoot, '.dashboard-assets', `${key}.json`);
export const saveDashboardAsset = async (key: DashboardAssetKey, imageUrl: string) => {
  const target = manifestPath(key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify({ imageUrl }));
  await fs.rename(temporary, target);
};
const pending = new Map<DashboardAssetKey, Promise<string>>();
export const dashboardAsset = (key: DashboardAssetKey): Promise<string> => {
  let promise = pending.get(key);
  if (!promise) {
    promise = (async () => {
      try {
        const stored = JSON.parse(await fs.readFile(manifestPath(key), 'utf8')) as {
          imageUrl: string;
        };
        return stored.imageUrl;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      const buffer = await fs.readFile(path.resolve('assets/dashboard', dashboardAssetFiles[key]));
      const url = await uploadBufferWithKey(
        buffer,
        `dashboard/images/${dashboardAssetFiles[key]}`,
        'image/png'
      );
      await fs.mkdir(path.dirname(manifestPath(key)), { recursive: true });
      try {
        await fs.writeFile(manifestPath(key), JSON.stringify({ imageUrl: url }), { flag: 'wx' });
        return url;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        // A simultaneous admin upload wins over initial default preparation.
        return (JSON.parse(await fs.readFile(manifestPath(key), 'utf8')) as { imageUrl: string })
          .imageUrl;
      }
    })();
    pending.set(key, promise);
    void promise.finally(() => pending.delete(key)).catch(() => {});
  }
  return promise;
};
