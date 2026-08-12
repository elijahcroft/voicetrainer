/* dsp.js — pure DSP for the voice trainer.
 *
 * No DOM, no Web Audio, no side effects. Imported by the app and by
 * test-dsp.mjs so the hard parts can be verified against synthetic signals
 * without a microphone.
 *
 * See RESEARCH.md for where the acoustic constants come from.
 */


// Standard value used in the formant-dispersion literature for estimating
// vocal tract length. A 17.5 cm tract gives formants at 500/1500/2500/3500 Hz.
var SPEED_OF_SOUND_CM_S = 35000;

// ---------------------------------------------------------------------------
// basic helpers
// ---------------------------------------------------------------------------

function rms(x) {
  var s = 0;
  for (var i = 0; i < x.length; i++) s += x[i] * x[i];
  return Math.sqrt(s / x.length);
}

// Running boxcar. Length `n` puts spectral nulls at multiples of fs/n, which
// is exactly where decimation by n folds energy back in — so two cascaded
// boxcars are a cheap, adequate anti-alias filter for our purposes.
function boxcar(x, n) {
  var out = new Float64Array(x.length);
  var sum = 0;
  for (var i = 0; i < x.length; i++) {
    sum += x[i];
    if (i >= n) sum -= x[i - n];
    out[i] = sum / Math.min(i + 1, n);
  }
  return out;
}

function decimate(x, factor) {
  if (factor <= 1) {
    var copy = new Float64Array(x.length);
    for (var k = 0; k < x.length; k++) copy[k] = x[k];
    return copy;
  }
  var filtered = boxcar(boxcar(x, factor), factor);
  var out = new Float64Array(Math.floor(x.length / factor));
  for (var i = 0; i < out.length; i++) out[i] = filtered[i * factor];
  return out;
}

// Vertex of the parabola through (-1,a) (0,b) (1,c), as an offset from index 0.
// Works for both maxima and minima.
function parabolicOffset(a, b, c) {
  var denom = a - 2 * b + c;
  if (denom === 0) return 0;
  var d = 0.5 * (a - c) / denom;
  return Math.abs(d) > 1 ? 0 : d;
}

function hzToSemitones(hz, refHz) {
  return 12 * Math.log2(hz / (refHz || 55));
}

function semitonesToHz(st, refHz) {
  return (refHz || 55) * Math.pow(2, st / 12);
}

// ---------------------------------------------------------------------------
// pitch — YIN
// ---------------------------------------------------------------------------

// Returns { f0, aperiodicity, rms }. f0 is 0 when no periodicity was found.
// `aperiodicity` is the YIN d' value at the chosen lag: low means confidently
// periodic, high means noise or silence.
function yin(frame, sampleRate, opts) {
  opts = opts || {};
  var fmin = opts.fmin || 60;
  var fmax = opts.fmax || 400;
  var threshold = opts.threshold != null ? opts.threshold : 0.15;
  var level = rms(frame);

  // Decimate to ~12 kHz. Keeps the O(W * maxLag) search cheap while leaving
  // enough lag resolution that parabolic interpolation lands well under 1%.
  var factor = Math.max(1, Math.round(sampleRate / 12000));
  var x = decimate(frame, factor);
  var fs = sampleRate / factor;

  var maxLag = Math.min(Math.floor(fs / fmin), Math.floor(x.length / 2));
  var minLag = Math.max(2, Math.floor(fs / fmax));
  var W = x.length - maxLag;
  if (W < 64 || maxLag <= minLag) {
    return { f0: 0, aperiodicity: 1, rms: level };
  }

  var d = new Float64Array(maxLag + 1);
  for (var tau = 1; tau <= maxLag; tau++) {
    var s = 0;
    for (var j = 0; j < W; j++) {
      var diff = x[j] - x[j + tau];
      s += diff * diff;
    }
    d[tau] = s;
  }

  // cumulative mean normalized difference
  var dp = new Float64Array(maxLag + 1);
  dp[0] = 1;
  var running = 0;
  for (tau = 1; tau <= maxLag; tau++) {
    running += d[tau];
    dp[tau] = running === 0 ? 1 : (d[tau] * tau) / running;
  }

  // absolute threshold: first dip below `threshold`, descended to its local min
  var best = -1;
  for (tau = minLag; tau <= maxLag; tau++) {
    if (dp[tau] < threshold) {
      while (tau + 1 <= maxLag && dp[tau + 1] < dp[tau]) tau++;
      best = tau;
      break;
    }
  }
  if (best < 0) {
    var min = Infinity;
    for (tau = minLag; tau <= maxLag; tau++) {
      if (dp[tau] < min) { min = dp[tau]; best = tau; }
    }
  }
  if (best <= 0) return { f0: 0, aperiodicity: 1, rms: level };

  var tauEst = best;
  if (best > 1 && best < maxLag) {
    tauEst = best + parabolicOffset(dp[best - 1], dp[best], dp[best + 1]);
  }
  if (!(tauEst > 0)) return { f0: 0, aperiodicity: 1, rms: level };

  var f0 = fs / tauEst;
  if (f0 < fmin || f0 > fmax) return { f0: 0, aperiodicity: dp[best], rms: level };
  return { f0: f0, aperiodicity: dp[best], rms: level };
}

