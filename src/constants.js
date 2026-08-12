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

// Connected-speech flags, used where a take is transcribed and each phrase is
// judged on its own rather than as one median over the whole reading. Like the
// contour thresholds above, these are judgement calls chosen to be quiet: a
// flag that fires on ordinary speech teaches you to ignore flags.
export var ASR_LEAD_MS = 700;       // how late a recogniser's first interim result runs
export var SWOOP_RATIO = 1.6;       // phrase spread this far over baseline reads as a swoop
export var RUSHED_WPS = 6.0;        // words per second of *voiced* speech that reads as rushed
export var PHRASE_MIN_WORDS = 2;    // fewer words than this is not enough to judge pace on
export var TRANSCRIPT_SETTLE_MS = 1200;  // grace for the recogniser to flush its last utterance

// Creak. Aperiodicity above this is a frame that is not a note: the folds are
// flapping irregularly rather than vibrating, which is how a pitch below what
// your voice can hold gets faked. Calibration and the glide already used this
// number to refuse to *measure* a creaky frame; the drills use it to say so.
export var CREAK_APERIODICITY = 0.2;
export var CREAK_WINDOW_MS = 3000;   // recent voiced time the warning judges
export var CREAK_ON = 0.6;           // fraction of it creaky before the warning shows
export var CREAK_OFF = 0.3;          // and the fraction it must fall to before it goes
export var CREAK_MIN_MS = 800;       // never judge on less recent speech than this

// Voice quality across a practice session, from cepstral peak prominence.
// This is the only measure here that is about strain rather than about how a
// voice reads, and the only one that can interrupt you. It compares two long
// windows of your own voice — the start of the session against now — and it
// is deliberately reluctant: see RESEARCH.md §11 for why each gate exists.
export var CPP_REF_MS = 20000;       // voiced time that establishes the session reference
export var CPP_WINDOW_MS = 20000;    // rolling window compared against it
export var CPP_MIN_MS = 10000;       // minimum voiced time in that window before judging
export var CPP_DROP_DB = 3;          // decline that counts as "rest now" — judgement call
export var CPP_F0_GATE_HZ = 15;      // pitch difference above which it declines to answer
export var CPP_HOLD_MS = 5000;       // the decline must persist this long before it says anything

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
