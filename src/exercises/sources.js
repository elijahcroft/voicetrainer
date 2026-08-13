// ==========================================================================
// sources
//
// Every drill in this app claims something about voices. This screen is where
// each claim names the work it rests on, and — just as important — says how
// strong that work is. A drill supported by one blog post and a drill
// supported by a meta-analysis look identical while you are doing them, and
// that is the thing this screen exists to fix.
//
// RESEARCH.md §10 mirrors this list. When you change one, change the other.
// ==========================================================================

// Kind tags match RESEARCH.md: what sort of thing a source is decides how much
// weight it carries, and that is invisible in a bare URL.
var PROGRAMS = [
  {
    id: 'calibrate',
    name: 'Calibration',
    claim: 'That a useful pitch target is derived from your own habitual pitch and your own ' +
           'measured floor, rather than from a population average.',
    grade: 'Moderate',
    refs: [
      ['journal', 'Voice, articulation and prosody contribute to listener perceptions of speaker ' +
        'gender: a systematic review and meta-analysis (JSLHR, 2018) — the 41.6% figure',
        'https://pubs.asha.org/doi/10.1044/2017_JSLHR-S-17-0067'],
      ['journal', 'Influences of F0, formant frequencies, aperiodicity and spectrum level on ' +
        'perception of voice gender (JSLHR)',
        'https://pubs.asha.org/doi/10.1044/1092-4388(2013/12-0314)'],
      ['clinical', 'ASHA practice portal: gender-affirming voice and communication',
        'https://www.asha.org/practice-portal/professional-issues/gender-affirming-voice-and-communication/']
    ]
  },
  {
    id: 'straw',
    name: '1. Straw warm-up',
    claim: 'That phonating through a narrow tube lets you work near the bottom of your range with ' +
           'less collision force than open phonation.',
    grade: 'Moderate',
    refs: [
      ['clinical', 'Lowering your larynx: tube breathing for voice masculinization',
        'https://www.reneeyoxon.com/blog/lowering-your-larynx-tube-breathing-for-voice-masculinization'],
      ['clinical', 'UCSF: transgender voice and communication — vocal health',
        'https://transcare.ucsf.edu/guidelines/vocal-health']
    ]
  },
  {
    id: 'onset',
    name: '2. Easy-onset reset',
    claim: 'That establishing continuous airflow before adding voice can reduce breath-holding ' +
           'and make phonation easier; the checklist itself is intentionally unscored.',
    grade: 'Moderate for flow phonation, Weak for this exact three-step reset',
    refs: [
      ['clinical', 'ASHA Voice Disorders practice portal — stretch-and-flow and flow phonation',
        'https://www.asha.org/practice-portal/clinical-topics/voice-disorders/'],
      ['clinical', 'UCSF: transgender voice and communication — flow phonation and vocal efficiency',
        'https://transcare.ucsf.edu/guidelines/vocal-health']
    ],
    note: 'The microphone cannot score the silent-airflow phase, so completion records practice ' +
          'rather than pretending an acoustic measure can verify the technique.'
  },
  {
    id: 'yawn',
    name: '3. Yawn-sigh',
    claim: 'That larynx height can be trained independently of pitch, and that lowering it ' +
           'lengthens the vocal tract enough to change how the voice reads.',
    grade: 'Strong for the mechanism, Moderate for the exercise',
    refs: [
      ['journal', 'Gender perception of speech: dependence on F0, implied vocal tract length and ' +
        'source spectral tilt (J Voice, 2024)',
        'https://www.jvoice.org/article/S0892-1997(24)00016-X/fulltext'],
      ['journal', 'Transmasculine voice modification: a case study (J Voice, 2019) — one speaker, ' +
        'tract length 17.0 → 19.4 cm alongside 124 → 108 Hz',
        'https://pubmed.ncbi.nlm.nih.gov/31153772/'],
      ['clinical', 'FTM voice training: essential tips and techniques',
        'https://connectedspeechpathology.com/blog/ftm-voice-training-essential-tips-and-techniques']
    ]
  },
  {
    id: 'ng',
    name: '4. "Ng" slides',
    claim: 'That pitch and resonance should descend together, and that a slide on /ŋ/ is where ' +
           'you can feel whether they do.',
    grade: 'Weak — practitioner convention',
    refs: [
      ['blog', 'Transmasculine voice training (Fullerton)',
        'https://peterfullerton.substack.com/p/voice-masculinization'],
      ['clinical', 'FTM voice training: essential tips and techniques',
        'https://connectedspeechpathology.com/blog/ftm-voice-training-essential-tips-and-techniques']
    ]
  },
  {
    id: 'ladder',
    name: '5. Resonance ladder',
    claim: 'That resonance practice should progress from a basic sound through syllables and ' +
           'words into phrases instead of jumping directly from an isolated sound to conversation.',
    grade: 'Moderate for hierarchical transfer, Weak for these prompts and timing',
    refs: [
      ['clinical', 'ASHA Voice Disorders practice portal — resonant voice therapy continuum',
        'https://www.asha.org/practice-portal/clinical-topics/voice-disorders/'],
      ['journal', 'Outcomes of gender-affirming voice and communication modification training ' +
        'for non-binary individuals — sound-to-conversation resonance hierarchy',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC10909913/']
    ],
    note: 'Vowel content changes the resonance estimate. The meter therefore guides each rung, ' +
          'but time practised—not a resonance threshold—unlocks the next rung.'
  },
  {
    id: 'vowels',
    name: '6. Sustained vowels',
    claim: 'That holding the target on an open vowel builds the habit of starting speech there — ' +
           'and that a thin, pressed low note is a failure rather than a success.',
    grade: 'Weak for the drill, Moderate for the strain it guards against',
    refs: [
      ['clinical', 'UCSF: transgender voice and communication — vocal health',
        'https://transcare.ucsf.edu/guidelines/vocal-health'],
      ['clinical', 'Two reasons your voice feels weak on testosterone (Yoxon)',
        'https://www.reneeyoxon.com/blog/two-reasons-your-voice-feels-weak-on-testosterone']
    ]
  },
  {
    id: 'glide',
    name: '7. Pitch glides',
    claim: 'That the safe floor is a measurement that moves with technique, so it is worth ' +
           're-taking rather than assuming.',
    grade: 'Weak — the 3-semitone margin is a deliberately conservative judgement call',
    refs: [
      ['clinical', 'UCSF: transgender voice and communication — vocal health',
        'https://transcare.ucsf.edu/guidelines/vocal-health'],
      ['clinical', 'Voice Science: trans masculine voice change',
        'https://www.voicescience.org/lexicon/trans-masculine-voice-change/']
    ]
  },
  {
    id: 'endings',
    name: '8. Statement endings',
    claim: 'That intonation carries a gendered reading independently of mean pitch, so terminal ' +
           'rise and final-syllable stretch are worth training on their own.',
    grade: 'Moderate for the effect, Weak for the thresholds',
    refs: [
      ['journal', 'What contributes to masculine perception of voice among transmasculine people ' +
        'on testosterone therapy? (J Voice) — F0 SD among the measured properties',
        'https://www.sciencedirect.com/science/article/abs/pii/S0892199724004715'],
      ['journal', 'Voice, articulation and prosody contribute to listener perceptions of speaker ' +
        'gender (JSLHR, 2018) — prosody as a separate contributor',
        'https://pubs.asha.org/doi/10.1044/2017_JSLHR-S-17-0067'],
      ['clinical', 'FTM voice training: essential tips and techniques (intonation section)',
        'https://connectedspeechpathology.com/blog/ftm-voice-training-essential-tips-and-techniques']
    ]
  },
  {
    id: 'passage',
    name: '9. Reading passage',
    claim: 'That connected speech on a fixed text is the comparable measurement — the same reason ' +
           'the research uses standard passages.',
    grade: 'Strong as method',
    refs: [
      ['journal', 'Acoustic predictors of gender attribution, masculinity–femininity and vocal ' +
        'naturalness ratings among transgender and cisgender speakers (J Voice, 2020)',
        'https://pubmed.ncbi.nlm.nih.gov/30503396/'],
      ['journal', 'Real-time resonance biofeedback for gender-affirming voice training: TruVox ' +
        'usability testing',
        'https://www.sciencedirect.com/science/article/abs/pii/S0892199725004205']
    ]
  },
  {
    id: 'free',
    name: '10. Free speech',
    claim: 'That trained habits have to survive spontaneous speech to count, and that practising ' +
           'real situations is how they get there.',
    grade: 'Moderate — carryover practice is standard clinical procedure',
    refs: [
      ['clinical', 'ASHA practice portal: gender-affirming voice and communication — generalization',
        'https://www.asha.org/practice-portal/professional-issues/gender-affirming-voice-and-communication/'],
      ['journal', 'Gender-affirming voice therapy duration and satisfaction (J Voice, 2025)',
        'https://pubmed.ncbi.nlm.nih.gov/39765446/']
    ]
  },
  {
    id: 'focus',
    name: 'Today’s focus',
    claim: 'That several completed days can choose a useful practice emphasis without moving ' +
           'your calibrated targets or letting one noisy take steer the session.',
    grade: 'Weak for the thresholds, Moderate for dosage and carryover',
    refs: [
      ['clinical', 'ASHA practice portal: gender-affirming voice and communication — home ' +
        'practice and generalization',
        'https://www.asha.org/practice-portal/professional-issues/gender-affirming-voice-and-communication/'],
      ['journal', 'Developing and testing a smartphone application to enhance adherence to voice ' +
        'therapy: a pilot study',
        'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9914943/']
    ],
    note: 'The two-day minimum and the four trigger gaps are conservative design choices, not ' +
          'published perceptual or clinical boundaries. The coach collapses retries to one median ' +
          'per day, reads only completed days, and never changes a target.'
  },
  {
    id: 'strain',
    name: 'The two warnings',
    claim: 'That creak can be told apart from a note, and that a voice getting rougher across a ' +
           'session can be seen in the signal before you notice it yourself.',
    grade: 'Moderate for the measures, Weak for the thresholds',
    refs: [
      ['journal', 'Cepstral peak prominence values for clinical voice evaluation — the measure ' +
        'behind the rest warning',
        'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7893528/'],
      ['journal', 'CPPS and the Acoustic Voice Quality Index: comparison, relationship with ' +
        'auditory-perceptual judgement, and cut-off points',
        'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11189156/'],
      ['journal', 'Impact of vocal fry and speaker gender on listener perceptions of speaker ' +
        'personal attributes',
        'https://pubmed.ncbi.nlm.nih.gov/36400634/'],
      ['clinical', 'UCSF: transgender voice and communication — vocal health',
        'https://transcare.ucsf.edu/guidelines/vocal-health']
    ],
    note: 'Neither warning can tell you that your voice is fine, and neither is a substitute for ' +
          'how your throat feels. They only ever speak up, never reassure — the published cut-off ' +
          'points are for clinical assessment of a recorded voice, not for a phone microphone in ' +
          'your kitchen, so this tool compares you only against yourself, minutes earlier.'
  },
  {
    id: 'biofeedback',
    name: 'The live meters themselves',
    claim: 'That watching your own resonance in real time helps at all.',
    grade: 'Moderate — usability and single-session results, with trans women rather than ' +
           'transmasculine users',
    refs: [
      ['journal', 'TruVox: development and single-session evaluations',
        'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12481138/'],
      ['conference', 'Web-based application for real-time biofeedback of vocal resonance ' +
        '(Interspeech 2025)',
        'https://www.isca-archive.org/interspeech_2025/mcallister25_interspeech.pdf']
    ]
  }
];

export function buildSources() {
  var html =
    '<div class="card">' +
      '<h3>Sources</h3>' +
      '<p class="why">What each drill claims, and the work that claim rests on. The grade is the ' +
      'strength of the evidence <i>for the way this tool uses it</i> — not how interesting the ' +
      'finding is. Where it says <b>Weak</b>, believe the direction and not the digits: that is ' +
      'practitioner convention, and a different SLP would do it differently.</p>' +
      '<div class="banner info" style="margin:0 0 4px">This is a practice aid, not a clinician. ' +
      'None of the work below was done on this app, and none of it can tell you whether what you ' +
      'are doing today is safe for your voice — stop for pain, tightness or hoarseness.</div>' +
      PROGRAMS.map(entry).join('') +
      '<p class="hint"><b>RESEARCH.md</b> in the repository carries the same list with the ' +
      'reasoning, every constant in the code, and what the measurements cannot see.</p>' +
    '</div>';
  return { html: html };
}

function entry(p) {
  return '<div class="src">' +
    '<h4>' + p.name + '<span class="grade">' + p.grade + '</span></h4>' +
    '<p>' + p.claim + '</p>' +
    '<ul>' + p.refs.map(function (r) {
      return '<li><i>' + r[0] + '</i> <a href="' + r[2] + '" target="_blank" rel="noopener noreferrer">' +
        r[1] + '</a></li>';
    }).join('') + '</ul>' +
    (p.note ? '<p class="hint">' + p.note + '</p>' : '') +
  '</div>';
}
