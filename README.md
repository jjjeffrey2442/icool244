# OTG Fitness

A gym companion for the rest periods between sets. The body is a temple, effort matters more than count, and the only person you're measured against is you.

Built with vanilla HTML, CSS and JavaScript. There's no framework, no build step and no dependencies. It's an installable PWA that works fully offline, and all data stays on the phone in `localStorage`.

## Run it

Serve the folder over HTTPS or `localhost`. Service workers need a secure context and won't run from `file://`.

```
npx http-server -p 8080 .
```

To install it, open the site on the phone once while online, then use **Add to Home Screen**. After that it runs with no connection. The service worker caches the app shell and all of `exercises.json`.

GitHub Pages works as-is because every path is relative.

**After changing any file, bump `VERSION` in `sw.js`.** Otherwise installed phones keep serving the cached build.

## Files

| File | What it is |
|---|---|
| `index.html` | Shell with four tabs: Grind, Programs, Recover, Temple |
| `styles.css` | All styling |
| `app.js` | Everything else: library, programs, runner, rest timer, metrics, recovery, goal builder, suggestions |
| `sw.js` | Offline cache |
| `exercises.json` | 912 exercises from wger.de (CC BY-SA) |
| `manifest.webmanifest`, `icons/` | Install metadata |

## How the parts work

- **Grinds.**
  - **Rest Day** multiplies reps and time by 1.5 and cuts rest by a quarter.
  - **Gladiator** halves the reps, adds one set and raises rest by half. Timed cardio becomes 6×30s sprints.
  - The grind is applied when a workout starts. Program pages show the base prescription.
- **Programs.** Arms and Abs each have Beginner, Intermediate and Advanced tiers. Legs is the owner's routine. Exercises are pinned by `id` in `exercises.json` and ordered from large muscles to small.
- **Relative score.** Pull-ups and push-ups score `reps × (bodyweight + added) ÷ 100`, using the bodyweight at the moment you log the set. Kettlebell carries score `weight × distance` (laps × track length) or `weight × seconds`. Progress is always your latest against your own best.
- **Suggestions.**
  1. If legs haven't been trained in 5 or more days, suggest legs.
  2. Otherwise suggest a group that has never been trained.
  3. Otherwise suggest the group that was trained longest ago.

  The reason is always shown in one line.
- **Goal builder.** "I want ___" maps to a body part, picks 5 primary exercises, then adds connected work (glutes → core, chest → back, and so on). The note always reads "Everything goes hand-in-hand."

Exercise data: [wger.de](https://wger.de) (CC BY-SA).
