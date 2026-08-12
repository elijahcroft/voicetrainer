import { ribbonRange } from './ribbon.js';

// ==========================================================================
// shared UI pieces
// ==========================================================================

// `bar` adds a progress strip under the value. `markAt` (0-1) draws the
// target notch on it.
export function meter(id, label, sub, bar) {
  return '<div class="meter idle" id="' + id + '"><div class="lab">' + label +
    '</div><div class="val" id="' + id + '-v">--</div><div class="sub" id="' + id + '-s">' +
    (sub || '') + '</div>' +
    (bar ? '<div class="bar"><i id="' + id + '-b"></i><u id="' + id + '-m" hidden></u></div>' : '') +
    '</div>';
}
export function setMeter(id, value, sub, opts) {
  var el = document.getElementById(id);
  if (!el) return;
  document.getElementById(id + '-v').textContent = value;
  if (sub != null) document.getElementById(id + '-s').innerHTML = sub;
  if (opts && opts.hit != null) el.classList.toggle('hit', !!opts.hit);
  if (opts && opts.muted != null) el.classList.toggle('muted', !!opts.muted);
  el.classList.toggle('idle', value === '--' || value === '—');

  var bar = document.getElementById(id + '-b');
  if (bar && opts && opts.fill != null) {
    bar.style.width = Math.max(0, Math.min(1, opts.fill)) * 100 + '%';
  }
  var mark = document.getElementById(id + '-m');
  if (mark && opts && opts.markAt != null) {
    mark.hidden = false;
    mark.style.left = Math.max(0, Math.min(1, opts.markAt)) * 100 + '%';
  }
}

// Position of `hz` on the meter bar, on the same scale as the ribbon so the
// bar and the trace agree.
export function pitchFill(hz) {
  if (!hz) return 0;
  var r = ribbonRange();
  return (Math.log2(hz) - Math.log2(r.lo)) / (Math.log2(r.hi) - Math.log2(r.lo));
}
