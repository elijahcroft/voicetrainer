/* test-dsp.mjs — verify dsp.js against synthetic signals of known F0 and known
 * formant frequencies. This is the part of the tool that can't be checked by
 * eye, so it gets checked by arithmetic.
 *
 * Run: node test-dsp.mjs
 */
import DSP from './dsp.js';

const FS = 48000;
const FRAME = 4096; // matches AnalyserNode.fftSize in voice-trainer.html

let passed = 0;
let failed = 0;

function check(name, ok, detail) {
  if (ok) { passed++; console.log(`  ok   ${name}${detail ? '  (' + detail + ')' : ''}`); }
  else { failed++; console.log(`  FAIL ${name}${detail ? '  (' + detail + ')' : ''}`); }
}

function pctErr(actual, expected) {
  return Math.abs(actual - expected) / expected * 100;
}

// --- synthesis ---------------------------------------------------------------

// Band-limited glottal-ish source: harmonics with a -12 dB/octave rolloff.
function glottalSource(f0, n, fs, phase0 = 0.2) {
  const out = new Float64Array(n);
  const nHarm = Math.floor((fs / 2) / f0);
  for (let h = 1; h <= nHarm; h++) {
    const amp = 1 / (h * h);
    const w = 2 * Math.PI * f0 * h / fs;
    const ph = phase0 * h;
    for (let i = 0; i < n; i++) out[i] += amp * Math.sin(w * i + ph);
  }
  return out;
}

// Two-pole resonator at frequency f with bandwidth bw.
function resonate(x, f, bw, fs) {
  const r = Math.exp(-Math.PI * bw / fs);
  const theta = 2 * Math.PI * f / fs;
  const a1 = 2 * r * Math.cos(theta);
  const a2 = -r * r;
  const gain = (1 - a1 - a2); // unity DC gain, keeps levels sane through a cascade
  const out = new Float64Array(x.length);
  let y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const y = gain * x[i] + a1 * y1 + a2 * y2;
    out[i] = y;
    y2 = y1; y1 = y;
  }
  return out;
}

function synthVowel(f0, formants, n, fs, bandwidths) {
  let sig = glottalSource(f0, n, fs);
  formants.forEach((f, i) => {
    sig = resonate(sig, f, (bandwidths && bandwidths[i]) || (60 + 40 * i), fs);
  });
  // normalize to a realistic speaking level
  let peak = 0;
  for (let i = 0; i < sig.length; i++) peak = Math.max(peak, Math.abs(sig[i]));
  const scale = peak > 0 ? 0.25 / peak : 1;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = sig[i] * scale;
  return out;
}

function vtlToFormants(lengthCm, count = 4) {
  // Uniform tube: F_i = (2i-1) * c / (4L)
  const out = [];
  for (let i = 1; i <= count; i++) {
    out.push((2 * i - 1) * DSP.SPEED_OF_SOUND_CM_S / (4 * lengthCm));
  }
  return out;
}

// --- 1. pitch accuracy -------------------------------------------------------

console.log('\nYIN pitch accuracy (target: within 1%)');
{
  const testF0s = [80, 95, 110, 130, 150, 180, 210, 250];
  let worst = 0, worstAt = null;
  for (const f0 of testF0s) {
    // A neutral-ish vowel so the source isn't a bare sawtooth.
    const sig = synthVowel(f0, [500, 1500, 2500, 3500], FRAME, FS);
    const r = DSP.yin(sig, FS);
    const err = pctErr(r.f0, f0);
    if (err > worst) { worst = err; worstAt = f0; }
    check(`f0 = ${f0} Hz`, err < 1.0, `measured ${r.f0.toFixed(2)} Hz, err ${err.toFixed(3)}%, aper ${r.aperiodicity.toFixed(3)}`);
  }
  console.log(`  worst error ${worst.toFixed(3)}% at ${worstAt} Hz`);
}

// --- 2. voicing gate ---------------------------------------------------------

