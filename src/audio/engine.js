import DSP from '../dsp.js';
import { analysisDue, resetAnalysisClock } from './clock.js';
import { current } from '../exercises/registry.js';
import { chime, pendingChime, takeRunning } from '../progress/reward.js';

// ==========================================================================
// audio
// ==========================================================================

export var audio = { ctx: null, analyser: null, stream: null, buf: null, running: false, starting: false };
var latest = null;               // most recent analysed frame
export var smoothF0 = new DSP.MedianSmoother(5);
export var smoothRes = new DSP.MedianSmoother(31);   // resonance is noisy; ~0.5 s
export var smoothWeight = new DSP.MedianSmoother(31);
export var intonation = new DSP.RollingStats(10000);

// Frames of continuous silence before the smoothers are cleared. A held vowel
// drops the odd frame, so clearing on the first unvoiced one would throw away
// the median mid-note; leaving them forever is worse — the resonance and
// weight meters would keep displaying a number long after you stopped making
// any sound, which is the one thing a biofeedback readout must never do.
var SILENCE_FRAMES_TO_CLEAR = 12;   // ~200 ms
var unvoicedRun = 0;

export function resetSmoothers() {
  smoothF0.reset(); smoothRes.reset(); smoothWeight.reset();
  intonation.reset();
  unvoicedRun = 0;
  latest = null;
}

// Called when a take starts. The smoothers are medians over the last ~0.5 s,
// and they are shared by every drill — so without this the opening frames of
// a take are dominated by whatever was said *before* you pressed Start. That
// is how a "best this take" could be set by the sentence you spoke while
// reaching for the button.
export function beginTake() {
  resetSmoothers();
  resetAnalysisClock();
}

function setMicUI(on, label) {
  document.getElementById('dot').className = 'dot' + (on ? ' on' : '');
  document.getElementById('micLabel').textContent = label;
  document.getElementById('micState').classList.toggle('live', on);
  document.getElementById('micBtn').textContent = on ? 'Stop microphone' : 'Start microphone';
  syncMicControls();
}

// Exercise controls that cannot do anything without audio say so, rather than
// looking available and then throwing an error banner when pressed. Called on
// every mic change and after each exercise rebuilds its pane.
export function syncMicControls() {
  Array.prototype.forEach.call(document.querySelectorAll('[data-needs-mic]'), function (b) {
    b.disabled = !audio.running;
    b.title = audio.running ? '' : 'Start the microphone first';
  });
  var hint = document.getElementById('micHint');
  if (hint) hint.hidden = audio.running;
  // While the permission prompt is up there is nothing useful a second press
  // can do, so the button says so instead of silently doing nothing.
  var mb = document.getElementById('micBtn');
  mb.disabled = audio.starting;
  if (audio.starting) mb.textContent = 'Waiting for permission…';
}

function showError(msg) {
  document.getElementById('errBox').innerHTML =
    '<div class="banner err">' + msg + '</div>';
}
function clearError() { document.getElementById('errBox').innerHTML = ''; }

export async function startMic() {
  // `audio.running` only becomes true after the await below, so without this
  // guard a second press while the permission prompt is up opened a second
  // stream, a second context and a second analysis loop. Both loops then fed
  // the same take, so every accumulator counted double — takes finished in
  // half the required time — and stopMic could only ever close one of them.
  if (audio.running || audio.starting) return;
  audio.starting = true;
  syncMicControls();
  clearError();
  try {
    // These three "helpful" features all corrupt acoustic measurement:
    // AGC rescales level, noise suppression eats the spectrum, echo
    // cancellation filters the signal.
    audio.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
  } catch (e) {
    audio.starting = false;
    setMicUI(false, 'microphone off');
    showError('Could not open the microphone (' + e.name + '). Grant permission, or if you opened ' +
      'this as a file, run <code>python3 -m http.server</code> in this folder and use ' +
      '<code>http://localhost:8000/</code> instead.');
    return;
  }
  audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (audio.ctx.state === 'suspended') await audio.ctx.resume();
  var src = audio.ctx.createMediaStreamSource(audio.stream);
  audio.analyser = audio.ctx.createAnalyser();
  audio.analyser.fftSize = 4096;
  src.connect(audio.analyser);
  audio.buf = new Float32Array(audio.analyser.fftSize);
  audio.starting = false;
  audio.running = true;
  resetSmoothers();
  resetAnalysisClock();
  setMicUI(true, Math.round(audio.ctx.sampleRate / 1000) + ' kHz, listening');
  requestAnimationFrame(loop);
}

export function stopMic() {
  if (!audio.running) return;
  audio.running = false;
  if (audio.stream) audio.stream.getTracks().forEach(function (t) { t.stop(); });
  if (audio.ctx) audio.ctx.close();
  audio.ctx = audio.analyser = audio.stream = null;
  resetSmoothers();
  // A take cannot continue without audio. Ending it here stops the exercise
  // sitting there labelled "recording" while nothing is being measured.
  if (current && current.abort) current.abort();
  setMicUI(false, 'microphone off');
  // The analysis loop is where held chimes normally drain, and it has just
  // stopped — so drain here too rather than leaving one owed indefinitely.
  if (pendingChime) chime(pendingChime);
}

function loop(ts) {
  if (!audio.running) return;
  requestAnimationFrame(loop);

  // Hold the analysis grid regardless of how fast the display refreshes. On a
  // faster screen the extra repaints are simply skipped rather than being fed
  // to the smoothers, so every frame-counted window means the same span of
  // time everywhere.
  if (!analysisDue(ts)) return;

  audio.analyser.getFloatTimeDomainData(audio.buf);
  var a = DSP.analyze(audio.buf, audio.ctx.sampleRate);
  latest = a;

  if (a.voiced) {
    unvoicedRun = 0;
    smoothF0.push(a.f0);
    intonation.push(DSP.hzToSemitones(a.f0), ts);
    if (a.resonance != null) smoothRes.push(a.resonance);
    if (a.weightRaw != null) smoothWeight.push(a.weightRaw);
  } else {
    smoothF0.reset();
    if (++unvoicedRun >= SILENCE_FRAMES_TO_CLEAR) { smoothRes.reset(); smoothWeight.reset(); }
  }

  if (current && current.frame) current.frame(a, ts);
  // A chime earned mid-take is held until the take stops, so it cannot be
  // measured as part of your voice. This is where it gets let out.
  if (pendingChime && !takeRunning()) chime(pendingChime);
}

// requestAnimationFrame stops while the page is hidden, so a take left running
// when you switch apps — this is an installable PWA, so that includes locking
// the phone — is not being measured at all, yet still says "recording". Worse,
// the frames either side of the gap are adjacent as far as the analysis is
// concerned: in the endings drill the sentence in progress gets stitched onto
// whatever you say when you come back, and the join is scored as an ending.
// The same rule already applies when the microphone stops: a take that cannot
// be measured ends.
document.addEventListener('visibilitychange', function () {
  if (!document.hidden || !audio.running || !takeRunning()) return;
  if (current && current.abort) current.abort();
  var s = document.getElementById('status');
  // Some aborts leave a more specific explanation of their own; that one wins.
  if (s && !s.textContent) {
    s.textContent = 'Take stopped — the page was hidden, so nothing was being measured.';
  }
});
