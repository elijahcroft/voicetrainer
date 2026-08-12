import { ASR_LEAD_MS, CREAK_ON, HOLD_LONG_MS, PHRASE_MIN_WORDS, RUSHED_WPS,
         SWOOP_RATIO } from '../constants.js';

// --- what went wrong, and on which word -----------------------------------
//
// Pure: phrases in, annotated phrases out, no DOM and no audio, so the whole
// judgement is testable from a fixture. Two jobs, in order — put words onto
// the phrases the pitch tracker found, then say what is wrong with each.
//
// The flags are deliberately few. Every one of them is something the DSP could
// already see and had no way to point at, and every one is actionable in the
// moment: a rise you did not intend, an ending you leaned on, a phrase that
// swooped, a phrase that was creak. Nothing here scores you — the tables still
// do that — it only says where to look.

// --- alignment ------------------------------------------------------------
//
// The Web Speech API gives no word timings, only whole utterances, and even
// those arrive late: the first interim result lands a fraction of a second
// after you started speaking, and the final one lands after you stopped. So
// the alignment is done in two steps that each fail softly. Phrases are
// matched to the utterance they overlap most, after widening the utterance
// backwards by the recogniser's lead. Then, inside one utterance, its words
// are dealt out to its phrases in proportion to voiced time.
//
// That second step is an estimate and is labelled as one in the interface.
// Speech rate is near enough constant within an utterance for it to land the
// right words in the right phrase most of the time, and the verdicts it
// carries — which are measured, not estimated — sit on the phrase either way.
export function alignTranscript(phrases, utterances) {
  phrases.forEach(function (p) { p.words = []; p.text = ''; });
  if (!utterances || !utterances.length) return phrases;

  var groups = utterances.map(function () { return []; });
  phrases.forEach(function (p) {
    var best = -1, bestOv = 0;
    utterances.forEach(function (u, i) {
      var lo = Math.max(p.start, u.start - ASR_LEAD_MS);
      var hi = Math.min(p.end, u.end);
      var ov = hi - lo;
      if (ov > bestOv) { bestOv = ov; best = i; }
    });
    // A phrase the recogniser never covered keeps its measured verdict and
    // shows as untranscribed, rather than borrowing a neighbour's words.
    if (best >= 0) groups[best].push(p);
  });

  groups.forEach(function (group, i) {
    if (!group.length) return;
    var words = splitWords(utterances[i].text);
    if (!words.length) return;
    var total = 0;
    group.forEach(function (p) { total += p.voicedMs; });
    var at = 0;
    group.forEach(function (p, k) {
      var n = k === group.length - 1
        ? words.length - at
        : Math.round(words.length * (p.voicedMs / total));
      // Every phrase in the group spoke, so every one gets at least one word,
      // even where rounding would otherwise leave it empty.
      n = Math.max(1, Math.min(n, words.length - at - (group.length - 1 - k)));
      p.words = words.slice(at, at + n);
      p.text = p.words.join(' ');
      at += n;
    });
  });
  return phrases;
}

export function splitWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean);
}

