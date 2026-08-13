import { beginTake, smoothF0 } from '../audio/engine.js';
import { CREAK_APERIODICITY } from '../constants.js';
import { explainer, practiceCue, takeControls } from './shared.js';
import { completeStep } from '../progress/state.js';
import { base, save } from '../store/baseline.js';
import { DIAGRAMS } from '../ui/diagrams.js';
import { meter, pitchFill, setMeter } from '../ui/meters.js';
import { Ribbon } from '../ui/ribbon.js';

// --- glides ---------------------------------------------------------------
export function buildGlide() {
  var html =
    '<div class="card">' +
      '<h3>Pitch glides — re-measure your floor</h3>' +
      '<p class="why">Your comfortable range moves as technique improves. Re-measuring keeps the ' +
      'pitch target honest instead of letting it drift away from what your voice can actually hold.</p>' +
      practiceCue('Record 4 separate downward “ahh” glides. Each one starts comfortably, lasts ' +
        'about 3–5 seconds, and ends as soon as the tone becomes creaky, breathy, or effortful.') +
      explainer({
        steps: [
          'Sigh down on "ahh" from a comfortable pitch.',
          'Stop the moment the tone turns creaky or effortful.',
          'Fully release between glides. After four clear glides, save their middle result as your new floor.'
        ],
        note: 'Creaky frames are discarded, so pushing past the clear part of the glide ' +
              'does not lower your floor — it just adds nothing.',
        diagram: DIAGRAMS.glide
      }) +
      '<canvas id="rib" class="trace" role="img" aria-label="Live pitch trace"></canvas>' +
      '<div class="meters">' + meter('m-pitch', 'Pitch', '', true) + meter('m-low', 'New floor estimate') +
        meter('m-reps', 'Clear glides') + meter('m-cur', 'Current floor') + '</div>' +
      takeControls('Start', '<button id="saveFloor" disabled>Save as new floor</button>') +
    '</div>';

  var REQUIRED_GLIDES = 4;
  var MIN_GLIDE_MS = 700;
  var END_GAP_MS = 250;
  var rib, running = false, lowest = null, minima = [];
  var glideMin = null, glideMs = 0, gapMs = 0, lastTs = null;

  function floorEstimate() { return floorFromGlides(minima, REQUIRED_GLIDES); }

  function partialEstimate() {
    if (!minima.length) return null;
    var sorted = minima.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function finishGlide() {
    if (glideMin != null && glideMs >= MIN_GLIDE_MS && minima.length < REQUIRED_GLIDES) {
      minima.push(glideMin);
    }
    glideMin = null; glideMs = 0; gapMs = 0;
    lowest = floorEstimate();
    var partial = partialEstimate();
    setMeter('m-reps', minima.length + ' of ' + REQUIRED_GLIDES,
      minima.length >= REQUIRED_GLIDES ? 'enough to save' : 'release, then glide again',
      { hit: minima.length >= REQUIRED_GLIDES });
    setMeter('m-low', (lowest != null ? lowest : partial) != null ?
      (lowest != null ? lowest : partial).toFixed(0) + ' Hz' : '--',
      lowest != null ? 'median of four clear glide bottoms' : 'provisional — collect all four');
    document.getElementById('saveFloor').disabled = minima.length < REQUIRED_GLIDES;
  }

  function setRunning(el, on) {
    running = on;
    if (on) {
      lowest = null; minima = []; glideMin = null; glideMs = 0; gapMs = 0; lastTs = null; rib.pts = [];
      beginTake();
      // All three of these outlived the take that produced them: the meter
      // kept showing the previous take's floor until a clear frame replaced
      // it, the save button stayed armed over a `lowest` that was now null so
      // pressing it did nothing at all, and "Floor updated" sat there through
      // the next take as though it had just happened.
      setMeter('m-low', '--');
      setMeter('m-reps', '0 of ' + REQUIRED_GLIDES, 'start the first glide');
      document.getElementById('saveFloor').disabled = true;
      document.getElementById('status').textContent = 'recording — nothing is saved';
    } else {
      finishGlide();
      document.getElementById('status').textContent = '';
    }
    el.textContent = on ? 'Stop' : 'Start';
    el.className = on ? 'recording' : 'primary';
  }

  return {
    html: html,
    abort: function () {
      if (!running) return;
      setRunning(document.getElementById('go'), false);
      // A floor is written straight into the pitch target every later drill is
      // held to, so it may not come from a take that was cut short.
      lowest = null;
      document.getElementById('saveFloor').disabled = true;
      setMeter('m-low', '--');
      document.getElementById('status').textContent =
        'Take stopped before it finished — discarded rather than saved as a floor.';
    },
    mount: function () {
      rib = new Ribbon(document.getElementById('rib'));
      rib.resize(); rib.draw(null);
      setMeter('m-cur', base.safeFloor != null ? base.safeFloor.toFixed(0) + ' Hz' : '--');
      document.getElementById('go').onclick = function () { setRunning(this, !running); };
      document.getElementById('saveFloor').onclick = function () {
        if (lowest == null) return;
        base.safeFloor = lowest;
        save();
        setMeter('m-cur', base.safeFloor.toFixed(0) + ' Hz');
        document.getElementById('status').textContent = 'Floor updated — pitch target recalculated.';
        this.disabled = true;
        // Saving a floor is the whole job of this step: it is the moment the
        // measurement turns into something the rest of the app uses.
        completeStep('glide', 1);
      };
    },
    frame: function (a, ts) {
      var f0 = smoothF0.value();
      var clear = a.voiced && f0 && a.aperiodicity < CREAK_APERIODICITY && a.rms > 0.02;
      setMeter('m-pitch', f0 ? f0.toFixed(0) + ' Hz' : '--',
        a.voiced ? (clear ? 'clear' : 'creaky — not counted') : '',
        { fill: f0 ? pitchFill(f0) : 0, hit: clear });
      if (running) {
        var dt = lastTs == null ? 0 : Math.min(100, ts - lastTs);
        lastTs = ts;
        rib.push(a.voiced ? f0 : 0);
        if (clear) {
          gapMs = 0;
          glideMs += dt;
          if (glideMin == null || f0 < glideMin) glideMin = f0;
        } else if (glideMin != null) {
          gapMs += dt;
          if (gapMs >= END_GAP_MS) finishGlide();
        }
        rib.draw(null);
      }
    }
  };
}

// Kept pure so the safety-critical aggregation rule can be tested without a
// microphone. No floor exists until the promised number of glides exists.
export function floorFromGlides(values, required) {
  required = required || 4;
  if (!values || values.length < required) return null;
  var sorted = values.slice().sort(function (a, b) { return a - b; });
  var mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
