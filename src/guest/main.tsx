import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GuestApp } from './GuestApp';
import { EMBEDDED } from '../ui/data';
import './guest.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GuestApp />
  </StrictMode>,
);

/*
 * Installable guest page: manifest + service worker (offline copy of the latest plan, evening
 * push notifications). Not in the single-file demos, which have no files of their own to serve.
 */
if (!EMBEDDED && typeof document !== 'undefined') {
  const base = import.meta.env.BASE_URL;
  const link = (rel: string, href: string, extra: Record<string, string> = {}) => {
    const el = document.createElement('link');
    el.rel = rel;
    el.href = href;
    for (const [k, v] of Object.entries(extra)) el.setAttribute(k, v);
    document.head.appendChild(el);
  };
  link('manifest', `${base}manifest.webmanifest`);
  link('apple-touch-icon', `${base}icons/apple-touch-icon.png`);
  link('icon', `${base}icons/icon-192.png`, { type: 'image/png' });
  const theme = document.createElement('meta');
  theme.name = 'theme-color';
  theme.content = '#2a6f97';
  document.head.appendChild(theme);
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch((e) => console.warn('service worker', e));
    });
  }
}
