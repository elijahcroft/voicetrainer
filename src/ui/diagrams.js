import { ANDROGYNOUS_HIGH, ANDROGYNOUS_LOW, MASC_F0_CEILING } from '../constants.js';

// ==========================================================================
// diagrams
//
// Every mechanism this tool asks you to feel — back-pressure, larynx height,
// fold thickness — is spatial, and spatial things described only in prose
// sound harder than they are. These are schematic on purpose: enough shape to
// locate the sensation in your own throat, not enough to be an anatomy plate.
// Each carries an aria-label saying the same thing in words, because the
// diagram is an explanation and not decoration.
// ==========================================================================

// An SVG with width:100% will happily scale to a 1200px card and blow the
// labels up to headline size, so each figure is capped at the width its
// viewBox was drawn for — read off the viewBox rather than repeated by hand.
function figure(svg, caption) {
  var vb = /viewBox="0 0 ([\d.]+)/.exec(svg);
  var cap = vb ? ' style="max-width:' + vb[1] + 'px"' : '';
  return '<figure class="diagram"><div class="dwrap"' + cap + '>' + svg + '</div>' +
    (caption ? '<figcaption><span>' + caption + '</span></figcaption>' : '') + '</figure>';
}

// Arrowhead markers are defined per-diagram with a unique id: only one
// exercise is ever mounted at a time, but ids leaking between panes would
// fail silently and look like a rendering bug.
function arrowDef(id, color) {
  return '<defs><marker id="' + id + '" viewBox="0 0 8 8" refX="7" refY="4" ' +
    'markerWidth="5" markerHeight="5" orient="auto">' +
    '<path d="M0 0 L8 4 L0 8 Z" fill="' + color + '"/></marker></defs>';
}

export var DIAGRAMS = {};

DIAGRAMS.straw = function () {
  return figure(
    '<svg viewBox="0 0 520 148" role="img" aria-label="Cross-section of the vocal tract with a ' +
      'straw at the lips. Air backs up inside the tract and presses down on the vocal folds, so ' +
      'they meet more gently.">' +
    arrowDef('ar-straw', 'var(--good)') +
    '<rect x="72" y="34" width="286" height="72" fill="rgba(212,59,122,.10)"/>' +
    '<rect x="358" y="59" width="112" height="22" fill="rgba(212,59,122,.10)"/>' +
    '<path d="M72 34 H358 L358 59 H470" fill="none" stroke="var(--rule)" stroke-width="2"/>' +
    '<path d="M72 106 H358 L358 81 H470" fill="none" stroke="var(--rule)" stroke-width="2"/>' +
    // vocal folds, seen edge-on, with the glottal gap between them
    '<path d="M50 26 L78 62 L50 68 Z" fill="var(--accent)"/>' +
    '<path d="M50 114 L78 78 L50 72 Z" fill="var(--accent)"/>' +
    '<line x1="330" y1="70" x2="112" y2="70" stroke="var(--good)" stroke-width="2" ' +
      'marker-end="url(#ar-straw)"/>' +
    '<text x="222" y="60" fill="var(--good)" font-size="11.5" text-anchor="middle">back-pressure</text>' +
    '<text x="66" y="132" fill="var(--dim)" font-size="11.5" text-anchor="middle">vocal folds</text>' +
    '<text x="215" y="132" fill="var(--dim)" font-size="11.5" text-anchor="middle">vocal tract</text>' +
    '<text x="414" y="132" fill="var(--dim)" font-size="11.5" text-anchor="middle">straw</text>' +
    '</svg>',
    'The narrow opening traps air in the tract. That trapped air pushes back down on the folds, ' +
    'so they meet with less force for the same loudness — which is why this is the safe way to warm up.');
};

