import { inSector } from './geo';
import { verdictOf } from './scoring';
import type { Spot, SpotScore, Text, Verdict } from './types';

/*
 * "The day at a glance": one verdict per kind of outing, so staff can answer
 * "what kind of day is tomorrow?" before looking at any single place.
 */

export type GlanceGroupId = 'north' | 'west' | 'south' | 'east' | 'trails' | 'boats' | 'culture' | 'villages';

export interface GlanceGroup {
  id: GlanceGroupId;
  name: Text;
  /** Number of places in the group that are a go / with caution / to avoid for this profile. */
  go: number;
  caution: number;
  avoid: number;
  /** Verdict of the best place in the group — "can you do this kind of outing at all tomorrow?" */
  verdict: Verdict;
  bestSpotId?: string;
  bestScore: number;
}

const NAMES: Record<GlanceGroupId, Text> = {
  north: { el: 'Βόρειες παραλίες', en: 'North-coast beaches' },
  west: { el: 'Δυτικές παραλίες', en: 'West-coast beaches' },
  south: { el: 'Νότιες παραλίες', en: 'South-coast beaches' },
  east: { el: 'Κόλποι & υπήνεμες ακτές', en: 'Bays & sheltered shores' },
  trails: { el: 'Φαράγγια & πεζοπορίες', en: 'Gorges & walks' },
  boats: { el: 'Καραβάκια', en: 'Boat trips' },
  culture: { el: 'Πόλη & πολιτισμός', en: 'Town & culture' },
  villages: { el: 'Χωριά, φύση & λίμνη', en: 'Villages, nature & lake' },
};

const ORDER: GlanceGroupId[] = ['north', 'west', 'south', 'east', 'boats', 'trails', 'culture', 'villages'];

export function glanceGroupOf(spot: Spot): GlanceGroupId | undefined {
  switch (spot.type) {
    case 'beach': {
      const f = spot.facing ?? 0;
      // beaches that face east or south-east sit in bays (Souda, Seitan, Kolymbari's lee side)
      if (inSector(f, [315, 45])) return 'north';
      if (inSector(f, [225, 315])) return 'west';
      if (inSector(f, [150, 225])) return 'south';
      return 'east';
    }
    case 'gorge':
    case 'hike':
      return 'trails';
    case 'boat':
      return 'boats';
    case 'town':
    case 'culture':
      return 'culture';
    case 'village':
    case 'nature':
    case 'lake':
      return 'villages';
    default:
      return undefined; // museums are a fallback, not a kind of day
  }
}

export function dayGlance(spots: Spot[], scores: Record<string, SpotScore>): GlanceGroup[] {
  const groups = new Map<GlanceGroupId, GlanceGroup>();
  for (const spot of spots) {
    const gid = glanceGroupOf(spot);
    const sc = scores[spot.id];
    if (!gid || !sc || sc.verdict === 'unsuitable') continue;
    const grp = groups.get(gid) ?? { id: gid, name: NAMES[gid], go: 0, caution: 0, avoid: 0, verdict: 'avoid', bestScore: -1 };
    grp[sc.verdict as 'go' | 'caution' | 'avoid'] += 1;
    if (sc.score > grp.bestScore) {
      grp.bestScore = sc.score;
      grp.bestSpotId = spot.id;
      grp.verdict = verdictOf(sc.score);
    }
    groups.set(gid, grp);
  }
  return ORDER.map((id) => groups.get(id)).filter((x): x is GlanceGroup => !!x);
}
