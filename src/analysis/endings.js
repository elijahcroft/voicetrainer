import { CONTOUR_MIN_MS, FINAL_SCAN_MS, SYLLABLE_DIP } from '../constants.js';
import { SMOOTH_HALF_MS, medianFilter } from './smooth.js';
import { median } from '../util/stats.js';

// --- statement endings ----------------------------------------------------
//
// The only exercise that measures a *shape* rather than a level. Everything
// else here reports a number you could hold steady; a terminal contour only
// exists relative to the phrase it ends, so this drill cuts speech into
// phrases, finds the last syllable of each, and scores that.
//
// Two segmentations, and they do different jobs:
//
//   phrase    — silence longer than PHRASE_GAP_MS. Crude, and adequate only
//               because the drill asks for one sentence at a time.
//   syllable  — a dip in loudness, not a gap in voicing. Voicing is the wrong
//               cue: "know how it ends" barely stops voicing at all, so the
//               last voiced run was the whole phrase and every ending read as
//               stretched. Loudness dips at a syllable boundary whether or
//               not the voice switches off.
//
// The verdict is read inside the final syllable alone. Reading it from a
// fixed window at the end of the phrase got the common case backwards: a
// question-like ending often *steps down* onto the last syllable before
// rising through it, so a window spanning the step saw a net fall and called
// a rise a landing.
export function findFinalSyllable(pts) {
  var i, e = -1;
  for (i = pts.length - 1; i >= 0; i--) { if (pts[i].st != null) { e = i; break; } }
  if (e < 1) return null;
  var env = medianFilter(pts, function (p) { return p.rms; }, SMOOTH_HALF_MS);

  // Walk back from the end, tracking the loudest frame seen. The syllable
  // starts where loudness has fallen to SYLLABLE_DIP of that nucleus. The
  // running maximum is what makes this survive a final syllable quieter than
  // the one before it — the threshold is relative to the syllable being
  // measured, not to the loudest part of the sentence.
  var pk = env[e], s = e, found = false;
  for (i = e - 1; i >= 0; i--) {
    if (pts[e].t - pts[i].t > FINAL_SCAN_MS) break;
    if (env[i] < pk * SYLLABLE_DIP) { found = true; break; }
    if (env[i] > pk) pk = env[i];
    s = i;
  }
  // No dip inside the scan window means the ending ran on into the syllable
  // before it with no boundary to find. The contour is still readable; the
  // duration is not, and is reported as unknown rather than as the scan
  // limit, which would be a made-up number that always looked stretched.
  return { start: pts[s].t, end: pts[e].t, found: found };
}

// Direction of the ending, in semitones, read as the difference between the
// medians of its first and last two-fifths. Medians rather than a slope: the
// region is short enough that one octave-slip frame swings a regression line,
// and the shape being detected is monotonic anyway.
export function contourDelta(pts, from, to) {
  if (to - from < CONTOUR_MIN_MS) from = to - CONTOUR_MIN_MS;
  var v = pts.filter(function (p) { return p.st != null && p.t >= from && p.t <= to; });
  if (v.length < 4) return null;
  var span = v[v.length - 1].t - v[0].t;
  if (span < CONTOUR_MIN_MS / 2) return null;
  function part(lo, hi) {
    var w = v.filter(function (p) { return p.t >= v[0].t + span * lo && p.t <= v[0].t + span * hi; });
    return w.length ? median(w.map(function (p) { return p.st; })) : null;
  }
  var a = part(0, 0.4), b = part(0.6, 1);
  return a == null || b == null ? null : b - a;
}
