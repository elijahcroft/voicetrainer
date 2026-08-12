import { beginTake, smoothF0, smoothRes } from '../audio/engine.js';
import { ANDROGYNOUS_HIGH, ANDROGYNOUS_LOW, CREAK_APERIODICITY, FLOOR_MARGIN_ST, MIN_FRAMES_FOR_MEDIAN, MIN_VOICED_MS_CALIBRATE, RESONANCE_GOAL } from '../constants.js';
import { PASSAGE, openExercise } from './registry.js';
import { explainer, micHint } from './shared.js';
import { base, save } from '../store/baseline.js';
import { recordTake } from '../store/history.js';
import { pitchTarget } from '../targets.js';
import { DIAGRAMS } from '../ui/diagrams.js';
import { meter, setMeter } from '../ui/meters.js';
import { median, semitoneSd } from '../util/stats.js';

// --- calibration ----------------------------------------------------------
export function buildCalibrate() {
  var html =
    '<div class="card">' +
      '<h3>Calibrate</h3>' +
      '<p class="why">Every target this tool shows is derived from your own voice, not from a ' +
      'population average. Two measurements are needed: how you speak now, and how low you can ' +
      'comfortably go. The second one exists so the tool can refuse to set a target that would ' +
      'have you grinding at the bottom of your range.</p>' +
      '<div id="calStep"></div>' +
    '</div>';

  var stage = 0, collecting = false;
  var f0s = [], resList = [], weights = [], lowest = null;
  var voicedMs = 0, lastTs = null;

  function render() {
    var el = document.getElementById('calStep');
    if (stage === 0) {
      el.innerHTML =
        '<div class="banner info">Step 1 of 2 — habitual voice</div>' +
        '<p>Read this aloud in your completely normal, everyday voice. Do not try to change it; ' +
        'this measurement is the reference everything else is compared against.</p>' +
        '<div class="passage">' + PASSAGE + '</div>' +
        '<div class="meters">' + meter('c-f0', 'Pitch') + meter('c-res', 'Resonance') +
          meter('c-n', 'Voiced speech', '', true) + '</div>' +
        '<div class="row take"><button id="calGo" class="primary" data-needs-mic>Start reading</button>' +
        '<span id="calStatus" style="color:var(--dim);font-size:13px"></span></div>' + micHint();
      document.getElementById('calGo').onclick = toggle;
    } else if (stage === 1) {
      el.innerHTML =
        '<div class="banner info">Step 2 of 2 — comfortable floor</div>' +
        '<p>Sigh downward on "ahh" from a comfortable pitch, and stop the moment the sound turns ' +
        'creaky, breathy, or effortful. <b>Do not push for your lowest possible note</b> — the point ' +
        'is the lowest note that still sounds clear and takes no effort. Do it three or four times.</p>' +
        explainer({ summary: 'What counts as the bottom of your range', diagram: DIAGRAMS.glide }) +
        '<div class="meters">' + meter('c-f0', 'Pitch') + meter('c-low', 'Lowest clear') + '</div>' +
        '<div class="row take"><button id="calGo" class="primary" data-needs-mic>Start glides</button>' +
        '<span id="calStatus" style="color:var(--dim);font-size:13px"></span></div>' + micHint();
      document.getElementById('calGo').onclick = toggle;
    } else {
      var t = pitchTarget();
      el.innerHTML =
        '<div class="banner info">Calibration complete</div>' +
        '<table><tr><th>Measure</th><th>Value</th></tr>' +
        '<tr><td>Habitual pitch</td><td class="num">' + base.habitualF0.toFixed(0) + ' Hz</td></tr>' +
        '<tr><td>Comfortable floor</td><td class="num">' + base.safeFloor.toFixed(0) + ' Hz</td></tr>' +
        '<tr><td>Pitch target</td><td class="num">' + t.hz.toFixed(0) + ' Hz</td></tr>' +
        '<tr><td>Resonance baseline</td><td class="num">' + (base.resonance != null ? base.resonance.toFixed(1) + ' cm' : 'not measured') + '</td></tr>' +
        '<tr><td>Resonance goal</td><td class="num">' + (base.resonance != null ? (base.resonance * RESONANCE_GOAL).toFixed(1) + ' cm' : '—') + '</td></tr>' +
        '<tr><td>Intonation</td><td class="num">' + (base.intonationSd != null ? base.intonationSd.toFixed(1) + ' st' : '—') + '</td></tr>' +
        '</table>' +
        DIAGRAMS.pitchMap({
          now: base.habitualF0,
          target: t.hz,
          caption: 'Hz. Your habitual pitch and the target this tool will hold you to. The amber ' +
            'band is where listeners stop agreeing on a voice — a real change in perception, not ' +
            'a smooth gradient, which is why crossing it buys more than the same drop elsewhere.'
        }) +
        interpretation(t) +
        '<div class="row take"><button id="calDone" class="primary">Start practising</button></div>';
      document.getElementById('calDone').onclick = function () { openExercise('straw'); };
    }
  }

  function interpretation(t) {
    var out = [];
    if (t.noHeadroom) {
      out.push('<div class="banner safety" style="margin-top:14px">There is no safe room to lower ' +
        'your pitch right now: your comfortable floor sits less than ' + FLOOR_MARGIN_ST + ' semitones ' +
        'below where you already speak, so the pitch target is simply where you are. This is a real ' +
        'result, not a measurement failure — and it is much less limiting than it sounds. Pitch ' +
        'accounts for under half of what makes a voice read as masculine; resonance is the larger ' +
        'share and is not constrained by your range at all. Work the yawn-sigh and "ng" exercises, ' +
        'and re-run the glides in a few weeks — the floor usually drops as technique improves.</div>');
    } else if (t.limited) {
      out.push('<div class="banner safety" style="margin-top:14px">Your target is set by your ' +
        'comfortable floor rather than by the 130 Hz mark, because reaching 130 Hz would put you ' +
        'within ' + FLOOR_MARGIN_ST + ' semitones of the bottom of your range. That is the right ' +
        'outcome, not a limitation of your voice: pitch explains under half of what makes a voice ' +
        'read as masculine, and resonance is both safer and available to you now. Weight the ' +
        'yawn-sigh and "ng" exercises more heavily.</div>');
    } else if (base.habitualF0 <= ANDROGYNOUS_LOW) {
      out.push('<div class="banner info" style="margin-top:14px">You already speak at or below the ' +
        'ambiguous zone (' + ANDROGYNOUS_LOW + '-' + ANDROGYNOUS_HIGH + ' Hz), where listeners stop ' +
        'reliably hearing a voice as female. Resonance and weight will do more for you than further ' +
        'pitch lowering.</div>');
    } else if (base.habitualF0 < ANDROGYNOUS_HIGH) {
      out.push('<div class="banner info" style="margin-top:14px">You already speak inside the ambiguous ' +
        'zone (' + ANDROGYNOUS_LOW + '-' + ANDROGYNOUS_HIGH + ' Hz), where gender recognition accuracy ' +
        'drops sharply — so you are past the steepest part of the curve already. There is still safe ' +
        'room to lower pitch toward your target, but resonance is the larger share of the effect from ' +
        'here on.</div>');
    } else {
      // The assumption almost everyone arrives with is that lower is better
      // without limit. It is not what listeners do: masculinity and
      // naturalness are rated separately, and naturalness went *up* when pitch
      // sat inside the ordinary male range rather than under it. That is why
      // the target steps down by two semitones and stops at 130 Hz instead of
      // chasing your floor. RESEARCH.md §8.
      out.push('<div class="banner info" style="margin-top:14px">Your target is one step down — not ' +
        'as low as your voice can go. Listeners judge how <i>natural</i> a voice sounds separately ' +
        'from how masculine it sounds, and in transmasculine speakers naturalness was rated higher ' +
        'when pitch sat inside the ordinary male range than when it sat below it. A voice can be ' +
        'read as masculine and as strained at the same time, and the second one is what people ' +
        'notice. This is why the target stops rather than chasing your floor.</div>');
    }
    return out.join('');
  }

  function toggle() {
    collecting = !collecting;
    this.textContent = collecting ? 'Stop' : 'Start';
    this.className = collecting ? 'recording' : 'primary';
    if (collecting) {
      f0s = []; resList = []; weights = []; lowest = null;
      voicedMs = 0; lastTs = null;
      beginTake();
      document.getElementById('calStatus').textContent = 'listening…';
    } else {
      finishStage();
    }
  }

  function finishStage() {
    if (stage === 0) {
      if (voicedMs < MIN_VOICED_MS_CALIBRATE) {
        document.getElementById('calStatus').textContent =
          'Only ' + (voicedMs / 1000).toFixed(1) + ' s of voiced speech captured, and ' +
          (MIN_VOICED_MS_CALIBRATE / 1000) + ' s are needed. Read it again, a little more slowly.';
        return;
      }
      base.habitualF0 = median(f0s);
      base.resonance = resList.length >= MIN_FRAMES_FOR_MEDIAN ? median(resList) : null;
      base.weight = weights.length >= MIN_FRAMES_FOR_MEDIAN ? median(weights) : null;
      // Over the whole reading, not the rolling live window — a baseline
      // measured over the last 10 s only is not the same quantity a take is
      // later compared against.
      base.intonationSd = semitoneSd(f0s);
      save();
      // The baseline reading is the first point on every progress chart —
      // without it the trend has nothing to start from.
      recordTake('calibration', {
        f0: base.habitualF0, res: base.resonance,
        weight: base.weight, sd: base.intonationSd
      });
      stage = 1;
      render();
    } else if (stage === 1) {
      if (lowest == null) {
        document.getElementById('calStatus').textContent = 'No clear low notes captured. Try again.';
        return;
      }
      base.safeFloor = lowest;
      save();
      stage = 2;
      render();
    }
  }

  return {
    html: html,
    mount: render,
    abort: function () {
      if (collecting) {
        collecting = false;
        var b = document.getElementById('calGo');
        if (b) { b.textContent = 'Start'; b.className = 'primary'; }
        var s = document.getElementById('calStatus');
        // Aborts arrive from the microphone stopping, the page being hidden,
        // and leaving the exercise, so the reason is left out rather than
        // named wrongly.
        if (s) s.textContent = 'Measurement discarded before it finished. Start it again and retake.';
      }
    },
    frame: function (a, ts) {
      if (!collecting) return;
      var f0 = smoothF0.value();
      var dt = lastTs == null ? 0 : Math.min(100, ts - lastTs);
      lastTs = ts;
      if (stage === 0) {
        if (a.voiced && f0) {
          voicedMs += dt;
          f0s.push(f0);
          if (a.resonance != null) resList.push(a.resonance);
          if (a.weightRaw != null) weights.push(a.weightRaw);
        }
        var res0 = smoothRes.value();
        setMeter('c-f0', f0 ? f0.toFixed(0) + ' Hz' : '--');
        setMeter('c-res', res0 ? res0.toFixed(1) + ' cm' : '--');
        var enough = voicedMs >= MIN_VOICED_MS_CALIBRATE;
        setMeter('c-n', (voicedMs / 1000).toFixed(1) + ' s',
          enough ? 'enough — press Stop' : 'need ' + (MIN_VOICED_MS_CALIBRATE / 1000) + ' s of voice',
          { hit: enough, fill: voicedMs / MIN_VOICED_MS_CALIBRATE });
      } else if (stage === 1) {
        // Only accept clearly periodic frames. A creaky or pressed bottom note
        // has high aperiodicity, and counting it would set the floor too low —
        // which is exactly the failure this step exists to prevent.
        if (a.voiced && f0 && a.aperiodicity < CREAK_APERIODICITY && a.rms > 0.02) {
          if (lowest == null || f0 < lowest) lowest = f0;
        }
        setMeter('c-f0', f0 ? f0.toFixed(0) + ' Hz' : '--',
          a.voiced ? (a.aperiodicity < CREAK_APERIODICITY ? 'clear' : 'too creaky to count') : '');
        setMeter('c-low', lowest ? lowest.toFixed(0) + ' Hz' : '--', 'lowest clear tone');
      }
    }
  };
}
