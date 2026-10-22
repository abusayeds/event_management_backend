/** Keep API failures readable, including non-JSON Cloudflare/proxy responses. */
export const readImageApiResponse = async <T>(response: Response, context: string): Promise<T> => {
  const body = await response.text();
  let result: unknown;
  try {
    result = JSON.parse(body);
  } catch {
    /* Proxy errors may be HTML. */
  }
  if (!response.ok) {
    const message =
      result &&
      typeof result === 'object' &&
      'message' in result &&
      typeof result.message === 'string'
        ? ` ${result.message}`
        : '';
    const hint =
      response.status === 404
        ? ' The running backend is missing this image API route. Restart/deploy the updated event-management-backend and ensure the public URL points to that process.'
        : response.status === 401 || response.status === 403
          ? ' Check that the account is an active administrator.'
          : '';
    throw new Error(`${context}: HTTP ${response.status}.${message}${hint}`);
  }
  if (!result || typeof result !== 'object')
    throw new Error(`${context}: HTTP ${response.status} returned an invalid JSON API response.`);
  return result as T;
};
