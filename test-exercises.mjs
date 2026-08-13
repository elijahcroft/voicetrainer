// test-exercises.mjs — rules promised by the rewritten exercise copy.
import './test-dom-stub.mjs';
import { MIN_VOICED_MS_FREE } from './src/constants.js';
import { floorFromGlides } from './src/exercises/glide.js';
import { EXERCISES, STATEMENTS } from './src/exercises/registry.js';
import { ROUTINE } from './src/progress/state.js';

let pass = 0, fail = 0;
function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log('ok   ' + name + (detail ? '   ' + detail : '')); }
  else { fail++; console.log('FAIL ' + name + (detail ? '   ' + detail : '')); }
}
function eq(name, got, want) {
  ok(name, Object.is(got, want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
}

eq('free speech requires 30 seconds of voiced speech', MIN_VOICED_MS_FREE, 30000);
eq('statement drill contains the promised eight prompts', STATEMENTS.length, 8);
ok('a single glide cannot establish a floor', floorFromGlides([82]) == null);
ok('three glides still cannot establish a floor', floorFromGlides([82, 79, 120]) == null);
eq('four glide bottoms use the median, not the lowest outlier',
  floorFromGlides([82, 80, 79, 45]), 79.5);
ok('the routine includes both new drills', ROUTINE.includes('onset') && ROUTINE.includes('ladder'));
ok('both new drills have registered screens',
  EXERCISES.some(e => e.id === 'onset') && EXERCISES.some(e => e.id === 'ladder'));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
