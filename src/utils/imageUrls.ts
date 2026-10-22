import config from '../config';

const imageFields = new Set(['imageUrl', 'coverImage', 'profilePicture', 'image', 'avatar', 'url']);

export const publicImageUrl = (storedPath: string): string => {
  if (storedPath.startsWith('/uploads/')) return `${config.backend.baseUrl}${storedPath}`;
  if (storedPath.startsWith('uploads/')) return `${config.backend.baseUrl}/${storedPath}`;
  // AWS and other absolute URLs are already public URLs.
  return storedPath;
};

// Convert image references at the API boundary while preserving dates, decimals,
// and other objects with their own JSON serialization behavior.
export const serializeImageUrls = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map(item => serializeImageUrls(item)) as T;
  if (!value || typeof value !== 'object') return value;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      imageFields.has(key) && typeof item === 'string'
        ? publicImageUrl(item)
        : serializeImageUrls(item),
    ])
  ) as T;
};
