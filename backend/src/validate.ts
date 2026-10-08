export const MAX_URL_LENGTH = 2048;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns the trimmed URL if valid, otherwise null. */
export function normalizeUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const url = input.trim();
  if (url.length === 0 || url.length > MAX_URL_LENGTH) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  return url;
}

export function isValidClientId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}
