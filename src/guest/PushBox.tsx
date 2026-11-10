import { useEffect, useState } from 'react';
import type { ProfileId } from '../engine/types';
import { g } from './i18n';
import type { GuestLang, Property } from './property';
import { enablePush, pushNeedsRenewal, pushState, pushSupported, type PushState } from './push';
import { askEveningText, whatsappTo } from './evening';

/** Evening-message opt-in: push notification where the browser allows it, WhatsApp otherwise. */
export function PushBox({ property, lang, profile }: { property: Property; lang: GuestLang; profile: ProfileId }) {
  const d = g(lang);
  const [state, setState] = useState<PushState>(() => pushState());
  const [busy, setBusy] = useState(false);
  const standalone = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches;

  // the server key was replaced since this browser opted in: renew quietly (permission is already granted);
  // where the browser insists on a tap, the button below is shown again and does the same
  useEffect(() => {
    if (!pushNeedsRenewal()) return;
    let alive = true;
    void enablePush(property.id, lang, profile).then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
    // once per page load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (pushSupported() && state !== 'denied') {
    return (
      <div className="g-evening">
        <p>{state === 'on' ? d.push.on : d.push.title}</p>
        {state !== 'on' && (
          <button
            type="button"
            className="g-btn g-btn-brand"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setState(await enablePush(property.id, lang, profile));
              setBusy(false);
            }}
          >
            {d.push.btn}
          </button>
        )}
        {!standalone && <p className="g-fb-intro">{d.push.install}</p>}
      </div>
    );
  }
  return (
    <div className="g-evening">
      {state === 'denied' && <p className="g-fb-intro">{d.push.denied}</p>}
      <p>{d.fb.evening}</p>
      <a className="g-btn g-btn-wa" href={whatsappTo(property.whatsapp, askEveningText(lang))} target="_blank" rel="noreferrer">
        {d.fb.eveningBtn}
      </a>
    </div>
  );
}
