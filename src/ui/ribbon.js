import { ANDROGYNOUS_HIGH, ANDROGYNOUS_LOW, MASC_F0_CEILING, RAMP } from '../constants.js';
import { base } from '../store/baseline.js';
import { pitchTarget } from '../targets.js';

// Scrolling pitch ribbon with the target band shaded.
export function Ribbon(canvas, opts) {
  this.c = canvas;
  this.g = canvas.getContext('2d');
  this.pts = [];
  this.opts = opts || {};
  var r = ribbonRange();
  this.loHz = r.lo; this.hiHz = r.hi;
}

// A fixed 60-320 Hz scale wastes most of the canvas: a voice working between
// 130 and 160 Hz draws inside a tenth of the height, where the differences
// that matter are invisible. Fit the scale to the range this speaker actually
// uses, while always keeping the reference lines and the target in view.
export function ribbonRange() {
  var t = pitchTarget();
  // Everything that has to stay on screen: the floor, the target, the
  // reference lines, and where this speaker actually talks.
  var lo = Math.min(base.safeFloor != null ? base.safeFloor : 110,
                    t ? t.hz : MASC_F0_CEILING, MASC_F0_CEILING);
  var hi = Math.max(base.habitualF0 != null ? base.habitualF0 : 200, ANDROGYNOUS_HIGH);
  // Generous headroom below, since a glide can go under the measured floor.
  return { lo: Math.max(55, lo * 0.8), hi: Math.min(400, hi * 1.12) };
}
Ribbon.prototype.resize = function () {
  var r = this.c.getBoundingClientRect();
  var dpr = window.devicePixelRatio || 1;
  this.c.width = Math.max(1, r.width * dpr);
  this.c.height = Math.max(1, r.height * dpr);
  this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
  this.w = r.width; this.h = r.height;
};
Ribbon.prototype.y = function (hz) {
  var t = (Math.log2(hz) - Math.log2(this.loHz)) / (Math.log2(this.hiHz) - Math.log2(this.loHz));
  return this.h - t * this.h;
};
Ribbon.prototype.push = function (hz) {
  this.pts.push(hz || 0);
  var max = Math.floor(this.w / 2);
  while (this.pts.length > max) this.pts.shift();
};
Ribbon.prototype.draw = function (band) {
  var g = this.g;
  var rect = this.c.getBoundingClientRect();
  if (!this.w || Math.abs(rect.width - this.w) > 1) this.resize();
  g.clearRect(0, 0, this.w, this.h);
  g.fillStyle = '#050508';
  g.fillRect(0, 0, this.w, this.h);

  // reference lines at the boundaries listeners actually respond to
  var refs = [
    { hz: MASC_F0_CEILING, label: '130 Hz  reads male', col: 'rgba(255,207,92,.5)' },
    { hz: ANDROGYNOUS_LOW, label: '140', col: 'rgba(143,151,173,.25)' },
    { hz: ANDROGYNOUS_HIGH, label: '165  ambiguous zone', col: 'rgba(143,151,173,.25)' }
  ];
  refs.forEach(function (r) {
    var y = this.y(r.hz);
    g.strokeStyle = r.col; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, y); g.lineTo(this.w, y); g.stroke();
    g.fillStyle = 'rgba(143,151,173,.65)'; g.font = '11px system-ui';
    g.fillText(r.label, 6, y - 4);
  }, this);

  if (band) {
    var yTop = this.y(band.hi), yBot = this.y(band.lo);
    g.fillStyle = 'rgba(212,59,122,.13)';
    g.fillRect(0, yTop, this.w, yBot - yTop);
    g.strokeStyle = 'rgba(212,59,122,.5)';
    g.setLineDash([4, 4]);
    g.beginPath(); g.moveTo(0, this.y(band.center)); g.lineTo(this.w, this.y(band.center)); g.stroke();
    g.setLineDash([]);
    // Right-aligned: the reference labels are drawn on the left and the
    // target line often sits within a few pixels of one of them.
    g.fillStyle = 'rgba(184,211,255,.9)'; g.font = '11px system-ui';
    g.textAlign = 'right';
    g.fillText('target ' + band.center.toFixed(0) + ' Hz', this.w - 6, yTop - 5);
    g.textAlign = 'left';
  }

  // trace
  g.lineWidth = 2.2;
  g.strokeStyle = RAMP.signal;
  var drawing = false;
  for (var i = 0; i < this.pts.length; i++) {
    var hz = this.pts[i];
    if (!hz) { if (drawing) { g.stroke(); drawing = false; } continue; }
    var x = i * 2, y = this.y(Math.min(this.hiHz, Math.max(this.loHz, hz)));
    if (band) g.strokeStyle = (hz >= band.lo && hz <= band.hi) ? RAMP.peak : RAMP.signal;
    if (!drawing) { g.beginPath(); g.moveTo(x, y); drawing = true; }
    else g.lineTo(x, y);
  }
  if (drawing) g.stroke();
};