export function normalize(word) {
  return String(word).toLowerCase().replace(/[^a-z0-9']+/g, '');
}

// --- questions ------------------------------------------------------------
//
// The reason transcription is worth the trouble. A rising ending is only a
// habit worth changing when the sentence was not a question, and pitch alone
// cannot tell the two apart — "you're coming" and "you're coming?" are the
// same acoustics. Without the words, the endings analysis has to either flag
// every rise, which is wrong whenever you asked something, or flag none.
//
// Recognisers punctuate inconsistently, so the mark is taken when it is there
// and the wording is read when it is not.
var QUESTION_WORDS = ('who what when where why how which whose whom is are was were ' +
  'am do does did can could will would should shall may might have has had ' +
  "isn't aren't wasn't weren't don't doesn't didn't can't couldn't won't " +
  "wouldn't shouldn't haven't hasn't hadn't").split(' ');

var TAGS = ['right', 'okay', 'ok', 'yeah', 'no', 'yes', 'huh', 'eh'];

export function isQuestion(words) {
  if (!words || !words.length) return false;
  if (/\?\s*$/.test(words[words.length - 1])) return true;
  if (QUESTION_WORDS.indexOf(normalize(words[0])) >= 0) return true;
  // "...isn't it", "...doesn't he", "..., right" — a tag question rises on
  // purpose and is a normal thing to say.
  var last = normalize(words[words.length - 1]);
  if (TAGS.indexOf(last) >= 0 && words.length > 2) return true;
  if (words.length > 2 && QUESTION_WORDS.indexOf(normalize(words[words.length - 2])) >= 0 &&
      ['it', 'he', 'she', 'they', 'we', 'you', 'i', 'that', 'this'].indexOf(last) >= 0) return true;
  return false;
}

// Hesitation sounds and the verbal padding that goes with them. Not a voice
// fault and nothing to do with pitch — but this is the only place in the app
// that can see them at all, and in free speech they are usually the first
// thing someone wants to know about their own recording.
var FILLERS = ['um', 'uh', 'erm', 'er', 'ah', 'hmm', 'mm', 'like', 'basically',
  'literally', 'actually', 'sorta', 'kinda'];

export function isFiller(word) {
  return FILLERS.indexOf(normalize(word)) >= 0;
}

// --- flags ----------------------------------------------------------------

// `ctx` carries the reference points the phrase is judged against — the pitch
// band and the calibrated intonation spread — because they come from stored
// state and this module does not read stored state.
export function flagPhrase(p, ctx) {
  ctx = ctx || {};
  var flags = [];
  function add(key, label, detail) { flags.push({ key: key, label: label, detail: detail }); }

  var question = isQuestion(p.words);
  p.question = question;

  if (p.dir === 'rise') {
    if (question) {
      add('ask', 'question', 'Rose ' + p.delta.toFixed(1) + ' st — a question, so a rise belongs here.');
    } else {
      add('rise', 'rose', 'The last syllable went up ' + p.delta.toFixed(1) +
        ' semitones. On a statement that reads as uncertainty. Drop the pitch onto it and stop.');
    }
  }
  if (p.hold != null && p.hold > HOLD_LONG_MS) {
    add('stretch', 'stretched', 'The final syllable ran ' + p.hold.toFixed(0) + ' ms — over ' +
      HOLD_LONG_MS + ' ms it starts to sound leant on. Cut it short.');
  }
  if (p.creakFrac > CREAK_ON) {
    add('creak', 'creak', Math.round(p.creakFrac * 100) + '% of this phrase was fry rather than ' +
      'a note. Come up a few hertz to where the voice can actually hold.');
  }
  if (ctx.band && p.f0 > ctx.band.hi) {
    add('high', 'high', p.f0.toFixed(0) + ' Hz against a target band topping out at ' +
      ctx.band.hi.toFixed(0) + ' Hz.');
  }
  if (ctx.baselineSd != null && p.sd != null && p.sd > ctx.baselineSd * SWOOP_RATIO) {
    add('swoop', 'swooped', 'Pitch moved ' + p.sd.toFixed(1) + ' st within this phrase, against a ' +
      'baseline of ' + ctx.baselineSd.toFixed(1) + ' st. Wide swings read higher than the median does.');
  }
  var secs = p.voicedMs / 1000;
  if (p.words.length >= PHRASE_MIN_WORDS && secs > 0.5 && p.words.length / secs > RUSHED_WPS) {
    add('rushed', 'rushed', (p.words.length / secs).toFixed(1) + ' words a second. Pace is not ' +
      'scored anywhere, but rushing is how the other four go wrong at once.');
  }

  p.flags = flags;
  // Filler words are marked on the word rather than on the phrase, so the
  // transcript can underline the "um" itself.
  p.fillers = p.words.filter(isFiller).length;
  return p;
}

export function flagPhrases(phrases, ctx) {
  phrases.forEach(function (p) { flagPhrase(p, ctx); });
  return phrases;
}

// --- reading against a known text -----------------------------------------
//
// Only the passage drill can do this: it is the one take where what you were
// supposed to say is known in advance. A longest-common-subsequence diff over
// normalised words marks what was skipped and what came out as something else,
// which is worth having because a misread line is the usual reason a passage
// take scores oddly against the calibration of the same passage.
export function diffAgainst(expected, spoken) {
  var n = expected.length, m = spoken.length;
  var i, j;
  var lcs = [];
  for (i = 0; i <= n; i++) lcs.push(new Array(m + 1).fill(0));
  for (i = n - 1; i >= 0; i--) {
    for (j = m - 1; j >= 0; j--) {
      lcs[i][j] = normalize(expected[i]) === normalize(spoken[j])
        ? lcs[i + 1][j + 1] + 1
        : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  var out = [];
  i = 0; j = 0;
  while (i < n && j < m) {
    if (normalize(expected[i]) === normalize(spoken[j])) { out.push({ word: expected[i], ok: true }); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) { out.push({ word: expected[i], ok: false }); i++; }
    else j++;
  }
  for (; i < n; i++) out.push({ word: expected[i], ok: false });
  return out;
}
