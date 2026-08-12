import { HISTORY_KEY, MAX_TAKES } from '../constants.js';
import { renderExList } from '../exercises/registry.js';

// ==========================================================================
// saved takes
//
// The scored numbers were computed and then thrown away, which meant the one
// question practice actually asks — "is this moving?" — could not be
// answered. Only the four medians and a timestamp are kept; no audio and no
// per-frame data ever leaves the analysis loop.
// ==========================================================================

export var history = loadHistory();
function loadHistory() {
  try {
    var h = JSON.parse(localStorage.getItem(HISTORY_KEY));
    return Array.isArray(h) ? h : [];
  } catch (e) { return []; }
}

// `kind` is 'calibration' | 'passage' | 'free'. The first two are the same
// text, so their resonance is comparable; free speech is a different text and
// is excluded from the resonance chart on purpose.
export function recordTake(kind, m) {
  history.push({
    t: Date.now(),
    kind: kind,
    f0: m.f0 != null ? +m.f0.toFixed(1) : null,
    res: m.res != null ? +m.res.toFixed(2) : null,
    weight: m.weight != null ? +m.weight.toFixed(2) : null,
    sd: m.sd != null ? +m.sd.toFixed(2) : null
  });
  if (history.length > MAX_TAKES) history = history.slice(-MAX_TAKES);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch (e) {}
  renderExList();
}

export function clearHistory() {
  history = [];
  try { localStorage.removeItem(HISTORY_KEY); } catch (e) {}
  renderExList();
}
