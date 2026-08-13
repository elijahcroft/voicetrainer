// test-trend.mjs — how the progress chart reads history as days.
// Run: node test-trend.mjs
//
// The chart used to plot takes evenly spaced by index and summarise the first
// take against the last. Both of those let one afternoon of retries speak as
// loudly as weeks of practice, which is exactly what the coach in focus.js
// refuses to do. These tests pin the two properties that fix it: a day is one
// point however many takes it holds, and no direction is stated until there
// are enough independent days to state one.
import { MIN_TREND_DAYS, dailyMedians, trend } from './src/progress/trend.js';

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log('ok   ' + name + (extra ? '   ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra ? '   ' + extra : '')); }
}
function eq(name, got, want) {
  ok(name, got === want, 'got ' + got + ' want ' + want);
}

// Local noon on a given day offset, so these cases cannot straddle a local
// midnight and turn one day into two on whatever machine runs them.
const DAY = 86400000;
const noon = new Date(2026, 0, 5, 12, 0, 0).getTime();
const at = (day, hour = 12) => noon + day * DAY + (hour - 12) * 3600000;
const take = (day, f0, hour = 12) => ({ t: at(day, hour), kind: 'passage', f0 });

// --- one point per day ----------------------------------------------------

eq('an afternoon of six retries is one day, not six points',
  dailyMedians([0, 1, 2, 3, 4, 5].map(h => take(0, 150, 9 + h)), 'f0').length, 1);

eq('...and that point is their median, not their last',
  dailyMedians([take(0, 200, 9), take(0, 150, 10), take(0, 148, 11)], 'f0')[0].value, 150);

eq('a take missing the metric does not create a day',
  dailyMedians([take(0, 150), { t: at(1), kind: 'passage', f0: null }], 'f0').length, 1);

// The x position of a day has to be a time inside that day, or the point is
// drawn somewhere its takes never happened.
const oneTake = dailyMedians([take(3, 150, 8)], 'f0')[0];
eq('a day holding one take sits at that take\'s own time', oneTake.t, at(3, 8));

const spread = dailyMedians([take(0, 150, 8), take(0, 150, 16)], 'f0')[0];
ok('a day holding several sits between the first and the last',
  spread.t > at(0, 8) && spread.t < at(0, 16));

eq('days come back oldest first',
  dailyMedians([take(2, 150), take(0, 160), take(1, 155)], 'f0')
    .map(d => d.value).join(','), '160,155,150');

// --- refusing to call a trend ---------------------------------------------

const flat = n => dailyMedians(Array.from({ length: n }, (_, i) => take(i, 150)), 'f0');

for (let n = 0; n < MIN_TREND_DAYS; n++) {
  eq('no trend from ' + n + ' day(s)', trend(flat(n)), null);
}
ok('a trend appears at ' + MIN_TREND_DAYS + ' days', trend(flat(MIN_TREND_DAYS)) !== null);

// The whole point of the rewrite: a single day cannot manufacture a trend by
// holding a lot of takes.
eq('twenty takes in one day still cannot make a trend',
  trend(dailyMedians(Array.from({ length: 20 }, (_, i) => take(0, 150 + i, 8 + i * 0.5)), 'f0')),
  null);

// --- what the trend compares ----------------------------------------------

// Four days: 160, 158, 142, 140. Early median 159, late median 141.
const falling = trend(dailyMedians(
  [take(0, 160), take(1, 158), take(2, 142), take(3, 140)], 'f0'));
eq('early and late sides do not overlap', falling.span, 2);
eq('the early side is the median of the first days', falling.from, 159);
eq('the late side is the median of the last days', falling.to, 141);
eq('and the delta runs early to late', falling.delta, -18);

// Five days: the middle one belongs to neither side rather than to both.
const odd = trend(dailyMedians(
  [take(0, 160), take(1, 160), take(2, 999), take(3, 140), take(4, 140)], 'f0'));
eq('an odd number of days drops the middle one', odd.from + ':' + odd.to, '160:140');

// One wild day on the end is outvoted by the days beside it, which is the
// reason for a median of five rather than the last reading.
const noisy = trend(dailyMedians(
  [take(0, 160), take(1, 160), take(2, 160), take(3, 160), take(4, 160), take(5, 160),
   take(6, 140), take(7, 140), take(8, 140), take(9, 140), take(10, 260)], 'f0'));
eq('a single bad day cannot swing the late side', noisy.to, 140);

// Long histories stay on the five-day window the coach reads.
const long = trend(dailyMedians(
  Array.from({ length: 40 }, (_, i) => take(i, 150)), 'f0'));
eq('each side is capped at five days', long.span, 5);
eq('...while the day count still reports the whole history', long.days, 40);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
