/**
 * Verifies the vocal biomarkers against synthetic audio with known properties.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { VoiceAnalyser } from "./voice.ts";

const SAMPLE_RATE = 48_000;
const FRAME = 2048;

/** A glottal-ish tone: fundamental plus two harmonics, as speech actually is. */
function tone(hz: number, amplitude: number, phase: number): Float32Array {
  const frame = new Float32Array(FRAME);
  for (let i = 0; i < FRAME; i++) {
    const t = (i + phase) / SAMPLE_RATE;
    frame[i] =
      amplitude *
      (Math.sin(2 * Math.PI * hz * t) +
        0.5 * Math.sin(4 * Math.PI * hz * t) +
        0.25 * Math.sin(6 * Math.PI * hz * t));
  }
  return frame;
}

function silence(): Float32Array {
  return new Float32Array(FRAME);
}

describe("VoiceAnalyser", () => {
  it("reports silence before it has enough frames", () => {
    const analyser = new VoiceAnalyser();
    analyser.push(tone(120, 0.2, 0), SAMPLE_RATE);
    const reading = analyser.read();
    assert.equal(reading.speaking, false);
    assert.equal(reading.pitchHz, null);
  });

  // Spanning low male through high female/child range: the upper end is where
  // autocorrelation is most prone to reporting an octave too low.
  for (const hz of [95, 130, 210, 300]) {
    it(`detects a ${hz} Hz fundamental`, () => {
      const analyser = new VoiceAnalyser();
      for (let i = 0; i < 40; i++) analyser.push(tone(hz, 0.25, i * FRAME), SAMPLE_RATE);
      const reading = analyser.read();

      assert.ok(reading.pitchHz !== null, "expected a pitch");
      assert.ok(
        Math.abs(reading.pitchHz - hz) / hz < 0.08,
        `expected ~${hz} Hz, got ${reading.pitchHz}`,
      );
      assert.equal(reading.speaking, true);
    });
  }

  it("treats a quiet room as silence, not a very low voice", () => {
    const analyser = new VoiceAnalyser();
    for (let i = 0; i < 40; i++) analyser.push(silence(), SAMPLE_RATE);
    const reading = analyser.read();

    assert.equal(reading.speaking, false);
    assert.equal(reading.pitchHz, null);
    assert.equal(reading.pauseRatio, 1);
  });

  it("measures the proportion of a window that was silent", () => {
    const analyser = new VoiceAnalyser();
    for (let i = 0; i < 40; i++) {
      analyser.push(i % 4 === 0 ? tone(140, 0.25, i * FRAME) : silence(), SAMPLE_RATE);
    }
    const reading = analyser.read();
    assert.ok(
      reading.pauseRatio > 0.6 && reading.pauseRatio < 0.9,
      `expected mostly-silent window, got ${reading.pauseRatio}`,
    );
  });

  it("scores a flat monotone as more monotonous than varied intonation", () => {
    const flat = new VoiceAnalyser();
    for (let i = 0; i < 40; i++) flat.push(tone(130, 0.25, i * FRAME), SAMPLE_RATE);

    const varied = new VoiceAnalyser();
    for (let i = 0; i < 40; i++) {
      // Sweeping the fundamental imitates the pitch movement of engaged speech.
      varied.push(tone(110 + (i % 8) * 12, 0.25, i * FRAME), SAMPLE_RATE);
    }

    assert.ok(
      flat.read().monotony > varied.read().monotony,
      "flat speech should score as more monotonous",
    );
  });

  it("rises in energy with louder input", () => {
    const quiet = new VoiceAnalyser();
    const loud = new VoiceAnalyser();
    for (let i = 0; i < 40; i++) {
      quiet.push(tone(130, 0.05, i * FRAME), SAMPLE_RATE);
      loud.push(tone(130, 0.4, i * FRAME), SAMPLE_RATE);
    }
    assert.ok(loud.read().energy > quiet.read().energy);
  });
});
