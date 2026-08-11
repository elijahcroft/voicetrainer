// test-progress.mjs — the streak, daily-goal and unlock rules.
// Run: node test-progress.mjs
//
// These rules live in index.html because they are wired straight into the UI,
// so this pulls them out of that file rather than keeping a copy that could
// drift away from what ships — the same trick test-endings.mjs uses.
//
// The cases here are the ones this kind of code always gets wrong: the day
// boundary (a streak must count *local* days, so practising at 23:50 and again
// at 00:10 is two days, not one), the off-by-one in "did I miss a day", and
// completing the same step twice for double XP.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'index.html'), 'utf8');

function grab(name) {
  const start = html.indexOf(`function ${name}(`);
  if (start < 0) throw new Error('not found: ' + name);
  let depth = 0;
  for (let j = html.indexOf('{', start); j < html.length; j++) {
    if (html[j] === '{') depth++;
    else if (html[j] === '}' && --depth === 0) return html.slice(start, j + 1);
  }
  throw new Error('unbalanced: ' + name);
}
const consts = [...html.matchAll(/^  var (ROUTINE|DAILY_GOAL|XP_STEP|XP_QUALITY) = [^;]+;/gm)]
  .map(m => m[0]).join('\n');

// The extracted functions read `progress` and `base`, and completeStep calls
// into the DOM at the end. Both are supplied by the harness: the point is to
// test the rules, not the rendering.
const src = [
  consts,
  'var progress, base;',
  'function saveProgress() {}',
  'function renderStreak() {}',
  'function renderExList() {}',
  'function celebrate() {}',
  'function showSummary() {}',
  grab('today'),
  grab('dayBefore'),
  grab('rollDay'),
  grab('doneToday'),
  grab('goalMet'),
  grab('stepDone'),
  grab('stepLocked'),
  grab('nextStep'),
  grab('completeStep')
].join('\n\n');

const api = new Function(src +
  '\nreturn { today, dayBefore, rollDay, doneToday, goalMet, stepDone, stepLocked,' +
  '         nextStep, completeStep, ROUTINE, DAILY_GOAL, XP_STEP, XP_QUALITY,' +
  '         set: function (p, b) { progress = p; base = b; },' +
  '         get: function () { return progress; } };')();

