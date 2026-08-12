import { STORE_KEY } from '../constants.js';
import { renderExList } from '../exercises/registry.js';
import { renderBaseTable } from '../targets.js';

// ==========================================================================
// saved calibration
// ==========================================================================

export var base = load();
function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
  catch (e) { return {}; }
}
export function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(base)); } catch (e) {}
  renderBaseTable();
  renderExList();
}

// Clearing the baseline is the store's own job. The reset button used to reach
// in and assign `base` from outside, which a module cannot do to another
// module's binding — and which meant three different files each knew how this
// one was stored.
export function resetBaseline() {
  base = {};
  try { localStorage.removeItem(STORE_KEY); } catch (e) {}
}
