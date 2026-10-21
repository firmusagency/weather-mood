import photosJson from './photos.json';
import inlineJson from './photos-inline.json';

/*
 * One licensed photo per spot, chosen from Wikimedia Commons by scripts/photos.ts.
 * `file` is the self-hosted copy (public/photos/), `remote` the Commons thumbnail used by the
 * single-file demo builds that ship no assets. Attribution is mandatory for CC BY / CC BY-SA.
 */
export interface Photo {
  /** Path under public/, e.g. photos/falasarna.jpg */
  file: string;
  /** Commons thumbnail URL (hotlink fallback). */
  remote: string;
  title: string;
  author: string;
  license: string;
  licenseUrl: string;
  /** Commons file page, where the full credit lives. */
  source: string;
  width: number;
  height: number;
  /** Set by hand to keep this photo when the script re-runs (e.g. the property's own picture). */
  locked?: boolean;
}

export const PHOTOS = photosJson as Record<string, Photo>;

/** A locked entry with an empty `file` means "no photo, and don't pick one automatically". */
export const photoFor = (spotId: string): Photo | undefined => (PHOTOS[spotId]?.file ? PHOTOS[spotId] : undefined);

const INLINE = inlineJson as Record<string, string>;

/**
 * Where to load the image from: own copy in normal builds; in the single-file demos a small
 * copy embedded in the page (their sandbox blocks other hosts), falling back to the Commons thumbnail.
 */
export function photoSrc(spotId: string, p: Photo, embedded: boolean, baseUrl = '/'): string {
  if (!embedded) return `${baseUrl}${p.file}`;
  return INLINE[spotId] ?? p.remote;
}

/** Short credit line, e.g. "Jane Doe · CC BY-SA 4.0". */
export const photoCredit = (p: Photo) => `${p.author} · ${p.license}`;
