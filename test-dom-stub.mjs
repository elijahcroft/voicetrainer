// test-dom-stub.mjs — the smallest browser a module graph needs to be imported.
//
// The rules under test (streaks, the daily goal, XP) live in modules that sit
// in the same graph as the panes that draw them, so importing one pulls in
// `window.matchMedia` and a handful of `document` lookups at evaluation time.
// None of it is exercised by the tests — the point is to test the rules, not
// the rendering — so every method here is deliberately inert.
//
// Import this FIRST: ES module imports are evaluated in order, and the stubs
// have to exist before the module under test runs.

const noop = () => {};

// A node that accepts anything. `completeStep` renders the practice list, the
// streak strip and (on a finished day) the summary dialog as part of awarding
// XP, so the rules cannot be exercised without something for those to write to.
function node() {
  const base = {
    style: { setProperty: noop },
    classList: { toggle: noop, add: noop, remove: noop, contains: () => false },
    dataset: {},
    innerHTML: '',
    textContent: '',
    hidden: false,
    disabled: false,
    title: '',
    parentNode: null,
    remove: noop,
    focus: noop,
    appendChild: noop,
    insertBefore: noop,
    removeChild: noop,
    setAttribute: noop,
    addEventListener: noop,
    removeEventListener: noop,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
    querySelector: () => node(),
    querySelectorAll: () => [],
    getContext: () => null
  };
  // Anything not named above — scrollTo, closest, whatever the panes reach for
  // next — answers as an inert method rather than sending this file back for
  // another round of additions. Assignments are stored, so code that writes a
  // property and reads it back still sees what it wrote.
  return new Proxy(base, {
    get: (t, k) => (k in t ? t[k] : noop),
    has: () => true
  });
}

globalThis.window = {
  matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
  addEventListener: noop,
  removeEventListener: noop,
  devicePixelRatio: 1
};

// Bare globals the app also uses unqualified.
globalThis.matchMedia = globalThis.window.matchMedia;
globalThis.requestAnimationFrame = noop;

globalThis.document = {
  getElementById: () => node(),
  querySelector: () => node(),
  querySelectorAll: () => [],
  createElement: () => node(),
  addEventListener: noop,
  removeEventListener: noop,
  body: node(),
  hidden: false
};

// A real Map behind the real API, so tests can seed state through the same
// load path the app uses rather than reaching past it.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear()
};
