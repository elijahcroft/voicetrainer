import DSP from '../dsp.js';
import { contourDelta, findFinalSyllable } from './endings.js';
import { SMOOTH_HALF_MS, medianFilter } from './smooth.js';
import { CONTOUR_MIN_MS, CREAK_APERIODICITY, MIN_PHRASE_MS, PHRASE_GAP_MS,
         TERMINAL_ST } from '../constants.js';
import { median, semitoneSd } from '../util/stats.js';

// --- phrase tracking for connected speech ---------------------------------
//
// The endings drill cuts one sentence at a time out of silence and scores its
// last syllable. Connected speech needs the same cut, but continuously and for
// the whole take: a reading of the passage is twelve phrases, and "your median
// pitch was 148 Hz" says nothing about which of them went wrong.
//
// Same segmentation rule as the drill — a gap longer than PHRASE_GAP_MS ends a
// phrase — and the same final-syllable search inside it, so a rise flagged here
// and a rise flagged there mean the same thing. What is new is that each phrase
// keeps enough of itself to be judged on more than its ending: its pitch, its
// spread, and how much of it was creak.
export function PhraseTracker() {
  this.phrases = [];
  this.pts = [];
  this.gapMs = 0;
  this.lastTs = null;
}

// One analysed frame. `dt` is the frame spacing the caller is already tracking;
// passing it in rather than differencing here keeps the clamp on a stalled
// frame in one place.
PhraseTracker.prototype.push = function (a, ts, dt) {
  if (a.voiced && a.f0) {
    this.gapMs = 0;
    this.pts.push({
      t: ts, st: DSP.hzToSemitones(a.f0), hz: a.f0, rms: a.rms,
      creak: a.aperiodicity != null && a.aperiodicity > CREAK_APERIODICITY,
      dt: dt
    });
  } else {
    this.gapMs += dt;
    if (this.pts.length) {
      if (this.gapMs >= PHRASE_GAP_MS) this.end();
      else this.pts.push({ t: ts, st: null, hz: null, rms: a.rms, creak: false, dt: dt });
    }
  }
};

// Close whatever is open. Called on a long enough silence, and once more when
// the take stops — otherwise the last phrase of every take, the one you were
// still speaking when you reached for the button, is thrown away.
PhraseTracker.prototype.end = function () {
  var phrase = this.pts;
  this.pts = [];
  var voiced = phrase.filter(function (p) { return p.st != null; });
  // A cough, a chair, or the tail of the phrase before is not a phrase.
  if (voiced.length < 4 || voiced[voiced.length - 1].t - voiced[0].t < MIN_PHRASE_MS) return;

  // De-spiked for measurement, the same ±25 ms window the drill scores through:
  // one octave-slip frame at the end of a sentence is the difference between a
  // fall and a rise.
  var st = medianFilter(phrase, function (p) { return p.st; }, SMOOTH_HALF_MS);
  var clean = phrase.map(function (p, i) { return { t: p.t, st: st[i], rms: p.rms }; });
  var syl = findFinalSyllable(clean);
  var delta = syl ? contourDelta(clean, syl.start, syl.end) : null;

  var voicedMs = 0, creakMs = 0;
  voiced.forEach(function (p) { voicedMs += p.dt; if (p.creak) creakMs += p.dt; });

  this.phrases.push({
    start: voiced[0].t,
    end: voiced[voiced.length - 1].t,
    voicedMs: voicedMs,
    f0: median(voiced.map(function (p) { return p.hz; })),
    sd: semitoneSd(voiced.map(function (p) { return p.hz; })),
    creakFrac: voicedMs ? creakMs / voicedMs : 0,
    delta: delta,
    // Unreadable endings stay unreadable rather than defaulting to "flat" —
    // a phrase whose last syllable ran into the one before it has no verdict,
    // and saying "flat" would be inventing one.
    dir: delta == null ? null
      : delta >= TERMINAL_ST ? 'rise' : delta <= -TERMINAL_ST ? 'fall' : 'flat',
    hold: syl && syl.found ? syl.end - syl.start : null,
    // Where the shaded final syllable sits, for anything that wants to draw it.
    from: syl ? Math.min(syl.start, syl.end - CONTOUR_MIN_MS) : null,
    to: syl ? syl.end : null
  });
};

PhraseTracker.prototype.reset = function () {
  this.phrases = [];
  this.pts = [];
  this.gapMs = 0;
};