DIAGRAMS.larynx = function () {
  // Two throats side by side. The only difference is where the larynx sits;
  // the shaded column above it is the space that shapes the sound.
  function throat(x, laryY, label, sub, hi) {
    var col = hi ? 'var(--good)' : 'var(--dim)';
    return '<g transform="translate(' + x + ',0)">' +
      '<rect x="34" y="26" width="62" height="' + (laryY - 26) + '" ' +
        'fill="' + (hi ? 'rgba(255,207,92,.18)' : 'rgba(143,151,173,.22)') + '"/>' +
      '<path d="M34 26 V128 M96 26 V128" fill="none" stroke="var(--rule)" stroke-width="2"/>' +
      '<line x1="34" y1="26" x2="96" y2="26" stroke="var(--rule)" stroke-width="2"/>' +
      '<rect x="28" y="' + laryY + '" width="74" height="15" rx="4" fill="var(--ink-3)" ' +
        'stroke="' + col + '" stroke-width="1.5"/>' +
      '<line x1="118" y1="28" x2="118" y2="' + (laryY - 2) + '" stroke="' + col + '" ' +
        'stroke-width="1.5" marker-start="url(#ar-lx)" marker-end="url(#ar-lx)"/>' +
      '<text x="10" y="22" fill="var(--dim)" font-size="11">lips</text>' +
      '<text x="65" y="' + (laryY + 11) + '" fill="' + col + '" font-size="10.5" ' +
        'text-anchor="middle">larynx</text>' +
      '<text x="65" y="148" fill="' + col + '" font-size="12" font-weight="600" ' +
        'text-anchor="middle">' + label + '</text>' +
      '<text x="65" y="164" fill="var(--dim)" font-size="11" text-anchor="middle">' + sub + '</text>' +
      '</g>';
  }
  return figure(
    '<svg viewBox="0 0 400 176" role="img" aria-label="Two throats compared. With the larynx ' +
      'raised the space above it is short and the voice sounds smaller; with the larynx lowered ' +
      'that space is longer and the voice sounds larger.">' +
    arrowDef('ar-lx', 'var(--dim)') +
    throat(20, 62, 'raised', 'shorter space', false) +
    throat(220, 104, 'lowered', 'longer space', true) +
    '</svg>',
    'Nothing about the pitch has to change between these two. The shaded column is what the ' +
    'resonance number measures — a yawn lengthens it, and the sigh keeps it long while you make sound.');
};

DIAGRAMS.ng = function () {
  // The failure mode is invisible from inside your own head, so it gets equal
  // billing with the success case rather than a footnote.
  function panel(x, resPath, title, titleCol, sub) {
    return '<g transform="translate(' + x + ',0)">' +
      '<rect x="0" y="14" width="196" height="86" rx="8" fill="#050508" stroke="var(--rule)"/>' +
      '<path d="M18 30 C 70 42, 120 66, 178 84" fill="none" stroke="var(--accent)" stroke-width="2.4"/>' +
      '<path d="' + resPath + '" fill="none" stroke="var(--good)" stroke-width="2.4"/>' +
      '<text x="98" y="120" fill="' + titleCol + '" font-size="12.5" font-weight="600" ' +
        'text-anchor="middle">' + title + '</text>' +
      '<text x="98" y="136" fill="var(--dim)" font-size="11" text-anchor="middle">' + sub + '</text>' +
      '</g>';
  }
  return figure(
    '<svg viewBox="0 0 440 146" role="img" aria-label="Two traces. When the slide is done well ' +
      'the pitch line falls while the resonance line rises. When pitch is lowered with the folds ' +
      'alone, the pitch line falls but the resonance line stays flat.">' +
    panel(10, 'M18 84 C 70 76, 120 50, 178 32', 'moving together', 'var(--good)',
      'larynx rides down with the pitch') +
    panel(234, 'M18 58 L178 58', 'folds alone', 'var(--warn)',
      'pitch drops, space unchanged — tiring') +
    '<g transform="translate(10,0)">' +
      '<text x="0" y="9" fill="var(--accent)" font-size="11">— pitch</text>' +
      '<text x="58" y="9" fill="var(--good)" font-size="11">— resonance</text>' +
    '</g>' +
    '</svg>',
    'Both panels sound lower. Only the left one is something you can hold for a whole conversation.');
};

