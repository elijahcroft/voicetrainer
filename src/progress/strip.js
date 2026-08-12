import { DAILY_GOAL, doneToday, goalMet, progress, rollDay, saveProgress } from './state.js';

// --- the strip in the top bar ---------------------------------------------

export function renderStreak() {
  rollDay();
  var el = document.getElementById('streakStrip');
  if (!el) return;
  var n = doneToday().length;
  var met = goalMet();
  var dots = '';
  for (var i = 0; i < DAILY_GOAL; i++) {
    dots += '<i class="gd' + (i < n ? ' on' : '') + '"></i>';
  }
  el.innerHTML =
    '<span class="sg' + (progress.streak > 0 ? ' live' : '') + '" ' +
      'title="' + (progress.streak > 0
        ? progress.streak + '-day streak, best ' + progress.best
        : 'Finish ' + DAILY_GOAL + ' steps today to start a streak') + '">' +
      '<b aria-hidden="true">▲</b>' + progress.streak + '</span>' +
    '<span class="gdots' + (met ? ' met' : '') + '" ' +
      'title="' + n + ' of ' + DAILY_GOAL + ' steps done today">' + dots +
      '<em>' + n + '/' + DAILY_GOAL + '</em></span>' +
    '<span class="xp" title="Total XP">' + progress.xp + ' XP</span>' +
    '<button class="mute" id="muteBtn" title="' +
      (progress.muted ? 'Sound off' : 'Sound on') + '" aria-label="' +
      (progress.muted ? 'Turn sound on' : 'Turn sound off') + '">' +
      (progress.muted ? '🔇' : '🔊') + '</button>';
  document.getElementById('muteBtn').onclick = function () {
    progress.muted = !progress.muted;
    saveProgress();
    renderStreak();
  };
}

// The strip belongs in the top bar on a wide screen and above the practice
// list on a phone, where the header is already one row too tall. It is the
// same element either way rather than two copies to keep in step, so this
// moves it — the one thing CSS cannot do, since the two homes are in
// different parents.
var narrow = window.matchMedia('(max-width: 700px)');
export function placeStrip() {
  var strip = document.getElementById('streakStrip');
  var nav = document.querySelector('nav');
  var wanted = narrow.matches ? nav : document.querySelector('header');
  if (strip.parentNode === wanted) return;
  if (narrow.matches) nav.insertBefore(strip, document.getElementById('exList'));
  else wanted.insertBefore(strip, document.getElementById('micState').nextSibling);
}
// addListener is the deprecated spelling, and the only one Safari understood
// before 14 — cheap to keep, and this is a page people open on old phones.
if (narrow.addEventListener) narrow.addEventListener('change', placeStrip);
else if (narrow.addListener) narrow.addListener(placeStrip);
