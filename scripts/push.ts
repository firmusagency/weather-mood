import { createECDH } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import webpush from 'web-push';
import { dbEnv, deleteRow, fetchAll, patchRow, type DbEnv } from './db';

/*
 * Sends the evening message (and the morning plan B) as web push notifications to every browser
 * that opted in on the guest page. Needs the VAPID private key (GitHub secret VAPID_PRIVATE_KEY)
 * and the database service key; without them the scripts simply skip this step.
 */

export interface PushEnv {
  db: DbEnv;
  publicKey: string;
  privateKey: string;
  subject: string;
}

/** The public key is not a secret and is committed in .env for the page build; the scripts may read it from there. */
function publicKeyFromDotEnv(): string | undefined {
  try {
    const file = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
    return readFileSync(file, 'utf8').match(/^VITE_VAPID_PUBLIC_KEY=(.+)$/m)?.[1]?.trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * A VAPID key as web-push wants it: URL-safe base64 without padding. Secrets pasted into a settings
 * page often carry quotes, spaces, a trailing newline, "=" padding or the standard +/ alphabet.
 */
export function cleanVapidKey(raw: string | undefined): string | undefined {
  const k = raw?.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return k || undefined;
}

const B64 = /^[A-Za-z0-9_-]+$/;
const normalize = (t: string) => t.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * The private key out of whatever was pasted into the secret. People paste the generator's whole
 * output ("Public Key: … Private Key: …"), a JSON object, or a line with a label: when the text
 * holds exactly one 43-character base64 token, that token is the key.
 */
export function extractPrivateKey(raw: string | undefined): string | undefined {
  const clean = cleanVapidKey(raw);
  if (clean && B64.test(clean) && clean.length === 43) return clean;
  const tokens = [...new Set((raw ?? '').match(/[A-Za-z0-9_+/-]{20,}={0,2}/g)?.map(normalize) ?? [])].filter((t) => t.length === 43);
  return tokens.length === 1 ? tokens[0] : undefined;
}

/** The public key that belongs to a private key (uncompressed P-256 point, URL-safe base64). */
export function publicKeyFor(privateKey: string): string | null {
  try {
    const ecdh = createECDH('prime256v1');
    ecdh.setPrivateKey(Buffer.from(privateKey, 'base64url'));
    return ecdh.getPublicKey().toString('base64url');
  } catch {
    return null;
  }
}

/**
 * Why the private key cannot be used, in words for the log; null when it is usable. Describes the
 * shape of what is stored (lengths, kind of text), never the value.
 */
export function privateKeyProblem(raw: string | undefined, publicKey?: string): string | null {
  if (!raw?.trim()) return 'secret VAPID_PRIVATE_KEY is empty';
  const key = extractPrivateKey(raw);
  if (!key) {
    const clean = cleanVapidKey(raw) ?? '';
    const tokens = (raw.match(/[A-Za-z0-9_+/-]{20,}={0,2}/g) ?? []).map((t) => normalize(t).length);
    const shape =
      raw.split('.').length === 3 && raw.trim().startsWith('ey')
        ? 'it looks like a JWT (a Supabase or other API key), not a VAPID key'
        : B64.test(clean) && clean.length === 87
          ? 'it is 87 characters long: that is the PUBLIC key; the private key has 43'
          : tokens.filter((n) => n === 43).length > 1
            ? 'it holds more than one 43-character token, so the private key cannot be told apart'
            : `it is ${raw.trim().length} characters long and holds base64 tokens of lengths [${tokens.join(', ') || 'none'}]; a VAPID private key is one token of 43`;
    return `secret VAPID_PRIVATE_KEY is not a VAPID private key: ${shape}`;
  }
  const derived = publicKeyFor(key);
  if (!derived) return 'secret VAPID_PRIVATE_KEY has the right length but is not a valid P-256 key';
  if (publicKey && derived !== publicKey) {
    return 'secret VAPID_PRIVATE_KEY is a valid key but does not belong to the public key the guest page uses (VITE_VAPID_PUBLIC_KEY in .env): the two were not generated together';
  }
  return null;
}

const publicKeyOf = (env: NodeJS.ProcessEnv) => cleanVapidKey(env.VAPID_PUBLIC_KEY || env.VITE_VAPID_PUBLIC_KEY || publicKeyFromDotEnv());

/** Names (never values) of the settings push still needs; empty when it can send. */
export function pushMissing(env = process.env): string[] {
  const missing: string[] = [];
  if (!env.SUPABASE_URL) missing.push('secret SUPABASE_URL');
  if (!env.SUPABASE_SERVICE_KEY) missing.push('secret SUPABASE_SERVICE_KEY');
  if (!publicKeyOf(env)) missing.push('variable VAPID_PUBLIC_KEY');
  const problem = privateKeyProblem(env.VAPID_PRIVATE_KEY, publicKeyOf(env));
  if (problem) missing.push(problem);
  return missing;
}

export function pushEnv(env = process.env): PushEnv | null {
  const db = dbEnv(env);
  const publicKey = publicKeyOf(env);
  const privateKey = extractPrivateKey(env.VAPID_PRIVATE_KEY);
  if (!db || !publicKey || !privateKey || privateKeyProblem(env.VAPID_PRIVATE_KEY, publicKey)) return null;
  return { db, publicKey, privateKey, subject: env.VAPID_SUBJECT || 'mailto:hello@weathermood.gr' };
}

export interface Subscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  lang: string | null;
  profile: string | null;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

const MAX_FAILURES = 5;

/** Sends one notification per subscription of the property; `build` returns null to skip a subscriber. */
export async function sendPush(cfg: PushEnv, propertyId: string, build: (sub: Subscription) => PushPayload | null): Promise<{ sent: number; removed: number; failed: number }> {
  webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
  const subs = await fetchAll<Subscription>(cfg.db, 'push_subscriptions', `select=id,endpoint,p256dh,auth,lang,profile,failures&property_id=eq.${encodeURIComponent(propertyId)}`);
  let sent = 0;
  let removed = 0;
  let failed = 0;
  for (const sub of subs) {
    const payload = build(sub);
    if (!payload) continue;
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 6 * 3600, urgency: 'normal' });
      await patchRow(cfg.db, 'push_subscriptions', sub.id, { last_sent_at: new Date().toISOString(), failures: 0 });
      sent += 1;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      const failures = ((sub as unknown as { failures?: number }).failures ?? 0) + 1;
      if (status === 404 || status === 410 || failures >= MAX_FAILURES) {
        await deleteRow(cfg.db, 'push_subscriptions', sub.id);
        removed += 1;
      } else {
        await patchRow(cfg.db, 'push_subscriptions', sub.id, { failures });
        failed += 1;
      }
    }
  }
  return { sent, removed, failed };
}

/** Title + first useful lines of a plain-text message, for a notification body. */
export function notificationFromMessage(message: string, maxChars = 220): string {
  const lines = message.split('\n').map((l) => l.trim()).filter(Boolean);
  // drop the greeting; keep the weather line and the picks
  const body = lines.slice(1).filter((l) => !/^https?:\/\//.test(l));
  let out = '';
  for (const l of body) {
    if ((out + '\n' + l).length > maxChars) break;
    out = out ? `${out}\n${l}` : l;
  }
  return out || lines[0] || '';
}
