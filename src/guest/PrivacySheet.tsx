import { useEffect, useRef } from 'react';
import { clientId } from './feedback';
import { g } from './i18n';
import { PRIVACY_PROVIDER, privacyNotice } from './privacy';
import type { GuestLang, Property } from './property';

/** The privacy note, as a sheet over the guest page (also opened directly by guest.html#privacy). */
export function PrivacySheet({ property, lang, onClose }: { property: Property; lang: GuestLang; onClose: () => void }) {
  const d = g(lang);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const n = privacyNotice(lang, { property: property.name, contact: property.privacyContact || PRIVACY_PROVIDER.contact || undefined, operator: PRIVACY_PROVIDER.operator || undefined, code: clientId() });

  return (
    <div className="g-sheet-backdrop" onClick={onClose}>
      <div className="g-sheet g-privacy" role="dialog" aria-modal="true" aria-labelledby="g-privacy-title" tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="g-sheet-grip" aria-hidden="true" />
        <header className="g-sheet-head">
          <h2 id="g-privacy-title" className="g-sheet-title">
            {n.title}
          </h2>
          <button type="button" className="g-close" onClick={onClose} aria-label={d.close}>
            ✕
          </button>
        </header>
        <p>{n.intro}</p>
        {n.sections.map((s) => (
          <section key={s.heading}>
            <h3>{s.heading}</h3>
            <ul>
              {s.items.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </section>
        ))}
        <p className="g-privacy-updated">{n.updated}</p>
      </div>
    </div>
  );
}