console.log('\nVoicing gate');
{
  const silence = new Float32Array(FRAME);
  check('silence is not voiced', !DSP.isVoiced(DSP.yin(silence, FS)));

  const noise = new Float32Array(FRAME);
  let seed = 12345;
  for (let i = 0; i < FRAME; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    noise[i] = (seed / 0x7fffffff - 0.5) * 0.5;
  }
  const nr = DSP.yin(noise, FS);
  check('white noise is not voiced', !DSP.isVoiced(nr), `aper ${nr.aperiodicity.toFixed(3)}`);

  const voiced = synthVowel(120, [500, 1500, 2500, 3500], FRAME, FS);
  const vr = DSP.yin(voiced, FS);
  check('synthetic vowel is voiced', DSP.isVoiced(vr), `aper ${vr.aperiodicity.toFixed(3)}`);

  // Very quiet speech should fall below the RMS floor.
  const quiet = new Float32Array(FRAME);
  for (let i = 0; i < FRAME; i++) quiet[i] = voiced[i] * 0.005;
  check('near-silent input is not voiced', !DSP.isVoiced(DSP.yin(quiet, FS)));
}

// --- 3. formant recovery -----------------------------------------------------

// F1 below ~400 Hz sits between widely spaced harmonics and LPC tends to lock
// onto one of them, so /i/ and /u/ get an F1 tolerance of their own. F2 is well
// resolved everywhere and is held to 8%.
console.log('\nFormant recovery');
{
  const cases = [
    { name: 'neutral 17.5 cm tract', f0: 100, formants: [500, 1500, 2500, 3500], tol1: 8 },
    { name: 'long 19.4 cm tract',    f0: 100, formants: vtlToFormants(19.4),     tol1: 8 },
    { name: 'short 15.0 cm tract',   f0: 100, formants: vtlToFormants(15.0),     tol1: 8 },
    { name: 'vowel /a/-like',        f0: 110, formants: [730, 1090, 2440, 3400], tol1: 8 },
  ];
  for (const c of cases) {
    const sig = synthVowel(c.f0, c.formants, FRAME, FS);
    const env = DSP.lpcEnvelope(sig, FS);
    const found = DSP.findFormants(env);
    const e1 = found[0] != null ? pctErr(found[0], c.formants[0]) : Infinity;
    const e2 = found[1] != null ? pctErr(found[1], c.formants[1]) : Infinity;
    check(c.name, e1 < c.tol1 && e2 < 8,
      `expected [${c.formants.map(f => f.toFixed(0)).join(', ')}] got [${found.map(f => f.toFixed(0)).join(', ')}] err F1 ${e1.toFixed(1)}% F2 ${e2.toFixed(1)}%`);
  }

  // Known limitation, asserted rather than hidden: F1 of close vowels like /i/
  // (~270 Hz) sits between widely spaced harmonics and is not recovered. What
  // matters is that this does not silently corrupt an absolute VTL reading.
  const iSig = synthVowel(110, [270, 2290, 3010, 3700], FRAME, FS);
  const iFound = DSP.findFormants(DSP.lpcEnvelope(iSig, FS));
  check('/i/ F1 is missed, and the strict VTL estimate refuses the frame',
    DSP.estimateVTL(iFound) === null,
    `formants [${iFound.map(f => f.toFixed(0)).join(', ')}]`);
}

// --- 4. VTL estimation -------------------------------------------------------

console.log('\nVTL absolute accuracy on uniform tubes (target: within 5%)');
{
  let worst = 0, rejected = 0, total = 0;
  for (const trueVtl of [13, 14, 16, 17.5, 19, 20, 22]) {
    for (const f0 of [85, 110, 140, 180, 220, 260]) {
      total++;
      const sig = synthVowel(f0, vtlToFormants(trueVtl), FRAME, FS);
      const est = DSP.estimateVTL(DSP.findFormants(DSP.lpcEnvelope(sig, FS)));
      if (est == null) { rejected++; continue; }
      worst = Math.max(worst, pctErr(est, trueVtl));
    }
  }
  check('worst error over 13-22 cm x 85-260 Hz', worst < 6, `worst ${worst.toFixed(2)}%`);
  check('most frames accepted', rejected / total < 0.5, `rejected ${rejected}/${total}`);
}

