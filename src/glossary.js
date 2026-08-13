// ==========================================================================
// glossary
//
// "Slide down, letting the larynx ride with the pitch" is not an instruction
// if you do not know what a larynx is or what moving one feels like. The copy
// stays precise and the terms explain themselves instead: each one is linked
// once per screen, and opens a definition plus the part a dictionary leaves
// out — what the thing feels like from the inside, which is what you actually
// practise with.
//
// Longer names come first: "vocal folds" must win before "folds" can match.
// ==========================================================================

var GLOSSARY = [
  { name: 'vocal folds', re: /\bvocal folds\b|\bthe folds\b/i,
    def: 'Two small flaps of muscle and tissue inside the larynx. Air passing between them sets ' +
         'them vibrating, and that vibration is the sound of your voice. Older name: vocal cords.',
    feel: 'You cannot feel them directly — what you feel is effort. An easy note is folds ' +
          'vibrating freely; a strained one is folds being squeezed.' },

  { name: 'vocal tract', re: /\bvocal tract\b/i,
    def: 'The air space your voice travels through after the folds: throat, mouth and nose. Its ' +
         'shape decides the character of the sound, while the folds decide the pitch.',
    feel: 'You change it by moving your tongue, jaw and larynx. Same note, different voice.' },

  { name: 'larynx', re: /\blarynx\b/i,
    def: 'Your voice box — the lump at the front of your throat that moves when you swallow. The ' +
         'vocal folds sit inside it.',
    feel: 'It rides <b>up</b> when you swallow and <b>down</b> at the start of a yawn. Lowering ' +
          'it lengthens the space above it, which is what makes a voice sound bigger. No change ' +
          'in pitch required.' },

  { name: 'semi-occluded', re: /\bsemi-occluded\b/i,
    def: 'Partly blocked. Making sound through a narrow opening — a straw, or a hum — is the ' +
         'gentlest way there is to exercise a voice.',
    feel: 'The sound seems to stop at your lips and buzz back into your face. That buzz is the ' +
          'thing you are after.' },

  { name: 'back-pressure', re: /\bback-pressure\b/i,
    def: 'The cushion of air that builds up above your vocal folds when the way out is narrowed.',
    feel: 'It holds the folds slightly apart so they meet more softly — full sound, less ' +
          'collision, which is why warm-ups are built on it.' },

  { name: 'resonance', re: /\bresonance\b/i,
    def: 'How large the space above your folds sounds. Shown in centimetres because the number ' +
         'estimates the length of your vocal tract: a longer tube reads as a bigger, lower voice ' +
         'at any pitch.',
    feel: 'A larger sound can be trained without lowering pitch. Explore it with an easy throat; ' +
          'the meter is feedback, not a reason to push the larynx down.' },

  { name: 'vocal weight', re: /\bvocal weight\b|\bweight\b/i,
    def: 'How much of each vocal fold takes part in the vibration. Heavier means thicker contact ' +
         'and a fuller sound; lighter means the thin edges only.',
    feel: 'A fuller sound may feel more substantial in the mouth or chest. The meter estimates a ' +
          'change from your baseline, but only you can feel whether the sound is easy or pressed.' },

  { name: 'pressing', re: /\bpressing\b|\bpressed\b/i,
    def: 'Forcing a note out by squeezing the folds together harder, instead of letting air do ' +
         'the work.',
    feel: 'Tight, effortful, slightly strangled. This is the one to stop for — it is how voice ' +
          'practice causes injury.' },

  { name: 'intonation', re: /\bintonation\b/i,
    def: 'How far your pitch travels while you speak, counted in semitones. A smaller number is ' +
         'a flatter delivery, not a monotone one.',
    feel: 'Most of the difference lives in the last syllable of a sentence: letting it fall ' +
          'reads as a statement, letting it rise reads as a question.' },

  { name: 'semitone', re: /\bsemitones?\b/i,
    def: 'One step on a piano — any key to the key beside it. Pitch differences are counted in ' +
         'semitones rather than hertz because equal steps sound equal to the ear wherever you ' +
         'are in your range.',
    feel: 'Two semitones is a whole step: the first two notes of <i>Frère Jacques</i>.' },

  { name: 'hertz', re: /\bhertz\b/i,
    def: 'Vibrations per second. 130 Hz means your vocal folds open and close 130 times every ' +
         'second. Lower number, lower pitch.',
    feel: 'Speech mostly sits between 85 and 255 Hz.' },

  { name: 'habitual pitch', re: /\bhabitual pitch\b|\bhabitual\b/i,
    def: 'The pitch you land on without thinking about it — your voice at rest, not your best ' +
         'voice. Every target here is derived from it.',
    feel: 'It is measured from you reading aloud normally, which is why calibration asks you not ' +
          'to perform.' },

  { name: 'comfortable floor', re: /\bcomfortable floor\b|\byour floor\b|\bthe floor\b/i,
    def: 'The lowest pitch you can make comfortably — measured from your own glides, not assumed.',
    feel: 'Below it the sound goes creaky and effortful. Targets are always held a margin above ' +
          'it, and the tool will refuse to set one that is not.' },

  { name: 'median', re: /\bmedians?\b/i,
    def: 'The middle value: half the measurements came out higher, half lower.',
    feel: 'Used instead of an average so one squeak, cough or creaky moment cannot move your ' +
          'score.' },

  { name: 'ambiguous zone', re: /\bambiguous zone\b/i,
    def: 'Roughly 130–165 Hz — the pitch range where listeners do not reliably hear a voice as ' +
         'male or female. Below it, pitch alone begins to read as male.',
    feel: 'Reaching it matters less than resonance and weight do. A voice can read as male from ' +
          'inside this zone.' },

  { name: 'ng', re: /\/ŋ\/|\bng\b/i,
    def: 'The sound at the end of <i>sing</i>: tongue against the soft palate, sound leaving ' +
         'through your nose. Written /ŋ/.',
    feel: 'Hold it and pinch your nose — the sound stops. That is how you know you have the ' +
          'right one.' }
];

