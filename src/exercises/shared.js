import { beginTake, smoothF0, smoothRes, smoothWeight } from '../audio/engine.js';
import { RESONANCE_GOAL } from '../constants.js';
import { completeStep } from '../progress/state.js';
import { base } from '../store/baseline.js';
import { targetBand } from '../targets.js';
import { meter, pitchFill, setMeter } from '../ui/meters.js';
import { Ribbon } from '../ui/ribbon.js';

// --- generic live-meter exercise -----------------------------------------

// Steps, cautions and diagrams are worth reading once and are in the way
// every session after that. Folding them away puts the meters back within a
// glance of the thing you are doing, instead of a screenful below it — the
// same reason the endings drill keeps its prompt and its verdict adjacent.
export function explainer(cfg) {
  var body =
    (cfg.steps ? '<ol class="steps">' +
      cfg.steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>' : '') +
    (cfg.note ? '<p class="note">' + cfg.note + '</p>' : '') +
    (cfg.diagram ? cfg.diagram() : '') +
    (cfg.extra || '');
  if (!body) return '';
  return '<details class="explain"><summary>' +
    (cfg.summary || 'How to do it, and why it works') + '</summary><div>' + body + '</div></details>';
}

export function simpleExercise(cfg) {
  var html =
    '<div class="card">' +
      '<h3>' + cfg.title + '</h3>' +
      '<p class="why">' + cfg.why + '</p>' +
      explainer(cfg) +
      '<canvas id="rib" class="trace" style="height:210px" role="img" aria-label="Live pitch trace"></canvas>' +
      '<div class="meters">' +
        meter('m-pitch', 'Pitch', '', true) +
        meter('m-res', 'Resonance', '', true) +
        meter('m-weight', 'Weight') +
        meter('m-time', cfg.showBand ? 'In target' : 'Voiced time', '', true) +
      '</div>' +
      takeControls('Start take') +
    '</div>';

  var rib, running = false, inBandMs = 0, voicedMs = 0, band = null, lastTs = null, scored = false;

  function setRunning(el, on) {
    running = on;
    inBandMs = 0; voicedMs = 0; lastTs = null; scored = false;
    rib.pts = [];
    if (on) beginTake();
    el.textContent = on ? 'Stop' : 'Start take';
    el.className = on ? 'recording' : 'primary';
    document.getElementById('status').textContent = on ? 'recording — nothing is saved' : '';
  }

  var api = {
    html: html,
    mount: function () {
      rib = new Ribbon(document.getElementById('rib'));
      rib.resize();
      band = cfg.showBand ? targetBand() : null;
      rib.draw(band);
      document.getElementById('go').onclick = function () { setRunning(this, !running); };
    },
    abort: function () {
      if (running) setRunning(document.getElementById('go'), false);
    },
    frame: function (a, ts) {
      var f0 = smoothF0.value();
      var inBand = !!(band && f0 && f0 >= band.lo && f0 <= band.hi);
      setMeter('m-pitch', a.voiced && f0 ? f0.toFixed(0) + ' Hz' : '--',
        band ? 'target ' + band.center.toFixed(0) + ' Hz' : 'comfortable is fine',
        { hit: inBand, fill: a.voiced && f0 ? pitchFill(f0) : 0,
          markAt: band ? pitchFill(band.center) : null });

      var res = smoothRes.value();
      setMeter('m-res', res ? res.toFixed(1) + ' cm' : '--', resonanceSub(res),
        resonanceMeterOpts(res));

      var w = smoothWeight.value();
      setMeter('m-weight', weightLabel(w), weightSub(w));

      // Real elapsed time, not a frame count: frame rate varies by display
      // and by load, so counting frames made a 120 Hz screen read half speed.
      var dt = lastTs == null ? 0 : Math.min(100, ts - lastTs);
      lastTs = ts;

      if (running) {
        rib.push(a.voiced ? f0 : 0);
        if (a.voiced && f0) {
          voicedMs += dt;
          if (inBand) inBandMs += dt;
        }
        var pct = voicedMs ? (inBandMs / voicedMs * 100) : 0;
        var secs = voicedMs / 1000;
        setMeter('m-time', band ? pct.toFixed(0) + '%' : secs.toFixed(0) + ' s',
          band ? 'aim for 80%' : 'of ' + cfg.goalSeconds + ' s',
          band ? { hit: pct >= 80, fill: pct / 100, markAt: 0.8 }
               : { hit: secs >= cfg.goalSeconds, fill: secs / cfg.goalSeconds });

        // The step is finished when you have put in the voiced time it asks
        // for. Accuracy is paid in XP rather than in whether it counts: the
        // day you can only manage 40% in the band is the day it matters most
        // that the routine still closes.
        // Latched: this used to run on every frame for the rest of the take.
        // completeStep is idempotent so no XP was double-awarded, but it was
        // re-entering the day-rollover and localStorage write sixty times a
        // second, and the status line never said the step had closed.
        if (secs >= cfg.goalSeconds && !scored) {
          scored = true;
          completeStep(api.id, band ? Math.min(1, pct / 80) : 1);
          document.getElementById('status').textContent =
            'Goal reached — this step is done for today. Keep going if you like.';
        }
      }
      rib.draw(band);
    }
  };
  return api;
}

// Shared start/stop row. The button is inert without a microphone rather than
// erroring on click.
export function takeControls(label, extra) {
  return '<div class="row take">' +
    '<button id="go" class="primary" data-needs-mic>' + label + '</button>' +
    (extra || '') +
    '<span id="status" style="color:var(--dim);font-size:13px"></span>' +
    '</div>' + micHint();
}
export function micHint() {
  return '<div class="banner info compact" id="micHint" hidden style="margin:12px 0 0">' +
    '<span aria-hidden="true">🎙</span><span>Press <b>Start microphone</b> in the top bar to enable this ' +
    'exercise. Nothing is uploaded or recorded — every frame is analysed and discarded.</span>' +
    '</div>';
}

export function resonanceSub(res) {
  if (res == null) return 'lower larynx = larger number';
  if (base.resonance == null) return 'lower larynx = larger number';
  var goal = (RESONANCE_GOAL - 1) * 100;
  return pctVsBaseline(res, base.resonance) + ' vs baseline (goal +' + goal.toFixed(0) + '%)';
}
// Signed percentage change, rounded before the sign is chosen so a value a
// hair under the baseline reads "+0.0%" rather than "-0.0%".
export function pctVsBaseline(value, baseline) {
  var pct = (value / baseline - 1) * 100;
  if (Math.abs(pct) < 0.05) pct = 0;
  return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
}

// Bar runs from baseline to the goal, so "full" means the goal is reached.
export function resonanceMeterOpts(res) {
  if (res == null || base.resonance == null) return { hit: false, fill: 0 };
  var span = base.resonance * (RESONANCE_GOAL - 1);
  return {
    hit: res >= base.resonance * RESONANCE_GOAL,
    fill: (res - base.resonance) / span,
    markAt: 1
  };
}
// Weight is the softest of the four measures and is only ever meaningful
// against your own baseline — with no baseline there is nothing to say, so
// the raw number is withheld rather than shown as if it meant something.
export function weightLabel(w) {
  if (w == null || base.weight == null) return '--';
  var d = w - base.weight;
  if (d > 2) return 'heavier';
  if (d < -2) return 'lighter';
  return 'baseline';
}
export function weightSub(w) {
  if (base.weight == null) return 'calibrate to get a reference';
  if (w == null) return 'relative to your baseline';
  return (w - base.weight >= 0 ? '+' : '') + (w - base.weight).toFixed(1) + ' vs baseline';
}
