import { EXERCISES } from '../exercises/registry.js';
import { ROUTINE, doneToday, progress } from './state.js';
import { history } from '../store/history.js';
import { median } from '../util/stats.js';

// --- the end of a day's practice ------------------------------------------
//
// Shown once, when the goal is met. Its job is to answer "did any of that
// work" with the only evidence there is — today's scored takes against the
// last day you scored any — and then get out of the way. It reports whatever
// the numbers say, including that they went the wrong way: a summary that can
// only deliver good news is not worth reading.

function dayKeyOf(ts) {
  var d = new Date(ts);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

// Median of a metric over the takes of one day. `passageOnly` metrics are
// restricted the same way the progress charts restrict them, because
// resonance is only comparable across the same text.
function dayMedian(takes, key, passageOnly) {
  var v = takes.filter(function (h) {
    return h[key] != null && (!passageOnly || h.kind === 'passage' || h.kind === 'calibration');
  }).map(function (h) { return h[key]; });
  return v.length ? median(v) : null;
}

function summaryDeltas() {
  var t = progress.day;
  var byDay = {};
  history.forEach(function (h) { (byDay[dayKeyOf(h.t)] = byDay[dayKeyOf(h.t)] || []).push(h); });
  var days = Object.keys(byDay).sort();
  var prev = null;
  for (var i = days.length - 1; i >= 0; i--) { if (days[i] < t) { prev = days[i]; break; } }
  if (!byDay[t] || !prev) return null;

  // `lower` says which direction is an improvement for that measure.
  var rows = [
    { label: 'Pitch', key: 'f0', unit: ' Hz', dp: 0, lower: true },
    { label: 'Resonance', key: 'res', unit: ' cm', dp: 1, lower: false, passageOnly: true },
    { label: 'Intonation', key: 'sd', unit: ' st', dp: 1, lower: true },
    { label: 'Weight', key: 'weight', unit: '', dp: 1, lower: false }
  ].map(function (m) {
    var now = dayMedian(byDay[t], m.key, m.passageOnly);
    var was = dayMedian(byDay[prev], m.key, m.passageOnly);
    if (now == null || was == null) return null;
    var d = now - was;
    return {
      label: m.label,
      now: now.toFixed(m.dp) + m.unit,
      delta: (d >= 0 ? '+' : '') + d.toFixed(m.dp) + m.unit,
      // A change too small to print is called flat rather than dressed up as
      // movement in whichever direction the noise happened to fall.
      dir: Math.abs(d) < Math.pow(10, -m.dp) / 2 ? 'flat' : (m.lower ? d < 0 : d > 0) ? 'up' : 'down'
    };
  }).filter(Boolean);

  return rows.length ? { prev: prev, rows: rows } : null;
}

export function showSummary() {
  var ids = doneToday();
  var earned = ids.reduce(function (s, id) { return s + progress.done[id]; }, 0);
  var cmp = summaryDeltas();

  var titles = {};
  EXERCISES.forEach(function (e) { titles[e.id] = e.title.replace(/^\d+\.\s*/, ''); });

  var body =
    '<div class="sum-head">' +
      '<div class="eb"><i>DAY</i>' + progress.day + '<s></s></div>' +
      '<h3>Practice done for today</h3>' +
      '<div class="sum-stats">' +
        '<div><b>' + progress.streak + '</b><span>day streak' +
          (progress.best > progress.streak ? ' · best ' + progress.best : '') + '</span></div>' +
        '<div><b>' + ids.length + '</b><span>of ' + ROUTINE.length + ' steps</span></div>' +
        '<div><b>+' + earned + '</b><span>XP today</span></div>' +
      '</div>' +
    '</div>' +
    '<ul class="sum-steps">' + ids.map(function (id) {
      return '<li><span>' + titles[id] + '</span><em>+' + progress.done[id] + '</em></li>';
    }).join('') + '</ul>' +
    (cmp
      ? '<table class="sum-cmp"><tr><th>Measure</th><th>Today</th><th>vs ' + cmp.prev + '</th></tr>' +
        cmp.rows.map(function (r) {
          return '<tr><td>' + r.label + '</td><td class="num">' + r.now +
            '</td><td class="num d-' + r.dir + '">' + r.delta + '</td></tr>';
        }).join('') + '</table>'
      : '<p class="hint" style="margin-top:14px">No earlier scored day to compare against yet. ' +
        'Score a <b>reading passage</b> on two different days and this becomes a comparison.</p>') +
    '<p class="hint">Day-to-day movement in these is mostly noise — sleep, hydration, time of day. ' +
    'The trend over weeks in <b>Progress</b> is the thing that means something.</p>' +
    '<div class="row"><button class="primary" id="sumClose">Done</button></div>';

  var wrap = document.createElement('div');
  wrap.className = 'sum-back';
  wrap.innerHTML = '<div class="sum card" role="dialog" aria-modal="true" aria-label="Practice summary">' +
    body + '</div>';
  document.body.appendChild(wrap);

  function close() {
    wrap.remove();
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  wrap.querySelector('#sumClose').onclick = close;
  wrap.onclick = function (e) { if (e.target === wrap) close(); };
  document.addEventListener('keydown', onKey);
  wrap.querySelector('#sumClose').focus();
}
