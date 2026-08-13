import { MAX_FOCUS_DAYS, MIN_FOCUS_DAYS, dayKey } from './focus.js';
import { median } from '../util/stats.js';

// --- reading history as days ----------------------------------------------
//
// The coach in focus.js already refuses to read a single take: it collapses
// history to one median per calendar day before it decides anything, because
// a take is mostly a reading of sleep, hydration, room and microphone
// position. The progress chart was not doing the same. It plotted every take
// evenly spaced by index, so six retries in one afternoon took up as much of
// the line as six weeks of practice, and the shape of the line said nothing
// about how fast anything was moving.
//
// Pure on purpose, like recommendFocus: these take a take list and return
// numbers, so the tests can exercise them without localStorage or a canvas.

// A trend needs two independent days on each side of the comparison. One day
// against one day is exactly the noise the coach declines to act on.
export var MIN_TREND_DAYS = 2 * MIN_FOCUS_DAYS;

// One point per calendar day, oldest first.
export function dailyMedians(takes, key) {
  var byDay = {};
  (takes || []).forEach(function (take) {
    if (!take || take[key] == null) return;
    var day = dayKey(take.t);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(take);
  });
  return Object.keys(byDay).sort().map(function (day) {
    var group = byDay[day];
    var sum = group.reduce(function (acc, take) { return acc + take.t; }, 0);
    return {
      day: day,
      // The day's own centre of mass, so a day holding a single take sits at
      // the time that take was actually made rather than at an invented noon.
      t: sum / group.length,
      value: median(group.map(function (take) { return take[key]; })),
      n: group.length
    };
  });
}

// Early days against late days, never overlapping, each side capped at the
// same five-day window the coach reads. The middle day of an odd number of
// days belongs to neither side rather than to both.
export function trend(days) {
  if (!days || days.length < MIN_TREND_DAYS) return null;
  var half = Math.min(Math.floor(days.length / 2), MAX_FOCUS_DAYS);
  var early = days.slice(0, half);
  var late = days.slice(days.length - half);
  var from = median(early.map(function (d) { return d.value; }));
  var to = median(late.map(function (d) { return d.value; }));
  return {
    from: from,
    to: to,
    delta: to - from,
    days: days.length,
    span: half
  };
}
