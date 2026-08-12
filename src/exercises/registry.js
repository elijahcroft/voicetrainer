import { resetSmoothers, syncMicControls } from '../audio/engine.js';
import { buildCalibrate } from './calibrate.js';
import { buildFree } from './free.js';
import { buildGlide } from './glide.js';
import { buildIntonation } from './intonation.js';
import { buildPassage } from './passage.js';
import { buildProgress } from './progress-view.js';
import { simpleExercise } from './shared.js';
import { buildSources } from './sources.js';
import { buildYawn } from './yawn.js';
import { linkTerms } from '../glossary.js';
import { ROUTINE, nextStep, progress, rollDay, stepDone } from '../progress/state.js';
import { base } from '../store/baseline.js';
import { DIAGRAMS } from '../ui/diagrams.js';

// ==========================================================================
// exercises
// ==========================================================================

export var current = null;

export var PASSAGE = 'When the sunlight strikes raindrops in the air, they act as a prism and form a ' +
  'rainbow. The rainbow is a division of white light into many beautiful colors.';

// Statements for the endings drill. Every one ends on a stressed syllable with
// a voiced nucleus, so the final contour is actually measurable — an ending
// like "...at six" goes unvoiced on the last consonant and the fall lands in
// silence where nothing can read it.
export var STATEMENTS = [
  'I finished it this morning.',
  'The meeting is on Tuesday.',
  'I already know how it ends.',
  'That is not what I ordered.',
  'We can talk about it tomorrow.',
  'I left the keys on the table.',
  'It took about an hour.',
  'I will be there in the evening.'
];

export var EXERCISES = [
  {
    id: 'calibrate',
    title: 'Calibrate',
    sub: 'Measure your baseline and floor',
    build: buildCalibrate
  },
  {
    id: 'straw',
    title: '1. Straw warm-up',
    sub: 'Semi-occluded, lowest strain',
    build: function () {
      return simpleExercise({
        title: 'Straw phonation warm-up',
        why: 'A semi-occluded vocal tract balances the pressure above and below the vocal folds, ' +
             'which lets you work at the bottom of your range with far less collision force. ' +
             'This is the standard warm-up before any pitch work.',
        steps: [
          'Seal your lips around a narrow straw — a coffee stirrer is ideal.',
          'Hum at a comfortable pitch and hold it steady.',
          'Aim for a flat line on the trace, for two minutes.'
        ],
        note: '<b>This is not a pitch-lowering exercise.</b> Wobble in the line means you are ' +
              'pushing; back off until it settles rather than trying to hold the number down.',
        diagram: DIAGRAMS.straw,
        showBand: false,
        goalSeconds: 120,
        measure: 'steady'
      });
    }
  },
  {
    id: 'yawn',
    title: '2. Yawn-sigh',
    sub: 'Larynx lowering — resonance only',
    build: buildYawn
  },
  {
    id: 'ng',
    title: '3. "Ng" slides',
    sub: 'Pitch and resonance together',
    build: function () {
      return simpleExercise({
        title: '"Ng" descending slides',
        why: 'The /ŋ/ at the end of "sing" couples the vocal tract to the nasal cavity and makes ' +
             'larynx height easy to feel. Sliding downward on it trains pitch and resonance to ' +
             'move together, which is what a naturally low voice does.',
        steps: [
          'Hold the "ng" from the end of <i>sing</i>.',
          'Slide slowly downward, letting the larynx ride down with the pitch.',
          'Watch for pitch falling <i>and</i> resonance growing at the same time.'
        ],
        note: 'If resonance stays flat while the pitch drops, you are lowering pitch with the ' +
              'folds alone — that is the tiring way, and it is the thing this exercise exists ' +
              'to catch.',
        diagram: DIAGRAMS.ng,
        showBand: true,
        goalSeconds: 90,
        measure: 'both'
      });
    }
  },
  {
    id: 'vowels',
    title: '4. Sustained vowels',
    sub: 'Hold the target pitch',
    build: function () {
      return simpleExercise({
        title: 'Sustained vowels at target pitch',
        why: 'Holding your target pitch on an open vowel builds the muscle memory to start speech ' +
             'there. The weight meter tells you whether you are getting there with fold thickness ' +
             '(sustainable) or by pressing (not).',
        steps: [
          'Sustain "ah" inside the shaded target band.',
          'Aim for 8 of every 10 seconds in the band.',
          'Keep weight at or above your baseline.'
        ],
        note: 'A thin, pressed low note is the failure mode: it hits the number and teaches your ' +
              'voice the wrong habit. If weight reads <b>lighter</b>, come up a few hertz and ' +
              'sustain there instead.',
        diagram: DIAGRAMS.weight,
        showBand: true,
        goalSeconds: 90,
        measure: 'both'
      });
    }
  },
  {
    id: 'glide',
    title: '5. Pitch glides',
    sub: 'Re-measure your floor',
    build: buildGlide
  },
  {
    id: 'endings',
    title: '6. Statement endings',
    sub: 'Land the last syllable',
    build: buildIntonation
  },
  {
    id: 'passage',
    title: '7. Reading passage',
    sub: 'All four measures live',
    build: buildPassage
  },
  {
    id: 'free',
    title: '8. Free speech',
    sub: 'No live meters — report after',
    build: buildFree
  },
  {
    id: 'progress',
    title: 'Progress',
    sub: 'Your scored takes over time',
    build: buildProgress
  },
  {
    id: 'sources',
    title: 'Sources',
    sub: 'What each drill rests on',
    build: buildSources
  }
];

