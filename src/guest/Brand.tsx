import { lt, type GuestLang, type Property } from './property';

/** Property header: logo when it has one, monogram otherwise, name and tagline. */
export function Brand({ property, lang, compact = false }: { property: Property; lang: GuestLang; compact?: boolean }) {
  return (
    <div className="g-brand">
      {property.logo ? (
        <img className="g-logo" src={property.logo} alt="" />
      ) : (
        <span className="g-monogram" aria-hidden="true">
          {property.name[0]}
        </span>
      )}
      <div>
        <p className="g-prop-name">{property.name}</p>
        {!compact && <p className="g-prop-tag">{lt(property.tagline, lang)}</p>}
      </div>
    </div>
  );
}
