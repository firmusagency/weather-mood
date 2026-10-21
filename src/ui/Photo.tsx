import { photoCredit, photoFor, photoSrc } from '../data/photos';
import { EMBEDDED } from './data';

/*
 * Licensed spot photo with its credit (author · licence, linking to the Commons file page).
 * Renders nothing when the spot has no photo yet, so layouts degrade gracefully.
 */
const BASE = ((import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/') as string;

export function SpotPhoto({ spotId, alt, variant = 'card', creditWord = 'Photo' }: { spotId: string; alt: string; variant?: 'card' | 'hero' | 'thumb'; creditWord?: string }) {
  const p = photoFor(spotId);
  if (!p) return null;
  return (
    <figure className={`photo photo-${variant}`}>
      <img src={photoSrc(p, EMBEDDED, BASE)} alt={alt} loading="lazy" decoding="async" width={p.width} height={p.height} />
      {variant !== 'thumb' && (
        <figcaption className="photo-credit">
          <a href={p.source} target="_blank" rel="noreferrer license" title={`${p.title} · ${p.license}`}>
            {creditWord}: {photoCredit(p)}
          </a>
        </figcaption>
      )}
    </figure>
  );
}