export function renderExList() {
  rollDay();
  var calibrated = base.habitualF0 != null;
  var next = nextStep();

  document.getElementById('exList').innerHTML = EXERCISES.map(function (e) {
    var isCal = e.id === 'calibrate';
    var inRoutine = ROUTINE.indexOf(e.id) >= 0;
    var done = isCal ? calibrated : (inRoutine && stepDone(e.id));
    var isNext = e.id === next;
    // "3. Ng slides" -> badge 3, title "Ng slides". Calibration is the
    // prerequisite rather than a numbered step, so it gets a state glyph.
    var m = /^(\d+)\.\s*(.*)$/.exec(e.title);
    var badge = isCal ? (calibrated ? '✓' : '!')
      // A count here would read as a step number beside the numbered drills.
      : e.id === 'progress' ? '↗'
      : e.id === 'sources' ? '§'
      // State replaces the number once there is state to show: a finished
      // step says so, but an untouched step is still just its place in the
      // routine.
      : done ? '✓'
      : isNext ? '▶'
      // Zero-padded, so the column of numbers stays a column.
      : (m ? ('0' + m[1]).slice(-2) : '·');
    var title = m ? m[2] : e.title;
    return '<button class="ex' + (current && current.id === e.id ? ' active' : '') +
      (done ? ' done' : '') + (isNext ? ' next' : '') +
      '" data-id="' + e.id + '">' +
      '<span class="n" aria-hidden="true">' + badge + '</span>' +
      '<span><span class="t">' + title + '</span><span class="s" style="display:block">' + e.sub + '</span></span>' +
      // Calibration is "done" without ever having earned XP, so the badge is
      // tied to the award rather than to the tick beside it.
      (done && progress.done[e.id] != null
        ? '<span class="xpb" aria-hidden="true">+' + progress.done[e.id] + '</span>' : '') +
      '</button>';
  }).join('');
  // Outside the list: on a phone the list is a horizontal scroller, and a
  // paragraph inside it becomes a 50px-wide flex item 200px tall.
  document.getElementById('lockedNote').hidden = calibrated;
  Array.prototype.forEach.call(document.querySelectorAll('.ex'), function (b) {
    b.onclick = function () { openExercise(b.dataset.id); };
  });
  revealStep();
}

// On a phone the list is a horizontal strip, so the step you are on scrolls
// off its right edge as the routine advances and the strip keeps showing
// work you have already finished.
function revealStep() {
  var list = document.getElementById('exList');
  if (list.scrollWidth <= list.clientWidth) return;
  var el = list.querySelector('.ex.active') || list.querySelector('.ex.next');
  if (!el) return;
  var left = list.scrollLeft + el.getBoundingClientRect().left -
    list.getBoundingClientRect().left - 12;
  left = Math.max(0, left);
  if (Math.abs(left - list.scrollLeft) < 4) return;
  list.scrollTo({
    left: left,
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  });
}

export function openExercise(id) {
  var def = EXERCISES.filter(function (e) { return e.id === id; })[0];
  if (!def) return;
  if (current && current.abort) current.abort();
  current = null;
  resetSmoothers();
  var built = def.build();
  built.id = id;
  document.getElementById('pane').innerHTML = built.html;
  current = built;
  stampEyebrow(def);
  linkTerms(document.getElementById('pane'));
  if (built.mount) built.mount();
  syncMicControls();
  renderExList();
}

// Where you are in the routine, above the heading of the first card. It shows
// the step number and the one-line descriptor rather than the exercise name,
// which the heading underneath is already saying.
function stampEyebrow(def) {
  var h = document.querySelector('#pane .card h3');
  if (!h) return;
  var m = /^(\d+)\.\s*(.*)$/.exec(def.title);
  var eb = document.createElement('div');
  eb.className = 'eb';
  eb.innerHTML = '<i>' + (m ? ('0' + m[1]).slice(-2)
      : def.id === 'calibrate' ? 'CAL' : def.id === 'sources' ? 'REF' : 'LOG') +
    '</i>' + def.sub + '<s></s>';
  h.parentNode.insertBefore(eb, h);
}
