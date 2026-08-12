import { progress } from './state.js';

// --- reward: sound and motion ---------------------------------------------
//
// Two constraints shape all of this. A chime played while a take is running
// goes straight down the microphone — echo cancellation is deliberately off,
// because it corrupts acoustic measurement — so it would land in the very
// numbers being scored. And the burst has to stay inside the ramp: this
// interface has one source of colour and it is your voice, so a shower of
// primaries would break the only rule the design has.

// Every drill marks its take by putting `recording` on the shared #go button,
// so that class is already an accurate global answer to "is the microphone
// being scored right now" without each exercise having to report in.
// Calibration uses its own button and had been missed by this check — it is
// the one measurement written straight into your baseline, so it is the last
// one that should be able to hear a chime.
export function takeRunning() { return !!document.querySelector('#go.recording, #calGo.recording'); }

export var pendingChime = null;

export function chime(kind) {
  if (progress.muted) return;
  // Held until the take stops; drained from the analysis loop.
  if (takeRunning()) { pendingChime = kind; return; }
  pendingChime = null;
  try {
    var C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    // Its own short-lived context, so this can never touch the analysis graph.
    var ctx = new C();
    // A rising perfect fifth for a step; the octave above it when the day is
    // done. Sine and quiet — this sits next to someone listening closely to
    // their own voice.
    var notes = kind === 'goal' ? [523.25, 783.99, 1046.5] : [523.25, 783.99];
    notes.forEach(function (f, i) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      var t0 = ctx.currentTime + i * 0.11;
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.14, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.34);
      o.connect(g); g.connect(ctx.destination);
      o.start(t0); o.stop(t0 + 0.36);
    });
    setTimeout(function () { try { ctx.close(); } catch (e) {} }, 1200);
  } catch (e) { /* no audio output is not an error worth surfacing */ }
}

var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function celebrate(id, earned, hitGoalNow) {
  chime(hitGoalNow ? 'goal' : 'step');

  // The XP lands on the step in the path that earned it, so the number has an
  // obvious origin rather than appearing from the corner of the screen.
  var anchor = document.querySelector('.ex[data-id="' + id + '"]') ||
               document.getElementById('streakStrip');
  if (!anchor) return;
  var r = anchor.getBoundingClientRect();

  var fly = document.createElement('div');
  fly.className = 'xpfly';
  fly.textContent = '+' + earned + ' XP';
  fly.style.left = (r.left + r.width / 2) + 'px';
  fly.style.top = (r.top + r.height / 2) + 'px';
  document.body.appendChild(fly);
  setTimeout(function () { fly.remove(); }, 1100);

  if (reduceMotion) return;
  // Sparks in the ramp only, and only on a finished day — a burst on every
  // step would make the one that means something indistinguishable.
  if (!hitGoalNow) return;
  var colours = ['#d43b7a', '#f5852f', '#ffcf5c'];
  for (var i = 0; i < 18; i++) {
    var s = document.createElement('i');
    s.className = 'spark';
    var ang = (Math.PI * 2 * i) / 18 + Math.random() * 0.3;
    var dist = 42 + Math.random() * 46;
    s.style.left = (r.left + r.width / 2) + 'px';
    s.style.top = (r.top + r.height / 2) + 'px';
    s.style.background = colours[i % 3];
    s.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(1) + 'px');
    s.style.setProperty('--dy', (Math.sin(ang) * dist).toFixed(1) + 'px');
    document.body.appendChild(s);
    /* jshint loopfunc:true */
    (function (el) { setTimeout(function () { el.remove(); }, 900); })(s);
  }
}
