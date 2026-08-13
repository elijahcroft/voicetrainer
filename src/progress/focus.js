import { RESONANCE_GOAL } from '../constants.js';
import { median } from '../util/stats.js';

// --- today's focus --------------------------------------------------------
//
// A single take is mostly a reading of sleep, hydration, room and microphone
// position. Coaching only starts after the same passage has been measured on
// two completed calendar days, and it works from one median per day so doing
// six retries in an afternoon cannot outweigh a different day.

export var MIN_FOCUS_DAYS = 2;
export var MAX_FOCUS_DAYS = 5;

var PLANS = {
  standard: ['straw', 'onset', 'ladder', 'passage', 'free'],
  pitch: ['straw', 'vowels', 'glide', 'passage', 'free'],
  resonance: ['straw', 'yawn', 'ladder', 'passage', 'free'],
  intonation: ['straw', 'onset', 'endings', 'passage', 'free'],
  carryover: ['straw', 'ladder', 'endings', 'passage', 'free']
};

export function dayKey(ts) {
  var d = new Date(ts);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' +
    ('0' + d.getDate()).slice(-2);
}

function groupedDays(takes, beforeDay) {
  var grouped = {};
  (takes || []).forEach(function (take) {
    if (!take || (take.kind !== 'passage' && take.kind !== 'free')) return;
    var day = dayKey(take.t);
    // Today's plan is made from yesterday's evidence. Excluding the current
    // day is what keeps the recommendation from changing halfway through the
    // session when its passage and free-speech takes are saved.
    if (day >= beforeDay) return;
    if (!grouped[day]) grouped[day] = { day: day, passage: [], free: [] };
    grouped[day][take.kind].push(take);
  });
  return Object.keys(grouped).sort().map(function (day) { return grouped[day]; });
}

function takeMedian(takes, key) {
  var values = takes.filter(function (take) { return take[key] != null; })
    .map(function (take) { return take[key]; });
  return values.length ? median(values) : null;
}

function dailyMetric(days, kind, key) {
  return days.map(function (day) { return takeMedian(day[kind], key); })
    .filter(function (value) { return value != null; });
}

function recent(values) { return values.slice(-MAX_FOCUS_DAYS); }

function result(kind, title, reason, days, evidence) {
  return {
    kind: kind,
    title: title,
    reason: reason,
    steps: PLANS[kind].slice(),
    evidenceDays: days,
    evidence: evidence
  };
}

// Pure on purpose: tests can give this a take history and a calibration
// without localStorage or the DOM. `target` is the object returned by
// pitchTarget(), including its noHeadroom refusal.
export function recommendFocus(takes, calibration, target, beforeDay) {
  calibration = calibration || {};
  beforeDay = beforeDay || dayKey(Date.now());
  var days = groupedDays(takes, beforeDay);
  var passageDays = days.filter(function (day) { return day.passage.length; });
  var n = passageDays.length;

  if (n < MIN_FOCUS_DAYS) {
    return result('standard', 'Build a reliable baseline',
      'Use a balanced session for now. Comparable passage takes on two different days are ' +
      'needed before one noisy take is allowed to steer your practice.', n,
      n + ' of ' + MIN_FOCUS_DAYS + ' measured passage days');
  }

  var candidates = [];
  var targetHz = target && target.hz;
  var pitchValues = recent(dailyMetric(passageDays, 'passage', 'f0'));
  if (targetHz && !target.noHeadroom && pitchValues.length >= MIN_FOCUS_DAYS) {
    var pitch = median(pitchValues);
    var pitchGap = (pitch - targetHz) / targetHz;
    // The passage itself calls anything within 6% on target. The coach uses
    // that same boundary instead of inventing a stricter second opinion.
    if (pitchGap > 0.06) candidates.push({
      kind: 'pitch', score: (pitchGap - 0.06) / 0.12,
      title: 'Settle into the target pitch',
      reason: 'Your recent passage median is ' + pitch.toFixed(0) + ' Hz, against a ' +
        'target of ' + targetHz.toFixed(0) + ' Hz. Sustained starts and a fresh floor check are ' +
        'the most direct work for that gap.'
    });
  }

  var resValues = recent(dailyMetric(passageDays, 'passage', 'res'));
  if (calibration.resonance && resValues.length >= MIN_FOCUS_DAYS) {
    var res = median(resValues);
    var resGoal = calibration.resonance * RESONANCE_GOAL;
    var resGap = (resGoal - res) / resGoal;
    // Strict resonance is about 5% noisy even under controlled synthetic
    // tests. Four percent is deliberately quiet and the score below still
    // makes a much larger miss outrank one sitting on that edge.
    if (resGap > 0.04) candidates.push({
      kind: 'resonance', score: (resGap - 0.04) / 0.10,
      title: 'Lead with resonance',
      reason: 'Your recent comparable passages read ' + res.toFixed(1) + ' cm, against a ' +
        resGoal.toFixed(1) + ' cm goal. Yawn-sighs isolate that dimension, and the resonance ' +
        'ladder carries it into speech without asking the pitch to go lower.'
    });
  }

  var sdValues = recent(dailyMetric(passageDays, 'passage', 'sd'));
  if (calibration.intonationSd && sdValues.length >= MIN_FOCUS_DAYS) {
    var sd = median(sdValues);
    var sdGap = (sd - calibration.intonationSd) / calibration.intonationSd;
    if (sdGap > 0.15) candidates.push({
      kind: 'intonation', score: (sdGap - 0.15) / 0.50,
      title: 'Make the endings deliberate',
      reason: 'Pitch spread in recent passages is ' + sd.toFixed(1) + ' st, against your ' +
        'calibration of ' + calibration.intonationSd.toFixed(1) + ' st. Work on clean statement ' +
        'landings, then carry them into connected speech.'
    });
  }

  // Carryover is only compared inside a day that contains both kinds. That
  // controls for much of the day-to-day voice variation, and it never treats
  // free-speech resonance as comparable to the fixed passage.
  var carryGaps = recent(days.map(function (day) {
    var passage = takeMedian(day.passage, 'f0');
    var free = takeMedian(day.free, 'f0');
    return passage != null && free != null ? free - passage : null;
  }).filter(function (value) { return value != null; }));
  if (targetHz && carryGaps.length >= MIN_FOCUS_DAYS) {
    var carry = median(carryGaps);
    var carryGap = carry / targetHz;
    if (carryGap > 0.06) candidates.push({
      kind: 'carryover', score: (carryGap - 0.06) / 0.12,
      title: 'Carry the voice into conversation',
      reason: 'Across matched practice days, free speech sat ' + carry.toFixed(0) +
        ' Hz above reading. Rehearse the starts and endings, then spend the session moving them ' +
        'into a real-life speaking situation.'
    });
  }

  if (!candidates.length) {
    return result('standard', 'Keep the work balanced',
      'Recent passage medians are inside the coach’s conservative thresholds. Maintain the skill ' +
      'with a balanced session instead of chasing smaller day-to-day changes.', n,
      'Built from ' + Math.min(n, MAX_FOCUS_DAYS) + ' recent passage days');
  }

  candidates.sort(function (a, b) { return b.score - a.score; });
  var best = candidates[0];
  return result(best.kind, best.title, best.reason, n,
    'Built from ' + Math.min(n, MAX_FOCUS_DAYS) + ' recent passage days');
}
