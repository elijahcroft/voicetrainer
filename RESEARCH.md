# Research behind the voice trainer

Every number the tool uses traces to something here. Where the evidence is weak, this file says
so — a target that looks authoritative but isn't is worse than no target.

**Contents**

1. [Pitch is a minority of the effect](#1-pitch-is-a-minority-of-the-effect)
2. [Where the pitch boundaries actually are](#2-where-the-pitch-boundaries-actually-are)
3. [Resonance / vocal tract length](#3-resonance--vocal-tract-length)
4. [Safety — why the floor is measured, not assumed](#4-safety--why-the-floor-is-measured-not-assumed)
5. [The exercises](#5-the-exercises)
6. [Real-time biofeedback works](#6-real-time-biofeedback-works)
7. [Measurement notes and honest limitations](#7-measurement-notes-and-honest-limitations)
8. [What the tool does not measure, and what the evidence says it should](#8-what-the-tool-does-not-measure-and-what-the-evidence-says-it-should)
9. [Practice dosage, carryover, and the testosterone timeline](#9-practice-dosage-carryover-and-the-testosterone-timeline)
10. [Sources by exercise](#10-sources-by-exercise)
11. [The two warnings: creak, and voice quality across a session](#11-the-two-warnings-creak-and-voice-quality-across-a-session)

---

## How to read this file

Each section carries an evidence rating. It grades the **support for the number the tool uses**,
not how interesting the finding is:

| Rating | Meaning |
|---|---|
| **Strong** | Multiple peer-reviewed sources agree, and the tool uses the number the way they measured it. |
| **Moderate** | Peer-reviewed, but a single study, a small sample, or a value the tool rounds or adapts. |
| **Weak** | Practitioner consensus and clinical writing rather than a measured result. Believe the direction, not the digits. |
| **Verified here** | Established by running this repo's own code against known signals (`node test-dsp.mjs`, `node test-endings.mjs`), not taken from literature. |

Each source is tagged with what kind of thing it is — `[journal]`, `[conference]`, `[clinical]`
(SLP or voice-teacher writing), `[blog]` — because a number's weight depends on where it came from
and that is invisible in a bare URL.

### Every constant, and where it comes from

| Constant | Value | Lives in | Why | Evidence |
|---|---|---|---|---|
| `MASC_F0_CEILING` | 130 Hz | `src/constants.js` | Below this, listeners reliably hear "male" | §2 — Moderate |
| `ANDROGYNOUS_LOW` | 140 Hz | `src/constants.js` | Bottom of the ambiguous band | §2 — Moderate |
| `ANDROGYNOUS_HIGH` | 165 Hz | `src/constants.js` | Top of the ambiguous band | §2 — Moderate |
| `RESONANCE_GOAL` | ×1.10 | `src/constants.js` | Bottom of the 10–20% cis-male tract-length range | §3 — Strong |
| `FLOOR_MARGIN_ST` | 3 semitones | `src/constants.js` | Never target this close to the bottom of a range | §4 — Weak (deliberately conservative) |
| `TERMINAL_ST` | 1.0 semitone | `src/constants.js` | Below this, a phrase ending is called flat rather than rising or falling | §5 — Weak (judgement call) |
| `HOLD_LONG_MS` | 350 ms | `src/constants.js` | Final syllable longer than this is flagged as stretched | §5 — Weak (judgement call) |
| `SYLLABLE_DIP` | 0.5 | `src/constants.js` | Loudness dip, relative to the nucleus, that marks where the final syllable starts | §5 — Verified here |
| `SMOOTH_HALF_MS` | 25 ms | `src/analysis/smooth.js` | Median window for the contour and the loudness envelope | §5 — Verified here |
| `CREAK_APERIODICITY` | 0.2 | `src/constants.js` | Above this a frame is creak rather than a note | §11 — Weak (judgement call) |
| `CPP_DROP_DB` | 3 dB | `src/constants.js` | Session decline that raises the rest warning | §11 — Weak (judgement call) |
| `CPP_F0_GATE_HZ` | 15 Hz | `src/constants.js` | Pitch difference above which the strain comparison refuses to answer | §11 — Verified here |
| `CPP_HOLD_MS` | 5 s | `src/constants.js` | How long a decline must persist before it is called one | §11 — Verified here |
| `MIN_FOCUS_DAYS` | 2 days | `src/progress/focus.js` | A single practice day cannot specialize the next session | §9 — Weak (conservative design choice) |
| `MAX_FOCUS_DAYS` | 5 days | `src/progress/focus.js` | Keeps coaching responsive without letting one take dominate | §9 — Weak (design choice) |
| Coaching gaps | pitch 6%; resonance 4%; intonation 15%; carryover 6% | `src/progress/focus.js` | Minimum gap before the daily plan specializes | §9 — Weak (measurement guards, not perceptual cut-points) |
| LPC order | 20 | `src/dsp.js` | Textbook order 14 cannot cover 0–6 kHz here | §7 — Verified here |
| Formant-gate tolerance | see `estimateVTL()` | `src/dsp.js` | Rejects frames where a formant is missing or spurious | §7 — Verified here |

### How a measurement becomes a target

```
  YOUR VOICE                    MEASURED                   DERIVED
  ─────────                     ────────                   ───────

  read the passage  ──────►  habitual F0  ───┐
  in your own voice          resonance       │
                             weight          ├──►  pitch target
                             intonation SD   │     = max( min(habitual − 2 st, 130 Hz),
                                             │            floor + 3 semitones )
  sigh down on "ahh" ─────►  comfortable ────┘
  until it turns creaky      floor                 if that lands at or above where you
       │                                           already speak, the tool reports
       │                                           "no headroom" rather than a target
       └── creaky frames are discarded, so a
           creak cannot set the floor too low
           and drag every later target down with it

                             resonance   ───────►  resonance goal
                             baseline              = baseline × 1.10
```

The whole point of the left column is that nothing on the right is a population average. Two people
with the same habitual pitch can get different targets, because the floor is what decides whether
lowering is safe.

---

## 1. Pitch is a minority of the effect

> **Evidence: Strong.** Three independent peer-reviewed sources, and the tool only uses the
> qualitative conclusion (resonance deserves equal billing), not the exact percentage.

The single most useful finding for designing this tool: **speaking fundamental frequency (F0)
accounts for roughly 41.6% of the variance in how listeners gender a voice**, in an analysis
across 38 studies. Nearly 60% of the effect lives elsewhere — principally in the spectral
structure of formants, which reflects vocal tract length.

The corollary matters for anyone whose range won't drop far: pitch is not the ceiling on how
masculine a voice can read.

- `[journal]` Voice, articulation and prosody contribute to listener perceptions of speaker gender:
  a systematic review and meta-analysis (JSLHR, 2018) — **the source of the 41.6% figure**, and of
  the finding that resonance, loudness, articulation and intonation each contribute alongside it —
  <https://pubs.asha.org/doi/10.1044/2017_JSLHR-S-17-0067>
- `[journal]` Testosterone therapy masculinizes speech and gender presentation in transgender men —
  <https://www.nature.com/articles/s41598-021-82134-2>
- `[journal]` Influences of F0, formant frequencies, aperiodicity and spectrum level on perception
  of voice gender (JSLHR) — <https://pubs.asha.org/doi/10.1044/1092-4388(2013/12-0314)>
- `[journal]` Gender perception of speech: dependence on F0, implied vocal tract length, and source
  spectral tilt (J Voice, 2024) — <https://www.jvoice.org/article/S0892-1997(24)00016-X/fulltext>

**Used for:** the decision to give resonance equal billing with pitch, and the wording shown when
someone's range can't reach the masculine band.

---

## 2. Where the pitch boundaries actually are

> **Evidence: Moderate.** The perceptual effect is well attested, but the exact cut-points differ
> between studies and the tool rounds them (138→140, 163→165) for legibility. Treat the boundaries
> as a band with soft edges, which is how the pitch ribbon draws them.

| Quantity | Value | Constant in code |
|---|---|---|
| Cis men, average speaking F0 | ~100–120 Hz | — |
| Cis women, average speaking F0 | ~190–220 Hz | — (drawn as the "reads female" zone) |
| Reliably read as male | below ~130 Hz | `MASC_F0_CEILING = 130` |
| Androgynous / ambiguous zone | ~140–165 Hz | `ANDROGYNOUS_LOW/HIGH` |

Listener gender-recognition accuracy exceeds 80% below ~138 Hz and above ~163 Hz, and drops
sharply in between. That ambiguous band is drawn on the pitch ribbon because it is a genuinely
different perceptual regime, not a smooth gradient.

```
   80        100       130   140      165      190       220      260 Hz
   ├──────────┴─────────┼─────┼────────┼────────┼─────────┴────────┤
   │    reads male      │     │ ambig- │        │   reads female   │
   │   (>80% accuracy)  │     │  uous  │        │  (>80% accuracy) │
                        ▲              ▲        ▲
              MASC_F0_CEILING   ANDROGYNOUS_   cis-female
                                  LOW/HIGH     average floor
```

Crossing the ambiguous band buys more than the same number of hertz anywhere else on the scale.
This is the single reason the tool draws zones instead of a gradient.

- `[blog]` The effects of speaking fundamental frequency on gender perception —
  <https://medium.com/@kaseyvaldivia/the-effects-of-speaking-fundamental-frequency-on-gender-perception-6de444e54d0a>
  (secondary summary — the 138/163 Hz figures should be read from the primary sources below)
- `[conference]` Cues for perception of gender in synthetic voices (Interspeech 2020) —
  <https://www.isca-archive.org/interspeech_2020/hope20_interspeech.pdf>
- `[journal]` Speaking fundamental frequency and vowel formant frequencies: effects on perception
  of gender — <https://www.sciencedirect.com/science/article/abs/pii/S0892199712002056>

---

## 3. Resonance / vocal tract length

> **Evidence: Strong** for the anatomy and for hormones-do-not-deliver-resonance.
> **Moderate** for the manual-therapy result, which is a small clinical literature.

Cis male vocal tracts are **10–20% longer** than cis female ones, which lowers all formants and
is a large part of what "size" in a voice means. The tool's resonance goal is `baseline × 1.10`
(`RESONANCE_GOAL`) — deliberately the bottom of that range, because it should be reachable.

The finding that shaped the whole design: in transmasculine people on testosterone, F0 and F0
standard deviation became **statistically indistinguishable from cis men, while vocal tract length
remained intermediate**. Hormones deliver pitch; they do not deliver resonance. Resonance is the
part training is for.

Manual laryngeal therapy and reposturing have been shown to increase vocal tract length and lower
mean F0, with listeners rating the voice as most masculine at the end of a training session.

- `[journal]` What contributes to masculine perception of voice among transmasculine people on
  testosterone therapy? (J Voice) —
  <https://www.sciencedirect.com/science/article/abs/pii/S0892199724004715>
- `[journal]` Resynthesis of transmasculine voices to assess gender perception as a function of
  testosterone therapy — <https://pmc.ncbi.nlm.nih.gov/articles/PMC9584127/>
- `[journal]` Transmasculine voice modification: a case study (J Voice; n = 1) —
  <https://www.sciencedirect.com/science/article/abs/pii/S089219971930116X>

---

## 4. Safety — why the floor is measured, not assumed

> **Evidence: Weak** in the strict sense — this is practitioner consensus, not a controlled trial,
> and the 3-semitone margin is a judgement call rather than a measured threshold. It is set
> conservatively on purpose: the cost of too much margin is slower progress, and the cost of too
> little is injury.

Forcing pitch downward is the main way this kind of practice causes injury. Sustainable
masculinization is led by resonance, vocal weight and efficiency, with pitch adjusted only as far
as it comfortably goes. Red flags are throat tightness, pain, persistent hoarseness, or fatigue
after practice.

On vocal fry specifically: there is **no evidence that glottal fry in itself causes injury**, but
sustained use with strain or effortful projection contributes to fatigue, and relying on fry to
sound masculine reduces clarity. So the tool neither forbids fry nor treats it as a technique — it
simply refuses to count creaky frames when measuring your floor, since a creaky bottom note would
set the floor too low and drag every later target down with it.

This is why `pitchTarget()` derives from a measured floor plus a 3-semitone margin
(`FLOOR_MARGIN_ST`) and can return "no headroom" rather than inventing a target.

- `[clinical]` How to masculinize your voice without straining it —
  <https://connectedspeechpathology.com/blog/how-to-masculinize-your-voice-without-straining-it>
- `[clinical]` Voice masculinization: safe techniques and common pitfalls —
  <https://breatheworks.com/voice-masculinization-techniques-safe-training-common-pitfalls/>
- `[clinical]` Vocal fry and trans voice training: what the research really says —
  <https://www.reneeyoxon.com/blog/vocal-fry>

---

## 5. The exercises

> **Evidence: Moderate** for straw phonation and larynx-height work, which have a real clinical
> literature. **Weak** for the specific ordering and durations, which follow practitioner
> convention.

| # | Exercise | Rationale |
|---|---|---|
| 1 | Straw phonation | Semi-occluded vocal tract balances pressure across the folds, reducing collision force. Standard low-strain warm-up. |
| 2 | Easy-onset reset | Establishes continuous airflow before voice is added, then carries that easy start into a phrase. |
| 3 | Yawn-sigh | Beginning a yawn lowers the larynx; the sigh explores that larger space without requiring lower pitch. |
| 4 | "Ng" slides | /ŋ/ makes larynx height easy to feel, and descending on it couples pitch and resonance. |
| 5 | Resonance ladder | Bridges isolated resonance into syllables, words, and a conversational phrase. |
| 6 | Sustained vowels | Builds muscle memory to *start* speech at the target rather than drifting up. |
| 7 | Glides | Re-measures the floor from the median of four clear glide bottoms. |
| 8 | Statement endings | Trains terminal shape separately from mean pitch over one eight-sentence round. |
| 9–10 | Passage + free speech | Connected speech is the real test; spontaneous speech is where trained habits either hold or don't. |

The order is a ramp: least strain first, most transfer to real speech last.

```
  warm up          isolate the skill        combine        transfer
  ───────          ─────────────────        ───────        ────────
  1 straw    ──►   2 easy onset              ──►  5 ladder  ──►  9 passage
                   3 yawn-sigh (resonance)       6 vowels      10 free speech
                   7 glides   (pitch floor)       4 "ng"             │
                        │                         8 endings            │
                        └── feeds the floor back into the target ────┘
```

**Easy onset and the ladder are coordination and transfer steps.** Flow phonation establishes
steady outward airflow before voice is added; the reset uses a tissue or the hand because the
browser cannot score silent airflow. Resonant voice therapy is normally hierarchical, moving from
basic speech gestures through words and phrases into conversation. The ladder makes that missing
middle explicit. Its rungs unlock on voiced practice time rather than a resonance threshold because
different vowels naturally produce different formant estimates.

- `[clinical]` ASHA Voice Disorders practice portal — flow phonation and resonant voice therapy —
  <https://www.asha.org/practice-portal/clinical-topics/voice-disorders/>
- `[journal]` Outcomes of gender-affirming voice and communication modification training for
  non-binary individuals — resonance work from single words through conversation —
  <https://pmc.ncbi.nlm.nih.gov/articles/PMC10909913/>

### Intonation, and what exercise 8 actually measures

> **Evidence: Moderate** that intonation contributes to gendered voice perception independently of
> mean pitch. **Weak** for the specific thresholds — `TERMINAL_ST` and `HOLD_LONG_MS` are judgement
> calls chosen so the drill flags the habit without flagging ordinary speech, not measured
> cut-points. Believe the direction; do not read the numbers as a boundary listeners hear.
> **Verified here** for the segmentation: which contour a given sentence shape produces is settled
> by `node test-endings.mjs`, which drives the shipped functions with synthetic sentences.

F0 standard deviation is one of the properties that became statistically indistinguishable from cis
men in transmasculine people on testosterone (§3), which is why the passage and free-speech reports
already track it. What SD cannot see is *where* in the phrase the variation sits: a speaker can have
a perfectly ordinary SD and still end every statement on a rise, because the rise is a fraction of a
second at the end of a phrase and is averaged away.

Terminal rise on declaratives ("uptalk") and phrase-final lengthening are treated in clinical voice
writing as separable, trainable habits that carry gendered readings on their own, and they are
attractive targets for the same reason the tool leans on resonance: they are not constrained by
range and they cost the voice nothing.

The measurement runs in two stages, and the second one is where the first version of this drill
went wrong.

**Phrases come from silence, not syntax.** A pause over `PHRASE_GAP_MS` (260 ms) ends a phrase. This
is adequate only because the drill asks for one sentence at a time with a breath between — it is not
a phrase detector for running speech, which is why the drill prompts sentences rather than scoring a
passage.

**The final syllable comes from loudness, not voicing.** Walking back from the end of the phrase, the
syllable starts where loudness has fallen to `SYLLABLE_DIP` (half) of the nucleus being measured,
tracked as a running maximum so a quiet final syllable after a loud one is still found. Two earlier
attempts were both wrong:

- *Cutting on gaps in voicing.* An ending like "…know how it ends" barely stops voicing at all, so
  the final voiced run was most of the sentence and every such ending was reported as stretched.
- *A fixed window at the end of the phrase.* A question-like ending frequently **steps down** onto
  the last syllable and rises through it; a 400 ms window spanning that step sees a net fall and
  calls the rise a landing. Verified in `test-endings.mjs`: the old rule scores a 130→165 Hz rise
  off a low onset as *flat*, the current one as a rise of 2.6 st.

**The verdict is two medians, not a slope.** Inside the final syllable, the medians of its first and
last two-fifths are compared. A least-squares slope over so short a region is swung by a single
octave-slip frame.

**Every window is milliseconds, never a count of frames.** Same reason as the voiced-time minimums
above. A five-frame median is 40 ms on a 120 Hz display and 165 ms on a throttled one, and at the
wide end it erases the very dip between syllables that the search depends on — which silently
merges the ending into the syllable before it and turns rises flat. `test-endings.mjs` scores the
same synthetic sentence at 30, 60 and 120 fps for exactly this reason.

**The hold is a proxy, and it can decline to answer.** It measures the loud core of the final
syllable — from the boundary dip to the last voiced frame — so it reads shorter than the syllable's
full duration, and `HOLD_LONG_MS` is calibrated to that definition rather than to a phonetic one.
When no dip is found inside `FINAL_SCAN_MS`, the ending ran into the syllable before it with no
boundary to find; the duration is then reported as unknown rather than as the scan limit, which
would be a made-up number that always looked stretched. The contour is still read.

**Nothing here is saved to Progress.** It is a shape rather than a level, and it is only comparable
across the same sentences. Free speech is the transfer test.

- `[clinical]` FTM voice training: essential tips and techniques (intonation section) —
  <https://connectedspeechpathology.com/blog/ftm-voice-training-essential-tips-and-techniques>
- `[journal]` What contributes to masculine perception of voice among transmasculine people on
  testosterone therapy? (J Voice) — F0 SD among the measured properties —
  <https://www.sciencedirect.com/science/article/abs/pii/S0892199724004715>

The literature explicitly recommends practising larynx height **independently of pitch** — which
is why the yawn-sigh screen hides the pitch readout entirely rather than merely de-emphasising it.

- `[blog]` Transmasculine voice training — <https://peterfullerton.substack.com/p/voice-masculinization>
- `[clinical]` Lowering your larynx: tube breathing for voice masculinization —
  <https://www.reneeyoxon.com/blog/lowering-your-larynx-tube-breathing-for-voice-masculinization>
- `[clinical]` FTM voice training: essential tips and techniques —
  <https://connectedspeechpathology.com/blog/ftm-voice-training-essential-tips-and-techniques>

---

## 6. Real-time biofeedback works

> **Evidence: Moderate.** Usability and single-session results, with trans women rather than
> transmasculine users. It supports the *approach*, not any particular target in this tool.

Web-based visual biofeedback for gender-affirming voice is an active research area. The TruVox
resonance module — real-time LPC spectrum with visual targets for brighter/darker resonance —
scored 75.25 on the System Usability Scale with trans women, supporting biofeedback as an adjunct
to therapy. This tool uses the same core approach (LPC envelope, personalised targets from a
baseline recording).

- `[journal]` Real-time resonance biofeedback for gender-affirming voice training: TruVox usability
  testing — <https://www.sciencedirect.com/science/article/abs/pii/S0892199725004205>
- `[conference]` Web-based application for real-time biofeedback of vocal resonance
  (Interspeech 2025) — <https://www.isca-archive.org/interspeech_2025/mcallister25_interspeech.pdf>
- `[journal]` TruVox: development and single-session evaluations —
  <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12481138/>

---

## 7. Measurement notes and honest limitations

> **Evidence: Verified here.** These were established by running `src/dsp.js` against synthetic signals
> of known pitch and known tract length (`node test-dsp.mjs`), not assumed. Re-run the tests before
> trusting any of these numbers after a change to the DSP.

### Summary

| Measure | Accuracy | How much to trust it |
|---|---|---|
| Pitch (YIN) | better than 0.6% over 80–250 Hz | **High** — use the absolute number |
| Resonance, strict (`estimateVTL`) | ~5% worst case over 13–22 cm | **Medium** — rejects ~⅓ of frames by design |
| Resonance, live meter (`resonanceIndex`) | direction reliable, magnitude not | **Relative only** — compare to your own baseline |
| Weight (H1–H2, spectral tilt) | direction only | **Low** — coarse label, never an absolute |

### Detail

**Pitch (YIN).** Accurate to better than 0.6% over 80–250 Hz. Trustworthy.

**LPC order.** Set to 20, not the textbook `fs/1000 + 2` (which would be 14 at the 12 kHz working
rate). At order 14 there were too few poles to cover 0–6 kHz: F4 was dragged upward and long
tracts collapsed entirely, with worst-case VTL error around 37%. Raising the order fixed it.

**Two resonance measures, deliberately.**

- `estimateVTL()` is strict. It uses exactly four formants and rejects any frame where a formant
  does not sit near its predicted position. Without that gate, one spurious peak below F1 re-slots
  every formant and produces a ~1.5× overestimate; with it, worst-case error over 13–22 cm and
  85–260 Hz is about 5%. It rejects roughly a third of frames, and *should* — including most of
  /i/ and /u/.
- `resonanceIndex()` is the same fit without the gate, and is what the live meter shows. The
  strict version rejects /a/ (its F1 and F2 sit too close together to look like a uniform tube),
  and /a/ is exactly what a yawn-sigh produces. While a single vowel is held steady, lowering the
  larynx scales every formant down together, so relative change is valid even when the absolute
  uniform-tube number is not.

**What the resonance number is not.** It is not an anatomical measurement of your vocal tract. A
uniform-tube model applied to real vowels reads high, and the value varies by 2–3 cm across vowels
in the same voice. It is meaningful as *change against your own baseline on the same task*, which
is the only way the tool ever presents it.

**Close vowels are unreliable.** Measured against a true 10% tract lengthening, /u/ reads about
+5.6% and /i/ about +22.7% — direction right, magnitude wrong in both directions. /i/'s F1 (~270 Hz)
is not recovered at all. This is why the exercises use open vowels, schwa and /ŋ/.

**Vocal weight is the softest measure here.** H1–H2 and spectral tilt do track breathy-versus-heavy
phonation in the right direction, but both are sensitive to microphone, distance and room. It is
shown only as a coarse label relative to your baseline, never as an absolute number, and it
deserves the least trust of the four.

**Single frames are noisy.** Everything is median-smoothed before display, and passage-level
numbers are medians over a whole take. A number that jumps around for a second means nothing.

---

## 8. What the tool does not measure, and what the evidence says it should

> **Evidence: Moderate.** Each of these is a real finding in the literature. What is *not* settled
> is whether any of them can be measured honestly in a browser, which is the reason none of them
> ships yet. This section exists so that the omissions are a decision on the record rather than an
> oversight.

The meta-analysis behind §1 does not stop at pitch and resonance. It names **loudness,
articulation and intonation** as contributors too, and later work adds two more dimensions the
tool is currently blind to.

**Loudness.** Mean sound pressure level predicts masculinity–femininity ratings independently of
F0, and in connected speech men measure roughly 2–3 dB louder than women with a wider
conversational range. The obstacle is not the finding but the microphone: a browser gives an
uncalibrated signal, where the difference between 68 and 70 dB SPL is indistinguishable from
sitting six inches closer. A *relative* dynamic-range measure — how much a speaker's loudness
varies within a take — is measurable here and is not confounded by distance in the same way.

**Speech rate.** Rate predicts *naturalness* ratings rather than masculinity. This matters because
naturalness is a separate axis: a voice can be read as masculine and as unnatural at the same time,
and the second is what people notice. Rate is approximable from the same loudness envelope the
endings drill already uses to find syllable boundaries.

**Naturalness as a target in its own right.** In transmasculine speakers specifically, naturalness
ratings rose when F0 sat *inside* the normative cis-male range rather than below it — which is an
argument against treating "lower is better" as the whole goal, and matches the tool's existing
refusal to target below the measured floor. This is now said out loud on the calibration result,
because "lower is better without limit" is the assumption almost everyone arrives with. Listener age moderated the effect; older listeners
rated transmasculine voices as less natural than cisgender ones.

**Voice quality (CPP).** *Shipped — see §11.* Cepstral peak prominence is the standard acoustic
index of periodicity, and it is what the transmasculine outcome literature reports alongside F0.
It is the one measure on this list that serves *safety* rather than gender reading: a CPP that
falls across a practice session is a voice degrading in real time, which is exactly the signal the
strain guidance previously had no way to see.

**Creak.** *Shipped — see §11.* Creaky phonation reads as more masculine, and is also a common way
to fake a low pitch the folds cannot sustain. Calibration already discarded creaky frames so a
creak could not drag the floor down — but the drills never said so, and "your low note is actually
fry" is useful feedback rather than a scoring detail.

- `[journal]` Voice, articulation and prosody contribute to listener perceptions of speaker gender:
  a systematic review and meta-analysis (JSLHR, 2018) —
  <https://pubs.asha.org/doi/10.1044/2017_JSLHR-S-17-0067>
- `[journal]` Acoustic predictors of gender attribution, masculinity–femininity and vocal
  naturalness ratings among transgender and cisgender speakers (J Voice, 2020) — SPL and rate —
  <https://pubmed.ncbi.nlm.nih.gov/30503396/>
- `[journal]` Factors influencing auditory perception of masculinity and naturalness in
  transmasculine voices (JSLHR, 2026) —
  <https://pubs.asha.org/doi/10.1044/2026_JSLHR-25-00971>
- `[journal]` Cepstral peak prominence values for clinical voice evaluation —
  <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7893528/>
- `[journal]` Impact of vocal fry and speaker gender on listener perceptions of speaker personal
  attributes — <https://pubmed.ncbi.nlm.nih.gov/36400634/>

---

## 9. Practice dosage, carryover, and the testosterone timeline

> **Evidence: Moderate** for dosage and carryover, which are consistent clinical practice rather
> than a controlled trial in this population. **Moderate** for the T timeline, where the group
> means are well attested and the individual variation is large enough that a mean is nearly
> useless as a personal prediction.

**Dosage.** Clinical guidance is consistent: short daily practice beats infrequent long sessions,
both for motor learning and because a long session is how people hurt themselves. Fifteen to
thirty minutes a day is the figure that recurs. The routine's daily goal — five of eight steps,
roughly ten minutes — sits at the low end of that on purpose, because a goal that survives a bad
day is the one that keeps the streak alive.

**Carryover is a separate skill.** Voice therapy does not treat "can do it in the exercise" and
"does it in a conversation" as the same achievement. Rehearsing specific everyday situations —
ordering something, taking a phone message, introducing yourself — is standard procedure, which is
why exercise 8 offers a situation rather than only "talk about anything". The gap between the
drilled number and the free-speech number is the measurement that matters, and it is already
charted.

**Adherence.** An app-supported home practice pilot cut missed practice tasks by roughly half
versus paper. This is the entire justification for the streak layer existing, and it is worth
being honest that it supports *the approach*, not this implementation of it.

**Adaptive daily focus.** The five-step recommendation is a scheduling layer, not a new acoustic
measure. It always begins with straw phonation, always ends with the fixed passage and free speech,
and uses the two middle slots for the largest reliable gap: pitch, resonance, intonation, or the
reading-to-conversation carryover gap. Every drill remains open and the coach never changes a
calibrated target.

One take is not evidence enough to steer tomorrow. Takes are first collapsed to one median per
calendar day, at least two completed passage days are required, and only the five most recent days
are considered. Today's takes are excluded so the plan cannot change halfway through the session.
The trigger gaps are deliberately quiet engineering guards rather than published perceptual
boundaries: 6% over the pitch target (the same tolerance the passage already uses), 4% under the
resonance goal (inside the strict estimator's roughly 5% error), 15% over calibrated intonation
spread, and a matched free-speech pitch more than 6% above the same day's passage. These thresholds
have **Weak** evidence: they limit noisy recommendations; they do not identify clinical deficits.

**The testosterone timeline, for those on T.** F0 drops substantially in the first months, with
most of the change typically inside the first six to nine months and a long tail of refinement
after. The variation between individuals is the important part: some people see almost nothing in
the first three months. Two consequences for this tool. First, someone early on T is measuring a
moving baseline, so a target derived weeks ago may be stale — which is what the recalibration
prompt is for. Second, testosterone thickens the folds inside a larynx whose framework has already
ossified; the pitch drops without the resonance space growing to match, which is precisely why
resonance work is not optional for this group and why voices can feel weak or unreliable during
the change.

- `[clinical]` ASHA practice portal: gender-affirming voice and communication —
  <https://www.asha.org/practice-portal/professional-issues/gender-affirming-voice-and-communication/>
- `[journal]` Gender-affirming voice therapy duration and satisfaction: experiences from a single
  institution (J Voice, 2025) — <https://pubmed.ncbi.nlm.nih.gov/39765446/>
- `[journal]` Developing and testing a smartphone application to enhance adherence to voice
  therapy: a pilot study — <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9914943/>
- `[journal]` Effects of testosterone on the transgender male voice (Irwig, *Andrology*, 2017) —
  <https://pubmed.ncbi.nlm.nih.gov/27643399/>
- `[clinical]` Testosterone voice timeline (Yoxon) —
  <https://www.reneeyoxon.com/blog/testosterone-voice-timeline>
- `[clinical]` UCSF gender affirming health program: transgender voice and communication — vocal
  health — <https://transcare.ucsf.edu/guidelines/vocal-health>

---

## 10. Sources by exercise

This table is what the in-app **Sources** screen shows. `src/exercises/sources.js` holds the same
list; when one changes, change the other. The grade is the strength of the evidence *for the way
this tool uses it*, on the scale defined at the top of this file.

| Program | The claim it makes | Grade | Sources |
|---|---|---|---|
| Calibration | A useful target comes from your own habitual pitch and your own measured floor, not a population average | Moderate | §1, §2, §4 |
| 1. Straw warm-up | A semi-occluded tract lets you work low with less collision force | Moderate | §5 |
| 2. Easy-onset reset | Continuous airflow before voice can reduce breath-holding and facilitate easier phonation | Moderate (method) / Weak (this checklist) | §5 |
| 3. Yawn-sigh | Larynx height trains independently of pitch, and lengthening the tract changes how the voice reads | Strong (mechanism) / Moderate (exercise) | §3, §5 |
| 4. "Ng" slides | Pitch and resonance should descend together | Weak — practitioner convention | §5 |
| 5. Resonance ladder | Resonant voice work progresses from basic gestures through words, phrases, and conversation | Moderate (hierarchy) / Weak (prompts and timing) | §5 |
| 6. Sustained vowels | Holding the target builds the habit of starting speech there; comfort outranks the weight estimate | Weak (drill) / Moderate (the strain it guards against) | §4, §5 |
| 7. Pitch glides | The safe floor moves with technique, so it is re-measured rather than assumed | Weak — the 3-semitone margin is a conservative judgement call | §4 |
| 8. Statement endings | Intonation reads as gendered independently of mean pitch | Moderate (effect) / Weak (thresholds) | §5 |
| 9. Reading passage | A fixed text is the comparable measurement | Strong as method | §6, §7 |
| 10. Free speech | Habits must survive spontaneous speech, and situations are rehearsed rather than waited for | Moderate | §9 |
| Today's focus | Several completed days can choose a useful emphasis without moving the user's targets | Weak for the thresholds / Moderate for dosage and carryover | §9 |
| The two warnings | Creak is distinguishable from a note, and a session-long decline in voice quality is visible in the signal | Moderate (measures) / Weak (thresholds) | §11 |
| The live meters | Real-time resonance biofeedback helps at all | Moderate — usability and single-session results, with trans women rather than transmasculine users | §6 |

Two things this table cannot do. It cannot tell you that a drill is safe for *your* voice today —
no acoustic measure here sees strain directly (§8). And it cannot make a Weak row stronger by
being written down: several of the ten drills rest partly on practitioner convention, and the honest
statement is that a different clinician would order them differently.

---

## 11. The two warnings: creak, and voice quality across a session

> **Evidence: Moderate** that both measures track what they claim to. **Weak** for every threshold
> here — the published cut-points for cepstral peak prominence are for clinical assessment of a
> recorded voice under controlled conditions, and none of them survives being ported to a phone
> microphone in a kitchen. **Verified here** for the gates: the pitch confound, the persistence
> requirement and the refusal cases are established by `node test-dsp.mjs` and `node test-strain.mjs`.

These are the only two things in the tool that interrupt you, and the only two that are about how
your voice is *working* rather than how it *reads*. Both are held to a rule the rest of the tool
does not need: **they can only ever say something is wrong.** There is no state of either warning
that means your voice is fine. A reassuring readout would be an invitation to push through a
warning sign, and no acoustic measure here is good enough to earn that.

### Creak

Aperiodicity above `CREAK_APERIODICITY` (0.2) is a frame where the folds are rattling rather than
vibrating. Calibration and the glide have always used that threshold to *refuse to measure* such a
frame, so a creak could not set the floor too low and drag every later target down with it. What
was missing is that the drills never told you it was happening — the tool knew, and kept quiet.

The live drills now say so when creak takes up `CREAK_ON` (60%) of the last `CREAK_WINDOW_MS`
(3 s) of voiced sound, and stop saying it below `CREAK_OFF` (30%). Two thresholds rather than one,
because a single one flickers the warning on and off around the boundary, which is how a warning
stops being read.

This matters here more than it would in a general voice tool. Creak reads as *more* masculine to
listeners, so it is a genuinely tempting shortcut — and it is the exact mechanism by which someone
hits a pitch target their folds cannot sustain. The number goes where you wanted it and your voice
learns nothing.

### Voice quality across a session

`cpp()` in `src/dsp.js` measures how far the cepstral peak at the pitch period rises above the
cepstrum's own trend line: how much of the signal is a clean harmonic stack rather than noise. It
falls as phonation gets noisier, which is what a tiring voice does.

Deliberately **not** the smoothed CPPS of the clinical literature, which averages across
neighbouring frames and quefrencies before picking the peak. A single frame is measured here and
the smoothing happens over time in `src/analysis/strain.js`. The absolute value is therefore not
comparable to any published figure, and the code says so where it is defined.

The comparison is always the same one: your voice at the start of this session against your voice
now, same microphone, minutes apart. Everything else is a refusal.

| Gate | Value | Why |
|---|---|---|
| Reference window | 20 s of voiced time | Established once per microphone session, then frozen |
| Current window | rolling 20 s | Medians, so a stray frame cannot move it |
| Minimum before judging | 10 s of voiced time | A rough patch of two seconds is a phoneme, not a trend |
| Decline | 3 dB | Against a measured clean-to-noisy range of ~18 dB (`test-dsp.mjs`) |
| Persistence | 5 s | See below — the median alone is not enough |
| Pitch gate | 15 Hz | See below — the confound that would otherwise make this dishonest |

**Why persistence, when there is already a median.** A rough patch of six seconds is briefly a
*majority* of a ten-second window while that window is still filling, so the median follows it and
the warning fires — permanently, since it latches. A cough or one creaky sentence would do it.
Requiring the decline to still be true five seconds later separates a trend from a patch, and
`test-strain.mjs` holds both cases.

**Why the pitch gate.** CPP moves with F0 for reasons that have nothing to do with strain:
measured on synthetic vowels in `test-dsp.mjs`, about 0.037 dB per hertz. Over a 15 Hz difference
that is 0.55 dB, comfortably inside the 3 dB threshold — but over the 60 Hz someone might move
across a practice session it is 2.2 dB, which is most of the way to a false warning. So when the
two windows differ by more than `CPP_F0_GATE_HZ`, there is no verdict at all. Worse than useless
is a strain warning that fires because the practice is working.

**It latches, and only the microphone resets it.** Switching exercises does not clear it — the
session is what tires a voice, and the drill you happen to be in when it starts to go is not the
point. A warning that blinks off because you managed one clean sentence is a warning nobody heeds.

**What it cannot do.** It cannot see strain that does not show up as noise; it cannot tell you that
you are fine; and it is not a substitute for how your throat feels. It is one rough proxy, held to
a conservative threshold, that says *stop* and never says *carry on*.

- `[journal]` Cepstral peak prominence values for clinical voice evaluation —
  <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7893528/>
- `[journal]` CPPS and the Acoustic Voice Quality Index: comparison, relationship with
  auditory-perceptual judgement, and cut-off points —
  <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11189156/>
- `[journal]` Impact of vocal fry and speaker gender on listener perceptions of speaker personal
  attributes — <https://pubmed.ncbi.nlm.nih.gov/36400634/>
- `[clinical]` UCSF gender affirming health program: transgender voice and communication — vocal
  health — <https://transcare.ucsf.edu/guidelines/vocal-health>
