import { beginTake, smoothRes } from '../audio/engine.js';
import { RAMP, RESONANCE_GOAL } from '../constants.js';
import { explainer, pctVsBaseline, practiceCue, resonanceMeterOpts, resonanceSub, takeControls } from './shared.js';
import { completeStep } from '../progress/state.js';
import { base } from '../store/baseline.js';
import { DIAGRAMS } from '../ui/diagrams.js';
import { meter, setMeter } from '../ui/meters.js';

// --- yawn-sigh: resonance only, pitch deliberately hidden ------------------
export function buildYawn() {
  var html =
    '<div class="card">' +
      '<h3>Yawn-sigh — lowering the larynx</h3>' +
      '<p class="why">A larger resonating space is the single biggest non-pitch cue to a masculine ' +
      'voice. Beginning a yawn drops the larynx; the sigh lets you explore that larger space ' +
      'without asking your pitch to go lower.</p>' +
      practiceCue('Do 6–8 short sighs. Let each “ahh” last 4–6 seconds, then fully release and ' +
        'take one easy breath.') +
      explainer({
        steps: [
          'Begin the feeling of a small, silent yawn; do not stretch to the largest yawn you can make.',
          'Before it finishes, sigh out an easy open “ahh”. Keep the jaw and throat loose.',
          'Let the pitch land wherever it wants — only resonance is scored here.'
        ],
        note: 'Do not push or hold the larynx down. A larger resonance number only counts when ' +
              'the sigh still feels easy.',
        diagram: DIAGRAMS.larynx,
        extra: '<div class="banner info" style="margin:14px 0 0">' +
          'The pitch readout is hidden on purpose. Larynx height and pitch tend to move together, ' +
          'and separating them is the skill this exercise builds — so pitch is removed from view ' +
          'rather than left as something to chase.</div>'
      }) +
      '<canvas id="resCanvas" class="trace" role="img" aria-label="Live resonance trace"></canvas>' +
      '<div class="meters">' +
        meter('m-res', 'Resonance', '', true) +
        meter('m-best', 'Best this take') +
        meter('m-time', 'Voiced time', '', true) +
        '<div class="meter muted"><div class="lab">Pitch</div><div class="val">—</div>' +
          '<div class="sub">hidden for this exercise</div></div>' +
      '</div>' +
      takeControls('Start take') +
    '</div>';

  // Sighs are short and come in sets, so the goal is accumulated voiced time
  // across the take rather than one long hold — a minute of yawn-sighs is
  // eight or ten of them, not one.
  var GOAL_S = 35;
  var cv, g, hist = [], running = false, best = null, voicedMs = 0, lastTs = null, scored = false;

  function draw() {
    var r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(r.width * dpr)) {
      cv.width = r.width * dpr; cv.height = r.height * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    var w = r.width, h = r.height;
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#050508'; g.fillRect(0, 0, w, h);

    var lo = 12, hi = 24;
    function y(v) { return h - ((v - lo) / (hi - lo)) * h; }

    if (base.resonance != null) {
      var yb = y(base.resonance), yg = y(base.resonance * RESONANCE_GOAL);
      g.fillStyle = 'rgba(255,207,92,.10)';
      g.fillRect(0, 0, w, yg);
      g.strokeStyle = 'rgba(255,207,92,.55)'; g.setLineDash([4, 4]);
      g.beginPath(); g.moveTo(0, yg); g.lineTo(w, yg); g.stroke();
      g.strokeStyle = 'rgba(143,151,173,.45)';
      g.beginPath(); g.moveTo(0, yb); g.lineTo(w, yb); g.stroke();
      g.setLineDash([]);
      g.fillStyle = 'rgba(255,207,92,.9)'; g.font = '11px system-ui';
      g.fillText('goal ' + (base.resonance * RESONANCE_GOAL).toFixed(1) + ' cm', 6, yg - 5);
      g.fillStyle = 'rgba(143,151,173,.8)';
      g.fillText('baseline ' + base.resonance.toFixed(1) + ' cm', 6, yb + 13);
    }

    g.strokeStyle = RAMP.signal; g.lineWidth = 2.2;
    var drawing = false;
    for (var i = 0; i < hist.length; i++) {
      if (hist[i] == null) { if (drawing) { g.stroke(); drawing = false; } continue; }
      var x = i * 2, yy = y(Math.min(hi, Math.max(lo, hist[i])));
      if (!drawing) { g.beginPath(); g.moveTo(x, yy); drawing = true; } else g.lineTo(x, yy);
    }
    if (drawing) g.stroke();
  }

  function setRunning(el, on) {
    running = on; hist = []; best = null; voicedMs = 0; lastTs = null; scored = false;
    // Without this the resonance median still holds up to half a second of
    // pre-take audio, and "best this take" could be set before the take began.
    if (on) beginTake();
    el.textContent = on ? 'Stop' : 'Start take';
    el.className = on ? 'recording' : 'primary';
    document.getElementById('status').textContent = on ? 'recording — nothing is saved' : '';
  }

  var api = {
    html: html,
    mount: function () {
      cv = document.getElementById('resCanvas');
      g = cv.getContext('2d');
      draw();
      document.getElementById('go').onclick = function () { setRunning(this, !running); };
    },
    abort: function () {
      if (running) setRunning(document.getElementById('go'), false);
    },
    frame: function (a, ts) {
      var res = smoothRes.value();
      setMeter('m-res', res ? res.toFixed(1) + ' cm' : '--', resonanceSub(res),
        resonanceMeterOpts(res));
      if (running) {
        hist.push(res);
        if (res != null && (best == null || res > best)) best = res;
        while (hist.length > 400) hist.shift();
        setMeter('m-best', best != null ? best.toFixed(1) + ' cm' : '--',
          base.resonance != null && best != null
            ? pctVsBaseline(best, base.resonance) + ' above baseline' : '');

        var dt = lastTs == null ? 0 : Math.min(100, ts - lastTs);
        lastTs = ts;
        if (a && a.voiced) voicedMs += dt;
        var secs = voicedMs / 1000;
        setMeter('m-time', secs.toFixed(0) + ' s', 'of ' + GOAL_S + ' s',
          { hit: secs >= GOAL_S, fill: secs / GOAL_S });

        if (secs >= GOAL_S && !scored) {
          scored = true;
          // Graded on how far the best sigh got from your baseline toward the
          // resonance goal, which is the only thing this drill measures.
          var q = 0.5;
          if (base.resonance != null && best != null) {
            q = (best - base.resonance) / (base.resonance * (RESONANCE_GOAL - 1));
          }
          completeStep(api.id, q);
          document.getElementById('status').textContent =
            'Goal reached — this step is done for today. Keep going if you like.';
        }
        draw();
      }
    }
  };
  return api;
}