var glossBox = null, glossTerm = null;

function closeGloss() {
  if (glossTerm) glossTerm.setAttribute('aria-expanded', 'false');
  if (glossBox) glossBox.hidden = true;
  glossTerm = null;
}

function openGloss(btn) {
  var entry = GLOSSARY.filter(function (g) { return g.name === btn.dataset.term; })[0];
  if (!entry) return;
  if (!glossBox) {
    glossBox = document.createElement('div');
    glossBox.id = 'gloss';
    glossBox.setAttribute('role', 'dialog');
    glossBox.setAttribute('aria-label', 'Definition');
    document.body.appendChild(glossBox);
  }
  glossBox.innerHTML = '<div class="gt">' + entry.name + '</div>' +
    '<div class="gd">' + entry.def + '</div>' +
    '<div class="gf">' + entry.feel + '</div>';
  glossBox.hidden = false;

  // Below the word, unless that would run off the bottom of the screen, and
  // never off either side — on a phone the word is often near an edge.
  var r = btn.getBoundingClientRect();
  var vw = document.documentElement.clientWidth;
  var vh = document.documentElement.clientHeight;
  var w = glossBox.offsetWidth, h = glossBox.offsetHeight;
  var below = r.bottom + 8 + h <= vh || r.top - 8 - h < 0;
  glossBox.style.left = Math.max(8, Math.min(r.left - 10, vw - w - 8)) + window.scrollX + 'px';
  glossBox.style.top = (below ? r.bottom + 8 : r.top - 8 - h) + window.scrollY + 'px';

  btn.setAttribute('aria-expanded', 'true');
  glossTerm = btn;
}

// Wraps the first occurrence of each term inside `root`. Once per screen is
// enough to explain a word, and underlining every instance turns a paragraph
// into a minefield.
export function linkTerms(root) {
  if (!root) return;
  GLOSSARY.forEach(function (entry) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      if (!termable(node)) continue;
      var m = entry.re.exec(node.nodeValue);
      if (!m) continue;
      var rest = node.splitText(m.index);
      rest.nodeValue = rest.nodeValue.slice(m[0].length);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'term';
      b.dataset.term = entry.name;
      b.setAttribute('aria-expanded', 'false');
      b.title = 'What this means';
      b.textContent = m[0];
      rest.parentNode.insertBefore(b, rest);
      break;
    }
  });
}

// Headings and controls stay plain: a definition is for prose, and a word
// inside a button cannot become a button of its own.
function termable(node) {
  if (!/\S/.test(node.nodeValue)) return false;
  for (var el = node.parentNode; el && el !== document.body; el = el.parentNode) {
    var tag = el.nodeName.toLowerCase();
    if (tag === 'button' || tag === 'summary' || tag === 'code' || tag === 'svg' ||
        tag === 'h1' || tag === 'h2' || tag === 'h3' ||
        (el.classList && el.classList.contains('eb'))) return false;
  }
  return true;
}

document.addEventListener('click', function (e) {
  var t = e.target.closest ? e.target.closest('.term') : null;
  if (t) { t === glossTerm ? closeGloss() : openGloss(t); return; }
  if (glossTerm && !(e.target.closest && e.target.closest('#gloss'))) closeGloss();
});
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeGloss(); });
window.addEventListener('resize', closeGloss);
