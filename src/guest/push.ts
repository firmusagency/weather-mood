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

/** Why the last attempt to subscribe failed ('' when it did not). */
export let lastPushError = '';

/**
 * iPhone or iPad showing the page in a browser tab: Apple delivers web push only to a page installed
 * on the Home Screen, so PushManager does not exist here and the guest needs to be told how to get it.
 */
export function iosNeedsInstall(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  return ios && !standalone && !('PushManager' in window) && !!VAPID_PUBLIC_KEY && feedbackEnabled();
}

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

const SEEN_KEY = 'wm:push-seen';

/**
 * Notifications lapse when the page stays closed for ten days (scripts/push.ts): the guest has gone home.
 * A guest who comes back, or stayed longer, opens the page and is registered again here, with the
 * subscription the browser already holds: no prompt, at most once a day.
 */
export async function refreshPush(propertyId: string, lang: string, profile: ProfileId, today = new Date().toISOString().slice(0, 10)): Promise<PushState> {
  if (pushState() !== 'on') return pushState();
  try {
    if (localStorage.getItem(SEEN_KEY) === today) return 'on';
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) {
      // the browser dropped the subscription (site data cleared, permission reset): offer the button again
      localStorage.removeItem('wm:push');
      return 'off';
    }
    const j = sub.toJSON();
    // 201 when the row had lapsed, 409 when it is still there: both are fine
    const res = await fetch(`${FEEDBACK_API.url}/rest/v1/push_subscriptions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: FEEDBACK_API.key, authorization: `Bearer ${FEEDBACK_API.key}`, prefer: 'return=minimal' },
      body: JSON.stringify({ property_id: propertyId, endpoint: sub.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth, lang, profile, client_id: clientId(), app_version: APP_VERSION }),
    });
    if (res.ok || res.status === 409) localStorage.setItem(SEEN_KEY, today);
  } catch {
    /* offline or blocked: try again at the next page load */
  }
  return pushState();
}

/** Turns notifications off on this device. The stored subscription dies with it and is removed at the next send. */
export async function disablePush(): Promise<PushState> {
  try {
    const reg = await navigator.serviceWorker.ready;
    await (await reg.pushManager.getSubscription())?.unsubscribe();
  } catch {
    /* nothing to unsubscribe from */
  }
  try {
    localStorage.removeItem('wm:push');
    localStorage.removeItem(KEY_USED);
  } catch {
    /* private mode */
  }
  return pushState();
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
    if (existing && !sameKey(existing.options?.applicationServerKey, key)) {
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
    if (!res.ok && res.status !== 409) {
      lastPushError = `HTTP ${res.status}`;
      return 'off';
    }
    localStorage.setItem('wm:push', 'on');
    localStorage.setItem(KEY_USED, VAPID_PUBLIC_KEY);
    lastPushError = '';
    return 'on';
  } catch (e) {
    // the browser's own short reason (NotAllowedError, InvalidStateError…), shown to the guest so a failure is not silent
    lastPushError = (e as Error)?.name || 'error';
    return 'off';
  }
}
