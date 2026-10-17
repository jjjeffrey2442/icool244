# OTG Fitness: handoff brief

Read this whole file before changing anything. It holds the decisions that protect the app's integrity. If anything here conflicts with a new request, ask the owner before you break it.

---

## 1. What OTG Fitness is

A gym companion by **OTG Factory**, built for the owner's own training and shipping to the iPhone App Store.

- **The body is a temple.** Effort matters more than count.
- **You against you.** Every person is measured against their own standard, never against anyone else. No leaderboards.
- **The app lives in the rest periods between sets**, when you're already on your phone.
- **Be optimal, intentional and deliberate.** No reckless jumps.

**Tone:** direct, effort-first, temple language. For example: "Carry the load longer." "The spirit is the work." Never cheesy, never corporate.

---

## 2. Non-negotiables

1. **Private by design.** No accounts, no servers, no analytics, no ads, no tracking. All data stays on the phone. The published privacy policy (section 9) promises this. Breaking it means rewriting the policy and the App Store privacy label.
2. **Works offline.** Gym Wi-Fi is unreliable.
3. **Nothing is ever lost.** Every set saves the moment it's logged. Closing or killing the app mid-workout loses nothing.
4. **No dead buttons and no placeholder content.** Every button works or doesn't exist.
5. **TO FAILURE on every set.** One tap logs the set as done to failure, with no rep count. Effort over count.
6. **Your own content only.** Don't copy other apps' code, text, images, animations or audio, including Leap Fitness (section 10).

---

## 3. The owner's training

**Weighted vest:** 25 lb → 50 lb → **75 lb now**. The owner progresses deliberately and does not jump straight to 120 or 200 lb. The vest hardens the core, and the legs bear the load when tired.

**Session order** (from the SwiftUI app built earlier):

1. **Vest + Arms.** A 30-day arms plan at Beginner, Intermediate or Advanced, one move at a time:
   - countdown timers
   - 15-second rests
   - every 4th day is a rest day
   - restarts at day 1 after day 30
2. **Cardio.** Curve treadmill, bike, elliptical or StairMaster, with a stopwatch. Ankle weights go up to 7 lb, and the app flags anything under the owner's 5–7 lb range.
3. **Abs & Obliques.** Its own 30-day plan with its own level, built on the pattern from the owner's screenshots.
4. **Legs.** Barbell squat, machine squat or pistol squat. Work-up:
   - 2×10 @ 135
   - 1×7 @ 225
   - 2×5 @ 315
   - 1–3 @ 405

   Three clean reps on the top set → the next session adds 10 lb, and the lighter sets scale with it.
5. **Recovery.** Basketball, tennis, steam room, sauna, hot tub, cold plunge, shower.

**Earlier owner's legs routine:** squats, running, cycling, calf raises, weighted calf raises, toe raises (outer calf).

**Open decision:** the vest currently goes up 5 lb only after a full 30-day arms cycle with no skipped moves. Confirm with the owner before changing it.

---

## 4. Core features

- **Two grinds.** Every workout is tagged to one.
  - **Rest Day Grind** = endurance: "Carry the load longer than the rest." Reps and time ×1.5, rest cut by a quarter.
  - **Gladiator Grind** = power: heavy and explosive. Half the reps, one more set, longer rest; timed cardio becomes 6×30s sprints.
- **Rest timer.** Starts automatically after a set, with big numbers. Tap anywhere to skip, or adjust by ±15 seconds. It survives an app restart.
- **Relative score** for pull-ups and push-ups: `score = reps × (bodyweight + added weight) ÷ 100`, using the bodyweight at the moment of logging. A vested rep outscores an unvested one, and a heavier body scores more for the same reps. Progress = latest vs your own personal best.
  - The plan's original formula, `÷ bodyweight`, was rejected because it gives the same score at every bodyweight.
- **Kettlebell carry score:** weight × distance (laps × track length) or weight × seconds.
- **Records:** personal records with dates, history bars and streaks.
- **Goal builder.** "I want ___" (glutes, bigger arms…) builds a 5–7 exercise program and adds connected work:
  - glutes → core
  - chest → back
  - back → chest + core
  - arms → shoulders + back
  - core → lower back
  - legs → core + calves

  It always shows the note: "Everything goes hand-in-hand."
- **Suggestions:**
  1. If legs haven't been trained in 5 or more days, suggest legs.
  2. Otherwise suggest a group that has never been trained.
  3. Otherwise suggest the group trained longest ago.

  Always show a one-line reason, for example "Arms are due — last trained 6 days ago."
- **Recovery log.** Activity + minutes + optional temperature (°F) and note. A "Till I couldn't" timer logs the elapsed time, and the log shows a weekly total.
- **Units:** weight in lb, carry distance in meters, temperature in °F.

---

## 5. The Branch of Life (growth tree)

The heart of the app's identity: a tree that grows as you train.