const { ROUTINE, DAILY_GOAL, XP_STEP, XP_QUALITY } = api;

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log('ok   ' + name + (extra ? '   ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra ? '   ' + extra : '')); }
}
function eq(name, got, want) {
  ok(name, Object.is(got, want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
}

// A calibrated user who has done the whole routine before, so nothing is locked
// unless a test says so.
const CALIBRATED = { habitualF0: 165 };
function fresh(over = {}) {
  const p = {
    xp: 0, streak: 0, best: 0, lastGoalDay: null,
    day: api.today(), done: {}, ever: ROUTINE.slice(), muted: false
  };
  Object.assign(p, over);
  api.set(p, CALIBRATED);
  return p;
}

// --- day arithmetic --------------------------------------------------------

eq('dayBefore crosses a month boundary', api.dayBefore('2026-03-01'), '2026-02-28');
eq('dayBefore crosses a leap day', api.dayBefore('2024-03-01'), '2024-02-29');
eq('dayBefore crosses a year boundary', api.dayBefore('2026-01-01'), '2025-12-31');
ok('today is a local YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(api.today()));

// The bug this guards: building the day string from toISOString() would use UTC,
// so anyone west of Greenwich practising in the evening would have their streak
// filed under tomorrow — and anyone east of it, in the morning, under yesterday.
{
  const d = new Date();
  const local = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
    '-' + String(d.getDate()).padStart(2, '0');
  eq('today matches the local calendar, not UTC', api.today(), local);
}

// --- XP --------------------------------------------------------------------

{
  const p = fresh();
  api.completeStep('straw', 1);
  eq('a perfect step pays base + full quality', p.xp, XP_STEP + XP_QUALITY);
}
{
  const p = fresh();
  api.completeStep('straw', 0);
  eq('a scraped-through step still pays the base', p.xp, XP_STEP);
}
{
  const p = fresh();
  api.completeStep('straw', 0.5);
  api.completeStep('straw', 1);
  eq('the same step cannot be banked twice in a day', p.xp, XP_STEP + Math.round(XP_QUALITY * 0.5));
  eq('...and its recorded XP is the first attempt', p.done.straw, XP_STEP + Math.round(XP_QUALITY * 0.5));
}
{
  const p = fresh();
  api.completeStep('straw', 5);
  eq('quality above 1 is clamped', p.xp, XP_STEP + XP_QUALITY);
  const q = fresh();
  api.completeStep('straw', -3);
  eq('quality below 0 is clamped', q.xp, XP_STEP);
}
{
  const p = fresh();
  api.completeStep('straw');       // no grade given
  eq('an ungraded step pays the middle', p.xp, XP_STEP + Math.round(XP_QUALITY * 0.5));
}

// --- the daily goal and the streak -----------------------------------------

{
  const p = fresh();
  for (let i = 0; i < DAILY_GOAL - 1; i++) api.completeStep(ROUTINE[i], 1);
  eq('one short of the goal is not a streak', p.streak, 0);
  ok('...and the goal is not met', !api.goalMet());
  api.completeStep(ROUTINE[DAILY_GOAL - 1], 1);
  eq('hitting the goal starts the streak', p.streak, 1);
  eq('...and records the day', p.lastGoalDay, p.day);
  eq('...and sets the best', p.best, 1);
}
{
  const p = fresh();
  for (let i = 0; i < ROUTINE.length; i++) api.completeStep(ROUTINE[i], 1);
  eq('finishing every step still only counts one day', p.streak, 1);
  eq('...but all of them are logged', api.doneToday().length, ROUTINE.length);
}

// Calibration must not be able to fill a slot in the day — a goal met without
// using your voice is not a day of practice.
{
  const p = fresh();
  api.completeStep('calibrate', 1);
  eq('calibration earns nothing toward the day', api.doneToday().length, 0);
}

// --- rolling over midnight -------------------------------------------------

{
  const t = api.today();
  const p = fresh({ day: api.dayBefore(t), done: { straw: 15, yawn: 15 }, streak: 3, lastGoalDay: api.dayBefore(t) });
  api.rollDay();
  eq('a new day clears what was done', Object.keys(p.done).length, 0);
  eq('...and keeps a streak that ran to yesterday', p.streak, 3);
  eq('...and moves to today', p.day, t);
}
{
  const t = api.today();
  const p = fresh({ day: '2020-01-01', done: {}, streak: 9, lastGoalDay: '2020-01-01' });
  api.rollDay();
  eq('a streak older than yesterday is broken', p.streak, 0);
}
{
  // Yesterday's goal met, nothing done today yet: the streak stands until the
  // day after tomorrow, and must not be double-counted when today's goal lands.
  const t = api.today();
  const p = fresh({ streak: 4, best: 4, lastGoalDay: api.dayBefore(t) });
  for (let i = 0; i < DAILY_GOAL; i++) api.completeStep(ROUTINE[i], 1);
  eq('a second day extends the streak by one', p.streak, 5);
  eq('...and raises the best', p.best, 5);
  // Anything further today must not extend it again.
  api.completeStep(ROUTINE[DAILY_GOAL], 1);
  eq('extra steps the same day do not extend it', p.streak, 5);
}
{
  const p = fresh({ streak: 1, best: 12, lastGoalDay: api.dayBefore(api.today()) });
  for (let i = 0; i < DAILY_GOAL; i++) api.completeStep(ROUTINE[i], 1);
  eq('the best is a high-water mark, not the current streak', p.best, 12);
}

// --- unlocking -------------------------------------------------------------

{
  api.set({ xp: 0, streak: 0, best: 0, lastGoalDay: null, day: api.today(), done: {}, ever: [], muted: false }, {});
  ok('everything is locked before calibration', api.stepLocked('straw'));
  eq('...and there is no next step', api.nextStep(), null);
}
{
  fresh({ ever: [] });
  ok('the first step is open on a fresh calibrated account', !api.stepLocked('straw'));
  ok('...but the second is not', api.stepLocked('yawn'));
  eq('...and the path points at the first', api.nextStep(), 'straw');
}
{
  const p = fresh({ ever: ['straw'] });
  ok('finishing a step once unlocks the next', !api.stepLocked('yawn'));
  ok('...and does not unlock the one after that', api.stepLocked('ng'));
  // Done today, so the path should move on rather than point at it again.
  p.done = { straw: 20 };
  eq('the path skips what is already done today', api.nextStep(), 'yawn');
}
{
  // An unlock is for good: a step done last week stays open today even though
  // today's list is empty.
  fresh({ ever: ROUTINE.slice(), done: {} });
  ok('a lifetime unlock survives the day rolling over', !api.stepLocked('free'));
}
{
  const p = fresh({ ever: ROUTINE.slice() });
  ROUTINE.forEach(id => api.completeStep(id, 1));
  eq('the whole routine done leaves no next step', api.nextStep(), null);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
