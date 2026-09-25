/**
 * Verifies the camera heart-rate estimator against synthetic input with a
 * known pulse rate.
 *
 * A fake webcam cannot produce a real pulse, so the honest way to test rPPG is
 * to feed it frames whose colour oscillates at a rate we chose and check that
 * the same rate comes back out.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RppgEstimator } from "./rppg.ts";

const SIZE = 16;

/**
 * Builds a frame whose chrominance oscillates at `bpm`. The estimator reads
 * 2G-R-B, so modulating green alone produces a clean pulsatile trace.
 */
function pulseFrame(tSeconds: number, bpm: number, noise = 0): ImageData {
  const hz = bpm / 60;
  const pulse = Math.sin(2 * Math.PI * hz * tSeconds);
  const data = new Uint8ClampedArray(SIZE * SIZE * 4);

  for (let p = 0; p < SIZE * SIZE; p++) {
    const jitter = noise ? (Math.sin(p * 12.9898 + tSeconds * 78.233) * noise) : 0;
    const i = p * 4;
    data[i] = 150;
    data[i + 1] = 160 + pulse * 4 + jitter;
    data[i + 2] = 140;
    data[i + 3] = 255;
  }

  return { data, width: SIZE, height: SIZE, colorSpace: "srgb" } as ImageData;
}

function feed(estimator: RppgEstimator, bpm: number, seconds: number, fps: number, noise = 0) {
  const frames = Math.round(seconds * fps);
  for (let i = 0; i < frames; i++) {
    const t = i / fps;
    estimator.push(pulseFrame(t, bpm, noise), t * 1000);
  }
}

describe("RppgEstimator", () => {
  it("returns nothing before it has enough frames to be meaningful", () => {
    const estimator = new RppgEstimator();
    feed(estimator, 72, 1, 30);
    const reading = estimator.read();
    assert.equal(reading.bpm, null);
    assert.equal(reading.quality, 0);
  });

  for (const bpm of [55, 72, 96, 120]) {
    it(`recovers a ${bpm} bpm pulse from clean frames`, () => {
      const estimator = new RppgEstimator(12_000);
      feed(estimator, bpm, 10, 30);
      const reading = estimator.read();

      assert.ok(reading.bpm !== null, "expected a reading");
      // Frequency resolution is bounded by the window length, so a couple of
      // bpm of slack is the physics, not sloppiness.
      assert.ok(
        Math.abs(reading.bpm - bpm) <= 4,
        `expected ~${bpm} bpm, got ${reading.bpm}`,
      );
      assert.ok(reading.quality > 0.5, `expected confident signal, got ${reading.quality}`);
    });
  }

  it("still tracks the rate through moderate sensor noise", () => {
    const estimator = new RppgEstimator(12_000);
    feed(estimator, 78, 10, 30, 3);
    const reading = estimator.read();
    assert.ok(reading.bpm !== null);
    assert.ok(Math.abs(reading.bpm - 78) <= 6, `got ${reading.bpm}`);
  });

  it("reports low quality when the frames carry no pulse at all", () => {
    const estimator = new RppgEstimator(12_000);
    const frames = 300;
    for (let i = 0; i < frames; i++) {
      const data = new Uint8ClampedArray(SIZE * SIZE * 4);
      for (let p = 0; p < SIZE * SIZE; p++) {
        const j = p * 4;
        // Uncorrelated noise: no periodic component to lock onto.
        data[j] = 120 + ((i * 37 + p * 17) % 40);
        data[j + 1] = 130 + ((i * 53 + p * 29) % 40);
        data[j + 2] = 110 + ((i * 71 + p * 13) % 40);
        data[j + 3] = 255;
      }
      estimator.push(
        { data, width: SIZE, height: SIZE, colorSpace: "srgb" } as ImageData,
        (i / 30) * 1000,
      );
    }

    const reading = estimator.read();
    assert.ok(reading.quality < 0.5, `expected low confidence, got ${reading.quality}`);
  });

  it("clears its buffer on reset", () => {
    const estimator = new RppgEstimator(12_000);
    feed(estimator, 72, 10, 30);
    assert.ok(estimator.read().bpm !== null);
    estimator.reset();
    assert.equal(estimator.read().bpm, null);
  });
});
