import { beginTake, smoothF0, smoothRes, smoothWeight } from '../audio/engine.js';
import { alignTranscript, flagPhrases } from '../analysis/speech-flags.js';
import { setTranscription, transcription } from '../analysis/transcribe.js';
import { CREAK_APERIODICITY, CREAK_MIN_MS, CREAK_OFF, CREAK_ON, CREAK_WINDOW_MS,
         RESONANCE_GOAL, TRANSCRIPT_SETTLE_MS } from '../constants.js';
import { renderTranscript } from '../ui/transcript.js';
import { completeStep } from '../progress/state.js';
import { base } from '../store/baseline.js';
import { targetBand } from '../targets.js';
import { meter, pitchFill, setMeter } from '../ui/meters.js';
import { Ribbon } from '../ui/ribbon.js';

// --- generic live-meter exercise -----------------------------------------

// Steps, cautions and diagrams are worth reading once and are in the way
// every session after that. Folding them away puts the meters back within a
// glance of the thing you are doing, instead of a screenful below it — the
// same reason the endings drill keeps its prompt and its verdict adjacent.
export function explainer(cfg) {
  var body =
    (cfg.steps ? '<ol class="steps">' +
      cfg.steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>' : '') +
    (cfg.note ? '<p class="note">' + cfg.note + '</p>' : '') +
    (cfg.diagram ? cfg.diagram() : '') +
    (cfg.extra || '');
  if (!body) return '';
  return '<details class="explain"><summary>' +
    (cfg.summary || 'How to do it, and why it works') + '</summary><div>' + body + '</div></details>';
}

export function simpleExercise(cfg) {
  var html =
    '<div class="card">' +
      '<h3>' + cfg.title + '</h3>' +
      '<p class="why">' + cfg.why + '</p>' +
      explainer(cfg) +
      '<canvas id="rib" class="trace" style="height:210px" role="img" aria-label="Live pitch trace"></canvas>' +
      '<div class="meters">' +
        meter('m-pitch', 'Pitch', '', true) +
        meter('m-res', 'Resonance', '', true) +
        meter('m-weight', 'Weight') +
        meter('m-time', cfg.showBand ? 'In target' : 'Voiced time', '', true) +
      '</div>' +
      '<div class="banner rest" id="creakNote" hidden>' +
        '<b>That is creak, not a note.</b>' +
        'The folds are rattling rather than vibrating — which hits the number without your voice ' +
        'ever learning to make it. Come up a few hertz and find the pitch you can actually hold.' +
      '</div>' +
      takeControls('Start take') +
    '</div>';

  var rib, running = false, inBandMs = 0, voicedMs = 0, band = null, lastTs = null, scored = false;
  // Rolling creak fraction over the last few seconds of voiced sound. This is
  // the same threshold calibration uses to refuse to measure a creaky frame —
  // the difference is that this one says so out loud, because "your low note
  // is actually fry" is the single most useful thing a drill can tell you and
  // until now the tool knew it and kept quiet.
  var creak = [], creakMs = 0, creaking = false;

  function setRunning(el, on) {
    running = on;
    inBandMs = 0; voicedMs = 0; lastTs = null; scored = false;
    rib.pts = [];
    if (on) beginTake();
    el.textContent = on ? 'Stop' : 'Start take';
    el.className = on ? 'recording' : 'primary';
    document.getElementById('status').textContent = on ? 'recording — nothing is saved' : '';
  }

  var api = {
    html: html,
    mount: function () {
      rib = new Ribbon(document.getElementById('rib'));
      rib.resize();
      band = cfg.showBand ? targetBand() : null;
      rib.draw(band);
      document.getElementById('go').onclick = function () { setRunning(this, !running); };
    },
    abort: function () {
      if (running) setRunning(document.getElementById('go'), false);
    },
    frame: function (a, ts) {
      var f0 = smoothF0.value();
      var inBand = !!(band && f0 && f0 >= band.lo && f0 <= band.hi);
      setMeter('m-pitch', a.voiced && f0 ? f0.toFixed(0) + ' Hz' : '--',
        band ? 'target ' + band.center.toFixed(0) + ' Hz' : 'comfortable is fine',
        { hit: inBand, fill: a.voiced && f0 ? pitchFill(f0) : 0,
          markAt: band ? pitchFill(band.center) : null });

      var res = smoothRes.value();
      setMeter('m-res', res ? res.toFixed(1) + ' cm' : '--', resonanceSub(res),
        resonanceMeterOpts(res));

      var w = smoothWeight.value();
      setMeter('m-weight', weightLabel(w), weightSub(w));

      // Real elapsed time, not a frame count: frame rate varies by display
      // and by load, so counting frames made a 120 Hz screen read half speed.
      var dt = lastTs == null ? 0 : Math.min(100, ts - lastTs);
      lastTs = ts;

      updateCreak(a, ts, dt);

      if (running) {
        rib.push(a.voiced ? f0 : 0);
        if (a.voiced && f0) {
          voicedMs += dt;
          if (inBand) inBandMs += dt;
        }
        var pct = voicedMs ? (inBandMs / voicedMs * 100) : 0;
        var secs = voicedMs / 1000;
        setMeter('m-time', band ? pct.toFixed(0) + '%' : secs.toFixed(0) + ' s',
          band ? 'aim for 80%' : 'of ' + cfg.goalSeconds + ' s',
          band ? { hit: pct >= 80, fill: pct / 100, markAt: 0.8 }
               : { hit: secs >= cfg.goalSeconds, fill: secs / cfg.goalSeconds });

        // The step is finished when you have put in the voiced time it asks
        // for. Accuracy is paid in XP rather than in whether it counts: the
        // day you can only manage 40% in the band is the day it matters most
        // that the routine still closes.
        // Latched: this used to run on every frame for the rest of the take.
        // completeStep is idempotent so no XP was double-awarded, but it was
        // re-entering the day-rollover and localStorage write sixty times a
        // second, and the status line never said the step had closed.
        if (secs >= cfg.goalSeconds && !scored) {
          scored = true;
          completeStep(api.id, band ? Math.min(1, pct / 80) : 1);
          document.getElementById('status').textContent =
            'Goal reached — this step is done for today. Keep going if you like.';
        }
      }
      rib.draw(band);
    }
  };

  // Two thresholds rather than one: a single one at 60% flickers the warning
  // on and off around the boundary, which is how a warning stops being read.
  function updateCreak(a, ts, dt) {
    if (a.voiced) {
      creak.push({ t: ts, dt: dt, creaky: a.aperiodicity >= CREAK_APERIODICITY ? 1 : 0 });
      creakMs += dt;
    }
    var cutoff = ts - CREAK_WINDOW_MS;
    while (creak.length && creak[0].t < cutoff) creakMs -= creak.shift().dt;

    var note = document.getElementById('creakNote');
    if (!note) return;
    if (creakMs < CREAK_MIN_MS) { note.hidden = true; creaking = false; return; }
    var bad = 0;
    for (var i = 0; i < creak.length; i++) if (creak[i].creaky) bad += creak[i].dt;
    var frac = bad / creakMs;
    if (frac >= CREAK_ON) creaking = true;
    else if (frac < CREAK_OFF) creaking = false;
    note.hidden = !creaking;
  }

  return api;
}

// Shared start/stop row. The button is inert without a microphone rather than
// erroring on click.
export function takeControls(label, extra) {
  return '<div class="row take">' +
    '<button id="go" class="primary" data-needs-mic>' + label + '</button>' +
    (extra || '') +
    '<span id="status" style="color:var(--dim);font-size:13px"></span>' +
    '</div>' + micHint();
}
export function micHint() {
  // "Nothing is uploaded" was unqualified until transcription existed. It is
  // still true of every measurement — but it is no longer true of the whole
  // page once the transcript switch is on, and a privacy claim that quietly
  // stops holding is worse than no claim.
  return '<div class="banner info compact" id="micHint" hidden style="margin:12px 0 0">' +
    '<span aria-hidden="true">🎙</span><span>Press <b>Start microphone</b> in the top bar to enable this ' +
    'exercise. Nothing is recorded — every frame is analysed and discarded' +
    (transcription.enabled ? ', though transcription is switched on and sends audio to your ' +
      'browser vendor while a take runs' : '') + '.</span>' +
    '</div>';
}

// --- transcription switch -------------------------------------------------
//
// Off until turned on, and the switch says where the audio goes rather than
// linking to somewhere that says it. This is the only part of the app that
// leaves the device, so it is the one place the interface is allowed to be
// wordy.
export function transcriptToggle() {
  if (!transcription.supported) {
    return '<div class="banner info compact" style="margin:14px 0 0">' +
      '<span aria-hidden="true">✎</span><span>This browser has no speech recognition, so takes ' +
      'here cannot be transcribed. Chrome and Safari do.</span></div>';
  }
  return '<label class="banner info compact tx-switch" style="margin:14px 0 0">' +
    '<input type="checkbox" id="txOn"' + (transcription.enabled ? ' checked' : '') + '>' +
    '<span><b>Transcribe this take and mark what went wrong.</b> Shows the words you said with ' +
    'rises, stretched endings, creak and filler words written against the phrase they happened in — ' +
    'and it is the only way the tool can tell a question apart from uptalk. ' +
    '<b>This one feature is not on-device:</b> while a take is running your browser streams the ' +
    'audio to its vendor’s speech servers to do the recognition. Nothing else here does that, and ' +
    'this stays off until you switch it on.</span></label>';
}

// Both speaking drills mount the switch the same way, and both need the take
// button to know whether a transcript is coming.
export function mountTranscriptToggle(onChange) {
  var box = document.getElementById('txOn');
  if (!box) return;
  box.onchange = function () {
    setTranscription(box.checked);
    var hint = document.getElementById('micHint');
    if (hint) hint.outerHTML = micHint();
    if (onChange) onChange();
  };
}

// The recogniser finalises an utterance a beat after the speech that produced
// it, so a transcript rendered the instant the button is released is missing
// its own last sentence. The panel says it is waiting rather than appearing
// half-built.
export function renderTranscriptInto(el, tracker, rec, expected) {
  if (!rec || !transcription.enabled) return;
  el.innerHTML = '<div class="hint" id="txWait">Transcribing…</div>';
  // Stopping is what makes the recogniser flush its last utterance, so it goes
  // first and the wait is for that flush to arrive.
  rec.stop();
  setTimeout(function () {
    // The pane can be gone by now — a drill switched, a take aborted.
    if (!el.isConnected) return;
    if (rec.error) {
      el.innerHTML = '<div class="banner err" style="margin-top:14px">' + rec.error + '</div>';
      return;
    }
    var phrases = alignTranscript(tracker.phrases, rec.utterances);
    flagPhrases(phrases, { band: targetBand(), baselineSd: base.intonationSd });
    el.innerHTML = renderTranscript(phrases, { expected: expected });
  }, TRANSCRIPT_SETTLE_MS);
}

export function resonanceSub(res) {
  if (res == null) return 'lower larynx = larger number';
  if (base.resonance == null) return 'lower larynx = larger number';
  var goal = (RESONANCE_GOAL - 1) * 100;
  return pctVsBaseline(res, base.resonance) + ' vs baseline (goal +' + goal.toFixed(0) + '%)';
}
// Signed percentage change, rounded before the sign is chosen so a value a
// hair under the baseline reads "+0.0%" rather than "-0.0%".
export function pctVsBaseline(value, baseline) {
  var pct = (value / baseline - 1) * 100;
  if (Math.abs(pct) < 0.05) pct = 0;
  return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
}

// Bar runs from baseline to the goal, so "full" means the goal is reached.
export function resonanceMeterOpts(res) {
  if (res == null || base.resonance == null) return { hit: false, fill: 0 };
  var span = base.resonance * (RESONANCE_GOAL - 1);
  return {
    hit: res >= base.resonance * RESONANCE_GOAL,
    fill: (res - base.resonance) / span,
    markAt: 1
  };
}
// Weight is the softest of the four measures and is only ever meaningful
// against your own baseline — with no baseline there is nothing to say, so
// the raw number is withheld rather than shown as if it meant something.
export function weightLabel(w) {
  if (w == null || base.weight == null) return '--';
  var d = w - base.weight;
  if (d > 2) return 'heavier';
  if (d < -2) return 'lighter';
  return 'baseline';
}
export function weightSub(w) {
  if (base.weight == null) return 'calibrate to get a reference';
  if (w == null) return 'relative to your baseline';
  return (w - base.weight >= 0 ? '+' : '') + (w - base.weight).toFixed(1) + ' vs baseline';
}
