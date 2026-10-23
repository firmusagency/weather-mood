import { g } from './i18n';
import { GUEST_LANGS, type GuestLang, type Property } from './property';
import { Qr } from './Qr';

/*
 * Printable room card (guest.html#qr): the property's name, a four-language "scan for tomorrow's
 * picks" line and a large QR to the guest page. Print it on A6 and put one in every room.
 */
export function QrCard({ property, lang }: { property: Property; lang: GuestLang }) {
  const d = g(lang);
  return (
    <div className="g-qrcard-wrap">
      <article className="g-qrcard">
        <header className="g-qrcard-head">
          <span className="g-monogram" aria-hidden="true">
            {property.name[0]}
          </span>
          <div>
            <p className="g-prop-name">{property.name}</p>
            <p className="g-prop-tag">{property.tagline[lang] ?? property.tagline.en}</p>
          </div>
        </header>
        <h1 className="g-qrcard-title">{d.qrTitle}</h1>
        <Qr text={property.guestUrl} size={220} label={d.scanForYourLanguage} />
        <ul className="g-qrcard-langs">
          {GUEST_LANGS.map((l) => (
            <li key={l} lang={l}>
              {g(l).qrLine}
            </li>
          ))}
        </ul>
        <p className="g-qrcard-url">{property.guestUrl.replace(/^https?:\/\//, '')}</p>
        <p className="g-qrcard-foot">{d.poweredBy}</p>
      </article>
      <div className="g-qrcard-actions">
        <button type="button" className="g-btn g-btn-brand" onClick={() => window.print()}>
          {d.qrPrint}
        </button>
        <p className="g-fb-intro">{d.qrHint}</p>
      </div>
    </div>
  );
}
