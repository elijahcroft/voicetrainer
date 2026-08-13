import DSP from '../dsp.js';
import { contourDelta, findFinalSyllable } from '../analysis/endings.js';
import { beginTake } from '../audio/engine.js';
import { CONTOUR_MIN_MS, HOLD_LONG_MS, MIN_PHRASE_MS, PHRASE_GAP_MS, TERMINAL_ST } from '../constants.js';
import { STATEMENTS } from './registry.js';
import { practiceCue, takeControls } from './shared.js';
import { completeStep } from '../progress/state.js';
import { SMOOTH_HALF_MS, medianFilter } from '../analysis/smooth.js';
import { Contour } from '../ui/contour.js';
import { DIAGRAMS } from '../ui/diagrams.js';
import { median } from '../util/stats.js';

export function buildIntonation() {
  var html =
    '<div class="card">' +
      '<h3>Statement endings — landing the last syllable</h3>' +
      '<p class="why">Two habits sit on top of pitch and are heard independently of it: holding the ' +
      'final syllable long, and letting it slide upward. Neither needs your range to move, and ' +
      'both should remain easy. <b>Read the sentence below, then pause for about ' +
      'a second</b> — the pause is what tells the tool an ending happened.</p>' +
      practiceCue('Read all 8 sentences once. After each sentence, stay silent for about one ' +
        'second so the app can score the ending and show the next prompt.') +

      '<details class="explain"><summary>How to do it, and what is being measured</summary><div>' +
        '<ol class="steps">' +
          '<li>Read the sentence, then <b>pause for about a second</b> — the pause is what tells ' +
            'the tool the sentence ended.</li>' +
          '<li>Keep the last syllable <i>short</i>, and let the pitch drop onto it.</li>' +
          '<li>Complete all eight prompts. Falling is the target, flat is also acceptable, and a rise is feedback to retry later.</li>' +
        '</ol>' +
        '<p class="note">Falling is the target and flat is fine; only a rise counts against you. ' +
        'Do not fake the fall by shoving the pitch down at the end — drop it and stop, the way you ' +
        'would if the sentence had simply run out.</p>' +
        DIAGRAMS.terminal() +
        '<p class="note">The trace is drawn in semitones around the sentence’s own average, so ' +
        'it shows the shape of the ending and not where your voice sits — pitch has its own drills. ' +
        'The shaded part is the final syllable, found from a dip in loudness; the verdict is read ' +
        'from that syllable alone.</p>' +
      '</div></details>' +

      '<div class="stack">' +
        '<div class="prompt"><div class="cnt" id="cnt">sentence 1 of ' + STATEMENTS.length + '</div>' +
          '<div class="say" id="say">' + STATEMENTS[0] + '</div></div>' +
        '<canvas id="cont" role="img" aria-label="Pitch contour of the sentence you just read, ' +
          'with the final syllable highlighted"></canvas>' +
        '<div class="verdict" id="verdict"><span class="v">—</span>' +
          '<span class="d">read a sentence, then pause</span></div>' +
      '</div>' +
      '<div class="chips" id="chips"></div>' +
      takeControls('Start take') +
      '<div id="report"></div>' +
    '</div>';

  var view, running = false;
  var pts = [];              // frames of the phrase in progress
  var frozen = null;         // the last scored phrase, kept on screen
  var gapMs = 0, lastTs = null;
  var results = [];

  function setRunning(el, on) {
    running = on;
    if (on) {
      pts = []; results = []; frozen = null;
      gapMs = 0; lastTs = null;
      beginTake();
      document.getElementById('report').innerHTML = '';
      setVerdict(null);
      renderChips();
      document.getElementById('status').textContent = 'recording — nothing is saved';
    } else {
      endPhrase();
      document.getElementById('status').textContent = '';
      report();
    }
    el.textContent = on ? 'Stop' : 'Start take';
    el.className = on ? 'recording' : 'primary';
    redraw();
  }

  function prompt() {
    var i = results.length % STATEMENTS.length;
    document.getElementById('cnt').textContent =
      'sentence ' + (i + 1) + ' of ' + STATEMENTS.length +
      (results.length >= STATEMENTS.length ? ' — round ' +
        (Math.floor(results.length / STATEMENTS.length) + 1) : '');
    document.getElementById('say').textContent = STATEMENTS[i];
  }

  function setVerdict(r) {
    var el = document.getElementById('verdict');
    if (!r) {
      el.className = 'verdict';
      el.innerHTML = '<span class="v">—</span><span class="d">' +
        (running ? 'read the sentence, then pause' : 'read a sentence, then pause') + '</span>';
      return;
    }
    var word = r.dir === 'rise' ? 'Rose' : r.dir === 'fall' ? 'Landed' : 'Flat';
    var detail = (r.dir === 'rise' ? 'up ' : r.dir === 'fall' ? 'down ' : 'within ') +
      Math.abs(r.delta).toFixed(1) + ' semitones across the last syllable';
    if (r.hold != null) {
      detail += ' · held ' + r.hold.toFixed(0) + ' ms' +
        (r.hold > HOLD_LONG_MS ? ' — stretched' : '');
    } else {
      detail += ' · length unreadable, it ran into the syllable before it';
    }
    el.className = 'verdict ' + (r.dir === 'rise' ? 'warn' : 'good');
    el.innerHTML = '<span class="v">' + word + '</span><span class="d">' + detail + '</span>';
  }

  function renderChips() {
    var landed = results.filter(function (r) { return r.dir !== 'rise'; }).length;
    var boxes = [];
    for (var i = 0; i < Math.max(STATEMENTS.length, results.length); i++) {
      var r = results[i];
      boxes.push('<span class="chip' + (r ? ' ' + r.dir : '') + '">' +
        (r ? (r.dir === 'rise' ? '↑' : r.dir === 'fall' ? '↓' : '–') : '') + '</span>');
    }
    document.getElementById('chips').innerHTML = boxes.join('') +
      '<span class="cnt">' + landed + ' of ' + results.length + ' landed</span>';
  }

  function endPhrase() {
    var phrase = pts;
    pts = [];
    var voiced = phrase.filter(function (p) { return p.st != null; });
    // A cough, a door, or the tail of the sentence before is not a phrase.
    if (voiced.length < 4 || voiced[voiced.length - 1].t - voiced[0].t < MIN_PHRASE_MS) return;

    // Score the de-spiked copy; keep the raw one for the drawing, which
    // smooths it the same way when it draws.
    var st = medianFilter(phrase, function (p) { return p.st; }, SMOOTH_HALF_MS);
    var clean = phrase.map(function (p, i) { return { t: p.t, st: st[i], rms: p.rms }; });
    var syl = findFinalSyllable(clean);
    if (!syl) return;
    var delta = contourDelta(clean, syl.start, syl.end);
    if (delta == null) return;

    var r = {
      delta: delta,
      hold: syl.found ? syl.end - syl.start : null,
      dir: delta >= TERMINAL_ST ? 'rise' : delta <= -TERMINAL_ST ? 'fall' : 'flat',
      from: Math.min(syl.start, syl.end - CONTOUR_MIN_MS),
      to: syl.end
    };
    results.push(r);
    // Without trimming, every frozen sentence carries the quarter-second of
    // silence that ended it and the line stops short of the right edge.
    while (phrase.length && phrase[phrase.length - 1].st == null) phrase.pop();
    frozen = { pts: phrase, mark: r };
    setVerdict(r);
    renderChips();
    prompt();
  }

  // While a sentence is being spoken it draws itself; the moment it ends the
  // scored version replaces it and stays put, because a contour you cannot
  // look at afterwards is not feedback.
  function redraw() {
    // A sentence in progress is drawn against a fixed span so the line grows
    // steadily instead of rescaling under you; a finished one is stretched to
    // the width, since by then its length is known.
    if (pts.length) view.draw(pts, false, 2200);
    else if (frozen) view.draw(frozen.pts, frozen.mark, 0);
    else view.draw(null, running ? false : null);
  }

  return {
    html: html,
    abort: function () {
      if (running) setRunning(document.getElementById('go'), false);
    },
    mount: function () {
      view = new Contour(document.getElementById('cont'));
      view.resize();
      prompt();
      renderChips();
      redraw();
      document.getElementById('go').onclick = function () { setRunning(this, !running); };
    },
    frame: function (a, ts) {
      if (running) {
        var dt = lastTs == null ? 0 : Math.min(100, ts - lastTs);
        lastTs = ts;
        // Raw per-frame pitch, not the shared smoother. That smoother is a
        // median of five *frames*, which is 83 ms at 60 Hz and over 200 ms on
        // a slow one — long enough to flatten a final syllable that only
        // lasts a quarter of a second, and it was attenuating real rises into
        // "flat". The contour does its own smoothing over a fixed 50 ms
        // window instead, which the octave-slip test covers.
        if (a.voiced && a.f0) {
          gapMs = 0;
          if (!pts.length) frozen = null;   // a new sentence clears the old one
          pts.push({ t: ts, st: DSP.hzToSemitones(a.f0), rms: a.rms });
        } else {
          gapMs += dt;
          if (pts.length) {
            if (gapMs >= PHRASE_GAP_MS) endPhrase();
            else pts.push({ t: ts, st: null, rms: a.rms });
          }
        }
      }
      // Redrawn even when stopped, so the scored sentence survives the window
      // being resized while you are looking at it.
      redraw();
    }
  };

  function report() {
    var el = document.getElementById('report');
    if (results.length < STATEMENTS.length) {
      el.innerHTML = '<div class="banner err" style="margin-top:14px">Only ' + results.length +
        ' of ' + STATEMENTS.length + ' sentences scored. Continue until every prompt has a result, ' +
        'leaving about a second of silence between them.</div>';
      return;
    }
    var rises = results.filter(function (r) { return r.dir === 'rise'; }).length;
    var holds = results.filter(function (r) { return r.hold != null; })
      .map(function (r) { return r.hold; });
    var longs = holds.filter(function (h) { return h > HOLD_LONG_MS; }).length;
    el.innerHTML =
      '<table style="margin-top:16px"><tr><th>Measure</th><th>This take</th><th>Target</th><th></th></tr>' +
      '<tr><td>Endings that rose</td><td class="num">' + rises + ' of ' + results.length +
        '</td><td class="num">0</td><td class="' + (rises === 0 ? 'ok' : 'no') + '">' +
        (rises === 0 ? 'on target' : 'keep working') + '</td></tr>' +
      (holds.length
        ? '<tr><td>Median final syllable</td><td class="num">' + median(holds).toFixed(0) +
          ' ms</td><td class="num">under ' + HOLD_LONG_MS + ' ms</td><td class="' +
          (longs === 0 ? 'ok' : 'no') + '">' + (longs === 0 ? 'on target' : longs + ' stretched') +
          '</td></tr>'
        : '<tr><td>Median final syllable</td><td class="num">—</td><td class="num">under ' +
          HOLD_LONG_MS + ' ms</td><td>no clean boundary found</td></tr>') +
      '</table>' +
      '<div class="hint">Not saved to <b>Progress</b>: this is a shape rather than a level, and it ' +
      'only means anything against the sentences on this page. The transfer test is whether the ' +
      'endings still land in <b>Free speech</b>, where nothing is prompting you.</div>';

    // The visible exercise promises one complete eight-sentence round, so the
    // completion rule uses that same boundary. Graded on how many landed.
    completeStep('endings', 1 - rises / results.length);
  }
}
