import type { GlanceGroup } from '../engine/glance';
import type { Lang } from '../engine/types';
import { spotById } from '../data/spots';
import { strings } from './i18n';

/** One chip per kind of outing: can you do it tomorrow, and which place is the best bet. */
export function Glance({ groups, lang, onOpen }: { groups: GlanceGroup[]; lang: Lang; onOpen: (id: string) => void }) {
  const s = strings(lang);
  return (
    <section className="glance" aria-labelledby="glance-title">
      <h3 id="glance-title" className="panel-title">
        {s.glanceTitle}
      </h3>
      <ul className="glance-list">
        {groups.map((grp) => {
          const best = grp.bestSpotId ? spotById(grp.bestSpotId) : undefined;
          const total = grp.go + grp.caution + grp.avoid;
          return (
            <li key={grp.id} className={`glance-item v-${grp.verdict}`}>
              <span className="glance-dot" aria-hidden="true" />
              <div className="glance-body">
                <span className="glance-name">{grp.name[lang]}</span>
                <span className="glance-count">
                  {grp.go}/{total} {s.glanceOk}
                </span>
                {best && (
                  <button type="button" className="glance-best" onClick={() => onOpen(best.id)}>
                    {grp.verdict === 'avoid' ? s.glanceLeastBad : s.glanceBest}: {best.name[lang]}
                  </button>
                )}
              </div>
              <span className="glance-verdict">{s.verdict[grp.verdict]}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
