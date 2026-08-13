import { RAMP, RESONANCE_GOAL } from '../constants.js';
import { openExercise } from './registry.js';
import { MIN_TREND_DAYS, dailyMedians, trend } from '../progress/trend.js';
import { base } from '../store/baseline.js';
import { clearHistory, history } from '../store/history.js';
import { pitchTarget } from '../targets.js';

// --- progress -------------------------------------------------------------

// What each chart plots, and what counts as "better". Resonance is restricted
// to the passage takes because it is only comparable across the same text —
// the same reason the passage report compares against the calibration read.
function progressMetrics() {
  var t = pitchTarget();
  return [
    { id: 'f0', label: 'Pitch', unit: ' Hz', dp: 0, lower: true,
      ref: t ? t.hz : null, refLabel: 'target' },
    { id: 'res', label: 'Resonance', unit: ' cm', dp: 1, lower: false,
      ref: base.resonance != null ? base.resonance * RESONANCE_GOAL : null, refLabel: 'goal',
      passageOnly: true },
    { id: 'sd', label: 'Intonation', unit: ' st', dp: 1, lower: true,
      ref: base.intonationSd, refLabel: 'baseline' },
    { id: 'weight', label: 'Weight', unit: '', dp: 1, lower: false,
      ref: base.weight, refLabel: 'baseline' }
  ];
}

var KIND_LABEL = { calibration: 'Calibration', passage: 'Passage', free: 'Free speech' };
var KIND_COLOR = { calibration: RAMP.quiet, passage: RAMP.signal, free: RAMP.high };
var DAY_MS = 86400000;