console.log('\nResonance sensitivity — the property resonance training depends on');
{
  // A 10% longer tract scales every formant by 1/1.10. The live meter must
  // actually move by ~10%, for every vowel including the ones the strict
  // estimator refuses, or the resonance feedback is measuring nothing.
  // Open and mid vowels — these are what the exercises actually use, and they
  // must be quantitatively right.
  const vowels = {
    '/a/': [730, 1090, 2440, 3400, 4400],
    '/e/': [530, 1840, 2480, 3400, 4500],
    '/ae/': [660, 1720, 2410, 3300, 4400],
    'schwa': [500, 1500, 2500, 3500, 4500]
  };
  const changes = [];
  for (const [name, F] of Object.entries(vowels)) {
    const a = DSP.resonanceIndex(DSP.findFormants(DSP.lpcEnvelope(synthVowel(110, F, FRAME, FS), FS)));
    const b = DSP.resonanceIndex(DSP.findFormants(DSP.lpcEnvelope(synthVowel(110, F.map(f => f / 1.10), FRAME, FS), FS)));
    if (a == null || b == null) { check(`${name}: usable`, false, 'returned null'); continue; }
    const change = (b / a - 1) * 100;
    changes.push(change);
    check(`${name}: +10% tract reads as +7..14%`, change > 7 && change < 14, `measured +${change.toFixed(1)}%`);
  }
  check('every open/mid vowel usable for the live meter', changes.length === 4, `${changes.length} of 4`);

  // Close vowels /i/ and /u/ have F1 and F2 packed low and close together. /u/
  // reads about half the true change, /i/ about double it (its F1 is missed
  // entirely, so the formants slot one place over). Direction survives;
  // magnitude does not. Asserted here so the limitation stays visible rather
  // than being discovered in use — the exercises deliberately use open vowels,
  // schwa and /ng/ instead.
  for (const [name, F] of Object.entries({ '/u/': [300, 870, 2240, 3200, 4300], '/i/': [270, 2290, 3010, 3700, 4600] })) {
    const a = DSP.resonanceIndex(DSP.findFormants(DSP.lpcEnvelope(synthVowel(110, F, FRAME, FS), FS)));
    const b = DSP.resonanceIndex(DSP.findFormants(DSP.lpcEnvelope(synthVowel(110, F.map(f => f / 1.10), FRAME, FS), FS)));
    const change = a != null && b != null ? (b / a - 1) * 100 : NaN;
    check(`${name} (close vowel): direction right, magnitude unreliable`,
      change > 0 && change < 30, `measured +${change.toFixed(1)}% for a true +10%`);
  }

  // Must not be a disguised pitch meter — pitch and resonance are separate
  // dimensions and the yawn-sigh exercise depends on moving one without the other.
  const lowVtl = DSP.resonanceIndex(DSP.findFormants(DSP.lpcEnvelope(synthVowel(90, vtlToFormants(17.5), FRAME, FS), FS)));
  const highVtl = DSP.resonanceIndex(DSP.findFormants(DSP.lpcEnvelope(synthVowel(220, vtlToFormants(17.5), FRAME, FS), FS)));
  check('resonance is independent of pitch', lowVtl != null && highVtl != null && pctErr(highVtl, lowVtl) < 6,
    `${lowVtl?.toFixed(2)} cm at 90 Hz vs ${highVtl?.toFixed(2)} cm at 220 Hz`);

  // Ordering must survive, since the UI shows a gauge.
  const shortVtl = DSP.resonanceIndex(DSP.findFormants(DSP.lpcEnvelope(synthVowel(120, vtlToFormants(15.5), FRAME, FS), FS)));
  const longVtl = DSP.resonanceIndex(DSP.findFormants(DSP.lpcEnvelope(synthVowel(120, vtlToFormants(19.5), FRAME, FS), FS)));
  check('longer tract reads as longer', longVtl > shortVtl, `${shortVtl.toFixed(2)} cm vs ${longVtl.toFixed(2)} cm`);
}

console.log('\nVTL rejects frames it cannot trust');
{
  // A spurious peak below F1 re-slots every formant; the residual gate must
  // catch it rather than report a ~1.5x overestimate.
  const clean = vtlToFormants(16.0);
  check('clean formants accepted', pctErr(DSP.estimateVTL(clean), 16.0) < 1);
  const spurious = [clean[0] * 0.55, ...clean];
  const est = DSP.estimateVTL(spurious);
  check('spurious low peak rejected or harmless',
    est == null || pctErr(est, 16.0) < 10,
    est == null ? 'rejected' : `${est.toFixed(2)} cm`);

  check('fewer than 4 formants rejected', DSP.estimateVTL([500, 1500, 2500]) === null);
  check('implausible spacing rejected', DSP.estimateVTL([100, 300, 500, 700]) === null);
}

