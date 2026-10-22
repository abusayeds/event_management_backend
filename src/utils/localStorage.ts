import { promises as fs, copyFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import config from '../config';

export const uploadRoot = path.resolve(config.storage.uploadDir);
const defaultPicture = path.join(uploadRoot, 'profiles/images/default-user.svg');
if (!existsSync(defaultPicture)) {
  mkdirSync(path.dirname(defaultPicture), { recursive: true });
  copyFileSync(path.resolve('assets/default-user.svg'), defaultPicture);
}

export const localPath = (key: string): string => {
  if (!key || key.includes('\\') || key.split('/').some(part => part === '..' || part === '.')) {
    throw new Error('Invalid storage key');
  }
  const target = path.resolve(uploadRoot, key);
  if (!target.startsWith(`${uploadRoot}${path.sep}`)) throw new Error('Invalid storage key');
  return target;
};

export const localStoredPath = (key: string): string =>
  `/uploads/${key.split('/').map(encodeURIComponent).join('/')}`;

export const localUrl = (key: string): string => `${config.backend.baseUrl}${localStoredPath(key)}`;

export const writeLocalFile = async (buffer: Buffer, key: string): Promise<string> => {
  const target = localPath(key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);
  return localStoredPath(key);
};

export const deleteLocalFile = async (key: string): Promise<void> => {
  await fs.rm(localPath(key), { force: true });
};

export const localKeyFromUrl = (value: string): string | null => {
  const url = new URL(value, config.backend.baseUrl);
  if (!url.pathname.startsWith('/uploads/')) return null;
  // Only files belonging to this backend may be removed.
  if (url.origin !== new URL(config.backend.baseUrl).origin) return null;
  const key = decodeURIComponent(url.pathname.slice('/uploads/'.length));
  localPath(key);
  return key;
};
