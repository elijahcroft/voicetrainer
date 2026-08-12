// test-loop.mjs — the analysis clock.
// Run: node test-loop.mjs
//
// Every smoothing window in this app is counted in *frames*: the pitch median is
// 5 of them, resonance and weight are 31, the silence timeout is 12, the traces
// hold a few hundred. Analysis used to run once per repaint, which made all of
// those mean different spans of time on different hardware — the resonance
// median covered half a second on a 60 Hz laptop and a quarter of one on a
// 120 Hz phone, so the same voice read differently on the two. The elapsed-time
// meters had already been fixed to use real time; these had not.
//
// So the thing worth pinning down is that the analysis rate is a property of the
// app and not of the display. The grid is imported from the module that ships
// it and driven with a synthetic clock, so the test and the app cannot drift.
import { ANALYSIS_HZ, ANALYSIS_MS, analysisDue, resetAnalysisClock } from './src/audio/clock.js';

const api = { reset: resetAnalysisClock };

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('ok   ' + name + (detail ? '   ' + detail : '')); }
  else { fail++; console.log('FAIL ' + name + (detail ? '   ' + detail : '')); }
}

// Drive the grid with a display of the given refresh rate, optionally with a
// window of repaints missing — which is what a hidden tab or a locked phone is.
function run(refreshHz, seconds, stall) {
  api.reset();
  const step = 1000 / refreshHz;
  const at = [];
  for (let ts = 0; ts < seconds * 1000; ts += step) {
    if (stall && ts >= stall.from && ts < stall.from + stall.ms) continue;
    if (analysisDue(ts)) at.push(ts);
  }
  const gaps = [];
  for (let i = 1; i < at.length; i++) gaps.push(at[i] - at[i - 1]);
  return { hz: at.length / seconds, gaps, count: at.length };
}

// --- the rate is the app's, not the display's -------------------------------

for (const hz of [60, 75, 90, 120, 144, 165, 240]) {
  const r = run(hz, 10);
  ok('analysis holds ' + ANALYSIS_HZ + ' Hz on a ' + hz + ' Hz display',
    Math.abs(r.hz - ANALYSIS_HZ) < 1, r.hz.toFixed(1) + ' Hz');
}

// A display slower than the grid cannot be sped up, and must not be throttled
// further: every repaint it does offer has to carry an analysis.
{
  const r = run(30, 10);
  ok('a 30 Hz display analyses every repaint it has', Math.abs(r.hz - 30) < 0.5,
    r.hz.toFixed(1) + ' Hz');
}

// The 120 Hz case is the one this exists for: it used to analyse at 120 Hz, so a
// 31-frame median covered 258 ms instead of 517 ms.
{
  const a = run(60, 10).count, b = run(120, 10).count;
  ok('a 120 Hz display no longer analyses twice as often as a 60 Hz one',
    Math.abs(a - b) <= 2, a + ' vs ' + b + ' frames');
}

// --- no drift, and no burst after a stall ----------------------------------

// A refresh rate that is not a multiple of the grid still must not creep: the
// gaps may alternate, but the average has to stay put over a long run.
{
  const r = run(144, 60);
  ok('no drift over a minute on a 144 Hz display', Math.abs(r.hz - ANALYSIS_HZ) < 0.5,
    r.hz.toFixed(2) + ' Hz over 60 s');
  ok('no gap on a 144 Hz display exceeds two grid steps',
    Math.max(...r.gaps) <= ANALYSIS_MS * 2 + 0.01,
    'largest ' + Math.max(...r.gaps).toFixed(1) + ' ms');
}

// After the page comes back, the missing three seconds are gone — they must not
// be replayed as a flurry of analyses over one buffer of already-stale audio.
{
  const r = run(120, 10, { from: 4000, ms: 3000 });
  const big = r.gaps.filter(g => g > ANALYSIS_MS * 2);
  ok('a 3 s stall produces exactly one long gap', big.length === 1,
    JSON.stringify(big.map(g => Math.round(g))));
  ok('...and no catch-up burst after it',
    Math.min(...r.gaps) >= ANALYSIS_MS - 3,
    'shortest ' + Math.min(...r.gaps).toFixed(1) + ' ms');
}

// --- the grid restarts cleanly at the top of a take -------------------------
//
// beginTake() zeroes nextAnalysis, and takes start at whatever timestamp the
// page happens to be at — hours in, on a long-lived PWA. The first frame of a
// take must be analysed rather than waiting out a grid left behind at zero.
{
  api.reset();
  ok('the first frame of a take is always analysed', analysisDue(9_999_999) === true);
  ok('...and the frame right after it is not', analysisDue(9_999_999 + 1) === false);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
