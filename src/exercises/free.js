import { beginTake, smoothF0 } from '../audio/engine.js';
import { MIN_FRAMES_FOR_MEDIAN, MIN_VOICED_MS_SCORE } from '../constants.js';
import { takeControls } from './shared.js';
import { completeStep } from '../progress/state.js';
import { base } from '../store/baseline.js';
import { recordTake } from '../store/history.js';
import { pitchTarget } from '../targets.js';
import { median, semitoneSd } from '../util/stats.js';

// --- free speech ----------------------------------------------------------
export function buildFree() {
  var html =
    '<div class="card">' +
      '<h3>Free speech</h3>' +
      '<p class="why">Live meters are useful for drilling and actively harmful for conversation — ' +
      'watching a number pulls you out of speaking. Talk for a minute about anything, with nothing ' +
      'to look at, and read the result afterwards.</p>' +
      takeControls('Start talking') +
      '<div id="report"></div>' +
    '</div>';

  var running = false, f0s = [], resList = [], weights = [], t0 = null;
  var voicedMs = 0, lastTs = null;

  function setRunning(el, on, score) {
    running = on;
    el.textContent = on ? 'Stop and score' : 'Start talking';
    el.className = on ? 'recording' : 'primary';
    if (on) {
      f0s = []; resList = []; weights = []; t0 = null;
      voicedMs = 0; lastTs = null;
      beginTake();
      document.getElementById('report').innerHTML = '';
    } else {
      document.getElementById('status').textContent = '';
      if (score) report();
    }
  }

  return {
    html: html,
    abort: function () {
      // Discarded rather than scored, to match calibration and the passage: a
      // take cut off mid-sentence would still be written to your history and
      // charted as if you had meant to stop there.
      if (!running) return;
      setRunning(document.getElementById('go'), false, false);
      document.getElementById('status').textContent = 'Take stopped early — discarded, not scored.';
    },
    mount: function () {
      document.getElementById('go').onclick = function () { setRunning(this, !running, true); };
    },
    frame: function (a, ts) {
      if (!running) return;
      var f0 = smoothF0.value();
      var dt = lastTs == null ? 0 : Math.min(100, ts - lastTs);
      lastTs = ts;
      if (t0 == null) t0 = ts;
      if (a.voiced && f0) {
        voicedMs += dt;
        f0s.push(f0);
        if (a.resonance != null) resList.push(a.resonance);
        if (a.weightRaw != null) weights.push(a.weightRaw);
      }
      // Counted from the first analysed frame on the frame clock, not from the
      // button press on the wall clock: the two disagreed by however long the
      // first frame took to arrive, and this is the only elapsed number the
      // drill shows you.
      document.getElementById('status').textContent =
        ((ts - t0) / 1000).toFixed(0) + ' s — no meters on purpose';
    }
  };

  function report() {
    if (voicedMs < MIN_VOICED_MS_SCORE) {
      document.getElementById('report').innerHTML =
        '<div class="banner err" style="margin-top:14px">Only ' + (voicedMs / 1000).toFixed(1) +
        ' s of voiced speech — too little to score. Talk for a bit longer.</div>';
      return;
    }
    var mF0 = median(f0s), sd = semitoneSd(f0s);
    var mRes = resList.length >= MIN_FRAMES_FOR_MEDIAN ? median(resList) : null;
    var mW = weights.length >= MIN_FRAMES_FOR_MEDIAN ? median(weights) : null;
    var t = pitchTarget();
    recordTake('free', { f0: mF0, res: mRes, weight: mW, sd: sd });
    var html = '<table style="margin-top:16px"><tr><th>Measure</th><th>This take</th><th>Reference</th></tr>' +
      '<tr><td>Median pitch</td><td class="num">' + mF0.toFixed(0) + ' Hz</td><td class="num">target ' +
        (t ? t.hz.toFixed(0) : '—') + ' Hz</td></tr>' +
      (mRes != null ? '<tr><td>Resonance</td><td class="num">' + mRes.toFixed(1) + ' cm</td><td class="num">baseline ' +
        (base.resonance != null ? base.resonance.toFixed(1) : '—') + ' cm</td></tr>' : '') +
      (mW != null && base.weight != null ? '<tr><td>Weight</td><td class="num">' +
        (mW - base.weight >= 0 ? '+' : '') + (mW - base.weight).toFixed(1) + '</td><td class="num">baseline</td></tr>' : '') +
      (sd != null ? '<tr><td>Intonation</td><td class="num">' + sd.toFixed(1) + ' st</td><td class="num">baseline ' +
        (base.intonationSd != null ? base.intonationSd.toFixed(1) : '—') + ' st</td></tr>' : '') +
      '</table>' +
      '<div class="hint">Spontaneous speech usually sits higher than drilled speech. That gap is the ' +
      'real measure of how far the training has carried. Saved to <b>Progress</b>.</div>';
    document.getElementById('report').innerHTML = html;

    // Free speech has no live meters and sets no pass mark on purpose, so the
    // grade is the one comparison it does make: pitch against the target.
    var q = t ? Math.max(0, Math.min(1, 1 - (mF0 - t.hz) / t.hz / 0.25)) : 0.5;
    completeStep('free', q);
  }
}