**Look:**
- flat 2D cartoon with thick dark outlines (#2b2238), in the style of *Wow! Wow! Wubbzy!*
- constant gentle rain under a sky that starts as a soft green (#cdeac0) at the horizon and rises through #9fe0c4 and #4fd0cf to bright turquoise (#1fb3d1) at the top
- never grey

**Structure:**
- **Two bases braided into one trunk:** two trunks twisting around each other, a symbol of the human.
- **Roots as vast below as the branches above.** The ground cuts the tree in half; below is a cross-section of soil with stones. The roots spread low and wide, like an earthbender's stance (Avatar). Their tips glow teal, in tune with the earth.
- **Branches cross and interweave:** the left trunk reaches right, the right reaches left.
- **A gold ring** wraps the trunk for every 25 lb of vest weight, labelled 25, 50, 75 …: each one a branch of life.
- **A heart** sits at the highest crossing of the trunks, in the chest.
- **A crown of leaves** grows on top.

**Growth from workouts.** Legs, calves and feet gain from everything, because they carry you through all of it.

| Workout | Roots (legs, calves, feet) | Trunk (core) | Branches (arms, chest) | Heart & lungs | Crown (mind) |
|---|---|---|---|---|---|
| Legs | 3 | 1 | 0 | 0 | 1 |
| Cardio | 2 | 0.5 | 0 | 3 | 1 |
| Arms | 1 | 0.5 | 3 | 0 | 1 |
| Chest | 1 | 0.5 | 3 | 0 | 1 |
| Abs | 1 | 3 | 0.5 | 0 | 1 |
| Recovery | 0 | 0 | 0 | 0.5 | 1 |
| Vest on (any workout except recovery) | +1 | +1 | | | |

Abs feed the branches a little because they're a stabilizer.

**Full growth:** roots 150 points, trunk 120, branches 120, heart 75, crown 75 sessions. Each part's level = points ÷ threshold, capped at 100%.

**What each part drives:**
- Roots: depth, spread and glow.
- Trunk: height, thickness and number of twists.
- Branches: how many levels they split into and how far they reach.
- Heart: its size and glow, and how deeply the canopy "breathes" (a slow scale pulse).
- Crown: how much of the canopy has leaves.

The tree must shrink to fit the screen and never run off the edges.

**Reference prototype:** `design/branch-of-life.html` in the web repo has the exact formulas and drawing code. Ask the owner for the file if you need it. A second prototype, `design/tree.html`, offers oak, cherry blossom and pine trees in 5 stages; it's an alternative look, not the chosen one.

**Direction in progress (owner, unfinished):** every muscle worked is a **seed planted**, a new opportunity and potential. Think of a pumpkin or watermelon seed sprouting one big leaf: cut that leaf open and there are millions of connectors that let it grow. Those connectors are your body in motion, working toward your dream reality. The gym machine says "the matrix," and the owner is breaking it and putting it all together.

Muscles the owner named, each one a seed:
- feet
- calves
- hamstrings (stressed heavily)
- quadriceps
- glutes (as stabilizer)
- abdomen
- obliques
- chest / pectorals
- deltoids
- rotator cuffs
- triceps
- biceps
- forearms

Next step: design how individual muscles plant seeds that grow into the tree's connectors and veins. Confirm the design with the owner before building it.

---

## 6. Two codebases

1. **The iPhone app (the one that ships):** SwiftUI, iOS 17+, at `~/Desktop/OTGFitness` on the owner's Mac. It builds clean.
2. **The web app (backup and reference):** repo `github.com/jjjeffrey2442/icool244`, branch `claude/otg-fitness-build-plan-2ob5z0`.
   - vanilla HTML/CSS/JS installable web app (PWA) that works offline
   - `exercises.json` with 912 exercises from wger.de, licensed CC BY-SA
   - all 9 build checkpoints passed in a mobile browser emulator; not yet tested on a real phone
   - `design/` holds the tree prototypes and `GROWTH.md`

If the iPhone app uses `exercises.json` data, credit it: "Exercise data: wger.de (CC BY-SA)."

---

## 7. App Store status

| Step | Status |
|---|---|
| App builds clean in Xcode | ✅ done |
| Apple Developer Program ($99/yr) | ⏳ owner to enroll at developer.apple.com/programs; approval is the slowest step |
| Privacy policy, public URL | ✅ live (section 9) |
| Bundle ID (e.g. `com.otgfactory.fitness`) | ⏳ |
| App icon, 1024 px | ⏳ |
| Store listing: description, keywords, screenshots, age rating | ⏳ |
| Privacy label in App Store Connect | answer **Data Not Collected** |
| Archive → TestFlight → submit for review | ⏳ |

Apple may reject an app that's just a website wrapped in an app shell. That's why the native SwiftUI app is the one that ships.

---

## 8. Owner preferences

- **Keep replies short.** Usage limits matter to the owner.
- Be decisive: choose the deliberate option and say what you chose in one line. Don't stall.
- Don't claim something works unless you verified it.
- The owner thinks in vision and metaphor. Translate it into concrete design, and confirm big design calls before building them.

---

## 9. Privacy policy (live)

**Public URL:** https://github.com/jjjeffrey2442/icool244/blob/claude/otg-fitness-build-plan-2ob5z0/PRIVACY.md

Summary: no data collected; everything stays on the device; no accounts, servers, analytics, ads or tracking; deleting the app deletes the data. Contact is through the repo's GitHub Issues.

If the app ever adds login, cloud sync, HealthKit, analytics or ads, **update the policy and the App Store privacy label first.**

---

## 10. Leap Fitness boundary

The owner used Leap Fitness apps and wants their own routine to live on in OTG if those apps ever disappear.

**Allowed:**
- recording the facts of the routine the owner follows (which exercise, which day, reps and seconds), for example from their own screenshots
- rebuilding those facts in OTG with OTG's own descriptions and logic

**Not allowed:**
- decompiling or reverse engineering Leap's app
- copying their instruction text, images, animations, audio or code

OTG's edge over fixed 30-day scripts is that it adapts to what you actually logged: progressive overload, deloads, holding back after failure, and day-1 vs day-30 tests.
