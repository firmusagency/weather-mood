# Sea temperature: when is it a swimming day, and for whom (2026-11-13)

The owner asked two things: up to what **water** temperature a swim is fine for an ordinary guest, and how to treat
**winter swimmers**, who go in much colder water. The numbers in the engine before this were an estimate
(comfort 23°, hard limits 18° / 16°). This note records what the sources say and what the engine does now.

## What the sources say

| Source | What it says |
| --- | --- |
| SwimTrek, water temperature guide (swimming-holiday operator, Mediterranean trips) | above 26° "very warm, similar to a heated pool"; **22–25° "ideal open water swimming temperatures… most swimmers will be comfortable… as long as they like"**; 17–21° "pleasant", but "some more susceptible to the cold may still want a wetsuit"; 12–16° "still possible for those acclimatised to slightly cooler waters"; 6–11° "most swimmers will need a wetsuit… even for a short period" |
| Outdoor Swimming Society, temperature guide (anecdotal, UK swimmers) | 17–20° "summer swimming… still fresh on entry"; 12–16° "fresh… doable for the brave, not a problem for hardened open water lovers"; lists cold-water shock, swim failure, afterdrop ("coldest 10 minutes after you exit") and hypothermia as the risks |
| World Aquatics (open-water competition rules, and its 2026 note on a study in the Journal of Applied Physiology) | **16° is the minimum water temperature** for races; **wetsuits are mandatory below 18°**; trained swimmers at race pace lost core temperature at 15.0–15.5°, so the 16° floor is kept "to ensure even the most susceptible swimmers remain safe" |
| National Center for Cold Water Safety | "treat any water temperature below 70F (21C) with caution"; cold shock is at its strongest between 10° and 15° |

Links: <https://www.swimtrek.com/water-temperature-and-wetsuit-guide>,
<https://www.outdoorswimmingsociety.com/cold-water-feels-temperature-guide/>,
<https://www.worldaquatics.com/news/4479872/science-supports-safety-new-research-reinforces-16c-world-aquatics-threshold-open-water-swimming>,
<https://www.coldwatersafety.org/water-temperature-safety-guide>.

None of these is a rule for holiday bathers (there is none); together they bracket the answer well. The sea off Chania runs
from about 16° in February–March to 26–27° in August; our archive shows 22.4° on 18 October, 22.0° on 1 November and 20.9° on
14 November 2026.

## Ordinary guests (`WATER_BANDS`, `SWIM_LIMITS`, `Profile.waterComfort`)

| Water | Word on the page | What the engine does |
| --- | --- | --- |
| 26° and up | warm | nothing |
| 22–26° | pleasant | nothing: the beach keeps full marks |
| 20–22° | fresh | loses a few points; card says "Fresh water (21°C)"; no "ideal for swimming" |
| 18–20° | cold | loses more; card says "Cold water (19°C): a quick dip at most"; still a "go" on a warm, calm day |
| 16–18° | very cold | hard limit: at most "with reservations" ("for the brave") |
| under 16° | very cold | hard limit: "avoid", not a swimming day |

- Comfort starts at 22° (it was 23°). Families with young children and the "relaxed programme" profile keep 23°: children
  and older people lose heat faster. This is a score tuning, not a limit.
- The hard limits did not move: 18° and 16° are exactly where World Aquatics puts the wetsuit rule and the minimum.
- The feels-like air temperature rules are unchanged (points below 24°, reservations below 18°, avoid below 15°).

## Winter swimmers (profile `winter`, `WINTER_SWIM`)

A seventh guest profile, chosen by the guest like the others, so the page, the evening message, the morning check and the
notifications all work for it without special cases.

- **What does not change:** waves, wind, rain, thunder, daylight. Their wave tolerance is slightly *below* a summer couple's
  (fine to 0.4 m, unpleasant from 0.9 m) because cold water shortens how long anyone can swim strongly.
- **What changes:** water costs points only under 16° and the cold hard limits sit lower: reservations under 14° water or
  10° feels-like air, avoid under 10° water or 5° air. Off Chania the sea practically never goes below 15°, so in practice
  the water alone never stops them; a 5 Bf northerly with 1.5 m waves does.
- Cool air costs them less and only below 16°; beaches come first in their ranking.
- **Safety wording:** below 20° every beach card for this profile reads "Sea at 17°C: only if you are used to it. Get in
  slowly, never alone", and "warm clothes and a hot drink for after the swim" leads the what-to-bring list. The profile is a
  self-declaration; the app does not suggest cold-water swimming to anybody else.

## Open

- The numbers above are a proposal built on these sources; the owner has not confirmed them yet.
- A boat trip stays on the ordinary cold limits for every profile (the deck is equally cold for everyone).
- The lake has no water temperature in the data; it follows the air limits only.