// A frame only yields trustworthy formants if it is actually voiced.
function isVoiced(measure, opts) {
  opts = opts || {};
  var minRms = opts.minRms != null ? opts.minRms : 0.005;
  var maxAperiodicity = opts.maxAperiodicity != null ? opts.maxAperiodicity : 0.45;
  return !!measure && measure.f0 > 0 &&
    measure.rms >= minRms && measure.aperiodicity <= maxAperiodicity;
}

// ---------------------------------------------------------------------------
// resonance — LPC envelope, formants, vocal tract length
// ---------------------------------------------------------------------------

// Levinson-Durbin. Returns the prediction error filter
// A(z) = 1 + a[1] z^-1 + ... + a[p] z^-p, plus residual energy e.
function levinson(r, order) {
  var a = new Float64Array(order + 1);
  a[0] = 1;
  var e = r[0];
  if (!(e > 0)) return null;
  for (var i = 1; i <= order; i++) {
    var acc = r[i];
    for (var j = 1; j < i; j++) acc += a[j] * r[i - j];
    var k = -acc / e;
    var prev = a.slice();
    for (j = 1; j < i; j++) a[j] = prev[j] + k * prev[i - j];
    a[i] = k;
    e *= 1 - k * k;
    if (!(e > 0)) return null;
  }
  return { a: a, e: e };
}

// Returns { freqs, db, sampleRate, order } — the all-pole spectral envelope.
//
// Order 20 rather than the textbook fs/1000 + 2 (which is 14 here). At order
// 14 there are too few poles to cover 0-6 kHz, so F4 gets dragged upward and
// long tracts collapse entirely; measured worst-case VTL error fell from
// ~37% to a few percent when the order was raised. See RESEARCH.md.
function lpcEnvelope(frame, sampleRate, opts) {
  opts = opts || {};
  var factor = Math.max(1, Math.round(sampleRate / 12000));
  var target = sampleRate / factor;
  var order = opts.order || 20;
  var nBins = opts.nBins || 512;
  var fMax = Math.min(opts.fMax || 5500, target / 2);

  var x = decimate(frame, factor);
  // ~43 ms of the most recent audio: long enough to resolve formants,
  // short enough to stay quasi-stationary.
  var N = Math.min(x.length, 512);
  if (N < order * 3) return null;

  var seg = new Float64Array(N);
  var start = x.length - N;
  for (var i = 0; i < N; i++) {
    var idx = start + i;
    var pre = x[idx] - 0.97 * (idx > 0 ? x[idx - 1] : 0);
    seg[i] = pre * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (N - 1)));
  }

  var r = new Float64Array(order + 1);
  for (var k = 0; k <= order; k++) {
    var s = 0;
    for (i = k; i < N; i++) s += seg[i] * seg[i - k];
    r[k] = s;
  }
  if (!(r[0] > 0)) return null;
  r[0] = r[0] * 1.0001 + 1e-12; // ridge, keeps Levinson stable on near-silent frames

  var lv = levinson(r, order);
  if (!lv) return null;

  var freqs = new Float64Array(nBins);
  var db = new Float64Array(nBins);
  var gain = Math.sqrt(lv.e);
  for (var b = 0; b < nBins; b++) {
    var f = (fMax * b) / (nBins - 1);
    var w = (-2 * Math.PI * f) / target;
    var re = 1, im = 0;
    for (var j = 1; j <= order; j++) {
      re += lv.a[j] * Math.cos(w * j);
      im += lv.a[j] * Math.sin(w * j);
    }
    var mag = gain / Math.sqrt(re * re + im * im);
    freqs[b] = f;
    db[b] = 20 * Math.log10(mag + 1e-12);
  }
  return { freqs: freqs, db: db, sampleRate: target, order: order };
}

