export interface WebManifest {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  theme_color: string;
  icons: { src: string; sizes?: string; type?: string; purpose?: string }[];
  [key: string]: unknown;
}
/** The manifest of one property; paths are relative to public/manifests/. */
export function manifestFor(property: { id: string; name: string; brand?: string }, base: WebManifest): WebManifest;
