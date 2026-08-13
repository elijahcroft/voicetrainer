// test-focus.mjs — conservative, stable daily coaching.
// Run: node test-focus.mjs
import { recommendFocus } from './src/progress/focus.js';

let pass = 0, fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log('ok   ' + name + (extra ? '   ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra ? '   ' + extra : '')); }
}
function eq(name, got, want) {
  ok(name, Object.is(got, want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
}

const before = '2026-08-12';
const base = { resonance: 10, intonationSd: 2 };
const target = { hz: 130, noHeadroom: false };
function at(day) { return new Date(day + 'T12:00:00').getTime(); }
function take(day, kind, values = {}) {
  return Object.assign({ t: at(day), kind, f0: 130, res: 11, sd: 2 }, values);
}
function twoDays(values1, values2) {
  return [take('2026-08-10', 'passage', values1), take('2026-08-11', 'passage', values2)];
}

{
  const focus = recommendFocus([], base, target, before);
  eq('no history keeps the standard plan', focus.kind, 'standard');
  eq('a daily plan always contains five steps', focus.steps.length, 5);
  eq('every plan starts with the low-strain warm-up', focus.steps[0], 'straw');
  ok('every plan ends in both transfer checks', focus.steps.slice(-2).join(',') === 'passage,free');
}
{
  const focus = recommendFocus([take('2026-08-11', 'passage', { f0: 180 })], base, target, before);
  eq('one bad day cannot specialize the plan', focus.kind, 'standard');
}
{
  const takes = twoDays({ f0: 155 }, { f0: 158 });
  // A terrible current-day take is ignored: it may have been produced after
  // the user had already begun the plan this function is supposed to hold.
  takes.push(take('2026-08-12', 'passage', { f0: 240, res: 5, sd: 9 }));
  const focus = recommendFocus(takes, base, target, before);
  eq('pitch above target on two completed days selects pitch work', focus.kind, 'pitch');
  ok('today cannot change today’s recommendation', !/240/.test(focus.reason));
}
{
  const focus = recommendFocus(twoDays({ res: 9.1 }, { res: 9.2 }), base, target, before);
  eq('a sustained resonance gap selects resonance work', focus.kind, 'resonance');
  ok('resonance plan isolates and then transfers the skill',
    focus.steps.includes('yawn') && focus.steps.includes('ladder'));
}
{
  const focus = recommendFocus(twoDays({ sd: 3.5 }, { sd: 3.7 }), base, target, before);
  eq('wide pitch spread selects endings work', focus.kind, 'intonation');
  ok('intonation plan includes statement endings', focus.steps.includes('endings'));
}
{
  const takes = twoDays({}, {});
  takes.push(take('2026-08-10', 'free', { f0: 150 }));
  takes.push(take('2026-08-11', 'free', { f0: 152 }));
  const focus = recommendFocus(takes, base, target, before);
  eq('a repeated reading-to-conversation gap selects carryover', focus.kind, 'carryover');
}
{
  const focus = recommendFocus(twoDays({}, {}), base, target, before);
  eq('measurements inside quiet thresholds stay balanced', focus.kind, 'standard');
}
{
  const noHeadroom = { hz: 165, noHeadroom: true };
  const focus = recommendFocus(twoDays({ f0: 190 }, { f0: 192 }), base, noHeadroom, before);
  ok('no-headroom calibration never prescribes pitch lowering', focus.kind !== 'pitch');
}
{
  const manyRetries = [
    take('2026-08-10', 'passage', { f0: 130 }),
    take('2026-08-10', 'passage', { f0: 130 }),
    take('2026-08-10', 'passage', { f0: 220 }),
    take('2026-08-11', 'passage', { f0: 130 })
  ];
  const focus = recommendFocus(manyRetries, base, target, before);
  eq('retries are collapsed to one median per day', focus.kind, 'standard');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