// Peak-pick the envelope. Returns up to `max` formant frequencies in Hz.
function findFormants(env, opts) {
  if (!env) return [];
  opts = opts || {};
  // Adult F1 essentially never falls below ~250 Hz; peaks under 200 are
  // spurious low-frequency artefacts that re-slot every later formant.
  var minFreq = opts.minFreq || 200;
  var minSep = opts.minSep || 200;
  var max = opts.max || 5;
  var freqs = env.freqs, db = env.db;
  var step = freqs[1] - freqs[0];

  var peaks = [];
  for (var i = 1; i < db.length - 1; i++) {
    if (db[i] > db[i - 1] && db[i] >= db[i + 1] && freqs[i] >= minFreq) {
      var off = parabolicOffset(db[i - 1], db[i], db[i + 1]);
      peaks.push({ f: freqs[i] + off * step, db: db[i] });
    }
  }

  var out = [];
  for (var p = 0; p < peaks.length; p++) {
    var last = out[out.length - 1];
    if (last && peaks[p].f - last.f < minSep) {
      if (peaks[p].db > last.db) out[out.length - 1] = peaks[p];
      continue;
    }
    out.push(peaks[p]);
  }
  return out.slice(0, max).map(function (q) { return q.f; });
}

// Formant-dispersion VTL. A uniform tube of length L resonates at
// F_i = (2i-1) * c / (4L), so fitting F_i against x_i = (2i-1)/2 through the
// origin gives the formant spacing dF = c / (2L).
//
// Two details matter a great deal in practice, both established by measurement
// against synthetic vowels of known tract length (see test-dsp.mjs):
//
//   * Exactly four formants, always. The fit assumes formants[i] occupies
//     slot i+1, so a varying peak count silently re-slots everything. Letting
//     the count drift is what made a true 10% tract change read as only 4-7%.
//   * A residual gate. One spurious peak below F1 shifts every formant into
//     the wrong slot and produces a ~1.5x overestimate. Requiring each formant
//     to sit near its predicted slot rejects those frames instead of believing
//     them, which cut worst-case error from ~40% to ~2%.
//
// Rejected frames return null and are simply skipped by the smoother. Roughly
// half of frames are rejected on extreme vowels like /i/ and /u/, which
// genuinely do not fit a uniform-tube model — that is the correct outcome.
function estimateVTL(formants, opts) {
  opts = opts || {};
  var need = 4;
  if (!formants || formants.length < need) return null;
  var maxResidual = opts.maxResidual != null ? opts.maxResidual : 0.35;

  var num = 0, den = 0, i, x;
  for (i = 0; i < need; i++) {
    x = (2 * (i + 1) - 1) / 2;
    num += x * formants[i];
    den += x * x;
  }
  var dF = num / den;
  if (!(dF > 0)) return null;

  for (i = 0; i < need; i++) {
    var target = ((2 * (i + 1) - 1) * dF) / 2;
    if (Math.abs(formants[i] - target) / dF > maxResidual) return null;
  }

  var vtl = SPEED_OF_SOUND_CM_S / (2 * dF);
  if (!(vtl >= 11) || vtl > 25) return null; // outside anatomical plausibility
  return vtl;
}

// The same formant-spacing fit with no consistency gate and only a loose
// plausibility clamp.
//
// estimateVTL() is strict because an absolute anatomical number should not be
// reported from a frame that does not support it — and that strictness
// rejects /a/, whose F1 and F2 sit too close together to look like a uniform
// tube. /a/ is exactly what a yawn-sigh produces, so a gated estimate would
// leave the resonance meter blank during the one exercise that needs it most.
//
// While a single vowel is held steady, lowering the larynx scales every
// formant down together, so a 10% drop in spacing means a 10% longer tract
// whether or not the vowel resembles a uniform tube. This value is therefore
// valid as a RELATIVE indicator within a sustained vowel, and is meaningless
// as an absolute anatomical measurement — the UI only ever shows it as change
// against the speaker's own baseline for that same exercise.
function resonanceIndex(formants) {
  if (!formants || formants.length < 4) return null;
  var num = 0, den = 0;
  for (var i = 0; i < 4; i++) {
    var x = (2 * (i + 1) - 1) / 2;
    num += x * formants[i];
    den += x * x;
  }
  var dF = num / den;
  if (!(dF > 0)) return null;
  var value = SPEED_OF_SOUND_CM_S / (2 * dF);
  if (!(value >= 8) || value > 32) return null;
  return value;
}

