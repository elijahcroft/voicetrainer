/* test-strain.mjs — the session voice-quality monitor.
 *
 * This is the only thing in the tool that can interrupt you, so what it must
 * be tested for is mostly *silence*: it has to stay quiet on short samples, on
 * ordinary variation, and whenever the comparison it would be making is not a
 * fair one. Firing late is a cost. Firing wrongly is the failure that would
 * make every later warning ignorable.
 *
 * Run: node test-strain.mjs
 */
import { pushStrain, resetStrain, strainState, strainWarning } from './src/analysis/strain.js';
import { CPP_DROP_DB, CPP_F0_GATE_HZ, CPP_HOLD_MS, CPP_MIN_MS, CPP_REF_MS } from './src/constants.js';

let passed = 0;
let failed = 0;

function check(name, ok, detail) {
  if (ok) { passed++; console.log(`  ok   ${name}${detail ? '  (' + detail + ')' : ''}`); }
  else { failed++; console.log(`  FAIL ${name}${detail ? '  (' + detail + ')' : ''}`); }
}

const FRAME_MS = 16;   // ~60 fps, the analysis grid the engine holds

// Feed `ms` of voiced speech at a given quality and pitch, starting at `t`.
// Returns the timestamp it got to, so runs can be chained.
function speak(t, ms, cpp, f0, opts = {}) {
  const end = t + ms;
  let i = 0;
  for (; t < end; t += FRAME_MS, i++) {
    // A little alternation, so nothing passes only because every frame is
    // identical — medians over a constant are not a real test of a median.
    const jitter = (i % 3) - 1;
    pushStrain({ voiced: true, cpp: cpp + jitter * (opts.spread ?? 0.4), f0: f0 + jitter },
      t, FRAME_MS);
  }
  return t;
}

function silence(t, ms) {
  const end = t + ms;
  for (; t < end; t += FRAME_MS) pushStrain({ voiced: false, cpp: null, f0: null }, t, FRAME_MS);
  return t;
}

console.log('\nThe reference window');
{
  resetStrain();
  let t = speak(0, CPP_REF_MS / 2, 20, 120);
  check('no reference before enough voiced time', strainState().ref === null);
  check('and no warning while there is nothing to compare against', !strainWarning());

  t = speak(t, CPP_REF_MS, 20, 120);
  check('reference closes once the voiced time is there', strainState().ref != null,
    `${strainState().ref?.cpp?.toFixed(1)} dB at ${strainState().ref?.f0?.toFixed(0)} Hz`);

  // Unvoiced frames must not count toward it — a long pause is not practice.
  resetStrain();
  silence(0, CPP_REF_MS * 2);
  check('silence never establishes a reference', strainState().ref === null);
}

console.log('\nWhen it fires');
{
  resetStrain();
  let t = speak(0, CPP_REF_MS + 1000, 20, 120);
  t = speak(t, CPP_MIN_MS + 2000, 20 - CPP_DROP_DB - 2, 120);
  check('the decline must outlast the hold before it fires', !strainWarning(),
    'the window has filled and the drop is real, but it has not persisted yet');
  t = speak(t, CPP_HOLD_MS + 2000, 20 - CPP_DROP_DB - 2, 120);
  check('a sustained decline past the threshold fires', strainWarning(),
    `${CPP_DROP_DB + 2} dB below the session reference, held past ${CPP_HOLD_MS / 1000} s`);

  // Latched: it does not go away because you managed a clean sentence.
  t = speak(t, 20000, 24, 120);
  check('and stays fired once it has', strainWarning());

  resetStrain();
  check('reset clears it', !strainWarning() && strainState().ref === null);
}

console.log('\nWhen it stays quiet');
{
  resetStrain();
  let t = speak(0, CPP_REF_MS + 1000, 20, 120);
  t = speak(t, CPP_MIN_MS + CPP_HOLD_MS + 10000, 20, 120);
  check('steady voice quality raises nothing', !strainWarning());

  resetStrain();
  t = speak(0, CPP_REF_MS + 1000, 20, 120);
  t = speak(t, CPP_MIN_MS + CPP_HOLD_MS + 10000, 20 - (CPP_DROP_DB - 1.5), 120);
  check('a decline smaller than the threshold raises nothing', !strainWarning(),
    `${CPP_DROP_DB - 1.5} dB is under the ${CPP_DROP_DB} dB mark`);

  resetStrain();
  t = speak(0, CPP_REF_MS + 1000, 20, 120);
  t = speak(t, CPP_MIN_MS / 3, 10, 120);
  check('a short rough patch is not a trend', !strainWarning(),
    `${(CPP_MIN_MS / 3 / 1000).toFixed(1)} s of much rougher voice, below the ${CPP_MIN_MS / 1000} s minimum`);

  // The confound: CPP moves with pitch, so a big pitch change makes the
  // comparison meaningless and the answer must be no answer.
  resetStrain();
  t = speak(0, CPP_REF_MS + 1000, 20, 180);
  t = speak(t, CPP_MIN_MS + 2000, 20 - CPP_DROP_DB - 2, 180 - CPP_F0_GATE_HZ - 20);
  check('a large pitch change means no verdict, not a warning', !strainWarning(),
    `pitch moved ${CPP_F0_GATE_HZ + 20} Hz, gate is ${CPP_F0_GATE_HZ} Hz`);

  // ...but a small one, inside the gate, must not be an escape hatch.
  resetStrain();
  t = speak(0, CPP_REF_MS + 1000, 20, 180);
  t = speak(t, CPP_MIN_MS + CPP_HOLD_MS + 4000, 20 - CPP_DROP_DB - 2, 180 - (CPP_F0_GATE_HZ - 5));
  check('a small pitch change still lets it fire', strainWarning(),
    `pitch moved ${CPP_F0_GATE_HZ - 5} Hz, inside the gate`);

  resetStrain();
  t = speak(0, CPP_REF_MS + 1000, 20, 120);
  t = silence(t, 60000);
  check('a long silence alone never fires it', !strainWarning());
}

console.log('\nThe rolling window forgets');
{
  // A bad patch that has scrolled out of the window must not still be counted.
  resetStrain();
  let t = speak(0, CPP_REF_MS + 1000, 20, 120);
  t = speak(t, 6000, 5, 120);                    // rough, but short
  t = speak(t, CPP_MIN_MS + 30000, 20, 120);     // then a long clean stretch
  check('an old rough patch scrolls out of the comparison', !strainWarning(),
    `window holds ${(strainState().windowMs / 1000).toFixed(0)} s`);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
