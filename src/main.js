// main.js — boot.
//
// Everything above this is a module that declares what it needs; this is the
// one place that wires the page together and decides what opens first.

import './styles.css';

import { audio, startMic, stopMic } from './audio/engine.js';
import { linkTerms } from './glossary.js';
import { openExercise, renderExList } from './exercises/registry.js';
import { progress, nextStep, resetProgress } from './progress/state.js';
import { placeStrip, renderStreak } from './progress/strip.js';
import { base, save, resetBaseline } from './store/baseline.js';
import { clearHistory, history } from './store/history.js';
import { renderBaseTable } from './targets.js';

document.getElementById('micBtn').onclick = function () {
  if (audio.running) stopMic(); else startMic();
};
document.getElementById('resetBtn').onclick = function () {
  // Old takes are scored against the old baseline, so keeping them across a
  // recalibration would put two different reference frames on one chart.
  if (!confirm('Clear your saved baseline, targets, all ' + history.length +
    ' saved takes, and your ' + progress.streak + '-day streak?')) return;
  resetBaseline();
  clearHistory();
  // The streak is derived from the takes it counted, so leaving it standing
  // after they are gone would make it a number about nothing.
  resetProgress();
  renderStreak();
  save();
  openExercise('calibrate');
};
renderBaseTable();
placeStrip();
renderStreak();
renderExList();
// The standing safety notice is where "resonance" and "weight" are first
// used, so it gets its terms linked too. Panes link their own on open.
linkTerms(document.querySelector('.banner.safety'));
// Opens where the routine left off rather than always at step one — and on
// the log once the day is finished, which is the only thing left to look at.
openExercise(base.habitualF0 == null ? 'calibrate' : (nextStep() || 'progress'));

// Installable + offline. Vite emits a hashed bundle, so the service worker is
// registered from the built page only; in dev it would cache the dev server's
// modules and serve them back stale.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  });
}