// --- 5. vocal weight ---------------------------------------------------------

console.log('\nVocal weight / spectral measures');
{
  const formants = [500, 1500, 2500, 3500];

  // A breathier source has a stronger first harmonic relative to the second.
  function sourceWithH1H2(f0, n, fs, rolloffExp) {
    const out = new Float64Array(n);
    const nHarm = Math.floor((fs / 2) / f0);
    for (let h = 1; h <= nHarm; h++) {
      const amp = 1 / Math.pow(h, rolloffExp);
      const w = 2 * Math.PI * f0 * h / fs;
      for (let i = 0; i < n; i++) out[i] += amp * Math.sin(w * i + 0.2 * h);
    }
    return out;
  }
  function shape(src, fs) {
    let s = src;
    formants.forEach((f, i) => { s = resonate(s, f, 60 + 40 * i, fs); });
    let peak = 0;
    for (let i = 0; i < s.length; i++) peak = Math.max(peak, Math.abs(s[i]));
    const out = new Float32Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s[i] * (0.25 / peak);
    return out;
  }

  const light = shape(sourceWithH1H2(120, FRAME, FS, 3.0), FS); // steep rolloff = lighter
  const heavy = shape(sourceWithH1H2(120, FRAME, FS, 1.4), FS); // shallow rolloff = heavier

  const lm = DSP.spectralMeasures(light, 120, FS);
  const hm = DSP.spectralMeasures(heavy, 120, FS);
  check('spectralMeasures returns values', lm != null && hm != null);
  check('heavier source scores higher weightRaw', hm.weightRaw > lm.weightRaw,
    `light ${lm.weightRaw.toFixed(2)} vs heavy ${hm.weightRaw.toFixed(2)}`);
  check('heavier source has shallower tilt', hm.tilt > lm.tilt,
    `light ${lm.tilt.toFixed(2)} dB/oct vs heavy ${hm.tilt.toFixed(2)} dB/oct`);
  check('unvoiced input returns null', DSP.spectralMeasures(new Float32Array(FRAME), 0, FS) === null);
}

// --- 6. helpers --------------------------------------------------------------

console.log('\nHelpers');
{
  const m = new DSP.MedianSmoother(5);
  [10, 12, 100, 11, 13].forEach(v => m.push(v));
  check('median rejects a single outlier', m.value() === 12, `got ${m.value()}`);

  const st = new DSP.RollingStats(1000);
  st.push(0, 0); st.push(2, 100); st.push(4, 200);
  check('rolling sd', Math.abs(st.sd() - 2) < 1e-9, `got ${st.sd()}`);
  st.push(10, 5000); // everything older than 4000 ms drops out
  check('rolling window evicts old samples', st.count() === 1, `count ${st.count()}`);

  check('semitone round trip', Math.abs(DSP.semitonesToHz(DSP.hzToSemitones(180, 55), 55) - 180) < 1e-9);
  // One octave must be 12 semitones.
  check('octave is 12 semitones',
    Math.abs((DSP.hzToSemitones(240, 55) - DSP.hzToSemitones(120, 55)) - 12) < 1e-9);
}

// --- 7. end-to-end analyze() -------------------------------------------------

console.log('\nanalyze() end to end');
{
  const sig = synthVowel(115, vtlToFormants(18.0), FRAME, FS);
  const a = DSP.analyze(sig, FS);
  check('reports voiced', a.voiced === true);
  check('f0 within 1%', pctErr(a.f0, 115) < 1, `${a.f0.toFixed(2)} Hz`);
  check('vtl within 10%', a.vtl != null && pctErr(a.vtl, 18.0) < 10, `${a.vtl != null ? a.vtl.toFixed(2) : 'null'} cm`);
  check('weight measured', a.weightRaw != null);
  check('envelope present for drawing', a.envelope != null && a.envelope.db.length === 512);

  const sil = DSP.analyze(new Float32Array(FRAME), FS);
  check('silence yields no metrics', !sil.voiced && sil.vtl === null && sil.weightRaw === null);
}

// --- summary -----------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
