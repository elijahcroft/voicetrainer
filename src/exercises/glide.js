import { beginTake, smoothF0 } from '../audio/engine.js';
import { CREAK_APERIODICITY } from '../constants.js';
import { explainer, takeControls } from './shared.js';
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
      explainer({
        steps: [
          'Sigh down on "ahh" from a comfortable pitch.',
          'Stop the moment the tone turns creaky or effortful.',
          'Repeat three or four times, then save the result as your new floor.'
        ],
        note: 'Creaky frames are discarded, so pushing past the clear part of the glide ' +
              'does not lower your floor — it just adds nothing.',
        diagram: DIAGRAMS.glide
      }) +
      '<canvas id="rib" class="trace" role="img" aria-label="Live pitch trace"></canvas>' +
      '<div class="meters">' + meter('m-pitch', 'Pitch', '', true) + meter('m-low', 'Lowest clear') +
        meter('m-cur', 'Current floor') + '</div>' +
      takeControls('Start', '<button id="saveFloor" disabled>Save as new floor</button>') +
    '</div>';

  var rib, running = false, lowest = null;

  function setRunning(el, on) {
    running = on;
    if (on) {
      lowest = null; rib.pts = [];
      beginTake();
      // All three of these outlived the take that produced them: the meter
      // kept showing the previous take's floor until a clear frame replaced
      // it, the save button stayed armed over a `lowest` that was now null so
      // pressing it did nothing at all, and "Floor updated" sat there through
      // the next take as though it had just happened.
      setMeter('m-low', '--');
      document.getElementById('saveFloor').disabled = true;
      document.getElementById('status').textContent = 'recording — nothing is saved';
    } else {
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
    frame: function (a) {
      var f0 = smoothF0.value();
      var clear = a.voiced && f0 && a.aperiodicity < CREAK_APERIODICITY && a.rms > 0.02;
      setMeter('m-pitch', f0 ? f0.toFixed(0) + ' Hz' : '--',
        a.voiced ? (clear ? 'clear' : 'creaky — not counted') : '',
        { fill: f0 ? pitchFill(f0) : 0, hit: clear });
      if (running) {
        rib.push(a.voiced ? f0 : 0);
        if (clear && (lowest == null || f0 < lowest)) {
          lowest = f0;
          document.getElementById('saveFloor').disabled = false;
        }
        setMeter('m-low', lowest ? lowest.toFixed(0) + ' Hz' : '--');
        rib.draw(null);
      }
    }
  };
}
