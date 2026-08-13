import { resetSmoothers, syncMicControls } from '../audio/engine.js';
import { buildCalibrate } from './calibrate.js';
import { buildFree } from './free.js';
import { buildGlide } from './glide.js';
import { buildIntonation } from './intonation.js';
import { buildLadder } from './ladder.js';
import { buildOnset } from './onset.js';
import { buildPassage } from './passage.js';
import { buildProgress } from './progress-view.js';
import { simpleExercise } from './shared.js';
import { buildSources } from './sources.js';
import { buildYawn } from './yawn.js';
import { linkTerms } from '../glossary.js';
import { ROUTINE, nextStep, progress, rollDay, stepDone } from '../progress/state.js';
import { recommendFocus } from '../progress/focus.js';
import { base } from '../store/baseline.js';
import { history } from '../store/history.js';
import { pitchTarget } from '../targets.js';
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
        practice: 'Make 8–10 gentle tones through the straw. Hold each for 5–8 seconds, then ' +
                  'release and take one easy breath.',
        steps: [
          'Place a narrow straw between your lips and seal your lips around it.',
          'Send a gentle “oo” tone through the straw at a comfortable pitch. Do not aim low.',
          'Keep the airflow and sound even, then fully release before the next repetition.'
        ],
        note: '<b>This is not a pitch-lowering exercise.</b> A small wobble is normal. If the ' +
              'sound feels tight, gets rougher, or needs more effort, use less volume or move to ' +
              'a more comfortable pitch.',
        diagram: DIAGRAMS.straw,
        showBand: false,
        goalSeconds: 60,
        measure: 'steady'
      });
    }
  },
  {
    id: 'onset',
    title: '2. Easy-onset reset',
    sub: 'Release breath-holding and throat grip',
    build: buildOnset
  },
  {
    id: 'yawn',
    title: '3. Yawn-sigh',
    sub: 'Larynx lowering — resonance only',
    build: buildYawn
  },
  {
    id: 'ng',
    title: '4. "Ng" slides',
    sub: 'Pitch and resonance together',
    build: function () {
      return simpleExercise({
        title: '"Ng" descending slides',
        why: 'The /ŋ/ at the end of "sing" couples the vocal tract to the nasal cavity and makes ' +
             'larynx height easy to feel. Sliding downward on it trains pitch and resonance to ' +
             'move together, which is what a naturally low voice does.',
        practice: 'Do 6–8 slow slides. Let each slide last 4–6 seconds, then release and take ' +
                  'one easy breath.',
        steps: [
          'Hold the "ng" from the end of <i>sing</i>.',
          'Slide slowly downward while keeping your jaw and throat loose.',
          'Watch for pitch falling <i>and</i> resonance growing at the same time.'
        ],
        note: 'Do not push the voice box down or hold it with your hand. If resonance stays flat, ' +
              'make the slide smaller and easier; the display is feedback, not a reason to force ' +
              'the movement.',
        diagram: DIAGRAMS.ng,
        showBand: true,
        goalSeconds: 35,
        measure: 'both'
      });
    }
  },
  {
    id: 'ladder',
    title: '5. Resonance ladder',
    sub: 'Carry the larger sound into phrases',
    build: buildLadder
  },
  {
    id: 'vowels',
    title: '6. Sustained vowels',
    sub: 'Hold the target pitch',
    build: function () {
      return simpleExercise({
        title: 'Sustained vowels at target pitch',
        why: 'Holding your target pitch on an open vowel builds the muscle memory to start speech ' +
             'there. The weight meter estimates how the sound’s fullness changes relative to your ' +
             'baseline; how your throat feels remains the safety check.',
        practice: 'Make 6–8 “ah” sounds. Hold each for 5–7 seconds, then fully release and take ' +
                  'one easy breath.',
        steps: [
          'Begin “ah” gently near the centre of the shaded target band.',
          'Keep the sound comfortable and aim for 80% of voiced time inside the band.',
          'Use the weight meter only as an estimate of relative fullness; it cannot diagnose strain.'
        ],
        note: 'The meter cannot tell whether your throat feels comfortable. If the note becomes ' +
              'tight, rough, or harder to start, come up a few hertz or use the easy-onset reset.',
        diagram: DIAGRAMS.weight,
        showBand: true,
        goalSeconds: 35,
        measure: 'both'
      });
    }
  },
  {
    id: 'glide',
    title: '7. Pitch glides',
    sub: 'Re-measure your floor',
    build: buildGlide
  },
  {
    id: 'endings',
    title: '8. Statement endings',
    sub: 'Land the last syllable',
    build: buildIntonation
  },
  {
    id: 'passage',
    title: '9. Reading passage',
    sub: 'All four measures live',
    build: buildPassage
  },
  {
    id: 'free',
    title: '10. Free speech',
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

// Built only from days before today, so this remains the same plan from the
// first exercise to the last even though today's takes are added to history.
export function dailyFocus() {
  return recommendFocus(history, base, pitchTarget());
}

export function renderExList() {
  rollDay();
  var calibrated = base.habitualF0 != null;
  var focus = dailyFocus();
  var next = nextStep(focus.steps);

  document.getElementById('exList').innerHTML = EXERCISES.map(function (e) {
    var isCal = e.id === 'calibrate';
    var inRoutine = ROUTINE.indexOf(e.id) >= 0;
    var done = isCal ? calibrated : (inRoutine && stepDone(e.id));
    var isNext = e.id === next;
    var isFocus = focus.steps.indexOf(e.id) >= 0;
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
      (isFocus ? ' focus' : '') +
      '" data-id="' + e.id + '">' +
      '<span class="n" aria-hidden="true">' + badge + '</span>' +
      '<span><span class="t">' + title + '</span><span class="s" style="display:block">' + e.sub + '</span></span>' +
      // Calibration is "done" without ever having earned XP, so the badge is
      // tied to the award rather than to the tick beside it.
      (done && progress.done[e.id] != null
        ? '<span class="xpb" aria-hidden="true">+' + progress.done[e.id] + '</span>' : '') +
      '</button>';
  }).join('');
  renderFocusCard(calibrated ? focus : null, next);
  // Outside the list: on a phone the list is a horizontal scroller, and a
  // paragraph inside it becomes a 50px-wide flex item 200px tall.
  document.getElementById('lockedNote').hidden = calibrated;
  Array.prototype.forEach.call(document.querySelectorAll('.ex'), function (b) {
    b.onclick = function () { openExercise(b.dataset.id); };
  });
  revealStep();
}

function renderFocusCard(focus, next) {
  var el = document.getElementById('focusCard');
  if (!el) return;
  el.hidden = !focus;
  if (!focus) { el.innerHTML = ''; return; }

  var names = {};
  EXERCISES.forEach(function (exercise) {
    names[exercise.id] = exercise.title.replace(/^\d+\.\s*/, '');
  });
  el.innerHTML =
    '<div class="fc-head"><span>Today’s focus</span><b>' + focus.title + '</b></div>' +
    '<p>' + focus.reason + '</p>' +
    '<div class="focus-steps" aria-label="Recommended five-step session">' +
      focus.steps.map(function (id) {
        return '<span class="' + (stepDone(id) ? 'done' : id === next ? 'current' : '') + '">' +
          (stepDone(id) ? '✓ ' : '') + names[id] + '</span>';
      }).join('') +
    '</div>' +
    '<small>' + focus.evidence + ' · Targets stay fixed</small>';
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
