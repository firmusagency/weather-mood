import type { ProfileId } from '../engine/types';
import { APP_VERSION, FEEDBACK_API, clientId, feedbackEnabled } from './feedback';

/*
 * Web push for the evening message: the browser subscribes through the service worker, the
 * subscription is stored in the database (anon key, insert only), and the nightly scripts send
 * the notification with the VAPID private key (GitHub secret). Free, no WhatsApp Business needed.
 */

const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
export const VAPID_PUBLIC_KEY = viteEnv.VITE_VAPID_PUBLIC_KEY ?? '';

export type PushState = 'unsupported' | 'off' | 'on' | 'denied';

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!VAPID_PUBLIC_KEY && feedbackEnabled();
}

export function pushState(): PushState {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    // "on" only for the key in use now: a subscription made with an older server key no longer receives anything
    return localStorage.getItem('wm:push') === 'on' && localStorage.getItem(KEY_USED) === VAPID_PUBLIC_KEY && Notification.permission === 'granted' ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

const KEY_USED = 'wm:push-key';

/** True when this browser had opted in under a server key that has since been replaced (it can re-subscribe without asking again). */
export function pushNeedsRenewal(): boolean {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  try {
    return localStorage.getItem('wm:push') === 'on' && localStorage.getItem(KEY_USED) !== VAPID_PUBLIC_KEY;
  } catch {
    return false;
  }
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

function keyBytes(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function enablePush(propertyId: string, lang: string, profile: ProfileId): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off';
  try {
    const reg = await navigator.serviceWorker.ready;
    const key = keyBytes(VAPID_PUBLIC_KEY);
    let existing = await reg.pushManager.getSubscription();
    // a subscription bound to a replaced server key is dead weight: drop it and subscribe again
    if (existing && !sameKey(existing.options.applicationServerKey, key)) {
      await existing.unsubscribe();
      existing = null;
    }
    const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key as BufferSource }));
    const j = sub.toJSON();
    const res = await fetch(`${FEEDBACK_API.url}/rest/v1/push_subscriptions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: FEEDBACK_API.key, authorization: `Bearer ${FEEDBACK_API.key}`, prefer: 'return=minimal' },
      body: JSON.stringify({ property_id: propertyId, endpoint: sub.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth, lang, profile, client_id: clientId(), app_version: APP_VERSION }),
    });
    if (!res.ok && res.status !== 409) return 'off';
    localStorage.setItem('wm:push', 'on');
    localStorage.setItem(KEY_USED, VAPID_PUBLIC_KEY);
    return 'on';
  } catch {
    return 'off';
  }
}
