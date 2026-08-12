import DSP from './dsp.js';
import { FLOOR_MARGIN_ST, MASC_F0_CEILING, RESONANCE_GOAL } from './constants.js';
import { linkTerms } from './glossary.js';
import { base } from './store/baseline.js';

// The pitch target, derived rather than assumed. It moves toward the
// masculine range but is never allowed within FLOOR_MARGIN_ST of the lowest
// pitch that was actually measured as comfortable.
// One stage lower than where you speak now, heading toward the masculine
// range, but never below a safe margin above your measured floor — and never
// ABOVE where you already speak, which would be telling you to raise your
// pitch. A narrow measured range legitimately means "no pitch work right
// now", and the tool says so rather than inventing a target.
export function pitchTarget() {
  if (base.habitualF0 == null) return null;
  var stepDown = DSP.semitonesToHz(DSP.hzToSemitones(base.habitualF0) - 2);
  var wanted = Math.min(stepDown, MASC_F0_CEILING);
  var limited = false;

  if (base.safeFloor != null) {
    var safest = DSP.semitonesToHz(DSP.hzToSemitones(base.safeFloor) + FLOOR_MARGIN_ST);
    if (wanted < safest) { wanted = safest; limited = true; }
  }
  if (wanted >= base.habitualF0) {
    // No headroom at all between the floor and habitual speech.
    return { hz: base.habitualF0, limited: true, noHeadroom: true };
  }
  return { hz: wanted, limited: limited, noHeadroom: false };
}

export function targetBand() {
  var t = pitchTarget();
  if (!t) return null;
  return { lo: t.hz * 0.94, hi: t.hz * 1.06, center: t.hz, limited: t.limited };
}

export function renderBaseTable() {
  var rows = [];
  function row(label, value, note) {
    rows.push('<tr><td>' + label + '</td><td class="num">' + value +
      '</td></tr>' + (note ? '<tr><td colspan="2" style="color:var(--dim);font-size:12px;border:0;padding-top:0">' + note + '</td></tr>' : ''));
  }
  if (base.habitualF0 == null) {
    rows.push('<tr><td colspan="2" style="color:var(--dim)">Run <b>Calibrate</b> first — every target below is derived from your own voice.</td></tr>');
  } else {
    row('Habitual pitch', base.habitualF0.toFixed(0) + ' Hz');
    if (base.safeFloor != null) row('Comfortable floor', base.safeFloor.toFixed(0) + ' Hz');
    var t = pitchTarget();
    if (t) {
      row('Pitch target', t.hz.toFixed(0) + ' Hz',
        t.limited ? 'Held above your floor on purpose — pushing lower is where injuries come from.' : null);
    }
    if (base.resonance != null) {
      row('Resonance baseline', base.resonance.toFixed(1) + ' cm');
      row('Resonance goal', (base.resonance * RESONANCE_GOAL).toFixed(1) + ' cm');
    }
    if (base.intonationSd != null) row('Intonation', base.intonationSd.toFixed(1) + ' st');
  }
  document.querySelector('#baseTable tbody').innerHTML = rows.join('');
  linkTerms(document.querySelector('#baseTable tbody'));
}
