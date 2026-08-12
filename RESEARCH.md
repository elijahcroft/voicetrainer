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
| 2 | Yawn-sigh | Beginning a yawn lowers the larynx; the sigh keeps it there while phonating. Directly trains the resonance dimension. |
| 3 | "Ng" slides | /ŋ/ makes larynx height easy to feel, and descending on it couples pitch and resonance the way a naturally low voice does. |
| 4 | Sustained vowels | Builds muscle memory to *start* speech at the target rather than drifting up. |
| 5 | Glides | Re-measures the floor, which moves as technique improves. |
| 6 | Statement endings | Terminal rise and final-syllable lengthening are heard independently of pitch, and cost nothing to change. |
| 7–8 | Passage + free speech | Connected speech is the real test; spontaneous speech is where trained habits either hold or don't. |

The order is a ramp: least strain first, most transfer to real speech last.

```
  warm up          isolate the skill        combine        transfer
  ───────          ─────────────────        ───────        ────────
  1 straw    ──►   2 yawn-sigh (resonance)  ──►  4 vowels  ──►  7 passage
                   5 glides   (pitch floor)      3 "ng"         8 free speech
                        │                        6 endings           │
                        └── feeds the floor back into the target ────┘
```

### Intonation, and what exercise 6 actually measures

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
