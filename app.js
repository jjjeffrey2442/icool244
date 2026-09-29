/* OTG Fitness — the body is a temple. Effort over count. You against you.
   Vanilla JS, no build step. Everything the user does is written to localStorage immediately. */
(() => {
  'use strict';

  /* =========================================================== utilities */

  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const DAY = 864e5;
  const pad = (n) => String(n).padStart(2, '0');
  const nowIso = () => new Date().toISOString();
  const dayKey = (d) => { d = new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const startOfDay = (d) => { d = new Date(d); d.setHours(0, 0, 0, 0); return d; };
  const daysAgo = (d) => Math.round((startOfDay(Date.now()) - startOfDay(d)) / DAY);
  const startOfWeek = () => { const d = startOfDay(Date.now()); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };
  const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const fmtDateLong = (d) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const fmtCountdown = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };
  const fmtElapsed = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60);
    return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
  };
  const fmtNum = (n, dp = 1) => Number(n).toLocaleString(undefined, { maximumFractionDigits: dp });
  const agoText = (d) => { const n = daysAgo(d); return n <= 0 ? 'earlier today' : n === 1 ? 'yesterday' : `${n} days ago`; };
  const num = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  let toastTimer = 0;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  /* =========================================================== storage */

  const KEY = 'otg.v1';
  const defaults = () => ({
    v: 1,
    grind: 'rest',
    bodyweight: null,
    bodyweightLog: [],
    workouts: [],
    activeWorkoutId: null,
    rest: null,
    lifts: [],
    recover: [],
    recoverTimer: null,
    customPrograms: [],
    lastTrackLength: 400
  });

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return Object.assign(defaults(), JSON.parse(raw));
    } catch (e) { /* corrupted or blocked storage: start clean */ }
    return defaults();
  }
  let S = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { toast('Storage is blocked or full — this cannot be saved.'); }
  }

  // UI-only state (not persisted)
  const ui = {
    tab: 'grind',
    detail: null,
    libQuery: '',
    libCat: 'All',
    goalText: '',
    goalDraft: null,
    goalError: '',
    recoverActivity: null,
    liftType: 'pullup',
    carryMode: 'distance',
    lastLiftResult: null,
    historySeries: null,
    summaryId: null,
    runnerOpen: false,
    draft: null
  };

  /* =========================================================== exercise library */

  const DB = { list: [], byId: new Map(), status: 'loading', error: '' };
  const EN_WORDS = /\b(the|your|and|with|hold|keep|you)\b/gi;
  const JUNK = /stretch|foam roll|roller|breath|kegel|pelvic|warm ?up|meditat|rest \(|massage|circles\b|coordination|mobility|90\/90|drill|taiso/i;

  function stripHtml(s) {
    s = String(s || '');
    if (!/[<&]/.test(s)) return s.trim();
    const doc = new DOMParser().parseFromString(s, 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  }
  const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []).map((x) => String(typeof x === 'object' && x ? x.name || '' : x).trim()).filter(Boolean);

  function normalizeExercise(e) {
    const description = stripHtml(e.description);
    return {
      id: String(e.id ?? e.name),
      name: String(e.name || '').replace(/\s+/g, ' ').trim(),
      description,
      category: String(e.category || 'Other'),
      muscles: arr(e.muscles),
      muscles2: arr(e.muscles_secondary),
      equipment: arr(e.equipment),
      en: (description.match(EN_WORDS) || []).length >= 3
    };
  }

  async function loadExercises() {
    try {
      const res = await fetch('exercises.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let data = await res.json();
      if (!Array.isArray(data)) data = data.exercises || data.results || [];
      DB.list = data.map(normalizeExercise).filter((e) => e.name);
      DB.byId = new Map(DB.list.map((e) => [e.id, e]));
      DB.status = 'ready';
    } catch (err) {
      DB.status = 'error';
      DB.error = err.message || String(err);
    }
    renderAll();
  }
  const exById = (id) => DB.byId.get(String(id));
  const categories = () => [...new Set(DB.list.map((e) => e.category))].sort();

  const BODYWEIGHT_EQ = /none|bodyweight|gym mat|pull-up bar|swiss ball|bench/i;
  const isBodyweight = (ex) => !!ex && ex.equipment.length > 0 && ex.equipment.every((q) => BODYWEIGHT_EQ.test(q));

  /* =========================================================== programs */

  const GRINDS = {
    rest: {
      id: 'rest', name: 'Rest Day Grind', short: 'Rest Day', motto: 'Carry the load longer than the rest.',
      focus: 'Endurance. Distance, reps, time under load, active recovery.',
      rule: 'Targets: reps and time ×1.5, rest cut by a quarter.'
    },
    gladiator: {
      id: 'gladiator', name: 'Gladiator Grind', short: 'Gladiator', motto: 'Everything you have, in an instant.',
      focus: 'Power. Heavy, explosive, maximum output.',
      rule: 'Targets: half the reps, one more set, longer rest. Load it up. Cardio becomes sprints.'
    }
  };

  const T = (ex, sets, reps, rest, extra = {}) => ({ ex, sets, reps, rest, unit: 'reps', ...extra });
  const BUILTIN = [
    {
      id: 'arms-beginner', group: 'Arms', name: 'Arms', tier: 'Beginner',
      blurb: 'Bodyweight and light dumbbells. Own the movement before you load it.',
      items: [T(197, 3, 10, 60), T(211, 3, 12, 60), T(92, 3, 12, 60), T(1567, 3, 10, 60), T(1881, 2, 15, 45), T(1333, 2, 15, 45)]
    },
    {
      id: 'arms-intermediate', group: 'Arms', name: 'Arms', tier: 'Intermediate',
      blurb: 'Cables, SZ-bar and heavier dumbbells. The same muscles, asked for more.',
      items: [T(1228, 4, 8, 90), T(1661, 3, 10, 75), T(1509, 3, 12, 60), T(94, 4, 8, 90), T(95, 3, 10, 60), T(1502, 3, 10, 60), T(493, 3, 12, 60)]
    },
    {
      id: 'arms-advanced', group: 'Arms', name: 'Arms', tier: 'Advanced',
      blurb: 'Barbell work. Heavy, strict, nothing wasted.',
      items: [T(1467, 4, 6, 150), T(50, 4, 8, 120), T(1481, 3, 10, 90), T(91, 4, 6, 120), T(51, 3, 12, 60), T(48, 3, 12, 60)]
    },
    {
      id: 'abs-beginner', group: 'Abs', name: 'Abs', tier: 'Beginner',
      blurb: 'Floor and bodyweight. Brace, breathe, hold the line.',
      items: [T(1307, 3, 30, 45, { unit: 'sec' }), T(1572, 3, 10, 45), T(1933, 3, 15, 45), T(1105, 3, 12, 45), T(1288, 3, 10, 45), T(1828, 2, 10, 30)]
    },
    {
      id: 'abs-intermediate', group: 'Abs', name: 'Abs', tier: 'Intermediate',
      blurb: 'Loaded carries, the wheel and cables. The core as a load-bearing wall.',
      items: [T(1776, 3, 40, 60, { unit: 'sec' }), T(1573, 3, 10, 60), T(173, 3, 12, 60), T(312, 3, 10, 60), T(145, 3, 12, 60), T(1650, 3, 12, 45)]
    },
    {
      id: 'abs-advanced', group: 'Abs', name: 'Abs', tier: 'Advanced',
      blurb: 'Barbell, kettlebell and levers. Strength that holds under weight.',
      items: [T(1245, 4, 10, 120, { unit: 'sec' }), T(41, 4, 8, 90), T(1779, 3, 10, 75), T(1099, 3, 30, 60, { unit: 'sec' }), T(2531, 3, 15, 90, { unit: 'sec' })]
    },
    {
      id: 'legs', group: 'Legs', name: 'Legs', tier: 'The Foundation',
      blurb: 'Squat, run, ride — then the calves from every angle.',
      items: [
        T(1801, 4, 8, 150, { label: 'Squats' }),
        T(527, 1, 20, 120, { unit: 'min', label: 'Running' }),
        T(1204, 1, 20, 120, { unit: 'min', label: 'Cycling' }),
        T(1203, 3, 15, 45, { label: 'Calf raises', note: 'Each leg.' }),
        T(148, 3, 12, 60, { label: 'Weighted calf raises' }),
        T(1200, 3, 20, 45, { label: 'Toe raises (outer calf)' })
      ]
    }
  ];

  const allPrograms = () => [...BUILTIN, ...S.customPrograms];
  const getProgram = (id) => allPrograms().find((p) => p.id === id) || null;
  const programTitle = (p) => (p.custom ? p.name : `${p.name} — ${p.tier}`);

  const UNIT = {
    reps: { short: '', label: 'reps', step: 1 },
    sec: { short: 's', label: 'seconds', step: 5 },
    min: { short: ' min', label: 'minutes', step: 1 }
  };
  const targetText = (t) => `${t.sets}×${t.reps}${UNIT[t.unit].short}`;

  // The grind reshapes the base prescription. Deliberate, visible, and the same every time.
  function applyGrind(item, grind) {
    let { sets, reps, rest } = item;
    let unit = item.unit || 'reps';
    const r5 = (n) => Math.round(n / 5) * 5;
    if (grind === 'gladiator') {
      if (unit === 'min') { sets = 6; reps = 30; unit = 'sec'; rest = 90; }
      else { reps = Math.max(unit === 'sec' ? 10 : 3, Math.round(reps * 0.5)); sets += 1; rest = r5(rest * 1.5); }
    } else {
      reps = unit === 'sec' ? r5(reps * 1.5) : Math.round(reps * 1.5);
      rest = Math.max(30, r5(rest * 0.75));
    }
    return { sets, reps, rest, unit };
  }

  /* =========================================================== goal-led programming */

  const CORE = { label: 'Core', cats: ['Abs'], names: /plank|crunch|bird dog|dead ?bug|roll ?out|ab wheel|leg raise|hollow|pallof|carry|sit-?up/i };
  const GOALS = [
    { keys: ['glute', 'butt', 'booty', 'hip', 'posterior'], label: 'Glutes', group: 'Legs',
      primary: { cats: ['Legs'], muscles: /gluteus/i, names: /hip thrust|glute|bridge|squat|lunge|deadlift|kickback|step/i },
      connected: [CORE] },
    { keys: ['chest', 'pec', 'bench'], label: 'Chest', group: 'Chest',
      primary: { cats: ['Chest'], muscles: /pectoralis/i },
      connected: [{ label: 'Back', cats: ['Back'], names: /row|pull-?down|face pull/i }] },
    { keys: ['back', 'lat', 'wing', 'row', 'posture'], label: 'Back', group: 'Back',
      primary: { cats: ['Back'], muscles: /latissimus|trapezius/i },
      connected: [{ label: 'Chest', cats: ['Chest'] }, CORE] },
    { keys: ['arm', 'bicep', 'tricep', 'gun', 'forearm', 'grip'], label: 'Arms', group: 'Arms',
      primary: { cats: ['Arms'], muscles: /biceps brachii|triceps|brachialis/i },
      connected: [{ label: 'Shoulders', cats: ['Shoulders'] }, { label: 'Back', cats: ['Back'] }] },
    { keys: ['shoulder', 'delt', 'trap'], label: 'Shoulders', group: 'Shoulders',
      primary: { cats: ['Shoulders'], muscles: /deltoid|trapezius/i },
      connected: [{ label: 'Back', cats: ['Back'] }] },
    { keys: ['ab', 'core', 'six', 'stomach', 'belly', 'oblique', 'waist', 'midsection'], label: 'Core', group: 'Abs',
      primary: { cats: ['Abs'], names: CORE.names, muscles: /abdominis/i },
      connected: [{ label: 'Lower back', cats: ['Back'], names: /extension|superman|good morning|deadlift|bird|hyper/i }] },
    { keys: ['calf', 'calves', 'shin', 'ankle', 'jump', 'vertical'], label: 'Calves', group: 'Legs',
      primary: { cats: ['Calves', 'Legs'], names: /calf|toe|tibial|plantar/i },
      connected: [{ label: 'Legs', cats: ['Legs'], muscles: /quadriceps/i }] },
    { keys: ['leg', 'quad', 'hamstring', 'thigh', 'squat', 'lower body'], label: 'Legs', group: 'Legs',
      primary: { cats: ['Legs'], muscles: /quadriceps|biceps femoris|gluteus/i },
      connected: [CORE, { label: 'Calves', cats: ['Calves'] }] },
    { keys: ['cardio', 'endurance', 'stamina', 'run', 'conditioning', 'lung', 'wind', 'lean', 'fat'], label: 'Conditioning', group: 'Legs',
      primary: { cats: ['Cardio'], names: /run|jog|bike|cycl|rowing|jump|burpee|climb|stair|skip|rope|sprint|slam|swim|elliptical|crosstrainer|treadmill|hiit|boxing|walk/i },
      connected: [{ label: 'Legs', cats: ['Legs'] }, CORE] },
    { generic: true, keys: ['strong', 'strength', 'power', 'mass', 'bulk', 'total', 'whole body', 'full body', 'everything', 'big'], label: 'Full body', group: 'Legs',
      primary: { cats: ['Legs', 'Back', 'Chest'], names: /squat|deadlift|press|row|pull-up|chin/i },
      connected: [CORE] }
  ];

  const MUSCLE_SIZE = [
    [/quadriceps|gluteus/i, 10], [/latissimus|biceps femoris/i, 9], [/pectoralis/i, 8], [/trapezius/i, 7],
    [/deltoid/i, 6], [/triceps/i, 5], [/biceps brachii/i, 4], [/brachialis|rectus abdominis/i, 3],
    [/obliquus|serratus|gastrocnemius/i, 2], [/soleus/i, 1.5]
  ];
  function sizeOf(ex) {
    if (!ex) return 0;
    if (ex.category === 'Cardio') return 11;
    let best = 0.5;
    for (const m of ex.muscles) for (const [re, s] of MUSCLE_SIZE) if (re.test(m)) best = Math.max(best, s);
    return best;
  }

  function matchGoal(text) {
    const t = ` ${text.toLowerCase()} `;
    let found = null;
    // A named body part always beats a generic wish: "bigger arms" is about arms.
    for (const g of [...GOALS.filter((x) => !x.generic), ...GOALS.filter((x) => x.generic)]) {
      if (found && g.generic) break;
      for (const k of g.keys) {
        const re = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
        const m = re.exec(t);
        if (m && (!found || m.index < found.index)) found = { goal: g, index: m.index };
      }
    }
    return found && found.goal;
  }

  const moveKey = (e) => {
    const words = e.name.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
    return `${words[words.length - 1] || ''}|${e.equipment[0] || ''}`;
  };

  function rankCandidates(spec) {
    return DB.list
      .filter((e) => spec.cats.includes(e.category) && !JUNK.test(e.name) && e.description.length >= 30)
      .map((e) => {
        let s = e.en ? 4 : 0;
        if (spec.muscles && e.muscles.some((m) => spec.muscles.test(m))) s += 3;
        if (spec.names && spec.names.test(e.name)) s += 3;
        if (e.description.length >= 80) s += 1;
        if (e.muscles.length) s += 1;
        return { e, s };
      })
      .filter((c) => (!spec.muscles && !spec.names) || (spec.muscles && c.e.muscles.some((m) => spec.muscles.test(m))) || (spec.names && spec.names.test(c.e.name)))
      .sort((a, b) => b.s - a.s || b.e.description.length - a.e.description.length || a.e.name.localeCompare(b.e.name))
      .map((c) => c.e);
  }

  function pickDiverse(cands, n, used) {
    const out = [];
    const moves = new Set();
    const equip = new Set();
    for (const pass of [0, 1]) {
      for (const e of cands) {
        if (out.length >= n) break;
        if (used.has(e.id) || moves.has(moveKey(e))) continue;
        if (pass === 0 && equip.has(e.equipment[0] || '')) continue;
        out.push(e); used.add(e.id); moves.add(moveKey(e)); equip.add(e.equipment[0] || '');
      }
    }
    return out;
  }

  const HOLD = /\b(plank|hold|lever|l-sit|hang|carry|wall sit)\b/i;
  function prescribe(ex, connected) {
    if (ex.category === 'Cardio') return { sets: 1, reps: 15, rest: 90, unit: 'min' };
    if (HOLD.test(ex.name)) return { sets: 3, reps: /carry/i.test(ex.name) ? 40 : 30, rest: 60, unit: 'sec' };
    return connected ? { sets: 3, reps: 12, rest: 45, unit: 'reps' } : { sets: 3, reps: 10, rest: 75, unit: 'reps' };
  }

  function buildGoalProgram(text) {
    const goal = matchGoal(text);
    if (!goal) return { error: `Nothing in the library answers to "${text}". Name a body part: glutes, chest, back, arms, shoulders, core, legs, calves, cardio.` };
    const used = new Set();
    const nConnected = goal.connected.length > 1 ? 1 : 2;
    const primary = pickDiverse(rankCandidates(goal.primary), 5, used).sort((a, b) => sizeOf(b) - sizeOf(a));
    const connected = [];
    for (const c of goal.connected) {
      const picks = pickDiverse(rankCandidates(c), nConnected, used).sort((a, b) => sizeOf(b) - sizeOf(a));
      picks.forEach((e) => connected.push({ e, label: c.label }));
    }
    if (primary.length < 3) return { error: `The library is too thin on ${goal.label.toLowerCase()} to build a real program.` };
    const items = [
      ...primary.map((e) => ({ ex: e.id, ...prescribe(e, false) })),
      ...connected.map(({ e, label }) => ({ ex: e.id, ...prescribe(e, true), connected: label }))
    ];
    return {
      id: `custom-${uid()}`, custom: true, group: goal.group, name: goal.label === 'Full body' ? 'Full body' : goal.label,
      tier: 'Your goal', goal: text.trim(),
      connectedLabels: [...new Set(connected.map((c) => c.label))],
      blurb: `Built from "I want ${text.trim()}". Everything goes hand-in-hand.`,
      items, createdAt: nowIso()
    };
  }

  /* =========================================================== history helpers */

  const activeWorkout = () => S.workouts.find((w) => w.id === S.activeWorkoutId) || null;
  const loggedSets = (w) => w.items.reduce((n, it) => n + it.logs.length, 0);
  const trainedWorkouts = () => S.workouts.filter((w) => loggedSets(w) > 0);
  const workoutDate = (w) => {
    const times = w.items.flatMap((it) => it.logs.map((l) => l.at));
    return times.length ? times.sort()[times.length - 1] : w.startedAt;
  };

  function lastTrained(group) {
    let best = null;
    for (const w of trainedWorkouts()) {
      if (w.group !== group) continue;
      const d = workoutDate(w);
      if (!best || d > best.date) best = { date: d, workout: w };
    }
    return best;
  }

  const SUGGEST_GROUPS = ['Legs', 'Arms', 'Abs'];
  function programForGroup(group) {
    if (group === 'Legs') return 'legs';
    if (group === 'Arms' || group === 'Abs') {
      const last = lastTrained(group);
      const prefix = group.toLowerCase() + '-';
      if (last && last.workout.programId.startsWith(prefix) && getProgram(last.workout.programId)) return last.workout.programId;
      return `${prefix}beginner`;
    }
    const custom = [...S.customPrograms].reverse().find((p) => p.group === group);
    return custom ? custom.id : null;
  }

  function suggestion() {
    const groups = [...new Set([...SUGGEST_GROUPS, ...S.customPrograms.map((p) => p.group)])];
    const info = groups.map((g) => ({ group: g, last: lastTrained(g) }));
    const legs = info.find((i) => i.group === 'Legs');
    const verb = (g) => (g === 'Legs' || g === 'Arms' || g === 'Abs' ? 'are' : 'is');
    const total = trainedWorkouts().length;

    if (!legs.last) {
      return { group: 'Legs', programId: 'legs',
        reason: total ? `Legs are due — ${plural(total, 'session')} logged, none of them legs.` : 'No sessions logged yet. Start at the foundation: legs.' };
    }
    const legDays = daysAgo(legs.last.date);
    if (legDays >= 5) {
      return { group: 'Legs', programId: 'legs', reason: `Legs are due — last trained ${legDays} days ago.` };
    }
    const never = info.filter((i) => !i.last && programForGroup(i.group));
    if (never.length) {
      const g = never[0].group;
      return { group: g, programId: programForGroup(g), reason: `${g} ${verb(g)} due — never trained here. Legs were ${agoText(legs.last.date)}.` };
    }
    const oldest = info.filter((i) => programForGroup(i.group)).sort((a, b) => (a.last.date < b.last.date ? -1 : 1))[0];
    const d = daysAgo(oldest.last.date);
    const when = d <= 0 ? 'last trained earlier today' : d === 1 ? 'last trained yesterday' : `last trained ${d} days ago`;
    const lead = d <= 0 ? `Everything has been hit today. ${oldest.group} had the longest rest` : `${oldest.group} ${verb(oldest.group)} due`;
    return { group: oldest.group, programId: programForGroup(oldest.group), reason: `${lead} — ${when}.` };
  }

  /* =========================================================== relative metrics */

  // Pull-ups & push-ups: every rep moves your body plus whatever you strapped on.
  // score = reps × (bodyweight + added) ÷ 100 — load moved, in hundreds of pounds.
  const bodyScore = (reps, bw, added) => (reps * (bw + (added || 0))) / 100;
  const LIFTS = {
    pullup: { label: 'Pull-ups', unit: 'pts' },
    pushup: { label: 'Push-ups', unit: 'pts' },
    carry: { label: 'Kettlebell carry', unit: '' }
  };
  const liftSeriesKey = (l) => (l.type === 'carry' ? `carry-${l.mode}` : l.type);
  const SERIES_LABEL = {
    pullup: 'Pull-ups', pushup: 'Push-ups',
    'carry-distance': 'Kettlebell carry (distance)', 'carry-time': 'Kettlebell carry (time)'
  };
  const SERIES_UNIT = { pullup: 'pts', pushup: 'pts', 'carry-distance': 'lb·m', 'carry-time': 'lb·s' };

  function liftBest(key, excludeId) {
    let best = null;
    for (const l of S.lifts) if (liftSeriesKey(l) === key && l.id !== excludeId && (!best || l.score > best.score)) best = l;
    return best;
  }

  function trainingDays() {
    const days = new Set();
    trainedWorkouts().forEach((w) => w.items.forEach((it) => it.logs.forEach((l) => days.add(dayKey(l.at)))));
    S.lifts.forEach((l) => days.add(dayKey(l.at)));
    return days;
  }
  function streaks() {
    const days = trainingDays();
    if (!days.size) return { current: 0, longest: 0 };
    const sorted = [...days].sort();
    let longest = 1; let run = 1;
    for (let i = 1; i < sorted.length; i++) {
      const gap = Math.round((new Date(sorted[i] + 'T12:00') - new Date(sorted[i - 1] + 'T12:00')) / DAY);
      run = gap === 1 ? run + 1 : 1;
      longest = Math.max(longest, run);
    }
    let current = 0;
    const d = startOfDay(Date.now());
    if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
    while (days.has(dayKey(d))) { current++; d.setDate(d.getDate() - 1); }
    return { current, longest };
  }

  function exerciseRecords() {
    const map = new Map();
    for (const w of trainedWorkouts()) {
      for (const it of w.items) {
        for (const l of it.logs) {
          const key = `${it.exId}|${it.unit}`;
          const r = map.get(key) || { key, name: it.name, unit: it.unit, sets: 0, failures: 0, bestWeight: null, bestCount: null, last: l.at };
          r.sets++;
          if (l.failure) r.failures++;
          if (l.weight > 0 && (!r.bestWeight || l.weight > r.bestWeight.weight || (l.weight === r.bestWeight.weight && (l.reps || 0) > (r.bestWeight.reps || 0)))) r.bestWeight = { weight: l.weight, reps: l.reps, failure: l.failure, at: l.at };
          if (l.reps != null && (!r.bestCount || l.reps > r.bestCount.reps)) r.bestCount = { reps: l.reps, at: l.at };
          if (l.at > r.last) r.last = l.at;
          map.set(key, r);
        }
      }
    }
    return [...map.values()].sort((a, b) => (a.last < b.last ? 1 : -1));
  }

  function seriesData(key) {
    if (SERIES_LABEL[key]) {
      return S.lifts.filter((l) => liftSeriesKey(l) === key).sort((a, b) => (a.at < b.at ? -1 : 1))
        .map((l) => ({ v: l.score, at: l.at })).slice(-12).map((p) => ({ ...p, label: fmtNum(p.v) }));
    }
    const sessions = [];
    let weighted = false;
    for (const w of trainedWorkouts()) {
      const logs = w.items.filter((it) => `${it.exId}|${it.unit}` === key).flatMap((it) => it.logs);
      if (!logs.length) continue;
      const maxW = Math.max(0, ...logs.map((l) => l.weight || 0));
      const maxR = Math.max(0, ...logs.map((l) => l.reps || 0));
      if (maxW > 0) weighted = true;
      sessions.push({ at: workoutDate(w), maxW, maxR, fails: logs.filter((l) => l.failure).length });
    }
    sessions.sort((a, b) => (a.at < b.at ? -1 : 1));
    const suffix = weighted ? 'lb' : (UNIT[key.split('|')[1]] || UNIT.reps).short.trim();
    return sessions.slice(-12).map((s) => {
      const v = weighted ? s.maxW : s.maxR;
      return { v, at: s.at, label: v ? `${fmtNum(v)}${suffix}` : (s.fails ? 'F' : '0') };
    });
  }

  /* =========================================================== rendering: shell */

  const TABS = ['grind', 'programs', 'recover', 'temple'];
  function setTab(tab) {
    ui.tab = tab;
    TABS.forEach((t) => { $(`#tab-${t}`).hidden = t !== tab; });
    document.querySelectorAll('.tabbar button').forEach((b) => {
      if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    renderTab();
    window.scrollTo(0, 0);
  }

  function renderTab() {
    ({ grind: renderGrind, programs: renderPrograms, recover: renderRecover, temple: renderTemple })[ui.tab]();
    renderTopbar();
  }

  function renderAll() {
    renderTab();
    if (ui.detail) renderDetail();
    renderRunner();
    renderRest();
  }

  function renderTopbar() {
    const w = activeWorkout();
    const el = $('#topbar-status');
    if (w && !ui.runnerOpen && ui.tab !== 'grind') el.innerHTML = '<button type="button" data-action="open-runner">Resume workout</button>';
    else if (S.recoverTimer) el.innerHTML = `<button type="button" data-action="tab" data-tab="recover">${esc(S.recoverTimer.activity)} <span data-tick="recover-mini">${fmtElapsed(Date.now() - S.recoverTimer.startedAt)}</span></button>`;
    else el.textContent = GRINDS[S.grind].name;
  }

  function libraryNotice() {
    if (DB.status === 'loading') return '<div class="card"><p class="muted">Loading the exercise library…</p></div>';
    if (DB.status === 'error') {
      return `<div class="card"><h3>Exercise library not loaded</h3><p class="muted">exercises.json could not be read (${esc(DB.error)}). Open the app once with a connection so it can be stored for offline use.</p></div>`;
    }
    return '';
  }

  /* =========================================================== GRIND tab */

  function renderGrind() {
    const w = activeWorkout();
    const sug = DB.status === 'ready' ? suggestion() : null;
    const sugProg = sug && sug.programId ? getProgram(sug.programId) : null;
    const weekStart = startOfWeek();
    const weekWorkouts = trainedWorkouts().filter((x) => new Date(workoutDate(x)) >= weekStart);
    const weekSets = weekWorkouts.reduce((n, x) => n + loggedSets(x), 0);
    const weekRecover = S.recover.filter((r) => new Date(r.at) >= weekStart).reduce((n, r) => n + r.minutes, 0);
    const last = trainedWorkouts().sort((a, b) => (workoutDate(a) < workoutDate(b) ? 1 : -1))[0];

    $('#tab-grind').innerHTML = `
      ${w ? `<div class="banner"><div><b>Workout in progress</b><span class="small">${esc(w.programName)} · ${plural(loggedSets(w), 'set')} logged</span></div><button type="button" class="btn" data-action="open-runner">Resume</button></div>` : ''}
      <h1 class="page-title">Grind</h1>
      <p class="page-sub">Choose today's track. The spirit is the work.</p>
      <div class="grind-pick">
        ${Object.values(GRINDS).map((g) => `
          <button type="button" class="grind-card" data-action="set-grind" data-grind="${g.id}" aria-pressed="${S.grind === g.id}">
            ${S.grind === g.id ? '<span class="g-check">TODAY</span>' : ''}
            <div class="g-name">${esc(g.name)}</div>
            <div class="g-motto">${esc(g.motto)}</div>
            <div class="g-focus">${esc(g.focus)}</div>
            <div class="g-rule">${esc(g.rule)}</div>
          </button>`).join('')}
      </div>

      <div class="section-title">Suggested today</div>
      ${libraryNotice()}
      ${sugProg ? `
        <div class="card accent suggest">
          <div class="eyebrow">${esc(GRINDS[S.grind].short)} · ${esc(sug.group)}</div>
          <h3>${esc(programTitle(sugProg))}</h3>
          <p class="reason">${esc(sug.reason)}</p>
          <p class="muted small">${plural(sugProg.items.length, 'exercise')} · ${esc(sugProg.blurb)}</p>
          <div class="btn-row">
            <button type="button" class="btn primary" data-action="start" data-program="${esc(sugProg.id)}">Start</button>
            <button type="button" class="btn ghost" data-action="open-program" data-program="${esc(sugProg.id)}">See the work</button>
          </div>
        </div>` : ''}
      ${DB.status === 'ready' ? '<button type="button" class="btn block ghost" data-action="tab" data-tab="programs">Pick your own program</button>' : ''}

      <div class="section-title">This week</div>
      <div class="stat-row">
        <div class="stat"><b>${weekWorkouts.length}</b><span>Sessions</span></div>
        <div class="stat"><b>${weekSets}</b><span>Sets</span></div>
        <div class="stat"><b>${weekRecover}</b><span>Recover min</span></div>
      </div>
      ${last ? `<p class="muted small" style="margin-top:12px">Last session: ${esc(last.programName)} (${esc(GRINDS[last.grind].short)}), ${esc(agoText(workoutDate(last)))}.</p>` : ''}
    `;
  }

  /* =========================================================== PROGRAMS tab */

  function progCard(p) {
    return `<button type="button" class="prog-card" data-action="open-program" data-program="${esc(p.id)}">
      <div><div class="p-tier">${esc(p.custom ? p.name : p.tier)}</div>
      <div class="p-meta">${plural(p.items.length, 'exercise')} · ${esc(p.custom ? `"I want ${p.goal}"` : p.blurb)}</div></div>
      <div class="p-arrow" aria-hidden="true">›</div></button>`;
  }

  function renderPrograms() {
    const el = $('#tab-programs');
    if (DB.status !== 'ready') {
      el.innerHTML = `<h1 class="page-title">Programs</h1><p class="page-sub">The routines.</p>${libraryNotice()}`;
      return;
    }
    const groups = ['Arms', 'Abs', 'Legs'];
    const d = ui.goalDraft;
    el.innerHTML = `
      <h1 class="page-title">Programs</h1>
      <p class="page-sub">The routines. Large muscles first, small muscles last.</p>

      ${groups.map((g) => {
        const ps = BUILTIN.filter((p) => p.group === g);
        return `<div class="group-head"><h2>${g}</h2><span>${ps.length > 1 ? 'Three tiers' : 'One routine'}</span></div>
          <div class="tier-list">${ps.map(progCard).join('')}</div>`;
      }).join('')}

      <div class="group-head"><h2>Yours</h2><span>Freedom of will</span></div>
      <form class="card" data-form="goal" autocomplete="off">
        <label class="field"><span>I want ___</span>
          <input class="input" name="goal" placeholder="glutes, bigger arms, a stronger back…" value="${esc(ui.goalText)}" enterkeyhint="go">
        </label>
        <button type="submit" class="btn primary block">Build my program</button>
        ${ui.goalError ? `<p class="small" style="color:var(--ember);margin-top:10px">${esc(ui.goalError)}</p>` : ''}
      </form>
      ${d ? `
        <div class="card accent" id="goal-draft">
          <div class="eyebrow">Built for: I want ${esc(d.goal)}</div>
          <h3>${esc(d.name)}</h3>
          <p class="goal-note">Everything goes hand-in-hand.</p>
          <p class="muted small">${esc(d.name)} work first, then connected work: ${esc(d.connectedLabels.join(' and ').toLowerCase())}.</p>
          <ol class="ex-list">${d.items.map(exItemHtml).join('')}</ol>
          <div class="btn-row">
            <button type="button" class="btn primary" data-action="save-goal">Save program</button>
            <button type="button" class="btn ghost" data-action="discard-goal">Discard</button>
          </div>
        </div>` : ''}
      ${S.customPrograms.length ? `<div class="tier-list">${S.customPrograms.map(progCard).join('')}</div>` : '<p class="muted small">Saved programs land here.</p>'}

      <div class="group-head"><h2>Library</h2><span>wger.de</span></div>
      <div class="lib-tools">
        <input class="input" type="search" data-input="lib-query" placeholder="Search ${DB.list.length} exercises" value="${esc(ui.libQuery)}" aria-label="Search exercises">
        <div class="chips" role="group" aria-label="Category">
          ${['All', ...categories()].map((c) => `<button type="button" class="chip" data-action="lib-cat" data-cat="${esc(c)}" aria-pressed="${ui.libCat === c}">${esc(c)}</button>`).join('')}
        </div>
      </div>
      <div id="lib-results"></div>
    `;
    renderLibraryList();
  }

  function renderLibraryList() {
    const box = $('#lib-results');
    if (!box) return;
    const q = ui.libQuery.trim().toLowerCase();
    const list = DB.list.filter((e) => (ui.libCat === 'All' || e.category === ui.libCat) &&
      (!q || e.name.toLowerCase().includes(q) || e.muscles.some((m) => m.toLowerCase().includes(q)) || e.equipment.some((m) => m.toLowerCase().includes(q))));
    box.innerHTML = `<div class="lib-count">${list.length} of ${DB.list.length} exercises</div>
      ${list.length ? `<ul class="lib-list">${list.map((e) => `<li><details>
        <summary><b>${esc(e.name)}</b><span>${esc(e.category)}</span></summary>
        <div class="lib-body">
          <p>${esc(e.description || 'No description in the library.')}</p>
          <div>${e.muscles.length ? `Muscles: ${esc(e.muscles.join(', '))}` : 'Muscles: not listed'}${e.muscles2.length ? ` · Secondary: ${esc(e.muscles2.join(', '))}` : ''}</div>
          <div>Equipment: ${esc(e.equipment.join(', ') || 'not listed')}</div>
        </div></details></li>`).join('')}</ul>` : '<p class="empty">Nothing matches. Try a muscle or a piece of equipment.</p>'}`;
  }

  function exItemHtml(item) {
    const ex = exById(item.ex);
    const t = { sets: item.sets, reps: item.reps, unit: item.unit || 'reps' };
    const name = item.label || (ex ? ex.name : `Exercise ${item.ex}`);
    return `<li class="ex-item">
      <div class="ex-head"><div class="ex-name">${esc(name)}</div><div class="ex-target">${targetText(t)}</div></div>
      ${ex && item.label && item.label !== ex.name ? `<div class="ex-lib">Library: ${esc(ex.name)}</div>` : ''}
      ${item.connected ? `<div style="margin-top:6px"><span class="tag accent">Connected work · ${esc(item.connected)}</span></div>` : ''}
      <div class="ex-desc">${esc(ex ? ex.description || 'No description in the library.' : 'Not found in exercises.json.')}</div>
      <div class="ex-meta">Rest ${item.rest}s${item.note ? ` · ${esc(item.note)}` : ''}${ex && ex.equipment.length ? ` · ${esc(ex.equipment.join(', '))}` : ''}</div>
    </li>`;
  }

  /* =========================================================== program detail sheet */

  function openProgram(id) {
    if (!getProgram(id)) return;
    const wasOpen = !!ui.detail;
    ui.detail = id;
    if (!wasOpen) history.pushState({ otg: 'detail' }, '');
    renderDetail();
  }
  function closeDetail(fromPop) {
    if (!ui.detail) return;
    ui.detail = null;
    $('#detail').hidden = true;
    if (!fromPop && history.state && history.state.otg === 'detail') history.back();
  }

  function renderDetail() {
    const el = $('#detail');
    const p = ui.detail && getProgram(ui.detail);
    if (!p) { el.hidden = true; ui.detail = null; return; }
    const g = GRINDS[S.grind];
    el.hidden = false;
    el.innerHTML = `<div class="sheet-inner">
      <div class="sheet-top">
        <button type="button" class="btn ghost sm" data-action="close-detail">‹ Back</button>
        ${p.custom ? '<button type="button" class="btn danger sm" data-action="delete-program">Delete</button>' : ''}
      </div>
      <div class="eyebrow">${esc(p.custom ? `I want ${p.goal}` : p.name)}</div>
      <h1 class="page-title">${esc(p.custom ? p.name : p.tier)}</h1>
      <p class="page-sub">${esc(p.blurb)}</p>
      ${p.custom ? '<p class="goal-note">Everything goes hand-in-hand.</p>' : ''}
      <ol class="ex-list">${p.items.map(exItemHtml).join('')}</ol>
      <p class="muted small">Base prescription shown. Today's grind is <b>${esc(g.name)}</b>: ${esc(g.rule.replace(/^Targets: /, ''))}</p>
      <div class="sticky-start">
        <button type="button" class="btn primary big block" data-action="start" data-program="${esc(p.id)}">Start — ${esc(g.short)}</button>
      </div>
    </div>`;
    el.scrollTop = 0;
  }

  /* =========================================================== workout runner */

  function startWorkout(programId) {
    if (DB.status !== 'ready') { toast('The exercise library is still loading.'); return; }
    const p = getProgram(programId);
    if (!p) return;
    const current = activeWorkout();
    if (current) {
      if (!confirm(`"${current.programName}" is still in progress. End it and start ${programTitle(p)}?`)) { openRunner(); return; }
      endWorkout(current, false);
    }
    const items = p.items.map((item) => {
      const ex = exById(item.ex);
      const t = applyGrind(item, S.grind);
      return {
        exId: String(item.ex), name: item.label || (ex ? ex.name : `Exercise ${item.ex}`), libName: ex ? ex.name : '',
        unit: t.unit, sets: t.sets, reps: t.reps, rest: t.rest,
        weighted: t.unit === 'reps' && !isBodyweight(ex), note: item.note || '', logs: []
      };
    });
    const w = { id: uid(), programId: p.id, programName: programTitle(p), group: p.group, grind: S.grind, startedAt: nowIso(), endedAt: null, cursor: 0, items };
    S.workouts.push(w);
    S.activeWorkoutId = w.id;
    S.rest = null;
    save();
    closeDetail();
    openRunner();
  }

  function openRunner() {
    ui.runnerOpen = true;
    renderRunner();
    renderRest();
    requestWakeLock();
  }
  function minimizeRunner() {
    ui.runnerOpen = false;
    ui.summaryId = null;
    $('#runner').hidden = true;
    releaseWakeLock();
    renderTab();
  }

  const nextUnfinished = (w, from) => {
    for (let k = 1; k <= w.items.length; k++) {
      const i = (from + k) % w.items.length;
      if (w.items[i].logs.length < w.items[i].sets) return i;
    }
    return -1;
  };

  function lastWeightFor(exId) {
    for (let i = S.workouts.length - 1; i >= 0; i--) {
      const w = S.workouts[i];
      for (const it of w.items) {
        if (it.exId !== exId) continue;
        for (let j = it.logs.length - 1; j >= 0; j--) if (it.logs[j].weight > 0) return it.logs[j].weight;
      }
    }
    return null;
  }

  function draftFor(w) {
    const it = w.items[w.cursor];
    const key = `${w.id}:${w.cursor}:${it.logs.length}`;
    if (!ui.draft || ui.draft.key !== key) {
      const prev = it.logs[it.logs.length - 1];
      ui.draft = { key, count: it.reps, weight: prev && prev.weight != null ? prev.weight : (it.weighted ? lastWeightFor(it.exId) : null) };
    }
    return ui.draft;
  }

  function logText(l, it) {
    if (l.failure) return `<span class="f">TO FAILURE</span>${l.weight ? ` @ ${fmtNum(l.weight)} lb` : ''}`;
    const u = it.unit === 'reps' ? plural(l.reps, 'rep') : `${l.reps}${UNIT[it.unit].short}`;
    return `${u}${l.weight ? ` @ ${fmtNum(l.weight)} lb` : ''}`;
  }

  function renderRunner() {
    const el = $('#runner');
    if (ui.summaryId) { renderSummary(); return; }
    const w = activeWorkout();
    if (!w || !ui.runnerOpen) { el.hidden = true; return; }
    el.hidden = false;
    const it = w.items[w.cursor];
    const ex = exById(it.exId);
    const done = it.logs.length;
    const complete = done >= it.sets;
    const totalSets = w.items.reduce((n, x) => n + x.sets, 0);
    const pct = Math.min(100, Math.round((loggedSets(w) / totalSets) * 100));
    const d = draftFor(w);
    const hasAnyLog = loggedSets(w) > 0;
    const g = GRINDS[w.grind];

    el.innerHTML = `<div class="runner-inner">
      <div class="runner-top">
        <button type="button" class="btn ghost sm" data-action="minimize-runner">‹ Tabs</button>
        <div class="mid"><div class="eyebrow">${esc(g.short)} grind</div><div>${esc(w.programName)}</div></div>
        <button type="button" class="btn sm" data-action="finish-workout">Finish</button>
      </div>
      <div class="progress" aria-label="Workout progress"><span style="width:${pct}%"></span></div>
      <div class="eyebrow">Exercise ${w.cursor + 1} of ${w.items.length}</div>
      <h2 class="r-name">${esc(it.name)}</h2>
      ${it.libName && it.libName !== it.name ? `<div class="r-lib">Library: ${esc(it.libName)}</div>` : ''}
      <div class="r-target">Target ${targetText(it)} · rest ${it.rest}s</div>
      ${it.note ? `<div class="r-note">${esc(it.note)}</div>` : ''}
      <div class="pips">${Array.from({ length: it.sets }, (_, i) => {
        const l = it.logs[i];
        return `<span class="pip ${l ? (l.failure ? 'fail' : 'done') : i === done ? 'now' : ''}"></span>`;
      }).join('')}</div>

      ${complete ? `
        <div class="card" style="text-align:center;margin-top:14px">
          <h3>Exercise complete.</h3>
          <p class="muted">Carry the load longer.</p>
          ${nextUnfinished(w, w.cursor) >= 0
            ? `<button type="button" class="btn primary block" data-action="goto-ex" data-i="${nextUnfinished(w, w.cursor)}">Next: ${esc(w.items[nextUnfinished(w, w.cursor)].name)}</button>`
            : '<button type="button" class="btn primary block" data-action="finish-workout">Finish workout</button>'}
        </div>` : `
        <div class="set-label">SET ${done + 1} OF ${it.sets}</div>
        <div class="counter">
          <button type="button" data-action="count" data-d="-1" aria-label="Less">−</button>
          <output id="count" class="num" aria-live="polite">${d.count}</output>
          <button type="button" data-action="count" data-d="1" aria-label="More">+</button>
        </div>
        <div class="counter-unit">${UNIT[it.unit].label}</div>
        ${it.unit === 'min' ? '' : `<div class="weight-field">
          <label for="weight">${it.weighted ? 'Weight (lb)' : 'Added weight (lb)'}</label>
          <input id="weight" class="input" type="number" inputmode="decimal" min="0" step="2.5" data-input="weight" value="${d.weight ?? ''}" placeholder="${it.weighted ? '0' : 'none'}">
        </div>`}
        <div class="r-actions">
          <button type="button" class="btn primary big" data-action="log-set">Log set</button>
          <button type="button" class="btn ember big" data-action="log-failure">To failure</button>
        </div>
        <p class="r-hint">Lost count? Tap TO FAILURE. The effort is logged, not the number.</p>`}

      ${done ? `<ul class="logged">${it.logs.map((l, i) => `<li><span>Set ${i + 1}</span><span>${logText(l, it)}</span></li>`).join('')}</ul>` : ''}

      <div class="r-nav">
        ${w.cursor > 0 ? `<button type="button" class="btn ghost sm" data-action="goto-ex" data-i="${w.cursor - 1}">‹ Prev</button>` : '<span></span>'}
        ${hasAnyLog ? '<button type="button" class="btn ghost sm" data-action="undo-set">Undo last set</button>' : ''}
        ${w.cursor < w.items.length - 1 ? `<button type="button" class="btn ghost sm" data-action="goto-ex" data-i="${w.cursor + 1}">Next ›</button>` : '<span></span>'}
      </div>

      <details class="r-desc"><summary>How it's done</summary><p>${esc(ex ? ex.description || 'No description in the library.' : 'Not found in exercises.json.')}</p></details>
    </div>`;
  }

  function readWeight() {
    const input = $('#weight');
    if (!input) return null;
    const v = num(input.value);
    return v && v > 0 ? v : null;
  }

  function logSet(failure) {
    const w = activeWorkout();
    if (!w) return;
    const it = w.items[w.cursor];
    if (it.logs.length >= it.sets) return;
    unlockAudio();
    const d = draftFor(w);
    const weight = readWeight();
    it.logs.push({ reps: failure ? null : d.count, weight, failure, at: nowIso() });
    const next = it.logs.length >= it.sets ? nextUnfinished(w, w.cursor) : w.cursor;
    if (next === -1) {
      save();
      endWorkout(w, true);
      return;
    }
    const nextIt = w.items[next];
    w.cursor = next;
    S.rest = {
      workoutId: w.id, endsAt: Date.now() + it.rest * 1000, total: it.rest * 1000,
      next: `${nextIt.name} — set ${nextIt.logs.length + 1} of ${nextIt.sets}`
    };
    save();
    renderRunner();
    renderRest();
    if (failure) toast('Logged to failure. Effort over count.');
  }

  function undoSet() {
    const w = activeWorkout();
    if (!w) return;
    let target = null;
    w.items.forEach((it, i) => {
      const l = it.logs[it.logs.length - 1];
      if (l && (!target || l.at > target.at)) target = { at: l.at, i };
    });
    if (!target) return;
    w.items[target.i].logs.pop();
    w.cursor = target.i;
    S.rest = null;
    save();
    renderRunner();
    renderRest();
  }

  function endWorkout(w, showSummary) {
    w.endedAt = nowIso();
    if (S.activeWorkoutId === w.id) S.activeWorkoutId = null;
    S.rest = null;
    if (!loggedSets(w)) S.workouts = S.workouts.filter((x) => x.id !== w.id);
    save();
    releaseWakeLock();
    if (showSummary && loggedSets(w)) { ui.summaryId = w.id; ui.runnerOpen = true; }
    else { ui.runnerOpen = false; }
    renderAll();
  }

  function finishWorkout() {
    const w = activeWorkout();
    if (!w) return;
    const logged = loggedSets(w);
    const total = w.items.reduce((n, x) => n + x.sets, 0);
    if (!logged) {
      if (!confirm('Nothing logged yet. Discard this workout?')) return;
    } else if (logged < total && !confirm(`${logged} of ${total} sets logged. Finish here? Unlogged sets stay unlogged.`)) {
      return;
    }
    endWorkout(w, true);
  }

  function renderSummary() {
    const w = S.workouts.find((x) => x.id === ui.summaryId);
    const el = $('#runner');
    if (!w) { ui.summaryId = null; el.hidden = true; return; }
    el.hidden = false;
    const sets = loggedSets(w);
    const fails = w.items.reduce((n, it) => n + it.logs.filter((l) => l.failure).length, 0);
    const mins = Math.max(1, Math.round((new Date(w.endedAt || Date.now()) - new Date(w.startedAt)) / 60000));
    el.innerHTML = `<div class="runner-inner">
      <div class="done-hero">
        <div class="eyebrow">${esc(GRINDS[w.grind].name)}</div>
        <div class="big">Work done.</div>
        <p class="muted">The spirit is the work.</p>
      </div>
      <div class="stat-row">
        <div class="stat"><b>${sets}</b><span>Sets</span></div>
        <div class="stat"><b>${fails}</b><span>To failure</span></div>
        <div class="stat"><b>${mins}</b><span>Minutes</span></div>
      </div>
      <div class="card" style="margin-top:12px">
        <h3>${esc(w.programName)}</h3>
        <ul class="pr-list">${w.items.filter((it) => it.logs.length).map((it) => `<li><div class="pr-name">${esc(it.name)}</div>
          <div class="pr-val">${it.logs.length}/${it.sets}<small>${it.logs.map((l) => (l.failure ? 'F' : l.reps)).join(' · ')}</small></div></li>`).join('')}</ul>
      </div>
      <button type="button" class="btn primary big block" data-action="close-summary">Back to the temple</button>
    </div>`;
    el.scrollTop = 0;
  }

  /* ---------- rest timer */

  function renderRest() {
    const el = $('#rest');
    const r = S.rest;
    const w = activeWorkout();
    if (!r || !w || r.workoutId !== w.id || !ui.runnerOpen || ui.summaryId) { el.hidden = true; return; }
    if (r.endsAt <= Date.now()) { endRest(false); return; }
    el.hidden = false;
    el.innerHTML = `
      <div class="r-label">REST</div>
      <div class="r-clock" data-tick="rest">${fmtCountdown(r.endsAt - Date.now())}</div>
      <div class="r-bar"><span data-tick="rest-bar" style="width:${Math.max(0, ((r.endsAt - Date.now()) / r.total) * 100)}%"></span></div>
      <div class="r-next">Next: ${esc(r.next)}</div>
      <div class="btn-row">
        <button type="button" class="btn ghost sm" data-action="rest-add" data-s="-15">−15s</button>
        <button type="button" class="btn ghost sm" data-action="rest-add" data-s="15">+15s</button>
      </div>
      <div class="r-skip">TAP ANYWHERE TO SKIP</div>`;
  }

  function endRest(alert) {
    S.rest = null;
    save();
    $('#rest').hidden = true;
    if (alert) {
      beep();
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
    renderRunner();
  }

  /* ---------- audio + wake lock */

  let actx = null;
  function unlockAudio() {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
    } catch (e) { actx = null; }
  }
  function beep() {
    if (!actx) return;
    try {
      const t = actx.currentTime;
      [0, 0.22, 0.44].forEach((dt, i) => {
        const o = actx.createOscillator(); const gn = actx.createGain();
        o.frequency.value = i === 2 ? 1175 : 880;
        gn.gain.setValueAtTime(0.0001, t + dt);
        gn.gain.exponentialRampToValueAtTime(0.35, t + dt + 0.02);
        gn.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.18);
        o.connect(gn).connect(actx.destination);
        o.start(t + dt); o.stop(t + dt + 0.2);
      });
    } catch (e) { /* no audio available */ }
  }

  let wakeLock = null;
  async function requestWakeLock() {
    try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } }
    catch (e) { wakeLock = null; }
  }
  function releaseWakeLock() { if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } }

  /* =========================================================== RECOVER tab */

  const ACTIVITIES = ['Basketball', 'Tennis', 'Steam room', 'Sauna', 'Hot tub', 'Cold plunge'];
  const HEAT = /steam|sauna|hot tub|cold plunge/i;

  function recoverLine(r) {
    return `${r.activity} — ${r.minutes} min`;
  }

  function renderRecover() {
    const el = $('#tab-recover');
    const weekStart = startOfWeek();
    const week = S.recover.filter((r) => new Date(r.at) >= weekStart);
    const total = week.reduce((n, r) => n + r.minutes, 0);
    const by = {};
    week.forEach((r) => { by[r.activity] = (by[r.activity] || 0) + r.minutes; });
    const t = S.recoverTimer;
    const act = ui.recoverActivity || (S.recover[0] && S.recover[0].activity) || 'Sauna';
    ui.recoverActivity = act;

    el.innerHTML = `
      <h1 class="page-title">Recover</h1>
      <p class="page-sub">The work continues off the floor.</p>

      <div class="card week-total">
        <div class="eyebrow">This week</div>
        <b class="num">${total}</b> <span class="muted">min</span>
        <div class="breakdown">${Object.keys(by).length ? Object.entries(by).map(([a, m]) => `<span class="tag">${esc(a)} ${m}</span>`).join('') : '<span class="muted small">Nothing yet this week.</span>'}</div>
      </div>

      ${t ? `
        <div class="card accent timer-card">
          <div class="eyebrow">Till I couldn't</div>
          <h3>${esc(t.activity)}</h3>
          <div class="timer-clock" data-tick="recover">${fmtElapsed(Date.now() - t.startedAt)}</div>
          <form data-form="timer-meta" autocomplete="off">
            <div class="grid-2">
              <label class="field"><span>Temp °F</span><input class="input" name="temp" type="number" inputmode="decimal" data-input="timer-meta" value="${esc(t.temp ?? '')}" placeholder="optional"></label>
              <label class="field"><span>Note</span><input class="input" name="note" data-input="timer-meta" value="${esc(t.note || '')}" placeholder="optional"></label>
            </div>
          </form>
          <button type="button" class="btn primary big block" data-action="stop-recover-timer">Stop &amp; log</button>
          <button type="button" class="linkish" data-action="cancel-recover-timer" style="margin-top:8px">Discard timer</button>
        </div>` : `
        <form class="card" data-form="recover" autocomplete="off">
          <div class="field"><span>Activity</span>
            <div class="chips" role="radiogroup">${ACTIVITIES.map((a) => `<label class="chip"><input type="radio" name="activity" value="${esc(a)}" data-input="recover-activity" ${a === act ? 'checked' : ''}><span>${esc(a)}</span></label>`).join('')}</div>
          </div>
          <div class="grid-3">
            <label class="field"><span>Minutes</span><input class="input" name="minutes" type="number" inputmode="numeric" min="1" placeholder="20"></label>
            <label class="field"><span>Temp °F</span><input class="input" name="temp" type="number" inputmode="decimal" placeholder="${HEAT.test(act) ? 'optional' : '—'}"></label>
            <label class="field"><span>Note</span><input class="input" name="note" placeholder="optional"></label>
          </div>
          <div class="btn-row">
            <button type="submit" class="btn">Log minutes</button>
            <button type="button" class="btn primary" data-action="start-recover-timer">Till I couldn't</button>
          </div>
          <p class="muted small" style="margin-top:10px">Till I couldn't: start the clock, stop when you're done. The time logs itself.</p>
        </form>`}

      <div class="section-title">Log</div>
      <div class="card">
        ${S.recover.length ? `<ul class="entry-list">${S.recover.slice(0, 40).map((r) => `
          <li><div><div class="e-main">${esc(recoverLine(r))}</div>
          <div class="e-sub">${esc(fmtDateLong(r.at))}${r.timed ? ' · till I couldn\'t' : ''}${r.temp != null ? ` · ${fmtNum(r.temp)}°F` : ''}${r.note ? ` · ${esc(r.note)}` : ''}</div></div>
          <button type="button" class="icon-btn" data-action="delete-recover" data-id="${esc(r.id)}" aria-label="Delete entry">×</button></li>`).join('')}</ul>`
        : '<p class="empty">No recovery logged. Recovery is part of the work.</p>'}
      </div>`;
  }

  function addRecover(entry) {
    S.recover.unshift({ id: uid(), at: nowIso(), ...entry });
    save();
    toast(`${recoverLine(S.recover[0])} saved.`);
  }

  /* =========================================================== TEMPLE tab */

  function renderTemple() {
    const el = $('#tab-temple');
    const bw = S.bodyweight;
    const st = streaks();
    const recs = exerciseRecords();
    const seriesKeys = [
      ...Object.keys(SERIES_LABEL).filter((k) => S.lifts.some((l) => liftSeriesKey(l) === k)),
      ...recs.map((r) => r.key)
    ];
    if (!seriesKeys.includes(ui.historySeries)) ui.historySeries = seriesKeys[0] || null;
    const sname = (k) => SERIES_LABEL[k] || (recs.find((r) => r.key === k) || {}).name || k;
    const bars = ui.historySeries ? seriesData(ui.historySeries) : [];
    const maxBar = Math.max(0, ...bars.map((b) => b.v));
    const history = trainedWorkouts().sort((a, b) => (workoutDate(a) < workoutDate(b) ? 1 : -1));
    const lt = ui.liftType;

    el.innerHTML = `
      <h1 class="page-title">Temple</h1>
      <p class="page-sub">You against you. No leaderboard but your own.</p>

      <form class="card" data-form="bodyweight" autocomplete="off">
        <div class="inline-form">
          <label class="field"><span>Bodyweight (lb)</span>
            <input class="input" name="bw" type="number" inputmode="decimal" min="50" max="700" step="0.1" value="${bw ?? ''}" placeholder="Enter your weight" required>
          </label>
          <button type="submit" class="btn primary">Save</button>
        </div>
        <p class="muted small" style="margin-top:8px">${bw ? `Current: ${fmtNum(bw)} lb${S.bodyweightLog.length ? ` · set ${esc(fmtDate(S.bodyweightLog[S.bodyweightLog.length - 1].at))}` : ''}. Every relative score uses the bodyweight at the moment you log it.` : 'Needed for relative scores on pull-ups and push-ups.'}</p>
      </form>

      <div class="section-title">Relative lifts</div>
      <form class="card" data-form="lift" autocomplete="off">
        <div class="chips" role="radiogroup" style="margin-bottom:14px">
          ${Object.entries(LIFTS).map(([k, v]) => `<label class="chip"><input type="radio" name="type" value="${k}" data-input="lift-type" ${lt === k ? 'checked' : ''}><span>${esc(v.label)}</span></label>`).join('')}
        </div>
        ${lt === 'carry' ? `
          <div class="chips" role="radiogroup" style="margin-bottom:12px">
            <label class="chip"><input type="radio" name="mode" value="distance" data-input="carry-mode" ${ui.carryMode === 'distance' ? 'checked' : ''}><span>Laps × track</span></label>
            <label class="chip"><input type="radio" name="mode" value="time" data-input="carry-mode" ${ui.carryMode === 'time' ? 'checked' : ''}><span>Time</span></label>
          </div>
          <label class="field"><span>Kettlebell weight (lb, total carried)</span><input class="input" name="weight" type="number" inputmode="decimal" min="0" step="any" required></label>
          ${ui.carryMode === 'distance' ? `
            <div class="grid-2">
              <label class="field"><span>Laps</span><input class="input" name="laps" type="number" inputmode="decimal" min="0" step="any" required></label>
              <label class="field"><span>Track length (m)</span><input class="input" name="track" type="number" inputmode="decimal" min="1" step="any" value="${esc(S.lastTrackLength)}" required></label>
            </div>` : `
            <div class="grid-2">
              <label class="field"><span>Minutes</span><input class="input" name="min" type="number" inputmode="numeric" min="0" value="0"></label>
              <label class="field"><span>Seconds</span><input class="input" name="sec" type="number" inputmode="numeric" min="0" max="59" value="0"></label>
            </div>`}
        ` : `
          <div class="grid-2">
            <label class="field"><span>Reps</span><input class="input" name="reps" type="number" inputmode="numeric" min="1" step="1" required></label>
            <label class="field"><span>Added weight (lb)</span><input class="input" name="added" type="number" inputmode="decimal" min="0" step="any" placeholder="vest, belt… 0"></label>
          </div>`}
        <div class="score-preview" id="score-preview"></div>
        <button type="submit" class="btn primary block">Log it</button>
        ${ui.lastLiftResult ? `<div class="result">${ui.lastLiftResult}</div>` : ''}
      </form>

      <div class="section-title">Personal records</div>
      <div class="card">
        ${Object.keys(SERIES_LABEL).some((k) => liftBest(k)) || recs.length ? `<ul class="pr-list">
          ${Object.keys(SERIES_LABEL).map((k) => {
            const b = liftBest(k);
            if (!b) return '';
            const latest = S.lifts.filter((l) => liftSeriesKey(l) === k).sort((a, c) => (a.at < c.at ? 1 : -1))[0];
            const pct = Math.round((latest.score / b.score) * 100);
            return `<li><div><div class="pr-name">${esc(SERIES_LABEL[k])}</div><div class="pr-sub">${esc(fmtDateLong(b.at))} · latest is ${pct}% of best</div></div>
              <div class="pr-val">${fmtNum(b.score)} ${SERIES_UNIT[k]}<small>${esc(liftDetail(b))}</small></div></li>`;
          }).join('')}
          ${recs.map((r) => {
            const best = r.bestWeight
              ? { v: `${fmtNum(r.bestWeight.weight)} lb`, s: r.bestWeight.failure ? 'to failure' : `× ${r.bestWeight.reps}`, at: r.bestWeight.at }
              : r.bestCount ? { v: `${r.bestCount.reps}${r.unit === 'reps' ? ' reps' : UNIT[r.unit].short}`, s: 'best set', at: r.bestCount.at }
              : { v: 'To failure', s: `${r.failures} sets`, at: r.last };
            return `<li><div><div class="pr-name">${esc(r.name)}</div><div class="pr-sub">${esc(fmtDateLong(best.at))} · ${plural(r.sets, 'set')}${r.failures ? `, ${r.failures} to failure` : ''}</div></div>
              <div class="pr-val">${esc(best.v)}<small>${esc(best.s)}</small></div></li>`;
          }).join('')}
        </ul>` : '<p class="empty">No records yet. Log a set and the temple starts keeping score.</p>'}
      </div>

      <div class="section-title">Streaks</div>
      <div class="stat-row">
        <div class="stat"><b>${st.current}</b><span>Day streak</span></div>
        <div class="stat"><b>${st.longest}</b><span>Longest</span></div>
        <div class="stat"><b>${history.length}</b><span>Sessions</span></div>
      </div>

      <div class="section-title">History</div>
      <div class="card">
        ${seriesKeys.length ? `
          <select class="input" data-input="history-series" aria-label="Exercise">
            ${seriesKeys.map((k) => `<option value="${esc(k)}" ${k === ui.historySeries ? 'selected' : ''}>${esc(sname(k))}</option>`).join('')}
          </select>
          <div class="bars">${bars.map((b) => `<div class="bar ${b.v === maxBar && maxBar > 0 ? 'best' : ''}"><div class="v">${esc(b.label)}</div>
            <div class="fill" style="height:${maxBar ? Math.max(3, (b.v / maxBar) * 100) : 3}%"></div><div class="d">${esc(fmtDate(b.at))}</div></div>`).join('')}</div>
          <p class="muted small" style="margin-top:8px">Last ${bars.length} ${bars.length === 1 ? 'entry' : 'entries'}. Gold is your best.</p>`
        : '<p class="empty">Bars appear once you have history.</p>'}
      </div>

      <div class="card">
        <h3 style="margin-bottom:6px">Sessions</h3>
        ${history.length ? `<ul class="entry-list">${history.slice(0, 30).map((w) => {
          const f = w.items.reduce((n, it) => n + it.logs.filter((l) => l.failure).length, 0);
          return `<li><div><div class="e-main">${esc(w.programName)}</div>
            <div class="e-sub">${esc(fmtDateLong(workoutDate(w)))} · ${esc(GRINDS[w.grind].short)} · ${plural(loggedSets(w), 'set')}${f ? `, ${f} to failure` : ''}${w.id === S.activeWorkoutId ? ' · in progress' : ''}</div></div>
            ${w.id === S.activeWorkoutId ? '' : `<button type="button" class="icon-btn" data-action="delete-workout" data-id="${esc(w.id)}" aria-label="Delete session">×</button>`}</li>`;
        }).join('')}</ul>` : '<p class="empty">No sessions yet.</p>'}
      </div>

      <div class="section-title">Settings</div>
      <div class="card">
        <p class="credit">Exercise data: wger.de (CC BY-SA).</p>
        <p class="muted small">Everything lives on this phone. No account, no cloud.</p>
        <div class="btn-row">
          <button type="button" class="btn sm" data-action="export">Export my data</button>
          <button type="button" class="btn danger sm" data-action="reset">Erase everything</button>
        </div>
      </div>`;
    updateLiftPreview();
  }

  function liftDetail(l) {
    if (l.type === 'carry') {
      return l.mode === 'distance'
        ? `${fmtNum(l.weight)} lb × ${fmtNum(l.laps)} laps × ${fmtNum(l.track)} m`
        : `${fmtNum(l.weight)} lb × ${fmtElapsed(l.seconds * 1000)}`;
    }
    return `${l.reps} reps @ ${fmtNum(l.bw)}${l.added ? ` + ${fmtNum(l.added)}` : ''} lb`;
  }

  function readLiftForm(form) {
    const f = new FormData(form);
    const type = ui.liftType;
    if (type === 'carry') {
      const weight = num(f.get('weight'));
      if (ui.carryMode === 'distance') {
        const laps = num(f.get('laps')); const track = num(f.get('track'));
        if (!(weight > 0 && laps > 0 && track > 0)) return { error: 'Enter weight, laps and track length.' };
        return { type, mode: 'distance', weight, laps, track, distance: laps * track, score: weight * laps * track };
      }
      const seconds = (num(f.get('min')) || 0) * 60 + (num(f.get('sec')) || 0);
      if (!(weight > 0 && seconds > 0)) return { error: 'Enter weight and time.' };
      return { type, mode: 'time', weight, seconds, score: weight * seconds };
    }
    const reps = Math.round(num(f.get('reps')) || 0);
    const added = Math.max(0, num(f.get('added')) || 0);
    if (!S.bodyweight) return { error: 'Set your bodyweight first.' };
    if (!(reps > 0)) return { error: 'Enter your reps.' };
    return { type, reps, added, bw: S.bodyweight, score: bodyScore(reps, S.bodyweight, added) };
  }

  function updateLiftPreview() {
    const form = document.querySelector('form[data-form="lift"]');
    const out = $('#score-preview');
    if (!form || !out) return;
    const r = readLiftForm(form);
    if (ui.liftType === 'carry') {
      out.innerHTML = r.error
        ? `Score = weight × ${ui.carryMode === 'distance' ? 'distance (laps × track length)' : 'time in seconds'}.`
        : `Score = ${fmtNum(r.weight)} × ${r.mode === 'distance' ? `${fmtNum(r.distance)} m` : `${fmtNum(r.seconds)} s`} = <b>${fmtNum(r.score)}</b> ${r.mode === 'distance' ? 'lb·m' : 'lb·s'}`;
      return;
    }
    if (!S.bodyweight) { out.textContent = 'Set your bodyweight above — the score depends on it.'; return; }
    out.innerHTML = r.error
      ? `Score = reps × (bodyweight + added) ÷ 100. Every rep moves all of you.`
      : `Score = ${r.reps} × (${fmtNum(r.bw)} + ${fmtNum(r.added)}) ÷ 100 = <b>${fmtNum(r.score)}</b> pts`;
  }

  function logLift(form) {
    const r = readLiftForm(form);
    if (r.error) { toast(r.error); return; }
    const entry = { id: uid(), at: nowIso(), ...r };
    const key = liftSeriesKey(entry);
    const prev = liftBest(key);
    S.lifts.push(entry);
    if (entry.type === 'carry' && entry.mode === 'distance') S.lastTrackLength = entry.track;
    save();
    const unit = SERIES_UNIT[key];
    ui.lastLiftResult = !prev
      ? `<b>${fmtNum(entry.score)} ${unit}</b> — ${esc(SERIES_LABEL[key])}. First entry: this is your baseline.`
      : entry.score > prev.score
        ? `<b>${fmtNum(entry.score)} ${unit}</b> — new personal best. Previous: ${fmtNum(prev.score)} (${esc(fmtDate(prev.at))}).`
        : `<b>${fmtNum(entry.score)} ${unit}</b> — ${Math.round((entry.score / prev.score) * 100)}% of your best (${fmtNum(prev.score)}, ${esc(fmtDate(prev.at))}).`;
    ui.historySeries = key;
    renderTemple();
  }

  /* =========================================================== events */

  const ACTIONS = {
    tab: (el) => { if (ui.detail) closeDetail(); setTab(el.dataset.tab); },
    'set-grind': (el) => { S.grind = el.dataset.grind; save(); renderTab(); },
    'open-program': (el) => openProgram(el.dataset.program),
    'close-detail': () => closeDetail(),
    'delete-program': () => {
      const p = getProgram(ui.detail);
      if (!p || !p.custom || !confirm(`Delete "${p.name}"? Past sessions stay in your history.`)) return;
      S.customPrograms = S.customPrograms.filter((x) => x.id !== p.id);
      save(); closeDetail(); renderTab();
    },
    start: (el) => startWorkout(el.dataset.program),
    'open-runner': () => openRunner(),
    'minimize-runner': () => minimizeRunner(),
    'finish-workout': () => finishWorkout(),
    'close-summary': () => { ui.summaryId = null; ui.runnerOpen = false; $('#runner').hidden = true; setTab('temple'); },
    count: (el) => {
      const w = activeWorkout(); if (!w) return;
      const it = w.items[w.cursor]; const d = draftFor(w);
      d.count = Math.max(0, d.count + Number(el.dataset.d) * UNIT[it.unit].step);
      $('#count').textContent = d.count;
    },
    'log-set': () => logSet(false),
    'log-failure': () => logSet(true),
    'undo-set': () => undoSet(),
    'goto-ex': (el) => {
      const w = activeWorkout(); if (!w) return;
      w.cursor = Math.max(0, Math.min(w.items.length - 1, Number(el.dataset.i)));
      S.rest = null; save(); renderRunner(); renderRest();
      $('#runner').scrollTop = 0;
    },
    'skip-rest': () => endRest(false),
    'rest-add': (el) => {
      if (!S.rest) return;
      S.rest.endsAt = Math.max(Date.now() + 1000, S.rest.endsAt + Number(el.dataset.s) * 1000);
      S.rest.total = Math.max(S.rest.total, S.rest.endsAt - Date.now());
      save(); tick();
    },
    'lib-cat': (el) => { ui.libCat = el.dataset.cat; document.querySelectorAll('[data-action="lib-cat"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === ui.libCat))); renderLibraryList(); },
    'save-goal': () => {
      if (!ui.goalDraft) return;
      S.customPrograms.push(ui.goalDraft);
      const id = ui.goalDraft.id;
      ui.goalDraft = null; ui.goalText = '';
      save(); renderPrograms(); openProgram(id);
      toast('Saved to your programs.');
    },
    'discard-goal': () => { ui.goalDraft = null; renderPrograms(); },
    'start-recover-timer': () => {
      const form = document.querySelector('form[data-form="recover"]');
      const f = new FormData(form);
      S.recoverTimer = { activity: f.get('activity') || ui.recoverActivity, startedAt: Date.now(), temp: num(f.get('temp')), note: String(f.get('note') || '').trim() };
      save(); renderRecover(); renderTopbar();
    },
    'stop-recover-timer': () => {
      const t = S.recoverTimer; if (!t) return;
      const minutes = Math.max(1, Math.round((Date.now() - t.startedAt) / 60000));
      S.recoverTimer = null;
      addRecover({ activity: t.activity, minutes, temp: t.temp ?? null, note: t.note || '', timed: true });
      renderRecover(); renderTopbar();
    },
    'cancel-recover-timer': () => {
      if (!confirm('Discard this timer without logging it?')) return;
      S.recoverTimer = null; save(); renderRecover(); renderTopbar();
    },
    'delete-recover': (el) => { S.recover = S.recover.filter((r) => r.id !== el.dataset.id); save(); renderRecover(); },
    'delete-workout': (el) => {
      if (!confirm('Delete this session from your history?')) return;
      S.workouts = S.workouts.filter((w) => w.id !== el.dataset.id); save(); renderTemple();
    },
    export: () => {
      const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `otg-fitness-${dayKey(Date.now())}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    reset: () => {
      if (!confirm('Erase every workout, record and setting on this phone? This cannot be undone.')) return;
      S = defaults(); save();
      Object.assign(ui, { lastLiftResult: null, goalDraft: null, summaryId: null, runnerOpen: false, draft: null });
      renderAll(); toast('Erased. A clean slate.');
    }
  };

  const FORMS = {
    goal: (form) => {
      const text = String(new FormData(form).get('goal') || '').trim();
      ui.goalText = text;
      if (!text) { ui.goalError = 'Say what you want. One word is enough.'; ui.goalDraft = null; renderPrograms(); return; }
      const res = buildGoalProgram(text);
      ui.goalError = res.error || '';
      ui.goalDraft = res.error ? null : res;
      renderPrograms();
      const d = $('#goal-draft'); if (d) d.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    recover: (form) => {
      const f = new FormData(form);
      const minutes = Math.round(num(f.get('minutes')) || 0);
      if (minutes <= 0) { toast('Enter minutes, or use Till I couldn\'t.'); return; }
      addRecover({ activity: f.get('activity') || ui.recoverActivity, minutes, temp: num(f.get('temp')), note: String(f.get('note') || '').trim(), timed: false });
      renderRecover();
    },
    'timer-meta': () => {},
    bodyweight: (form) => {
      const bw = num(new FormData(form).get('bw'));
      if (!(bw >= 50 && bw <= 700)) { toast('Enter a bodyweight between 50 and 700 lb.'); return; }
      S.bodyweight = bw;
      S.bodyweightLog.push({ bw, at: nowIso() });
      save(); renderTemple(); toast(`Bodyweight set: ${fmtNum(bw)} lb.`);
    },
    lift: (form) => logLift(form)
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (el) {
      const fn = ACTIONS[el.dataset.action];
      if (fn) { e.preventDefault(); fn(el, e); }
      return;
    }
    if (e.target.closest('#rest')) ACTIONS['skip-rest']();
  });

  document.addEventListener('submit', (e) => {
    const fn = FORMS[e.target.dataset.form];
    if (fn) { e.preventDefault(); fn(e.target); }
  });

  document.addEventListener('input', (e) => {
    const el = e.target;
    const kind = el.dataset.input;
    if (kind === 'lib-query') { ui.libQuery = el.value; renderLibraryList(); }
    else if (kind === 'weight') { const w = activeWorkout(); if (w) draftFor(w).weight = num(el.value); }
    else if (kind === 'timer-meta' && S.recoverTimer) {
      if (el.name === 'temp') S.recoverTimer.temp = num(el.value); else S.recoverTimer.note = el.value.trim();
      save();
    }
    else if (el.closest('form[data-form="lift"]') && !['lift-type', 'carry-mode'].includes(kind)) updateLiftPreview();
    else if (el.name === 'goal') ui.goalText = el.value;
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    const kind = el.dataset.input;
    if (kind === 'lift-type') { ui.liftType = el.value; ui.lastLiftResult = null; renderTemple(); }
    else if (kind === 'carry-mode') { ui.carryMode = el.value; renderTemple(); }
    else if (kind === 'history-series') { ui.historySeries = el.value; renderTemple(); }
    else if (kind === 'recover-activity') { ui.recoverActivity = el.value; }
  });

  window.addEventListener('popstate', () => { if (ui.detail) closeDetail(true); });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      tick();
      if (ui.runnerOpen && activeWorkout()) requestWakeLock();
    }
  });

  /* ---------- the clock */

  function tick() {
    const r = S.rest;
    if (r && !$('#rest').hidden) {
      const left = r.endsAt - Date.now();
      if (left <= 0) endRest(true);
      else {
        const c = document.querySelector('[data-tick="rest"]'); if (c) c.textContent = fmtCountdown(left);
        const b = document.querySelector('[data-tick="rest-bar"]'); if (b) b.style.width = `${Math.max(0, (left / r.total) * 100)}%`;
      }
    }
    if (S.recoverTimer) {
      const txt = fmtElapsed(Date.now() - S.recoverTimer.startedAt);
      document.querySelectorAll('[data-tick="recover"], [data-tick="recover-mini"]').forEach((n) => { n.textContent = txt; });
    }
  }
  setInterval(tick, 250);

  /* =========================================================== boot */

  // Programmatic hooks for automated checks (read-only helpers, no UI).
  window.OTG = { state: () => S, db: () => DB, buildGoalProgram, suggestion, bodyScore };

  if (S.activeWorkoutId && !activeWorkout()) { S.activeWorkoutId = null; save(); }
  if (activeWorkout()) ui.runnerOpen = true; // reopened mid-workout: straight back to the work
  setTab('grind');
  renderRunner();
  renderRest();
  loadExercises();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
