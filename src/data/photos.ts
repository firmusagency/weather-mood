import photosJson from './photos.json';

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

export const photoFor = (spotId: string): Photo | undefined => PHOTOS[spotId];

/** Where to load the image from: own copy in normal builds, Commons thumbnail in embedded demos. */
export function photoSrc(p: Photo, embedded: boolean, baseUrl = '/'): string {
  return embedded ? p.remote : `${baseUrl}${p.file}`;
}

/** Short credit line, e.g. "Jane Doe · CC BY-SA 4.0". */
export const photoCredit = (p: Photo) => `${p.author} · ${p.license}`;
