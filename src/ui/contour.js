import { RAMP } from '../constants.js';
import { median } from '../util/stats.js';
import { Ribbon } from './ribbon.js';
import { SMOOTH_HALF_MS, medianFilter } from '../analysis/smooth.js';

// One sentence at a time, drawn whole.
//
// The scrolling ribbon is the wrong instrument for a contour: it reads two
// pixels per frame, so a sentence arrives as a stream of disconnected
// fragments that has already slid halfway off the canvas by the time you
// could look at it, and its hertz scale flattens a three-semitone rise into a
// few pixels. This draws one phrase across the full width, on a semitone
// scale centred on that phrase's own average, and holds it on screen after
// you stop speaking so there is something to actually look at.
export function Contour(canvas) {
  this.c = canvas;
  this.g = canvas.getContext('2d');
}
Contour.prototype.resize = Ribbon.prototype.resize;

// `pts` are the frames of one phrase ({ t, st, rms }, st null when unvoiced);
// `mark` is the scored final syllable, or null while the phrase is still
// being spoken.
Contour.prototype.draw = function (pts, mark, spanMs) {
  var g = this.g, i;
  var rect = this.c.getBoundingClientRect();
  if (!this.w || Math.abs(rect.width - this.w) > 1) this.resize();
  var w = this.w, h = this.h, PAD = 30;
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#050508';
  g.fillRect(0, 0, w, h);
  g.font = '11px system-ui';

  var voiced = pts ? pts.filter(function (p) { return p.st != null; }) : [];
  var SPAN = 6;  // semitones shown above and below the sentence's own average
  var mid = voiced.length ? median(voiced.map(function (p) { return p.st; })) : 0;
  var t0 = pts && pts.length ? pts[0].t : 0;
  var dur = Math.max(spanMs || 0, pts && pts.length ? pts[pts.length - 1].t - t0 : 0, 1200);
  function x(t) { return PAD + (t - t0) / dur * (w - PAD - 8); }
  function y(st) { return h / 2 - Math.max(-SPAN, Math.min(SPAN, st - mid)) / SPAN * (h / 2 - 14); }

  // Grid in semitones relative to this sentence, because the question is the
  // shape of the ending, not where the voice sits — pitch has its own drills.
  [4, 2, 0, -2, -4].forEach(function (st) {
    var yy = y(mid + st);
    g.strokeStyle = st === 0 ? 'rgba(143,151,173,.34)' : 'rgba(143,151,173,.13)';
    g.beginPath(); g.moveTo(PAD, yy); g.lineTo(w - 8, yy); g.stroke();
    g.fillStyle = 'rgba(143,151,173,.65)';
    g.textAlign = 'right';
    g.fillText(st === 0 ? 'avg' : (st > 0 ? '+' + st : st), PAD - 6, yy + 3.5);
  });
  g.textAlign = 'left';

  if (!voiced.length) {
    g.fillStyle = 'rgba(143,151,173,.6)';
    g.fillText(mark === false ? 'listening — read the sentence above, then pause'
                              : 'press Start take, then read the sentence above', PAD + 4, h / 2 - 10);
    return;
  }

  // The final syllable, shaded, so the verdict is visibly about one part of
  // the sentence rather than the whole thing.
  if (mark) {
    var x0 = x(mark.from), x1 = x(mark.to);
    g.fillStyle = mark.dir === 'rise' ? 'rgba(245,133,47,.13)' : 'rgba(255,207,92,.13)';
    g.fillRect(x0, 8, Math.max(2, x1 - x0), h - 16);
    g.fillStyle = mark.dir === 'rise' ? 'rgba(245,133,47,.85)' : 'rgba(255,207,92,.85)';
    g.textAlign = 'center';
    g.fillText('last syllable', (x0 + x1) / 2, h - 6);
    g.textAlign = 'left';
  }

  var st = medianFilter(pts, function (p) { return p.st; }, SMOOTH_HALF_MS);
  // Break the line only at a real pause. Every stop consonant devoices for a
  // few frames, and breaking there was most of what made this look choppy.
  var drawing = false, prevCol = null, prev = null;
  g.lineWidth = 2.4;
  g.lineJoin = 'round';
  for (i = 0; i < pts.length; i++) {
    if (st[i] == null) continue;
    var inMark = mark && pts[i].t >= mark.from && pts[i].t <= mark.to;
    var col = !mark ? RAMP.signal
      : inMark ? (mark.dir === 'rise' ? RAMP.high : RAMP.peak)
      : 'rgba(212,59,122,.45)';
    var here = { x: x(pts[i].t), y: y(st[i]) };
    var brk = prev == null || pts[i].t - prev.t > 120;
    if (drawing && (brk || col !== prevCol)) { g.stroke(); drawing = false; }
    if (!drawing) {
      g.strokeStyle = col;
      g.beginPath();
      // Rejoin from the previous point unless the gap was a real pause, so a
      // colour change part-way along does not leave a hole in the line.
      g.moveTo(brk ? here.x : prev.x, brk ? here.y : prev.y);
      drawing = true;
      prevCol = col;
    }
    g.lineTo(here.x, here.y);
    prev = { x: here.x, y: here.y, t: pts[i].t };
  }
  if (drawing) g.stroke();
};
