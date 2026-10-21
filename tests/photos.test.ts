import { describe, expect, it } from 'vitest';
import { licenseOk, pickBest, type Candidate } from '../src/engine/photos';

const base = (over: Partial<Candidate>): Candidate => ({
  title: 'File:Falasarna beach 01.jpg',
  mime: 'image/jpeg',
  width: 2400,
  height: 1600,
  thumbUrl: 'https://upload.wikimedia.org/x/1200px-a.jpg',
  source: 'https://commons.wikimedia.org/wiki/File:a.jpg',
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  author: 'Jane Doe',
  categories: 'Beaches of Crete',
  ...over,
});

describe('photo licences', () => {
  it('accepts CC BY, CC BY-SA, CC0 and public domain only', () => {
    for (const ok of ['CC BY 4.0', 'CC BY-SA 3.0', 'CC BY-SA 2.0', 'CC0', 'Public domain', 'CC BY 2.5']) expect(licenseOk(ok)).toBe(true);
    for (const bad of ['CC BY-NC 4.0', 'CC BY-NC-SA 3.0', 'CC BY-ND 4.0', 'Fair use', '', 'GFDL']) expect(licenseOk(bad)).toBe(false);
  });
});

describe('picking a photo', () => {
  it('prefers a large landscape photo of the place with a community assessment', () => {
    const cands = [
      base({ title: 'File:Falasarna map.png', mime: 'image/png' }),
      base({ title: 'File:Falasarna beach tiny.jpg', width: 640, height: 480 }),
      base({ title: 'File:Falasarna beach portrait.jpg', width: 1200, height: 1800 }),
      base({ title: 'File:Falasarna beach good.jpg', assessments: 'Quality image' }),
      base({ title: 'File:Falasarna beach noncommercial.jpg', license: 'CC BY-NC 4.0', assessments: 'Featured picture' }),
    ];
    expect(pickBest(cands, 'Falasarna')?.title).toBe('File:Falasarna beach good.jpg');
  });

  it('returns null when nothing is usable', () => {
    expect(pickBest([base({ license: 'CC BY-NC 2.0' }), base({ title: 'File:Crete map.jpg' })], 'Falasarna')).toBeNull();
  });

  it('rejects photos that are not identifiably from the region (a Dutch "Tersana" is not Tersanas)', () => {
    const dutch = base({ title: 'File:Riettransport op de suikeronderneming Nieuw Tersana.jpg', categories: 'Sugar plantations in Suriname' });
    expect(pickBest([dutch], 'Tersanas Τερσανάς')).toBeNull();
  });

  it('skips maps, logos and very wide panoramas in favour of a normal photo', () => {
    const cands = [base({ title: 'File:Balos panorama.jpg', width: 6000, height: 1200 }), base({ title: 'File:Balos lagoon from above.jpg', width: 1800, height: 1200 })];
    expect(pickBest(cands, 'Balos')?.title).toBe('File:Balos lagoon from above.jpg');
  });
});
