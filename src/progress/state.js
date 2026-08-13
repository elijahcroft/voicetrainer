import { renderExList } from '../exercises/registry.js';
import { celebrate } from './reward.js';
import { renderStreak } from './strip.js';
import { showSummary } from './summary.js';
import { base } from '../store/baseline.js';

// ==========================================================================
// the routine: streak, daily goal, and what you have finished today
//
// Voice change is a months-long habit, and the thing that decides whether it
// happens is whether you come back tomorrow — not how good any one take was.
// So this layer counts *turning up*, deliberately, and keeps well away from
// the measurements: nothing here can move a target, alter a score, or change
// what a meter says. It is a wrapper around the practice, not part of it.
//
// What is kept: a day string, which steps were finished on it, lifetime XP,
// and the streak. Still four numbers and a date, still nothing but yours.
// ==========================================================================

export var PROGRESS_KEY = 'voice-trainer-progress-v1';

// The ten drills, in the order the routine intends: low-strain coordination
// first, isolated control next, and connected speech last.
export var ROUTINE = ['straw', 'onset', 'yawn', 'ng', 'ladder', 'vowels', 'glide', 'endings', 'passage', 'free'];

// Five of the ten is roughly ten minutes. A goal you can hit on a bad day
// is the one that survives; asking for all ten would break the streak on
// exactly the days that keeping it matters.
export var DAILY_GOAL = 5;

export var XP_STEP = 10;    // for finishing a step at all — turning up is the point
export var XP_QUALITY = 10; // scaled 0..1 by how well it went, so it can never be
                     // worth skipping the work to farm the base award

export var progress = loadProgress();

// Local calendar day. Deliberately local rather than UTC: a streak is about
// your days, and practising at 11pm should not count as tomorrow.
export function today() {
  var d = new Date();
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
export function dayBefore(day) {
  var p = day.split('-');
  var d = new Date(+p[0], +p[1] - 1, +p[2]);
  d.setDate(d.getDate() - 1);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

function loadProgress() {
  var p;
  try { p = JSON.parse(localStorage.getItem(PROGRESS_KEY)); } catch (e) { p = null; }
  if (!p || typeof p !== 'object') p = {};
  return {
    xp: p.xp || 0,
    streak: p.streak || 0,
    best: p.best || 0,
    lastGoalDay: p.lastGoalDay || null,   // last day the daily goal was met
    day: p.day || today(),                // the day `done` refers to
    done: p.done && typeof p.done === 'object' ? p.done : {},  // id -> xp earned today
    ever: Array.isArray(p.ever) ? p.ever : [],                 // ids ever completed, lifetime
    muted: !!p.muted
  };
}
export function saveProgress() {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch (e) {}
}

// Called before anything reads today's state. Rolling the day here rather
// than on a timer means the app can sit open across midnight and still be
// right the next time you touch it.
export function rollDay() {
  var t = today();
  if (progress.day === t) return;
  progress.day = t;
  progress.done = {};
  // The streak survives exactly one missed calendar day's worth of gap: it is
  // broken only once the last goal day is further back than yesterday.
  if (progress.lastGoalDay && progress.lastGoalDay !== t && progress.lastGoalDay !== dayBefore(t)) {
    progress.streak = 0;
  }
  saveProgress();
}

// Only the ten drills count toward a day. Calibration is deliberately not
// among them: it is the setup the targets come from, not practice, and
// letting it fill a slot would mean a day's goal could be met without
// actually using your voice for anything.
export function doneToday() {
  return Object.keys(progress.done).filter(function (id) { return ROUTINE.indexOf(id) >= 0; });
}
export function goalMet() { return doneToday().length >= DAILY_GOAL; }
export function stepDone(id) { return Object.prototype.hasOwnProperty.call(progress.done, id); }

// Nothing is gated: every drill is open from the start. The routine order is
// a suggestion the path still points along, not a wall.
export function stepLocked() { return false; }

// The next thing to do: the first step in the supplied daily plan not yet
// finished today. With no plan supplied this retains the full-routine behavior
// for callers and tests that need it. Nothing is locked; the order only decides
// where the path points and what the app opens on. Null once that plan is done.
export function nextStep(order) {
  if (base.habitualF0 == null) return null;
  rollDay();
  order = order && order.length ? order : ROUTINE;
  for (var i = 0; i < order.length; i++) {
    if (!stepDone(order[i]) && !stepLocked(order[i])) return order[i];
  }
  return null;
}

// The one entry point. `quality` is 0..1 and may be omitted when a drill has
// no meaningful grade — an unscored step is still a step you did.
export function completeStep(id, quality) {
  rollDay();
  if (stepDone(id)) return;                          // once a day; no XP farming
  var q = quality == null ? 0.5 : Math.max(0, Math.min(1, quality));
  var earned = XP_STEP + Math.round(XP_QUALITY * q);

  progress.done[id] = earned;
  progress.xp += earned;
  if (progress.ever.indexOf(id) < 0) progress.ever.push(id);

  var hitGoalNow = goalMet() && progress.lastGoalDay !== progress.day;
  if (hitGoalNow) {
    progress.lastGoalDay = progress.day;
    progress.streak += 1;
    if (progress.streak > progress.best) progress.best = progress.streak;
  }
  saveProgress();

  renderStreak();
  renderExList();
  celebrate(id, earned, hitGoalNow);
  if (hitGoalNow) showSummary();
}

// Same reasoning as resetBaseline: the streak is derived from the takes that
// earned it, so clearing those clears this, and the store that owns the key is
// the one that removes it.
export function resetProgress() {
  try { localStorage.removeItem(PROGRESS_KEY); } catch (e) {}
  reloadProgress();
}

// Re-read what is in storage. Separate from resetProgress so the rules can be
// exercised against seeded state without going through a wipe first.
export function reloadProgress() {
  progress = loadProgress();
}