export function buildProgress() {
  var metrics = progressMetrics().filter(function (m) {
    return history.some(function (h) { return h[m.id] != null; });
  });
  if (!metrics.length) {
    return {
      html:
        '<div class="card">' +
          '<h3>Progress</h3>' +
          '<p class="why">Scored takes are kept in this browser so you can see whether the numbers ' +
          'are actually moving. Nothing here is uploaded, and no audio is stored — only the four ' +
          'medians and the date.</p>' +
          '<div class="banner info" style="margin:0">No scored takes yet. The <b>reading passage</b> ' +
          'and <b>free speech</b> exercises each save one take when you press <i>Stop and score</i>; ' +
          'your calibration reading is saved as the first point.</div>' +
        '</div>'
    };
  }

  var sel = metrics[0].id;

  var html =
    '<div class="card">' +
      '<h3>Progress</h3>' +
      '<p class="why">Every scored take, on a real time axis: a week between two takes looks like a ' +
      'week. Practice moves slowly and unevenly — a single take says almost nothing, so the line ' +
      'joins one median per day rather than every take. Nothing here is uploaded; only the medians ' +
      'and the date are kept, in this browser.</p>' +
      '<div class="row" id="metricRow" style="margin-top:0">' +
        metrics.map(function (m) {
          return '<button data-metric="' + m.id + '"' + (m.id === sel ? ' class="primary"' : '') +
            '>' + m.label + '</button>';
        }).join('') +
      '</div>' +
      '<canvas id="progCanvas" class="trace" style="height:230px;margin-top:14px" role="img" ' +
        'aria-label="Scored takes on a time axis, with the median of each day joined by a line">' +
      '</canvas>' +
      // Two mark types now share the chart, so both have to be named: the
      // dots are takes and the line is days, and without this the reader has
      // no way to know that six dots can sit under one point on the line.
      '<div class="hint" id="progLegend">' +
        Object.keys(KIND_LABEL).map(function (kind) {
          return '<span class="lg"><i style="background:' + KIND_COLOR[kind] + '"></i>' +
            KIND_LABEL[kind] + '</span>';
        }).join('') +
        '<span class="lg"><i class="ring"></i>median of that day</span>' +
      '</div>' +
      '<div id="progSummary" class="hint"></div>' +
    '</div>' +
    '<div class="card">' +
      '<h3 style="font-size:15px">Takes</h3>' +
      '<div style="max-height:340px;overflow:auto">' + takeTable() + '</div>' +
      '<div class="row"><button id="clearHist">Delete take history</button>' +
        '<span style="color:var(--dim);font-size:12.5px">Your calibration is kept.</span></div>' +
    '</div>';

  var cv, g, onResize = null;

  function series(m) {
    return history.filter(function (h) {
      return h[m.id] != null && !(m.passageOnly && h.kind === 'free');
    });
  }

  function draw() {
    var m = metrics.filter(function (x) { return x.id === sel; })[0];
    var pts = series(m);
    var days = dailyMedians(pts, m.id);
    var r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(r.width * dpr)) {
      cv.width = r.width * dpr; cv.height = r.height * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    var w = r.width, h = r.height;
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#050508'; g.fillRect(0, 0, w, h);
    g.font = '11px system-ui';

    if (!pts.length) {
      g.fillStyle = 'rgba(143,151,173,.8)';
      g.fillText('No takes with a ' + m.label.toLowerCase() + ' reading yet.', 10, h / 2);
      document.getElementById('progSummary').textContent = '';
      return;
    }

    // The reference line is part of the picture, so the scale has to include
    // it — a chart that crops the target off the top implies you are there.
    var vals = pts.map(function (p) { return p[m.id]; });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (m.ref != null) { lo = Math.min(lo, m.ref); hi = Math.max(hi, m.ref); }
    var pad = (hi - lo) * 0.18 || Math.max(Math.abs(hi) * 0.05, 0.5);
    lo -= pad; hi += pad;

    var padL = 46, padR = 12, padT = 12, padB = 22;
    // Real time, not take number. Less than a day of history is widened to a
    // day and centred, which keeps this to one code path and stops a single
    // session's takes from being stretched across the full width as though
    // they were weeks apart.
    var t0 = pts[0].t, t1 = pts[pts.length - 1].t;
    var span = Math.max(t1 - t0, DAY_MS), tLo = (t0 + t1) / 2 - span / 2;
    function x(t) { return padL + (t - tLo) / span * (w - padL - padR); }
    function y(v) { return padT + (1 - (v - lo) / (hi - lo)) * (h - padT - padB); }

    // y axis
    g.strokeStyle = 'rgba(46,52,70,.9)'; g.lineWidth = 1;
    g.fillStyle = 'rgba(143,151,173,.75)';
    [lo + pad, (lo + hi) / 2, hi - pad].forEach(function (v) {
      var yy = Math.round(y(v)) + 0.5;
      g.beginPath(); g.moveTo(padL, yy); g.lineTo(w - padR, yy); g.stroke();
      g.fillText(v.toFixed(m.dp), 6, yy + 4);
    });

    if (m.ref != null) {
      var yr = y(m.ref);
      g.strokeStyle = 'rgba(255,207,92,.55)'; g.setLineDash([4, 4]);
      g.beginPath(); g.moveTo(padL, yr); g.lineTo(w - padR, yr); g.stroke();
      g.setLineDash([]);
      g.fillStyle = 'rgba(255,207,92,.9)';
      var lbl = m.refLabel + ' ' + m.ref.toFixed(m.dp) + m.unit;
      g.fillText(lbl, w - padR - g.measureText(lbl).width, yr - 5);
    }

    // The line is the days. A day holding one take and a day holding six
    // retries are one point each, which is the whole reason for drawing it.
    g.strokeStyle = 'rgba(212,59,122,.75)'; g.lineWidth = 2;
    g.beginPath();
    days.forEach(function (d, i) {
      var xx = x(d.t), yy = y(d.value);
      if (i) g.lineTo(xx, yy); else g.moveTo(xx, yy);
    });
    g.stroke();

    // Rings, so a day of one take still shows that take's own colour inside.
    days.forEach(function (d) {
      g.beginPath(); g.arc(x(d.t), y(d.value), 4.5, 0, Math.PI * 2); g.stroke();
    });

    // The takes themselves stay on the chart — the spread of a day is worth
    // seeing — but as the quieter mark, since the line is what to read.
    g.globalAlpha = 0.55;
    pts.forEach(function (p) {
      g.fillStyle = KIND_COLOR[p.kind] || RAMP.signal;
      g.beginPath(); g.arc(x(p.t), y(p[m.id]), 2.5, 0, Math.PI * 2); g.fill();
    });
    g.globalAlpha = 1;

    // Dates sit under the take they name rather than at the edges, which the
    // widened single-day span would otherwise make untrue.
    g.fillStyle = 'rgba(143,151,173,.75)';
    function stamp(t) {
      var text = dayLabel(t), tw = g.measureText(text).width;
      g.fillText(text, Math.min(Math.max(x(t) - tw / 2, padL), w - padR - tw), h - 6);
    }
    if (x(t1) - x(t0) >= 90) stamp(t0);
    stamp(t1);

    summarise(m, pts, days);
  }

  // Early days against late days, stated in the direction that is actually an
  // improvement for the metric — "down 11 Hz" is progress, "down 0.4 cm" is
  // not. This used to be the first take against the last one, which is the
  // noisiest comparison available: the two readings most exposed to a bad
  // night's sleep decided what the whole screen said.
  function summarise(m, pts, days) {
    var el = document.getElementById('progSummary');
    var tail = m.passageOnly
      ? ' Free-speech takes are left out, since resonance only compares on the same text.' : '';
    var plural = function (n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); };
    var t = trend(days);
    if (!t) {
      el.innerHTML = plural(pts.length, 'take') + ' across ' + plural(days.length, 'day') +
        '. A trend needs ' + MIN_TREND_DAYS + ' measured days, so that two independent days ' +
        'stand on each side of the comparison.' + tail;
      return;
    }
    var flat = Math.abs(t.delta) < Math.pow(10, -m.dp) / 2;
    var better = m.lower ? t.delta < 0 : t.delta > 0;
    var word = flat ? 'unchanged' : better ? 'toward your goal' : 'away from your goal';
    el.innerHTML = 'Across ' + plural(t.days, 'measured day') + ', ' + m.label.toLowerCase() +
      ' went from ' + t.from.toFixed(m.dp) + m.unit + ' to ' + t.to.toFixed(m.dp) + m.unit +
      ' (' + (t.delta >= 0 ? '+' : '') + t.delta.toFixed(m.dp) + m.unit + ') ' +
      '<span class="' + (flat ? '' : better ? 'ok' : 'no') + '">' + word + '</span>' +
      '. Each end is the median of ' + t.span + ' days.' + tail;
  }

  return {
    html: html,
    mount: function () {
      cv = document.getElementById('progCanvas');
      g = cv.getContext('2d');
      draw();
      Array.prototype.forEach.call(document.querySelectorAll('#metricRow button'), function (b) {
        b.onclick = function () {
          sel = b.dataset.metric;
          Array.prototype.forEach.call(document.querySelectorAll('#metricRow button'), function (o) {
            o.className = o === b ? 'primary' : '';
          });
          draw();
        };
      });
      document.getElementById('clearHist').onclick = function () {
        if (!confirm('Delete all ' + history.length + ' saved takes? Your calibration is kept.')) return;
        clearHistory();
        openExercise('progress');
      };
      onResize = function () { draw(); };
      window.addEventListener('resize', onResize);
    },
    abort: function () {
      if (onResize) window.removeEventListener('resize', onResize);
      onResize = null;
    }
  };
}