DIAGRAMS.weight = function () {
  // "Weight" is the least intuitive of the four measures, and the one most
  // easily faked by pressing — which is exactly what the diagram contrasts.
  function folds(x, depth, title, titleCol, sub) {
    var top = 62 - depth / 2;
    return '<g transform="translate(' + x + ',0)">' +
      '<rect x="20" y="16" width="58" height="92" rx="6" fill="var(--ink-3)" stroke="var(--rule)"/>' +
      '<rect x="118" y="16" width="58" height="92" rx="6" fill="var(--ink-3)" stroke="var(--rule)"/>' +
      '<rect x="78" y="' + top + '" width="40" height="' + depth + '" ' +
        'fill="' + (titleCol === 'var(--good)' ? 'rgba(255,207,92,.35)' : 'rgba(245,133,47,.35)') + '" ' +
        'stroke="' + titleCol + '" stroke-width="1.5"/>' +
      '<line x1="190" y1="' + top + '" x2="190" y2="' + (top + depth) + '" stroke="' + titleCol + '" ' +
        'stroke-width="1.5" marker-start="url(#ar-wt)" marker-end="url(#ar-wt)"/>' +
      '<text x="98" y="128" fill="' + titleCol + '" font-size="12.5" font-weight="600" ' +
        'text-anchor="middle">' + title + '</text>' +
      '<text x="98" y="144" fill="var(--dim)" font-size="11" text-anchor="middle">' + sub + '</text>' +
      '</g>';
  }
  return figure(
    '<svg viewBox="0 0 440 154" role="img" aria-label="The vocal folds seen from the front. Heavy ' +
      'folds touch over a deep area and give a full low note. Pressed folds touch over a shallow ' +
      'area and give a thin low note that costs effort.">' +
    arrowDef('ar-wt', 'var(--dim)') +
    folds(6, 52, 'heavy — sustainable', 'var(--good)', 'deep contact, full sound') +
    folds(226, 14, 'pressed thin', 'var(--warn)', 'shallow contact, effortful') +
    '</svg>',
    'Both can land on the same note. The weight meter is how you tell which one you just did.');
};

DIAGRAMS.glide = function () {
  return figure(
    '<svg viewBox="0 0 460 140" role="img" aria-label="A sigh gliding downward. The clear part of ' +
      'the glide is counted; the creaky tail past your comfortable floor is not.">' +
    '<rect x="12" y="10" width="436" height="92" rx="9" fill="#050508" stroke="var(--rule)"/>' +
    '<line x1="12" y1="76" x2="448" y2="76" stroke="rgba(255,207,92,.5)" stroke-width="1.5" ' +
      'stroke-dasharray="5 4"/>' +
    '<path d="M40 26 C 120 34, 190 58, 250 74" fill="none" stroke="var(--good)" stroke-width="2.6"/>' +
    '<path d="M250 74 C 300 84, 350 90, 420 93" fill="none" stroke="var(--bad)" stroke-width="2.6" ' +
      'stroke-dasharray="3 4"/>' +
    '<circle cx="250" cy="74" r="4.5" fill="var(--good)"/>' +
    '<line x1="250" y1="79" x2="250" y2="112" stroke="var(--rule)" stroke-width="1.5"/>' +
    '<text x="20" y="70" fill="var(--good)" font-size="11.5">clear — counted</text>' +
    '<text x="440" y="66" fill="var(--bad)" font-size="11.5" text-anchor="end">creaky — not counted</text>' +
    '<text x="250" y="128" fill="var(--text)" font-size="11.5" text-anchor="middle">' +
      'your comfortable floor</text>' +
    '</svg>',
    'The floor is where the tone stops being clear, not where sound stops coming out. ' +
    'Pushing past the dot measures your creak, which is not a note you can speak on.');
};

DIAGRAMS.terminal = function () {
  // The thing being trained is a shape, and the shape is the whole
  // explanation — so the two endings are drawn side by side at the same
  // pitch, because it is the last half-second that differs and nothing else.
  function panel(x, path, tail, title, titleCol, sub) {
    return '<g transform="translate(' + x + ',0)">' +
      '<rect x="0" y="14" width="196" height="86" rx="8" fill="#050508" stroke="var(--rule)"/>' +
      '<path d="' + path + '" fill="none" stroke="var(--accent)" stroke-width="2.4"/>' +
      '<path d="' + tail + '" fill="none" stroke="' + titleCol + '" stroke-width="2.8"/>' +
      '<line x1="128" y1="20" x2="128" y2="94" stroke="var(--rule)" stroke-width="1" ' +
        'stroke-dasharray="3 4"/>' +
      '<text x="98" y="120" fill="' + titleCol + '" font-size="12.5" font-weight="600" ' +
        'text-anchor="middle">' + title + '</text>' +
      '<text x="98" y="136" fill="var(--dim)" font-size="11" text-anchor="middle">' + sub + '</text>' +
      '</g>';
  }
  return figure(
    '<svg viewBox="0 0 440 146" role="img" aria-label="Two pitch traces of the same sentence. In ' +
      'the first the last syllable is held long and slides upward, which makes a statement sound ' +
      'like a question. In the second the last syllable is short and drops.">' +
    panel(10, 'M16 62 C 50 54, 90 66, 128 60', 'M128 60 C 150 50, 166 40, 186 30',
      'held and rising', 'var(--warn)', 'a statement that asks') +
    panel(234, 'M16 62 C 50 54, 90 66, 128 60', 'M128 60 C 138 66, 146 76, 154 86',
      'short and landing', 'var(--good)', 'a statement that states') +
    '<text x="10" y="9" fill="var(--dim)" font-size="11">pitch over one sentence — ' +
      'dotted line is the last syllable</text>' +
    '</svg>',
    'Both sentences can sit at exactly the same average pitch. The ending is a separate habit from ' +
    'the pitch, which is why it gets its own drill.');
};

