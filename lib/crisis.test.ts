/**
 * Tests for the safety screen.
 *
 * This module is the one place in Neura where being wrong has a cost measured
 * in something other than user annoyance, so the phrasings below are written
 * as real speech — including the indirect, hedged phrasing people actually use
 * rather than the textbook version.
 *
 * Run with: npm test
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assessCombined, assessText, atLeast, maxRisk } from "./crisis.ts";
import type { Telemetry } from "./types.ts";

describe("assessText — crisis", () => {
  const crisisPhrases = [
    // The exact hedged phrasing from the original project's demo, which an
    // obvious `not want to live` pattern does not catch.
    "yeah, honestly, I'm not really sure if I want to keep living",
    "I don't want to be here anymore",
    "I'm not sure there's any reason to keep going on living",
    "sometimes I think about killing myself",
    "I've been thinking about ending my life",
    "I just want to die",
    "I wish I was dead",
    "everyone would be better off without me",
    "I've been hurting myself again",
    "I cut myself last night",
    "I thought about taking an overdose",
    "why should I even bother living",
  ];

  for (const phrase of crisisPhrases) {
    it(`flags: "${phrase}"`, () => {
      const result = assessText(phrase);
      assert.equal(result.level, "crisis", `expected crisis for: ${phrase}`);
      assert.equal(result.escalate, true);
    });
  }
});

describe("assessText — must not over-trigger on ordinary speech", () => {
  const safePhrases: Array<[string, string]> = [
    ["I'm feeling pretty good actually", "none"],
    ["I really want to keep living my life properly", "none"],
    ["I killed it in my presentation today", "none"],
    ["my phone died on the way here", "none"],
    ["the weather has been lovely", "none"],
  ];

  for (const [phrase, expected] of safePhrases) {
    it(`"${phrase}" reads as ${expected}`, () => {
      assert.equal(assessText(phrase).level, expected);
    });
  }
});

describe("assessText — graded distress", () => {
  it("treats hopelessness as high risk", () => {
    const result = assessText("I just feel completely hopeless these days");
    assert.equal(result.level, "high");
    assert.equal(result.escalate, true);
  });

  it("treats feeling like a burden as high risk", () => {
    assert.equal(assessText("I'm such a burden on my family").level, "high");
  });

  it("treats an unexplained plan as high rather than crisis", () => {
    assert.equal(assessText("I have a plan").level, "high");
  });

  it("treats symptom reports as moderate", () => {
    assert.equal(assessText("I've been so anxious and I can't sleep").level, "moderate");
  });

  it("treats mild strain as low", () => {
    assert.equal(assessText("work has been a bit stressful").level, "low");
  });
});

const telemetry = (overrides: Partial<Telemetry["scores"]>): Telemetry => ({
  at: Date.now(),
  video: {
    bpm: 82,
    hrvMs: 40,
    quality: 0.7,
    emotion: "sad",
    emotionConfidence: 0.6,
    eyeClosure: 0.1,
    headMotion: 0.2,
    faceDetected: true,
  },
  voice: {
    pitchHz: 120,
    jitter: 0.2,
    shimmer: 0.2,
    energy: 0.4,
    pauseRatio: 0.5,
    monotony: 0.7,
    speaking: true,
  },
  scores: {
    wellbeing: 50,
    stress: 40,
    arousal: 40,
    valence: 0,
    confidence: 0.8,
    ...overrides,
  },
});

describe("assessCombined", () => {
  it("escalates moderate distress when biomarkers corroborate it", () => {
    const result = assessCombined("moderate", telemetry({ valence: -60 }));
    assert.equal(result.level, "high");
    assert.equal(result.escalate, true);
  });

  it("does not escalate when biomarker confidence is too low to trust", () => {
    const result = assessCombined("moderate", telemetry({ valence: -60, confidence: 0.1 }));
    assert.equal(result.level, "moderate");
  });

  it("never invents risk from biomarkers alone", () => {
    const result = assessCombined("none", telemetry({ valence: -90, stress: 95, wellbeing: 10 }));
    assert.equal(result.level, "none");
    assert.equal(result.escalate, false);
  });

  it("leaves an existing crisis flag at crisis", () => {
    assert.equal(assessCombined("crisis", telemetry({})).level, "crisis");
  });
});

describe("risk ordering", () => {
  it("maxRisk picks the more severe level", () => {
    assert.equal(maxRisk("low", "high"), "high");
    assert.equal(maxRisk("crisis", "moderate"), "crisis");
  });

  it("atLeast compares against a floor", () => {
    assert.equal(atLeast("high", "high"), true);
    assert.equal(atLeast("moderate", "high"), false);
    assert.equal(atLeast("crisis", "high"), true);
  });
});
