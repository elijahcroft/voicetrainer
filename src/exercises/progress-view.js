import { RAMP, RESONANCE_GOAL } from '../constants.js';
import { openExercise } from './registry.js';
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
      '<p class="why">Every scored take, oldest first. Practice moves slowly and unevenly — a single ' +
      'take says almost nothing, and the line across a few weeks says everything. Nothing here is ' +
      'uploaded; only the medians and the date are kept, in this browser.</p>' +
      '<div class="row" id="metricRow" style="margin-top:0">' +
        metrics.map(function (m) {
          return '<button data-metric="' + m.id + '"' + (m.id === sel ? ' class="primary"' : '') +
            '>' + m.label + '</button>';
        }).join('') +
      '</div>' +
      '<canvas id="progCanvas" class="trace" style="height:230px;margin-top:14px" role="img" ' +
        'aria-label="Scored takes over time"></canvas>' +
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
    function x(i) {
      return pts.length === 1 ? padL + (w - padL - padR) / 2
        : padL + i / (pts.length - 1) * (w - padL - padR);
    }
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

    g.strokeStyle = 'rgba(212,59,122,.75)'; g.lineWidth = 2;
    g.beginPath();
    pts.forEach(function (p, i) {
      var xx = x(i), yy = y(p[m.id]);
      if (i) g.lineTo(xx, yy); else g.moveTo(xx, yy);
    });
    g.stroke();

    pts.forEach(function (p, i) {
      g.fillStyle = KIND_COLOR[p.kind] || RAMP.signal;
      g.beginPath(); g.arc(x(i), y(p[m.id]), 3.5, 0, Math.PI * 2); g.fill();
    });

    g.fillStyle = 'rgba(143,151,173,.75)';
    g.fillText(shortDate(pts[0].t), padL, h - 6);
    if (pts.length > 1) {
      var last = shortDate(pts[pts.length - 1].t);
      g.fillText(last, w - padR - g.measureText(last).width, h - 6);
    }

    summarise(m, pts);
  }

  // Change since the first take, stated in the direction that is actually an
  // improvement for the metric — "down 11 Hz" is progress, "down 0.4 cm" is not.
  function summarise(m, pts) {
    var el = document.getElementById('progSummary');
    if (pts.length < 2) {
      el.innerHTML = 'One take so far. A second one gives you a line.';
      return;
    }
    var first = pts[0][m.id], last = pts[pts.length - 1][m.id];
    var d = last - first;
    var better = m.lower ? d < 0 : d > 0;
    var word = Math.abs(d) < Math.pow(10, -m.dp) / 2 ? 'unchanged' :
      (better ? 'toward your goal' : 'away from your goal');
    el.innerHTML = pts.length + ' takes since ' + shortDate(pts[0].t) + '. ' +
      m.label + ' ' + (d >= 0 ? '+' : '') + d.toFixed(m.dp) + m.unit +
      ' <span class="' + (word === 'unchanged' ? '' : better ? 'ok' : 'no') + '">' + word + '</span>' +
      (m.passageOnly ? ' — free-speech takes are left out, since resonance only compares on the same text.' : '');
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
