import { CPP_DROP_DB, CPP_F0_GATE_HZ, CPP_HOLD_MS, CPP_MIN_MS, CPP_REF_MS,
         CPP_WINDOW_MS } from '../constants.js';

// ==========================================================================
// strain — has your voice got worse since you started?
//
// Everything else in this tool measures how a voice *reads*. This measures
// how it is *working*, and it is the only thing here allowed to interrupt you.
//
// Cepstral peak prominence falls as phonation becomes noisier, which is what
// a tiring voice does. The absolute number means nothing across people, mics
// or rooms — so nothing is ever compared except your own voice at the start
// of this session against your own voice now, on the same microphone, minutes
// apart. That comparison is the whole design.
//
// Three rules, and all three are refusals:
//
//   1. It never reports good news. There is no "quality: fine" state, because
//      a reassuring readout is an invitation to push through a warning sign,
//      and no acoustic measure here is good enough to earn that trust. The
//      only thing it can say is "this is the point to stop".
//   2. It declines to answer when the comparison is not fair. If your pitch
//      has moved between the two windows, CPP moves with it for reasons that
//      have nothing to do with strain (about 0.04 dB per hertz, measured in
//      test-dsp.mjs), so a large pitch difference means no verdict at all.
//   3. It needs a lot of speech on both sides — twenty seconds of voiced time
//      for the reference, ten for the current window — and the decline has to
//      persist for five seconds after that before it will say anything. The
//      median over a window is not enough on its own: one rough patch of six
//      seconds is briefly a majority of a ten-second window while the window
//      fills, which would let a cough or a single creaky sentence fire a
//      warning that then never goes away. A trend outlasts the window filling;
//      a patch does not.
//
// Once it fires it stays fired for the session. A warning that blinks off
// because you happened to say something clean is a warning nobody heeds.
// ==========================================================================

var ref = null;             // { cpp, f0 } once the reference window has closed
var refCpp = [], refF0 = [], refMs = 0;
var cur = [];               // { t, cpp, f0 } rolling window
var curMs = 0;
var decliningSince = null;  // when the decline first became true, or null
var latched = false;

export function resetStrain() {
  ref = null;
  refCpp = []; refF0 = []; refMs = 0;
  cur = []; curMs = 0;
  decliningSince = null;
  latched = false;
}

// Called for every analysed frame. `dtMs` is the frame's own elapsed time, so
// what accumulates is voiced *time* rather than a frame count — same reason
// as everywhere else in this codebase.
export function pushStrain(a, ts, dtMs) {
  if (!a || !a.voiced || a.cpp == null || !a.f0) return;
  var dt = Math.min(100, dtMs || 0);

  if (!ref) {
    refCpp.push(a.cpp); refF0.push(a.f0); refMs += dt;
    if (refMs >= CPP_REF_MS) ref = { cpp: median(refCpp), f0: median(refF0) };
    return;
  }

  cur.push({ t: ts, cpp: a.cpp, f0: a.f0, dt: dt });
  curMs += dt;
  var cutoff = ts - CPP_WINDOW_MS;
  while (cur.length && cur[0].t < cutoff) curMs -= cur.shift().dt;

  if (latched) return;
  if (curMs < CPP_MIN_MS) { decliningSince = null; return; }
  var nowF0 = median(cur.map(function (o) { return o.f0; }));
  // Not a fair comparison: no verdict, and the clock starts again if the pitch
  // comes back. Declining to answer is a state this module is comfortable in.
  if (Math.abs(nowF0 - ref.f0) > CPP_F0_GATE_HZ) { decliningSince = null; return; }
  var nowCpp = median(cur.map(function (o) { return o.cpp; }));
  if (ref.cpp - nowCpp < CPP_DROP_DB) { decliningSince = null; return; }
  if (decliningSince == null) decliningSince = ts;
  else if (ts - decliningSince >= CPP_HOLD_MS) latched = true;
}

// The only question this module answers. True means stop and rest; false means
// nothing at all — not that anything is fine.
export function strainWarning() { return latched; }

// For the tests, and for nothing else: the numbers behind the verdict.
export function strainState() {
  return {
    ref: ref, refMs: refMs, windowMs: curMs, latched: latched,
    decliningSince: decliningSince,
    current: cur.length ? {
      cpp: median(cur.map(function (o) { return o.cpp; })),
      f0: median(cur.map(function (o) { return o.f0; }))
    } : null
  };
}

function median(xs) {
  var s = xs.slice().sort(function (a, b) { return a - b; });
  var m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
