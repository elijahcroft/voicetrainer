// test-endings.mjs — the statement-endings measurement, against synthetic
// sentences of known shape.  Run: node test-endings.mjs
//
// The measurement lives in index.html because it is bound up with the
// exercise UI, so this pulls the four functions it needs out of that file
// rather than keeping a copy that could drift away from what ships.  The
// synthetic sentences are the cases the first version of this drill got wrong:
// a rise that starts *below* the body of the sentence, and an ending that never
// stops being voiced.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'index.html'), 'utf8');

function grab(name, kind = 'function') {
  const start = html.indexOf(`${kind} ${name}(`);
  if (start < 0) throw new Error('not found: ' + name);
  let i = html.indexOf('{', start), depth = 0;
  for (let j = i; j < html.length; j++) {
    if (html[j] === '{') depth++;
    else if (html[j] === '}' && --depth === 0) return html.slice(start, j + 1);
  }
  throw new Error('unbalanced: ' + name);
}
const consts = [...html.matchAll(/^  var (PHRASE_GAP_MS|MIN_PHRASE_MS|FINAL_SCAN_MS|SYLLABLE_DIP|CONTOUR_MIN_MS|TERMINAL_ST|HOLD_LONG_MS|SMOOTH_HALF_MS) = [^;]+;/gm)]
  .map(m => m[0]).join('\n');
const src = [consts, grab('median'), grab('medianFilter'), grab('findFinalSyllable'), grab('contourDelta')].join('\n\n');
const { findFinalSyllable, contourDelta, medianFilter, SMOOTH_HALF_MS, C } = new Function(src +
  '\nreturn { findFinalSyllable, contourDelta, medianFilter, SMOOTH_HALF_MS,' +
  '         C: { HOLD_LONG_MS, TERMINAL_ST, PHRASE_GAP_MS } };')();

const FRAME = 16.7;
const hzToSemitones = hz => 12 * Math.log2(hz / 55);

// A syllable: `ms` long, pitch gliding f0a->f0b, loudness rising then falling
// so the envelope has the dip at the boundary that real speech has.
function syl(ms, f0a, f0b, peak = 0.09) {
  const n = Math.round(ms / FRAME), out = [];
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : i / (n - 1);
    out.push({ st: hzToSemitones(f0a + (f0b - f0a) * u), rms: peak * Math.sin(Math.PI * u) ** 0.6 });
  }
  return out;
}
const gap = (ms, rms = 0.004) =>
  Array.from({ length: Math.round(ms / FRAME) }, () => ({ st: null, rms }));

function stamp(frames) {          // give the frames monotonic timestamps
  return frames.map((f, i) => ({ ...f, t: 1000 + i * FRAME }));
}
function score(frames) {
  const raw = stamp(frames);
  // The drill de-spikes the phrase before scoring it, so the test does too.
  const st = medianFilter(raw, p => p.st, SMOOTH_HALF_MS);
  const pts = raw.map((p, i) => ({ t: p.t, st: st[i], rms: p.rms }));
  const syl_ = findFinalSyllable(pts);
  if (!syl_) return null;
  const delta = contourDelta(pts, syl_.start, syl_.end);
  return {
    delta,
    hold: syl_.found ? syl_.end - syl_.start : null,
    dir: delta >= C.TERMINAL_ST ? 'rise' : delta <= -C.TERMINAL_ST ? 'fall' : 'flat'
  };
}

// "I finished it this morning." — four syllables of body, then the ending.
const body = [
  ...syl(180, 150, 152), ...gap(45), ...syl(160, 152, 148), ...gap(50),
  ...syl(170, 148, 150), ...gap(45), ...syl(200, 150, 148), ...gap(60)
];

const cases = [
  // name                                     ending                                    dir     stretched
  ['statement, short fall',                   syl(210, 148, 118),                       'fall', false],
  ['uptalk, low onset then rise',             syl(320, 128, 175),                       'rise', false],
  ['uptalk, short rise off a low onset',      syl(200, 130, 165),                       'rise', false],
  ['uptalk, stretched',                       syl(620, 140, 180),                       'rise', true],
  ['flat ending',                             syl(220, 148, 146),                       'flat', false],
  ['fall, but held far too long',             syl(700, 150, 120),                       'fall', true],
  ['quiet final syllable after a loud one',   syl(230, 148, 120, 0.03),                 'fall', false],
  // Two frames where the pitch tracker halves the frequency. Isolated slips
  // must not be able to turn a rise into a fall.
  ['rise with two octave slips',              octaveSlips(syl(300, 130, 176), [7, 13]),  'rise', false],
];

function octaveSlips(frames, at) {
  return frames.map((f, i) => at.includes(i) ? { ...f, st: f.st - 12 } : f);
}

let ok = true;
for (const [name, ending, wantDir, wantLong] of cases) {
  const r = score([...body, ...ending, ...gap(400)]);
  const long = r && r.hold != null && r.hold > C.HOLD_LONG_MS;
  const pass = !!r && r.dir === wantDir && long === wantLong;
  ok &&= pass;
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name.padEnd(38)} ` +
    (r ? `${r.dir.padEnd(4)} ${r.delta.toFixed(2).padStart(6)} st  hold=${r.hold == null ? 'unknown' : r.hold.toFixed(0) + ' ms'}` : 'no score'));
}

// Continuously voiced ending with no loudness dip ("...know how it ends"):
// the shape must still be read, and the duration must come back unknown rather
// than as a made-up number that always looks stretched.
const fused = score([...body, ...syl(300, 150, 148), ...syl(260, 146, 116), ...gap(400)]);
const fusedNoDip = score([...body,
  ...Array.from({ length: Math.round(900 / FRAME) }, (_, i) => {
    const u = i / (Math.round(900 / FRAME) - 1);
    return { st: hzToSemitones(150 - 30 * u), rms: 0.075 };   // flat loudness: no boundary anywhere
  }), ...gap(400)]);
const pass1 = fused && fused.dir === 'fall';
const pass2 = fusedNoDip && fusedNoDip.dir === 'fall' && fusedNoDip.hold === null;
ok &&= pass1 && pass2;
console.log(`${pass1 ? 'ok  ' : 'FAIL'} ${'voiced right through the boundary'.padEnd(38)} ${fused.dir} hold=${fused.hold?.toFixed(0)} ms`);
console.log(`${pass2 ? 'ok  ' : 'FAIL'} ${'no dip at all -> hold unknown'.padEnd(38)} ${fusedNoDip.dir} hold=${fusedNoDip.hold}`);

// The verdict must not depend on the display. Frame counts made it: a
// fixed-length median erased the dip between syllables on a slow frame rate,
// which merged the ending into the syllable before it and turned rises flat.
for (const fps of [30, 60, 120]) {
  // Resample the same sentence onto the frame grid that frame rate produces —
  // same speech, more or fewer looks at it.
  const src = [...body, ...syl(300, 128, 172), ...gap(400)];
  const dt = 1000 / fps, pts = [];
  for (let t = 0; t < src.length * FRAME; t += dt) {
    pts.push({ ...src[Math.min(src.length - 1, Math.round(t / FRAME))], t: 1000 + t });
  }
  const s = findFinalSyllable(pts);
  const d = contourDelta(pts, s.start, s.end);
  const pass = s.found && d >= C.TERMINAL_ST;
  ok &&= pass;
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${`rise still reads as a rise at ${fps} fps`.padEnd(38)} ` +
    `${d.toFixed(2)} st  hold=${(s.end - s.start).toFixed(0)} ms`);
}

console.log(ok ? '\nall pass' : '\nFAILURES');
process.exit(ok ? 0 : 1);