// The one diagram carrying live numbers: where your own voice sits on the
// scale the targets are drawn from.
DIAGRAMS.pitchMap = function (opts) {
  opts = opts || {};
  // 190 Hz is the bottom of the cis-female average band (RESEARCH.md §2) and
  // is local to this drawing: nothing in the tool targets it, it is only the
  // point past which the "reads female" label is honest.
  var LO = 80, HI = 260, FEM_FLOOR = 190, W = 460, PAD = 14;
  function x(hz) { return PAD + (Math.min(HI, Math.max(LO, hz)) - LO) / (HI - LO) * (W - PAD * 2); }
  function zone(lo, hi, fill) {
    return '<rect x="' + x(lo).toFixed(1) + '" y="30" width="' + (x(hi) - x(lo)).toFixed(1) +
      '" height="30" fill="' + fill + '"/>';
  }
  function pin(hz, label, col, up) {
    if (hz == null) return '';
    var px = x(hz).toFixed(1);
    return '<g><line x1="' + px + '" y1="' + (up ? 22 : 30) + '" x2="' + px + '" y2="' +
      (up ? 60 : 70) + '" stroke="' + col + '" stroke-width="2"/>' +
      '<text x="' + px + '" y="' + (up ? 17 : 84) + '" fill="' + col + '" font-size="11.5" ' +
      'text-anchor="middle">' + label + '</text></g>';
  }
  var ticks = [100, 130, 165, 200, 240].map(function (t) {
    return '<text x="' + x(t).toFixed(1) + '" y="104" fill="var(--dim)" font-size="10.5" ' +
      'text-anchor="middle">' + t + '</text>';
  }).join('');
  return figure(
    '<svg viewBox="0 0 460 112" role="img" aria-label="A scale of speaking pitch in hertz. Below ' +
      '130 hertz listeners reliably hear a voice as male; between 140 and 165 hertz they stop ' +
      'agreeing; above roughly 190 hertz they reliably hear it as female.">' +
    zone(LO, MASC_F0_CEILING, 'rgba(255,207,92,.22)') +
    zone(MASC_F0_CEILING, ANDROGYNOUS_LOW, 'rgba(255,207,92,.10)') +
    zone(ANDROGYNOUS_LOW, ANDROGYNOUS_HIGH, 'rgba(245,133,47,.20)') +
    zone(ANDROGYNOUS_HIGH, FEM_FLOOR, 'rgba(212,59,122,.06)') +
    zone(FEM_FLOOR, HI, 'rgba(212,59,122,.16)') +
    '<rect x="' + PAD + '" y="30" width="' + (W - PAD * 2) + '" height="30" fill="none" ' +
      'stroke="var(--rule)" rx="4"/>' +
    '<text x="' + x(105).toFixed(1) + '" y="49" fill="var(--good)" font-size="11" ' +
      'text-anchor="middle">reads male</text>' +
    '<text x="' + x(152).toFixed(1) + '" y="49" fill="var(--warn)" font-size="10.5" ' +
      'text-anchor="middle">ambiguous</text>' +
    '<text x="' + x(224).toFixed(1) + '" y="49" fill="var(--accent)" font-size="11" ' +
      'text-anchor="middle">reads female</text>' +
    ticks +
    pin(opts.now, 'you now', 'var(--text)', true) +
    pin(opts.target, 'target', 'var(--good)', false) +
    '</svg>',
    opts.caption || 'Hz. The ambiguous band is a real change in how listeners hear a voice, not a ' +
    'smooth gradient — which is why crossing it is worth more than the same drop anywhere else.');
};
