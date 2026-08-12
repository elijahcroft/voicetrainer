// test-transcript.mjs — phrase segmentation of connected speech, the flags
// read off each phrase, and the alignment of recognised words onto them.
// Run: node test-transcript.mjs
//
// Nothing here touches the Web Speech API. The recogniser is stubbed with the
// utterances it would have returned, because what is worth testing is not that
// Chrome can hear — it is that a rise lands on the phrase that rose, that a
// question does not get flagged as uptalk, and that words are dealt out to
// phrases in something like the right proportion.
import { HOLD_LONG_MS, PHRASE_GAP_MS, RUSHED_WPS } from './src/constants.js';
import { PhraseTracker } from './src/analysis/phrases.js';
import { alignTranscript, diffAgainst, flagPhrases, isQuestion,
         splitWords } from './src/analysis/speech-flags.js';

const FRAME = 16.7;
let ok = true;
function check(name, pass, note = '') {
  ok &&= pass;
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name.padEnd(46)} ${note}`);
}

// --- a synthetic speaker --------------------------------------------------
//
// Frames in the shape the analysis loop hands over: voiced with an f0 and an
// aperiodicity, or unvoiced. Loudness rises and falls across each syllable so
// the final-syllable search has the boundary dip it looks for.
function syl(ms, f0a, f0b, { peak = 0.09, creak = false } = {}) {
  const n = Math.round(ms / FRAME), out = [];
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : i / (n - 1);
    out.push({
      voiced: true, f0: f0a + (f0b - f0a) * u, rms: peak * Math.sin(Math.PI * u) ** 0.6,
      aperiodicity: creak ? 0.45 : 0.05
    });
  }
  return out;
}
const gap = ms => Array.from({ length: Math.round(ms / FRAME) },
  () => ({ voiced: false, f0: 0, rms: 0.004, aperiodicity: 1 }));

// Four syllables of body at a steady pitch, then whatever ending is passed in.
const body = (hz = 150, o = {}) => [
  ...syl(180, hz, hz + 2, o), ...gap(45), ...syl(160, hz + 2, hz - 2, o), ...gap(50),
  ...syl(170, hz - 2, hz, o), ...gap(45), ...syl(200, hz, hz - 2, o), ...gap(60)
];

function run(frames) {
  const tr = new PhraseTracker();
  frames.forEach((f, i) => tr.push(f, 1000 + i * FRAME, FRAME));
  tr.end();
  return tr.phrases;
}

// --- segmentation ---------------------------------------------------------
const three = run([
  ...body(), ...syl(210, 148, 118), ...gap(600),
  ...body(), ...syl(300, 128, 175), ...gap(600),
  ...body(), ...syl(220, 148, 146), ...gap(400)
]);
check('three phrases out of three sentences', three.length === 3, `${three.length} found`);
check('endings read fall / rise / flat',
  three.map(p => p.dir).join(' ') === 'fall rise flat', three.map(p => p.dir).join(' '));

// The gap inside a sentence must not split it, and the drill's own threshold
// is the line: a pause a hair under PHRASE_GAP_MS is a breath, not a boundary.
const one = run([...body(), ...gap(PHRASE_GAP_MS - 60), ...syl(210, 148, 118), ...gap(600)]);
check('a short pause does not split a phrase', one.length === 1, `${one.length} found`);

// The phrase still being spoken when the take stops is scored, not dropped.
const trailing = new PhraseTracker();
[...body(), ...syl(210, 148, 118)].forEach((f, i) => trailing.push(f, 1000 + i * FRAME, FRAME));
check('nothing yet closed', trailing.phrases.length === 0);
trailing.end();
check('stopping the take closes the last phrase', trailing.phrases.length === 1);

// --- flags ----------------------------------------------------------------
const band = { lo: 110, hi: 145, center: 128 };

function annotate(phrases, words, ctx = { band, baselineSd: 2.0 }) {
  phrases.forEach((p, i) => { p.words = splitWords(words[i] || ''); p.text = p.words.join(' '); });
  return flagPhrases(phrases, ctx);
}
const flagged = (...a) => annotate(...a).map(p => p.flags.map(f => f.key));

const rises = flagged(
  run([...body(128), ...syl(300, 126, 172), ...gap(600),
       ...body(128), ...syl(210, 126, 104), ...gap(400)]),
  ['I finished it this morning', 'The meeting is on Tuesday']);
check('a rise on a statement is flagged', rises[0].includes('rise'), rises[0].join(','));
check('a landed ending is flagged as nothing', rises[1].length === 0, rises[1].join(','));

// The whole reason transcription is worth doing: the same acoustics, one of
// them a question. Pitch cannot tell these apart and words can.
const asked = flagged(
  run([...body(), ...syl(300, 128, 175), ...gap(400)]),
  ['Are you coming on Tuesday']);
check('the same rise on a question is not a fault',
  !asked[0].includes('rise') && asked[0].includes('ask'), asked[0].join(','));

check('question: wh- opener', isQuestion(splitWords('where did you put it')));
check('question: tag', isQuestion(splitWords('you finished it already, right')));
check('question: written mark', isQuestion(splitWords('you are coming?')));
check('statement is not a question', !isQuestion(splitWords('I left the keys on the table')));

const stretched = flagged(
  run([...body(), ...syl(700, 150, 120), ...gap(400)]),
  ['I finished it this morning']);
check('a leant-on ending is flagged', stretched[0].includes('stretch'), stretched[0].join(','));

const creaky = flagged(
  run([...body(120, { creak: true }), ...syl(210, 118, 100, { creak: true }), ...gap(400)]),
  ['I finished it this morning']);
check('a phrase of fry is flagged', creaky[0].includes('creak'), creaky[0].join(','));

const high = flagged(run([...body(190), ...syl(210, 188, 160), ...gap(400)]),
  ['I finished it this morning']);
check('a phrase above the band is flagged', high[0].includes('high'), high[0].join(','));

// A phrase that swings across half an octave on every syllable, against a
// calibrated baseline of a semitone and a half. One dramatic ending is not a
// swoop — the flag is about the whole line, which is why it takes a line that
// never settles to fire it.
const swoop = flagged(run([
  ...syl(180, 130, 190), ...gap(45), ...syl(160, 190, 132), ...gap(50),
  ...syl(170, 132, 195), ...gap(45), ...syl(200, 195, 135), ...gap(60),
  ...syl(260, 135, 118), ...gap(400)]),
  ['I finished it this morning'], { band, baselineSd: 1.5 });
check('a swoop is flagged against the baseline', swoop[0].includes('swoop'), swoop[0].join(','));

// The one phrase everything is measured on, said normally, must come back
// clean — a panel that flags ordinary speech is a panel nobody reads.
const clean = flagged(run([...body(128), ...syl(210, 126, 104), ...gap(400)]),
  ['I finished it this morning']);
check('ordinary speech inside the band is unflagged', clean[0].length === 0, clean[0].join(','));

const rushed = flagged(run([...body(128), ...syl(210, 126, 104), ...gap(400)]),
  ['one two three four five six seven eight nine ten eleven twelve thirteen']);
check('too many words for the time is flagged', rushed[0].includes('rushed'), rushed[0].join(','));

// --- alignment ------------------------------------------------------------
//
// The recogniser reports one utterance covering two spoken phrases, and it
// reports it late — the window starts after the speech did and ends after it
// stopped. Both phrases must still get words, in order.
const two = run([...body(), ...syl(210, 148, 118), ...gap(600),
                 ...body(), ...syl(300, 128, 175), ...gap(400)]);
alignTranscript(two, [{
  start: two[0].start + 500, end: two[1].end + 800,
  text: 'I finished it this morning are you coming on Tuesday'
}]);
check('a late utterance still reaches both phrases',
  two[0].words.length > 0 && two[1].words.length > 0,
  `${two[0].words.length} + ${two[1].words.length} words`);
check('words stay in the order they were said',
  two[0].words.concat(two[1].words).join(' ') ===
  'I finished it this morning are you coming on Tuesday');
check('the split lands near the phrase boundary',
  Math.abs(two[0].words.length - 5) <= 2, `${two[0].words.length} words in the first phrase`);

// A phrase the recogniser never covered keeps its verdict and shows no words,
// rather than borrowing its neighbour's.
const missed = run([...body(), ...syl(210, 148, 118), ...gap(600),
                    ...body(), ...syl(300, 128, 175), ...gap(400)]);
alignTranscript(missed, [{ start: missed[0].start, end: missed[0].end, text: 'I finished it' }]);
check('an untranscribed phrase gets no borrowed words',
  missed[1].words.length === 0 && missed[1].dir === 'rise');

alignTranscript(missed, []);
check('no transcript at all leaves the phrases intact',
  missed.every(p => p.words.length === 0 && p.dir));

// --- reading against the known passage ------------------------------------
const d = diffAgainst(splitWords('the rainbow is a division of white light'),
                      splitWords('the rainbow is division of light'));
check('skipped words are marked and the rest are not',
  d.filter(x => !x.ok).map(x => x.word).join(' ') === 'a white',
  d.filter(x => !x.ok).map(x => x.word).join(' '));
check('punctuation and case do not count as a misreading',
  diffAgainst(splitWords('rainbow. The rainbow'), splitWords('Rainbow the rainbow'))
    .every(x => x.ok));

// --- the panel it all ends up in ------------------------------------------
//
// String building, so it is checkable here rather than only by looking at it:
// the marks have to land on the words the flags are about, and a clean phrase
// has to come out with nothing on it at all.
const { renderTranscript } = await import('./src/ui/transcript.js');
const panel = renderTranscript(annotate(
  run([...body(128), ...syl(300, 126, 172), ...gap(600),
       ...body(128), ...syl(210, 126, 104), ...gap(400)]),
  ['I think um it went fine', 'The meeting is on Tuesday']));
check('the rise underlines the word it happened on',
  /<span class="txw e rise">fine<\/span>/.test(panel));
check('the filler word is marked as a filler',
  /<span class="txw f">um<\/span>/.test(panel));
check('the landed phrase carries no tags',
  /<div class="txp clean">[^<]*<span class="txw">The/.test(panel));
check('the summary counts what it flagged', /1 ending rose/.test(panel));
check('the panel says the word placement is an estimate', /is an estimate/.test(panel));
check('markup in a transcript is escaped',
  !renderTranscript(annotate(run([...body(128), ...syl(210, 126, 104), ...gap(400)]),
    ['<script>x</script> two three'])).includes('<script>'));

console.log(ok ? '\nall pass' : '\nFAILURES');
process.exit(ok ? 0 : 1);
