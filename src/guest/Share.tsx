import { useEffect, useState } from 'react';
import { whatsappUrl } from './advice';
import { g } from './i18n';
import type { GuestLang } from './property';

/**
 * Share button: the phone's own share sheet when available (WhatsApp, Messages, AirDrop…),
 * otherwise a WhatsApp link plus Copy. Both fallbacks work inside restricted frames too.
 */
export function ShareButton({ text, title, lang, wide }: { text: string; title: string; lang: GuestLang; wide?: boolean }) {
  const d = g(lang);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const canNative = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (state === 'idle') return;
    const id = window.setTimeout(() => setState('idle'), 2500);
    return () => window.clearTimeout(id);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
  };

  const share = async () => {
    if (canNative) {
      try {
        await navigator.share({ title, text });
        return;
      } catch {
        /* user cancelled or the frame refused: fall through to the menu */
      }
    }
    setOpen((o) => !o);
  };

  return (
    <div className={`g-share ${wide ? 'g-share-wide' : ''}`}>
      <button type="button" className={`g-btn ${wide ? 'g-btn-wide' : ''}`} onClick={share} aria-expanded={open}>
        {d.share}
      </button>
      {open && (
        <div className="g-share-menu" role="group" aria-label={d.share}>
          <a className="g-btn g-btn-wa" href={whatsappUrl(text)} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
          <button type="button" className="g-btn" onClick={copy}>
            {state === 'copied' ? d.copied : d.copy}
          </button>
          {state === 'failed' && <textarea className="g-share-text" readOnly value={text} rows={4} aria-label={d.copyFailed} />}
        </div>
      )}
    </div>
  );
}
