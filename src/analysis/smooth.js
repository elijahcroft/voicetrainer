// smooth.js — the median filter the pitch and loudness traces are read through.
//
// Pure: no DOM. It sat next to the Contour canvas because that was its first
// caller, but the statement-endings measurement depends on it just as much,
// and a signal filter is not a drawing routine.

import { median } from '../util/stats.js';

// Isolated frames where the pitch tracker slips an octave are what made the
// trace look ragged; a median over a short window removes them without
// rounding off a real contour, which lasts tenths of a second.
//
// The window is milliseconds and not a number of frames, for the same reason
// the voiced-time minimums are: a 5-frame median is 40 ms on a 120 Hz screen
// and 165 ms on a throttled one. At the wide end it erased the very dip
// between syllables that the final-syllable search looks for, so the drill
// read the whole end of the sentence as one syllable and called rises flat.
export function medianFilter(pts, pick, halfMs) {
  return pts.map(function (p, i) {
    var v = pick(p);
    if (v == null) return null;
    var w = [], j;
    for (j = i; j >= 0 && p.t - pts[j].t <= halfMs; j--) { if (pick(pts[j]) != null) w.push(pick(pts[j])); }
    for (j = i + 1; j < pts.length && pts[j].t - p.t <= halfMs; j++) { if (pick(pts[j]) != null) w.push(pick(pts[j])); }
    return w.length ? median(w) : v;
  });
}
export var SMOOTH_HALF_MS = 25;   // ±25 ms: two frames either side at 60 Hz
