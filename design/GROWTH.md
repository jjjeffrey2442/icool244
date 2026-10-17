# Branch of Life: growth rules

The tree grows from logged workouts. Every workout feeds the roots, because legs, calves and feet carry you through all of it.

| Workout | Roots (legs, calves, feet) | Trunk (core) | Branches (arms, chest) | Heart & lungs | Crown (mind) |
|---|---|---|---|---|---|
| Legs | 3 | 1 | 0 | 0 | 1 |
| Cardio | 2 | 0.5 | 0 | 3 | 1 |
| Arms | 1 | 0.5 | 3 | 0 | 1 |
| Chest | 1 | 0.5 | 3 | 0 | 1 |
| Abs | 1 | 3 | 0.5 | 0 | 1 |
| Recovery | 0 | 0 | 0 | 0.5 | 1 |
| Vest on (any workout except recovery) | +1 | +1 | | | |

**Full growth thresholds:** roots 150, trunk 120, branches 120, heart 75, crown 75 sessions. Each part's level is points divided by its threshold, capped at 100%.

**Gold rings:** one for every 25 lb of current vest weight, stacked below the heart.

**What each part drives in the drawing:**
- Roots: depth, spread and glowing tips below ground.
- Trunk: height, thickness and number of twists in the braid.
- Branches: how many levels they split into and how far they reach.
- Heart: its size and glow, and how deeply the canopy breathes.
- Crown: how much of the canopy has leaves.

Reference implementation: `design/branch-of-life.html` (functions `GROWTH`, `totals`, `render`).
