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

export function pushEnv(env = process.env): PushEnv | null {
  const db = dbEnv(env);
  const publicKey = env.VAPID_PUBLIC_KEY || env.VITE_VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY;
  if (!db || !publicKey || !privateKey) return null;
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