function takeTable() {
  var t = pitchTarget();
  var rows = history.slice().reverse().map(function (h) {
    function cell(v, dp, unit) {
      return '<td class="num">' + (v == null ? '—' : v.toFixed(dp) + unit) + '</td>';
    }
    return '<tr><td class="num">' + shortDate(h.t) + '</td>' +
      '<td>' + (KIND_LABEL[h.kind] || h.kind) + '</td>' +
      '<td class="num' + (t && h.f0 != null && h.f0 <= t.hz * 1.06 ? ' ok' : '') + '">' +
        (h.f0 == null ? '—' : h.f0.toFixed(0) + ' Hz') + '</td>' +
      cell(h.res, 1, ' cm') +
      cell(h.sd, 1, ' st') +
      (h.weight != null && base.weight != null
        ? '<td class="num">' + (h.weight - base.weight >= 0 ? '+' : '') +
          (h.weight - base.weight).toFixed(1) + '</td>'
        : '<td class="num">—</td>') +
      '</tr>';
  });
  // Six columns do not fit a phone; the table scrolls inside its own box
  // rather than dragging the page sideways.
  return '<div class="tscroll"><table><tr><th>When</th><th>Take</th><th>Pitch</th><th>Resonance</th>' +
    '<th>Intonation</th><th>Weight</th></tr>' + rows.join('') + '</table></div>';
}

function shortDate(ms) {
  var d = new Date(ms);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

// The chart axis spans weeks, where the time of day is noise. The take table
// still wants it, since two takes on one day are two rows there.
function dayLabel(ms) {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
