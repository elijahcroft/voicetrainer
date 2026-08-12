import { beginTake, intonation, smoothF0, smoothRes, smoothWeight } from '../audio/engine.js';
import { PhraseTracker } from '../analysis/phrases.js';
import { Recognizer, transcription } from '../analysis/transcribe.js';
import { MIN_FRAMES_FOR_MEDIAN, MIN_VOICED_MS_SCORE, RESONANCE_GOAL } from '../constants.js';
import { PASSAGE } from './registry.js';
import { mountTranscriptToggle, renderTranscriptInto, resonanceMeterOpts, resonanceSub,
         takeControls, transcriptToggle, weightLabel, weightSub } from './shared.js';
import { completeStep } from '../progress/state.js';
import { base } from '../store/baseline.js';
import { recordTake } from '../store/history.js';
import { pitchTarget, targetBand } from '../targets.js';
import { meter, pitchFill, setMeter } from '../ui/meters.js';
import { Ribbon } from '../ui/ribbon.js';
import { median, semitoneSd } from '../util/stats.js';

// --- reading passage ------------------------------------------------------
export function buildPassage() {
  var html =
    '<div class="card">' +
      '<h3>Reading passage</h3>' +
      '<p class="why">Connected speech is the real test. Resonance is only meaningful when averaged ' +
      'over many vowels, so this take is compared against your calibration reading of the same ' +
      'passage — like for like.</p>' +
      // The text you are reading and the trace of you reading it belong to
      // each other, so they share one bordered block rather than two cards.
      '<div class="stack">' +
        '<div class="prompt"><div class="cnt">read aloud</div>' +
          '<div class="say" style="font-size:16.5px;line-height:1.7">' + PASSAGE + '</div></div>' +
        '<canvas id="rib" role="img" aria-label="Live pitch trace"></canvas>' +
      '</div>' +
      '<div class="meters">' + meter('m-pitch', 'Pitch', '', true) + meter('m-res', 'Resonance', '', true) +
        meter('m-weight', 'Weight') + meter('m-int', 'Intonation') + '</div>' +
      transcriptToggle() +
      takeControls('Start take') +
      '<div id="report"></div>' +
      '<div id="transcript"></div>' +
    '</div>';

  var rib, running = false, f0s = [], resList = [], weights = [], band = null;
  var voicedMs = 0, lastTs = null;
  var tracker = new PhraseTracker(), rec = null;

  function setRunning(el, on, score) {
    running = on;
    el.textContent = on ? 'Stop and score' : 'Start take';
    el.className = on ? 'recording' : 'primary';
    if (on) {
      f0s = []; resList = []; weights = []; rib.pts = [];
      voicedMs = 0; lastTs = null;
      tracker.reset();
      rec = new Recognizer();
      rec.start();
      document.getElementById('report').innerHTML = '';
      document.getElementById('transcript').innerHTML = '';
      beginTake();
      document.getElementById('status').textContent = transcription.enabled
        ? 'recording — audio is never saved, but is being sent for transcription'
        : 'recording — audio is never saved';
    } else {
      // The phrase you were still finishing when you pressed Stop is a phrase.
      tracker.end();
      document.getElementById('status').textContent = '';
      if (score) {
        report();
        renderTranscriptInto(document.getElementById('transcript'), tracker, rec, PASSAGE);
      } else if (rec) {
        rec.stop();
      }
      rec = null;
    }
  }

  return {
    html: html,
    abort: function () {
      // Not scored. An aborted take is a partial reading of the passage, and
      // the whole value of this one is that it is the *same* passage as the
      // calibration it is charted against — half of it is a different text.
      // Calibration already discards on abort; this used to score and save.
      if (!running) return;
      setRunning(document.getElementById('go'), false, false);
      document.getElementById('status').textContent =
        'Take stopped before the passage finished — discarded, not scored.';
    },
    mount: function () {
      rib = new Ribbon(document.getElementById('rib'));
      rib.resize();
      band = targetBand();
      rib.draw(band);
      document.getElementById('go').onclick = function () { setRunning(this, !running, true); };
      mountTranscriptToggle();
    },
    frame: function (a, ts) {
      var f0 = smoothF0.value();
      var res = smoothRes.value();
      setMeter('m-pitch', f0 ? f0.toFixed(0) + ' Hz' : '--',
        band ? 'target ' + band.center.toFixed(0) : '',
        { hit: band && f0 && f0 >= band.lo && f0 <= band.hi,
          fill: f0 ? pitchFill(f0) : 0, markAt: band ? pitchFill(band.center) : null });
      setMeter('m-res', res ? res.toFixed(1) + ' cm' : '--', resonanceSub(res), resonanceMeterOpts(res));
      setMeter('m-weight', weightLabel(smoothWeight.value()), weightSub(smoothWeight.value()));
      var sd = intonation.sd();
      setMeter('m-int', sd != null ? sd.toFixed(1) + ' st' : '--', 'flatter reads more masculine');
      if (running) {
        // The frame's own timestamp, like every other drill. Reading the clock
        // here instead measured up to the moment the callback ran, which
        // included the previous frame's canvas work in this take's voiced time.
        var dt = lastTs == null ? 0 : Math.min(100, ts - lastTs);
        lastTs = ts;
        // Phrase-by-phrase, alongside the whole-take medians. The two answer
        // different questions: the table says how the reading went, the
        // transcript says which line it went wrong on.
        tracker.push(a, ts, dt);
        if (a.voiced && f0) {
          voicedMs += dt;
          f0s.push(f0);
          if (a.resonance != null) resList.push(a.resonance);
          if (a.weightRaw != null) weights.push(a.weightRaw);
        }
        rib.push(a.voiced ? f0 : 0);
        rib.draw(band);
      }
    }
  };

  function report() {
    if (voicedMs < MIN_VOICED_MS_SCORE) {
      document.getElementById('report').innerHTML =
        '<div class="banner err" style="margin-top:14px">Only ' + (voicedMs / 1000).toFixed(1) +
        ' s of voiced speech — too little to score. Read the whole passage.</div>';
      return;
    }
    var mF0 = median(f0s);
    var mRes = resList.length >= MIN_FRAMES_FOR_MEDIAN ? median(resList) : null;
    var mW = weights.length >= MIN_FRAMES_FOR_MEDIAN ? median(weights) : null;
    var sd = semitoneSd(f0s);
    var rows = [], hits = 0;
    function line(name, val, target, good) {
      if (good) hits++;
      rows.push('<tr><td>' + name + '</td><td class="num">' + val + '</td><td class="num">' + target +
        '</td><td class="' + (good ? 'ok' : 'no') + '">' + (good ? 'on target' : 'keep working') + '</td></tr>');
    }
    var t = pitchTarget();
    line('Pitch', mF0.toFixed(0) + ' Hz', t ? t.hz.toFixed(0) + ' Hz' : '—', t && mF0 <= t.hz * 1.06);
    if (mRes != null && base.resonance != null) {
      line('Resonance', mRes.toFixed(1) + ' cm', (base.resonance * RESONANCE_GOAL).toFixed(1) + ' cm',
        mRes >= base.resonance * RESONANCE_GOAL);
    }
    if (mW != null && base.weight != null) {
      line('Weight', (mW - base.weight >= 0 ? '+' : '') + (mW - base.weight).toFixed(1),
        'at or above baseline', mW >= base.weight);
    }
    if (sd != null && base.intonationSd != null) {
      line('Intonation', sd.toFixed(1) + ' st', '≤ ' + base.intonationSd.toFixed(1) + ' st', sd <= base.intonationSd);
    }
    recordTake('passage', { f0: mF0, res: mRes, weight: mW, sd: sd });
    // Graded on the share of the four measures that landed on target — the
    // report was already deciding that, so the grade is not a second opinion.
    completeStep('passage', rows.length ? hits / rows.length : 0.5);
    document.getElementById('report').innerHTML =
      '<table style="margin-top:16px"><tr><th>Measure</th><th>This take</th><th>Target</th><th></th></tr>' +
      rows.join('') + '</table>' +
      '<div class="hint">Compared against your own calibration on this same passage, so vowel content ' +
      'matches. Resonance measured on a different text is not comparable. ' +
      'Saved to <b>Progress</b>.</div>';
  }
}