// ---------------------------------------------------------------------------
// vocal weight — H1-H2 and spectral tilt
// ---------------------------------------------------------------------------

// In-place iterative radix-2 Cooley-Tukey.
function fft(re, im) {
  var n = re.length;
  for (var i = 1, j = 0; i < n; i++) {
    var bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      var tr = re[i]; re[i] = re[j]; re[j] = tr;
      var ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }
  for (var len = 2; len <= n; len <<= 1) {
    var ang = (-2 * Math.PI) / len;
    var wr = Math.cos(ang), wi = Math.sin(ang);
    for (var s = 0; s < n; s += len) {
      var cr = 1, ci = 0;
      for (var k = 0; k < len / 2; k++) {
        var ar = re[s + k], ai = im[s + k];
        var br = re[s + k + len / 2] * cr - im[s + k + len / 2] * ci;
        var bi = re[s + k + len / 2] * ci + im[s + k + len / 2] * cr;
        re[s + k] = ar + br; im[s + k] = ai + bi;
        re[s + k + len / 2] = ar - br; im[s + k + len / 2] = ai - bi;
        var ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

function largestPowerOfTwo(n) {
  var p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}

// Returns { h1h2, tilt, weightRaw } or null when the frame is unusable.
//   h1h2  — dB. Higher means breathier / lighter phonation.
//   tilt  — dB per octave, negative. Less steep means more high-frequency
//           energy, which reads as a heavier, brassier voice.
//   weightRaw — combined; larger is heavier. Only meaningful relative to
//           the speaker's own baseline, so the UI never shows it raw.
function spectralMeasures(frame, f0, sampleRate) {
  if (!(f0 > 0)) return null;
  var n = largestPowerOfTwo(frame.length);
  if (n < 512) return null;
  var re = new Float64Array(n), im = new Float64Array(n);
  var start = frame.length - n;
  for (var i = 0; i < n; i++) {
    var w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    re[i] = frame[start + i] * w;
  }
  fft(re, im);

  var half = n / 2;
  var mag = new Float64Array(half);
  for (i = 0; i < half; i++) mag[i] = Math.hypot(re[i], im[i]);
  var binHz = sampleRate / n;

  function peakNear(freq, tolerance) {
    var lo = Math.max(1, Math.floor((freq * (1 - tolerance)) / binHz));
    var hi = Math.min(half - 1, Math.ceil((freq * (1 + tolerance)) / binHz));
    var best = 0;
    for (var k = lo; k <= hi; k++) if (mag[k] > best) best = mag[k];
    return best;
  }

  var h1 = peakNear(f0, 0.15);
  var h2 = peakNear(2 * f0, 0.15);
  if (!(h1 > 0) || !(h2 > 0)) return null;
  var h1h2 = 20 * Math.log10(h1 / h2);

  // Octave-band average levels, then regress dB on log2(f). Banding stops the
  // many high-frequency bins from dominating a plain per-bin regression.
  var centers = [250, 500, 1000, 2000, 4000];
  var xs = [], ys = [];
  for (var c = 0; c < centers.length; c++) {
    var lo = centers[c] / Math.SQRT2, hi = centers[c] * Math.SQRT2;
    if (hi >= sampleRate / 2) break;
    var sum = 0, count = 0;
    var kLo = Math.max(1, Math.floor(lo / binHz));
    var kHi = Math.min(half - 1, Math.ceil(hi / binHz));
    for (var k = kLo; k <= kHi; k++) { sum += mag[k] * mag[k]; count++; }
    if (!count || !(sum > 0)) continue;
    xs.push(Math.log2(centers[c]));
    ys.push(10 * Math.log10(sum / count));
  }
  if (xs.length < 3) return null;

  var mx = 0, my = 0;
  for (i = 0; i < xs.length; i++) { mx += xs[i]; my += ys[i]; }
  mx /= xs.length; my /= ys.length;
  var num = 0, den = 0;
  for (i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) * (xs[i] - mx);
  }
  if (!(den > 0)) return null;
  var tilt = num / den;

  return { h1h2: h1h2, tilt: tilt, weightRaw: -h1h2 + tilt };
}

// ---------------------------------------------------------------------------
// smoothing
// ---------------------------------------------------------------------------

// Median over the last n pushes. VTL and weight are noisy frame to frame and
// unreadable without this.
function MedianSmoother(n) {
  this.n = n || 15;
  this.buf = [];
}
MedianSmoother.prototype.push = function (v) {
  if (v == null || !isFinite(v)) return this.value();
  this.buf.push(v);
  if (this.buf.length > this.n) this.buf.shift();
  return this.value();
};
MedianSmoother.prototype.value = function () {
  if (!this.buf.length) return null;
  var s = this.buf.slice().sort(function (a, b) { return a - b; });
  var m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
MedianSmoother.prototype.reset = function () { this.buf = []; };

// Time-windowed stats over voiced pitch, in semitones — the unit intonation
// range is actually reported in.
function RollingStats(maxAgeMs) {
  this.maxAgeMs = maxAgeMs || 10000;
  this.items = [];
}
RollingStats.prototype.push = function (value, tMs) {
  if (value == null || !isFinite(value)) return;
  this.items.push({ t: tMs, v: value });
  var cutoff = tMs - this.maxAgeMs;
  while (this.items.length && this.items[0].t < cutoff) this.items.shift();
};
RollingStats.prototype.count = function () { return this.items.length; };
RollingStats.prototype.mean = function () {
  if (!this.items.length) return null;
  var s = 0;
  for (var i = 0; i < this.items.length; i++) s += this.items[i].v;
  return s / this.items.length;
};
RollingStats.prototype.sd = function () {
  if (this.items.length < 2) return null;
  var m = this.mean(), s = 0;
  for (var i = 0; i < this.items.length; i++) {
    var d = this.items[i].v - m;
    s += d * d;
  }
  return Math.sqrt(s / (this.items.length - 1));
};
RollingStats.prototype.median = function () {
  if (!this.items.length) return null;
  var a = this.items.map(function (o) { return o.v; }).sort(function (x, y) { return x - y; });
  var m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
RollingStats.prototype.reset = function () { this.items = []; };

// ---------------------------------------------------------------------------
// one-call frame analysis, used by the live loop
// ---------------------------------------------------------------------------

function analyze(frame, sampleRate, opts) {
  var pitch = yin(frame, sampleRate, opts);
  var out = {
    f0: pitch.f0,
    rms: pitch.rms,
    aperiodicity: pitch.aperiodicity,
    voiced: false,
    formants: null,
    vtl: null,
    resonance: null,
    envelope: null,
    weightRaw: null,
    h1h2: null,
    tilt: null
  };
  if (!isVoiced(pitch, opts)) return out;
  out.voiced = true;

  var env = lpcEnvelope(frame, sampleRate, opts);
  if (env) {
    out.envelope = env;
    out.formants = findFormants(env, opts);
    out.vtl = estimateVTL(out.formants, opts);       // absolute, gated
    out.resonance = resonanceIndex(out.formants);     // relative, ungated
  }
  var sm = spectralMeasures(frame, pitch.f0, sampleRate);
  if (sm) {
    out.weightRaw = sm.weightRaw;
    out.h1h2 = sm.h1h2;
    out.tilt = sm.tilt;
  }
  return out;
}

var api = {
  SPEED_OF_SOUND_CM_S: SPEED_OF_SOUND_CM_S,
  rms: rms,
  decimate: decimate,
  yin: yin,
  isVoiced: isVoiced,
  levinson: levinson,
  lpcEnvelope: lpcEnvelope,
  findFormants: findFormants,
  estimateVTL: estimateVTL,
  resonanceIndex: resonanceIndex,
  fft: fft,
  spectralMeasures: spectralMeasures,
  MedianSmoother: MedianSmoother,
  RollingStats: RollingStats,
  hzToSemitones: hzToSemitones,
  semitonesToHz: semitonesToHz,
  analyze: analyze
};

export default api;
