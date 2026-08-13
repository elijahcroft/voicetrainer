import { completeStep } from '../progress/state.js';

// --- easy-onset reset -----------------------------------------------------
//
// Airflow before voicing is not something the microphone can grade honestly:
// the first phase is deliberately silent. This is therefore a short guided
// checklist, useful both as a routine step and as a reset whenever another
// drill starts to feel gripped.

var PHASES = [
  {
    n: '1 of 3', title: 'Find continuous airflow',
    prompt: 'silent “hoo”',
    body: 'Hold a tissue or your palm 5–8 cm in front of your lips. Exhale gently for about four ' +
          'seconds and keep the movement steady. Repeat three times; do not make a voice yet.'
  },
  {
    n: '2 of 3', title: 'Add voice without stopping the air',
    prompt: 'hoo',
    body: 'Begin with the same easy airflow, then let a quiet “hoo” appear on it. The air should ' +
          'not jerk or stop when the sound begins. Repeat five times at a comfortable pitch.'
  },
  {
    n: '3 of 3', title: 'Carry the easy start into speech',
    prompt: 'Who are we waiting for?',
    body: 'Say the phrase five times. Keep the first “who” as easy as the “hoo” you just made, ' +
          'then let the rest of the sentence stay conversational. Fully release between attempts.'
  }
];

export function buildOnset() {
  var html =
    '<div class="card">' +
      '<h3>Easy-onset reset</h3>' +
      '<p class="why">This reset coordinates breath and sound before low or resonant practice. ' +
      'It is for the moment a note feels stuck, squeezed, or difficult to begin; it is not a way ' +
      'to make the voice breathy.</p>' +
      '<div class="practice-cue"><b>Do this</b><span>Work through all three cards in order. Each ' +
        'takes about 30 seconds. Nothing is acoustically scored because steady silent airflow ' +
        'cannot be measured by the microphone.</span></div>' +
      '<div id="onsetPhase"></div>' +
      '<p class="stop-rule">Use only enough air to move the tissue gently. Stop if you become ' +
        'light-headed or if adding voice creates pain, tightness, or increasing effort.</p>' +
    '</div>';
  var phase = 0;

  function render() {
    var p = PHASES[phase];
    var final = phase === PHASES.length - 1;
    document.getElementById('onsetPhase').innerHTML =
      '<div class="prompt-card">' +
        '<div class="cnt">step ' + p.n + ' · ' + p.title + '</div>' +
        '<div class="onset-prompt">' + p.prompt + '</div>' +
        '<p>' + p.body + '</p>' +
      '</div>' +
      '<div class="row"><button id="onsetNext" class="primary">' +
        (final ? 'Finish reset' : 'Done — next step') + '</button>' +
        '<span id="status" style="color:var(--dim);font-size:13px"></span></div>';
    document.getElementById('onsetNext').onclick = function () {
      if (!final) { phase++; render(); return; }
      completeStep('onset');
      this.disabled = true;
      this.textContent = 'Reset complete';
      document.getElementById('status').textContent = 'This step is done for today.';
    };
  }

  return { html: html, mount: render };
}
