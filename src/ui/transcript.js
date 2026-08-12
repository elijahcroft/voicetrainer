import { diffAgainst, isFiller, splitWords } from '../analysis/speech-flags.js';

// --- the annotated transcript ---------------------------------------------
//
// One line per phrase, in the order you said them, with the fault written
// against the phrase it happened in. The rule everywhere here is that a mark
// on a word means the word, and a tag at the end of the line means the phrase:
// a rise is a property of the ending, so it underlines the last word; a swoop
// is a property of the whole line, so it does not underline anything.
//
// Endings that landed get no mark at all. A transcript where every line is
// annotated is a transcript nobody reads twice.

function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

// Which flags are about the ending, and therefore mark the final word.
var ENDING = { rise: 1, stretch: 1, ask: 1 };

export function renderTranscript(phrases, opts) {
  opts = opts || {};
  var scored = phrases.filter(function (p) { return p.words.length; });
  if (!scored.length) {
    return '<div class="banner info compact" style="margin-top:14px"><span aria-hidden="true">✎</span>' +
      '<span>No words came back for this take. Recognition needs a reasonably quiet room, and it ' +
      'stays silent rather than guessing.</span></div>';
  }

  var lines = phrases.map(function (p) {
    if (!p.words.length) {
      // Measured but not transcribed. Saying so is better than dropping the
      // phrase, which would make the transcript disagree with the counts.
      return '<div class="txp"><span class="txq">(' + (p.voicedMs / 1000).toFixed(1) +
        ' s not transcribed)</span>' + tags(p) + '</div>';
    }
    var endingFlag = p.flags.filter(function (f) { return ENDING[f.key]; })[0];
    var last = p.words.length - 1;
    var words = p.words.map(function (w, i) {
      var cls = [];
      if (isFiller(w)) cls.push('f');
      if (i === last && endingFlag) cls.push('e', endingFlag.key);
      return '<span class="txw' + (cls.length ? ' ' + cls.join(' ') : '') + '">' + esc(w) + '</span>';
    }).join(' ');
    return '<div class="txp' + (p.flags.length ? '' : ' clean') + '">' + words + tags(p) + '</div>';
  }).join('');

  return '<div class="tx">' + lines + '</div>' + summary(phrases) +
    (opts.expected ? misread(opts.expected, phrases) : '');
}

function tags(p) {
  if (!p.flags.length) return '';
  return '<span class="txt">' + p.flags.map(function (f) {
    return '<b class="' + f.key + '" title="' + esc(f.detail) + '">' + f.label + '</b>';
  }).join('') + '</span>';
}

function summary(phrases) {
  var counts = {};
  var fillers = 0;
  phrases.forEach(function (p) {
    fillers += p.fillers;
    p.flags.forEach(function (f) { counts[f.key] = (counts[f.key] || 0) + 1; });
  });
  var parts = [];
  function part(key, one, many) {
    if (!counts[key]) return;
    parts.push(counts[key] + ' ' + (counts[key] === 1 ? one : many));
  }
  part('rise', 'ending rose', 'endings rose');
  part('stretch', 'stretched ending', 'stretched endings');
  part('creak', 'creaky phrase', 'creaky phrases');
  part('high', 'phrase above the band', 'phrases above the band');
  part('swoop', 'swoop', 'swoops');
  part('rushed', 'rushed phrase', 'rushed phrases');
  if (fillers) parts.push(fillers + ' filler word' + (fillers === 1 ? '' : 's'));
  if (counts.ask) parts.push(counts.ask + ' question' + (counts.ask === 1 ? '' : 's') + ', not counted');
  return '<div class="hint">' + phrases.length + ' phrases · ' +
    (parts.length ? parts.join(' · ') : 'nothing flagged') +
    '. Words come from the browser’s speech recognition and are placed on each phrase by ' +
    'timing, so which line a word landed on is an estimate — the verdicts beside them are measured.' +
    '</div>';
}

// Passage only: what you actually read against what was on the screen.
function misread(expected, phrases) {
  var spoken = [];
  phrases.forEach(function (p) { spoken = spoken.concat(p.words); });
  if (!spoken.length) return '';
  var diff = diffAgainst(splitWords(expected), spoken);
  var missed = diff.filter(function (d) { return !d.ok; }).length;
  if (!missed) return '';
  // Past half the passage the recogniser is the thing that failed, not the
  // reading, and marking every other word would train you to distrust the panel.
  if (missed / diff.length > 0.5) {
    return '<div class="hint">Too little of the passage was recognised to check the reading ' +
      'against it.</div>';
  }
  return '<details class="explain"><summary>' + missed + ' word' + (missed === 1 ? '' : 's') +
    ' did not come back as written</summary><div>' +
    '<div class="tx"><div class="txp">' + diff.map(function (d) {
      return '<span class="txw' + (d.ok ? '' : ' miss') + '">' + esc(d.word) + '</span>';
    }).join(' ') + '</div></div>' +
    '<p class="note">Marked words were skipped, swapped, or not heard clearly. The resonance ' +
    'comparison assumes you read the same vowels as your calibration, so a heavily marked passage ' +
    'is a reason to read it again rather than to trust the number.</p>' +
    '</div></details>';
}
