import { beginTake, smoothRes } from '../audio/engine.js';
import { RESONANCE_GOAL } from '../constants.js';
import { completeStep } from '../progress/state.js';
import { base } from '../store/baseline.js';
import { explainer, practiceCue, resonanceMeterOpts, resonanceSub, takeControls } from './shared.js';
import { meter, setMeter } from '../ui/meters.js';

// --- resonance ladder -----------------------------------------------------
// The missing bridge in the original routine: resonance was isolated on a
// yawn and /ng/, then expected to survive a complete passage. Each rung adds
// speech while retaining the same easy, larger-space intention.

var RUNGS = [
  {
    name: 'Hum', prompt: 'mmm',
    cue: 'Make three easy hums, 2–4 seconds each. Notice the vibration without pressing for volume.'
  },
  {
    name: 'Open syllable', prompt: 'mah',
    cue: 'Make “mmm” and open smoothly into “mah.” Repeat three times without changing the throat shape.'
  },
  {
    name: 'Words', prompt: 'mom · calm · arm · tomorrow',
    cue: 'Say the four words slowly. Reset with a quiet “mmm” before a word if the sound becomes smaller or tight.'
  },
  {
    name: 'Phrase', prompt: 'My calm voice carries across the room.',
    cue: 'Say the complete phrase three times in a conversational voice. Keep the larger, easy sound; do not imitate the hum.'
  }
];

var RUNG_VOICED_MS = 6000;

export function buildLadder() {
  var html =
    '<div class="card">' +
      '<h3>Resonance ladder — sound into speech</h3>' +
      '<p class="why">The goal is transfer: keep an easy, larger resonating space while a hum ' +
      'becomes a syllable, words, and finally a normal sentence.</p>' +
      practiceCue('Complete four rungs. At each rung, make the prompt three times and fully ' +
        'release between repetitions. Move on after 6 seconds of voiced practice are captured.') +
      explainer({
        summary: 'What to keep—and what not to force',
        steps: [
          'Begin each rung with an easy throat and ordinary conversational volume.',
          'Aim for the resonance trace to remain near or above your baseline as speech is added.',
          'If the number falls, return to the previous sound once; do not push the larynx down.'
        ],
        note: 'Different vowels naturally produce different readings. The meter shows direction ' +
              'within the rung; completing the ladder depends on practice time, not hitting a number.'
      }) +
      '<div class="prompt-card" id="ladderPrompt"></div>' +
      '<div class="meters">' + meter('m-res', 'Resonance', '', true) +
        meter('m-best', 'Best this rung') + meter('m-rung-time', 'Voiced practice', '', true) + '</div>' +
      takeControls('Start ladder', '<button id="nextRung" disabled>Next rung</button>') +
    '</div>';

  var rung = 0, running = false, voicedMs = 0, best = null, lastTs = null;

  function renderPrompt() {
    var r = RUNGS[rung];
    document.getElementById('ladderPrompt').innerHTML =
      '<div class="cnt">rung ' + (rung + 1) + ' of ' + RUNGS.length + ' · ' + r.name + '</div>' +
      '<div class="ladder-say">' + r.prompt + '</div><p>' + r.cue + '</p>';
    var next = document.getElementById('nextRung');
    next.disabled = voicedMs < RUNG_VOICED_MS;
    next.textContent = rung === RUNGS.length - 1 ? 'Finish ladder' : 'Next rung';
  }

  function resetRung() {
    voicedMs = 0; best = null; lastTs = null;
    setMeter('m-best', '--');
    setMeter('m-rung-time', '0 s', 'of ' + (RUNG_VOICED_MS / 1000) + ' s',
      { hit: false, fill: 0 });
    renderPrompt();
  }

  function setRunning(on) {
    running = on;
    var go = document.getElementById('go');
    go.textContent = on ? 'Pause' : (rung || voicedMs ? 'Resume ladder' : 'Start ladder');
    go.className = on ? 'recording' : 'primary';
    if (on) {
      beginTake();
      lastTs = null;
      document.getElementById('status').textContent = 'practising rung ' + (rung + 1);
    } else {
      document.getElementById('status').textContent = 'paused — this rung is kept';
    }
  }

  return {
    html: html,
    abort: function () { if (running) setRunning(false); },
    mount: function () {
      resetRung();
      document.getElementById('go').onclick = function () { setRunning(!running); };
      document.getElementById('nextRung').onclick = function () {
        if (voicedMs < RUNG_VOICED_MS) return;
        if (rung === RUNGS.length - 1) {
          running = false;
          completeStep('ladder');
          document.getElementById('go').disabled = true;
          this.disabled = true;
          this.textContent = 'Ladder complete';
          document.getElementById('status').textContent = 'All four rungs are done for today.';
          return;
        }
        rung++;
        resetRung();
        if (running) {
          beginTake();
          document.getElementById('status').textContent = 'practising rung ' + (rung + 1);
        }
      };
    },
    frame: function (a, ts) {
      var res = smoothRes.value();
      setMeter('m-res', res != null ? res.toFixed(1) + ' cm' : '--', resonanceSub(res),
        resonanceMeterOpts(res));
      if (!running) return;
      var dt = lastTs == null ? 0 : Math.min(100, ts - lastTs);
      lastTs = ts;
      if (a.voiced && res != null) {
        voicedMs += dt;
        if (best == null || res > best) best = res;
      }
      setMeter('m-best', best != null ? best.toFixed(1) + ' cm' : '--',
        base.resonance != null ? 'goal ' + (base.resonance * RESONANCE_GOAL).toFixed(1) + ' cm' : '');
      var secs = voicedMs / 1000;
      var ready = voicedMs >= RUNG_VOICED_MS;
      setMeter('m-rung-time', secs.toFixed(0) + ' s', ready ? 'ready for the next rung' :
        'of ' + (RUNG_VOICED_MS / 1000) + ' s', { hit: ready, fill: voicedMs / RUNG_VOICED_MS });
      document.getElementById('nextRung').disabled = !ready;
    }
  };
}
