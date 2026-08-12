import DSP from '../dsp.js';

export function median(arr) {
  var s = arr.slice().sort(function (a, b) { return a - b; });
  var m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Intonation range over a whole take, in semitones. The live meter uses the
// 10 s rolling window; scored numbers use every frame of the take, so a
// baseline and a later take are the same measurement over the same span.
export function semitoneSd(f0List) {
  if (!f0List || f0List.length < 2) return null;
  var st = f0List.map(function (hz) { return DSP.hzToSemitones(hz); });
  var m = 0, i;
  for (i = 0; i < st.length; i++) m += st[i];
  m /= st.length;
  var s = 0;
  for (i = 0; i < st.length; i++) s += (st[i] - m) * (st[i] - m);
  return Math.sqrt(s / (st.length - 1));
}
