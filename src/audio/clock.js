// clock.js — the analysis grid.
//
// Analysis runs on a fixed rate rather than once per repaint. Every smoothing
// window in this app is specified in *frames* — the pitch median is 5 of them,
// resonance and weight are 31, the silence timeout is 12, the traces hold a few
// hundred — so tying the frame rate to the display made all of them mean
// different spans of time on different hardware: the resonance median covered
// 0.5 s on a 60 Hz laptop and 0.26 s on a 120 Hz phone, and the same voice read
// differently on the two. The elapsed-time meters were already fixed to use
// real time; these windows were not.
//
// Pure arithmetic and one counter, with no audio or DOM, so test-loop.mjs can
// drive it with a synthetic clock.

export var ANALYSIS_HZ = 60;
export var ANALYSIS_MS = 1000 / ANALYSIS_HZ;
export var ANALYSIS_SLOP_MS = 2;   // a frame arriving a hair early is still due

var nextAnalysis = 0;

// True when this repaint is the one that should carry an analysis, advancing
// the grid as it goes. Scheduling from the grid rather than from `ts` keeps the
// rate from drifting on a display that is not a multiple of 60; resyncing when
// the grid falls behind stops a stall — a hidden tab, a slow frame — from
// firing a burst of catch-up analyses over audio that has already gone.
export function analysisDue(ts) {
  if (ts < nextAnalysis - ANALYSIS_SLOP_MS) return false;
  nextAnalysis += ANALYSIS_MS;
  if (nextAnalysis < ts) nextAnalysis = ts + ANALYSIS_MS;
  return true;
}

export function resetAnalysisClock() {
  nextAnalysis = 0;
}
