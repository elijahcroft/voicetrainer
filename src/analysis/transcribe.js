// --- transcription --------------------------------------------------------
//
// Everything else in this app is measured on the device and thrown away. This
// is the one exception, and it is off until you turn it on: the Web Speech API
// in Chrome and Safari does not recognise anything locally — it opens its own
// microphone stream and sends the audio to the vendor's servers. For a tool
// people use to practise a voice they are not out about, that is not a detail
// to bury, so it is opt-in, it is remembered per-device, and the copy next to
// the switch says where the audio goes.
//
// What it buys is the thing pitch alone cannot give: *which words* the rise
// happened on. A take that reports "three endings rose" is a score; a take that
// shows you the sentence with the rise sitting on the last word is a note you
// can act on.

var KEY = 'voice-trainer-transcribe-v1';

var SR = typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

export var transcription = {
  supported: !!SR,
  enabled: false
};

try {
  transcription.enabled = transcription.supported && localStorage.getItem(KEY) === '1';
} catch (e) { /* private mode: the default of off is the safe one */ }

export function setTranscription(on) {
  transcription.enabled = !!on && transcription.supported;
  try { localStorage.setItem(KEY, transcription.enabled ? '1' : '0'); } catch (e) {}
}

// A run of recognition over one take. Utterances arrive with the wall-clock
// time they were first heard and the time they were finalised, on the same
// clock as requestAnimationFrame, which is what lets them be lined up against
// the phrases the pitch tracker found.
export function Recognizer() {
  this.utterances = [];
  this.error = null;
  this.wanted = false;
  this.rec = null;
  this.seen = null;
}

Recognizer.prototype.start = function () {
  if (!transcription.enabled || !SR) return false;
  this.utterances = [];
  this.error = null;
  this.wanted = true;
  this.open();
  return true;
};

Recognizer.prototype.open = function () {
  var self = this;
  var rec = new SR();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
  // Index within *this* recognition session. Chrome restarts numbering from
  // zero every time it reopens, so the map is cleared with the session rather
  // than carried across it.
  this.seen = {};

  rec.onresult = function (ev) {
    var now = performance.now();
    for (var i = ev.resultIndex; i < ev.results.length; i++) {
      if (self.seen[i] == null) self.seen[i] = now;
      if (!ev.results[i].isFinal) continue;
      var text = (ev.results[i][0].transcript || '').trim();
      if (!text) continue;
      self.utterances.push({ start: self.seen[i], end: now, text: text });
    }
  };
  // "no-speech" and "aborted" are how a pause and a stop announce themselves;
  // neither is worth telling anyone about. The rest are.
  rec.onerror = function (ev) {
    if (ev.error === 'no-speech' || ev.error === 'aborted') return;
    self.error = ev.error === 'not-allowed' || ev.error === 'service-not-allowed'
      ? 'The browser refused speech recognition. It needs its own microphone permission, ' +
        'separate from the one this page already has.'
      : ev.error === 'network'
      ? 'Speech recognition could not reach the network, so there is no transcript for this take.'
      : 'Speech recognition stopped: ' + ev.error + '.';
  };
  // Chrome ends a session of its own accord after a stretch of silence, which
  // in a minute of free speech happens several times. Reopening keeps one take
  // one transcript.
  rec.onend = function () { if (self.wanted) self.open(); };

  try { rec.start(); } catch (e) { this.error = 'Speech recognition would not start.'; }
  this.rec = rec;
};

Recognizer.prototype.stop = function () {
  this.wanted = false;
  if (this.rec) { try { this.rec.stop(); } catch (e) {} }
  this.rec = null;
};
