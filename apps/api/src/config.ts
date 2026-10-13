import 'dotenv/config';
export function config() {
  const secret = process.env.JWT_SECRET ?? '';
  if (secret.length < 32 || secret.startsWith('replace_')) throw new Error('JWT_SECRET must contain at least 32 random characters');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const origin = process.env.WEB_ORIGIN ?? 'http://localhost:6001';
  if (new URL(origin).origin !== origin) throw new Error('WEB_ORIGIN must be an exact origin, without trailing slash');
  const secure = process.env.COOKIE_SECURE === 'true';
  if (process.env.NODE_ENV === 'production' && (!secure || !origin.startsWith('https://'))) throw new Error('Production requires HTTPS WEB_ORIGIN and COOKIE_SECURE=true');
  return { secret, origin, secure, accessSeconds: 900, refreshMs: 7 * 86400000 };
}
