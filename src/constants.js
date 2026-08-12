export var MASC_F0_CEILING = 130;   // below this, listeners reliably hear "male"
export var ANDROGYNOUS_LOW = 140;   // 140-165 Hz is the ambiguous zone where
export var ANDROGYNOUS_HIGH = 165;  // gender recognition accuracy collapses
export var FLOOR_MARGIN_ST = 3;     // never target within 3 semitones of the bottom
export var RESONANCE_GOAL = 1.10;   // cis male vocal tracts run 10-20% longer

// Phrase-final contour, used only by the statement-endings drill. A phrase is
// whatever sits between two long silences; inside it, the final syllable is
// found from the loudness envelope and the verdict is read from that syllable
// alone. The thresholds are judgement calls, not measured cut-points — see
// RESEARCH.md §5.
export var PHRASE_GAP_MS = 260;     // silence that ends a phrase
export var MIN_PHRASE_MS = 400;     // shorter than this is a cough, not a sentence
export var FINAL_SCAN_MS = 700;     // how far back to look for the final syllable
export var SYLLABLE_DIP = 0.5;      // loudness dip, relative to the nucleus, that marks its start
export var CONTOUR_MIN_MS = 250;    // a shorter syllable is padded backwards to read its shape
export var TERMINAL_ST = 1.0;       // smaller than this in either direction is "flat"
export var HOLD_LONG_MS = 350;      // final syllable longer than this reads stretched

// How much *voiced* speech a measurement needs, in milliseconds. These were
// frame counts, which made them depend on the display: 120 frames is two
// seconds on a 60 Hz screen and one on a 120 Hz one, and far longer if the
// browser throttles requestAnimationFrame. Time is the quantity that was
// always meant.
export var MIN_VOICED_MS_CALIBRATE = 5000;
export var MIN_VOICED_MS_SCORE = 2000;
export var MIN_FRAMES_FOR_MEDIAN = 20;   // frames, correctly: enough samples to median

export var STORE_KEY = 'voice-trainer-baseline-v1';
export var HISTORY_KEY = 'voice-trainer-history-v1';
export var MAX_TAKES = 300;         // ~a year of daily practice; oldest are dropped

// The same energy ramp the stylesheet uses, for the things drawn into a
// canvas, where a CSS variable cannot reach. Magenta is signal, amber is
// signal where you wanted it: that mapping has to hold on the trace and in
// the meters at once, or the colours stop meaning anything.
export var RAMP = {
  signal: '#d43b7a',   // live, and off target
  peak:   '#ffcf5c',   // inside the target band
  high:   '#f5852f',   // caution: a rising ending, a free-speech take
  quiet:  '#8b8898'    // measured, but not the thing being judged
};
