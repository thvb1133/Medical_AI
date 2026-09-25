/**
 * Microphone pipeline: one getUserMedia stream feeding two consumers.
 *
 * 1. Continuous voice-biomarker analysis (pitch, energy, pauses).
 * 2. Silence-based turn detection that records a complete utterance and hands
 *    it off for transcription.
 *
 * Turn detection is the part that decided how the original demo felt: too
 * eager and it interrupts someone mid-thought, too patient and the pauses feel
 * like the app has frozen. The thresholds below are tuned for a quiet room
 * with a laptop microphone at desk distance.
 */

import { VoiceAnalyser, type VoiceReading } from "../voice";

export type TurnDetectionConfig = {
  /** RMS above which a frame counts as speech. */
  speechThreshold: number;
  /** Consecutive speech frames needed to open a turn. */
  onsetFrames: number;
  /** Silence needed to close a turn. Someone in distress pauses a lot. */
  hangoverMs: number;
  /** Utterances shorter than this are treated as a cough or a door closing. */
  minUtteranceMs: number;
  /** Hard stop so a stuck stream cannot record forever. */
  maxUtteranceMs: number;
};

export const DEFAULT_TURN_DETECTION: TurnDetectionConfig = {
  speechThreshold: 0.018,
  onsetFrames: 3,
  hangoverMs: 1100,
  minUtteranceMs: 400,
  maxUtteranceMs: 30_000,
};

type Handlers = {
  onReading: (reading: VoiceReading) => void;
  onUtterance: (audio: Blob) => void;
  onSpeakingChange?: (speaking: boolean) => void;
};

const FRAME_INTERVAL_MS = 50;

function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export class MicPipeline {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private buffer: Float32Array | null = null;

  private readonly voice = new VoiceAnalyser();
  private readonly config: TurnDetectionConfig;
  private readonly handlers: Handlers;

  private speechFrames = 0;
  private lastLoudAt = 0;
  private utteranceStartedAt = 0;
  private inUtterance = false;
  /** Set while the avatar is talking so its own audio is not transcribed. */
  private muted = false;
  /** False when the browser's own recogniser is handling turns instead. */
  private capture = true;

  constructor(handlers: Handlers, config: Partial<TurnDetectionConfig> = {}) {
    this.handlers = handlers;
    this.config = { ...DEFAULT_TURN_DETECTION, ...config };
  }

  async start(stream: MediaStream): Promise<void> {
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.context = new AudioCtor();
    if (this.context.state === "suspended") await this.context.resume();

    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0;
    this.source = this.context.createMediaStreamSource(stream);
    this.source.connect(this.analyser);
    this.buffer = new Float32Array(this.analyser.fftSize);

    this.timer = setInterval(() => this.tick(stream), FRAME_INTERVAL_MS);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted && this.inUtterance) this.abortUtterance();
  }

  /**
   * Disables utterance recording while leaving biomarker analysis running, for
   * when the browser's speech recogniser owns turn-taking instead.
   */
  setCaptureEnabled(enabled: boolean): void {
    this.capture = enabled;
    if (!enabled && this.inUtterance) this.abortUtterance();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.abortUtterance();
    this.source?.disconnect();
    this.analyser?.disconnect();
    void this.context?.close();
    this.context = null;
    this.analyser = null;
    this.source = null;
    this.voice.reset();
  }

  private tick(stream: MediaStream): void {
    if (!this.analyser || !this.buffer) return;

    // Chrome types getFloatTimeDomainData as Float32Array<ArrayBuffer>, which
    // the DOM lib models more strictly than the runtime requires.
    this.analyser.getFloatTimeDomainData(this.buffer as Float32Array<ArrayBuffer>);
    const frame = this.buffer;
    const sampleRate = this.context?.sampleRate ?? 48_000;

    this.voice.push(frame, sampleRate);
    this.handlers.onReading(this.voice.read());

    if (this.muted || !this.capture) return;

    let sum = 0;
    for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
    const level = Math.sqrt(sum / frame.length);
    const now = Date.now();

    if (level >= this.config.speechThreshold) {
      this.speechFrames += 1;
      this.lastLoudAt = now;
    } else {
      this.speechFrames = 0;
    }

    // Recording opens slightly before the speech threshold is confirmed so the
    // first consonant is not clipped off the front of the utterance.
    const preRoll = level >= this.config.speechThreshold * 0.6;
    if (!this.inUtterance && preRoll) {
      this.beginUtterance(stream, now);
    }

    if (!this.inUtterance) return;

    const confirmed = this.speechFrames >= this.config.onsetFrames;
    const silentFor = now - this.lastLoudAt;
    const elapsed = now - this.utteranceStartedAt;

    if (elapsed >= this.config.maxUtteranceMs) {
      this.endUtterance(confirmed);
      return;
    }

    if (silentFor >= this.config.hangoverMs) {
      const longEnough = elapsed >= this.config.minUtteranceMs;
      this.endUtterance(confirmed && longEnough);
    }
  }

  private beginUtterance(stream: MediaStream, now: number): void {
    const mimeType = pickMimeType();
    try {
      this.recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      return;
    }
    this.chunks = [];
    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };
    this.recorder.start();
    this.inUtterance = true;
    this.utteranceStartedAt = now;
    this.lastLoudAt = now;
    this.handlers.onSpeakingChange?.(true);
  }

  private endUtterance(emit: boolean): void {
    const recorder = this.recorder;
    this.inUtterance = false;
    this.speechFrames = 0;
    this.handlers.onSpeakingChange?.(false);
    if (!recorder) return;

    recorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: recorder.mimeType || "audio/webm" });
      this.chunks = [];
      if (emit && blob.size > 0) this.handlers.onUtterance(blob);
    };
    if (recorder.state !== "inactive") recorder.stop();
    this.recorder = null;
  }

  private abortUtterance(): void {
    if (!this.recorder) {
      this.inUtterance = false;
      return;
    }
    this.recorder.onstop = null;
    if (this.recorder.state !== "inactive") this.recorder.stop();
    this.recorder = null;
    this.chunks = [];
    this.inUtterance = false;
    this.handlers.onSpeakingChange?.(false);
  }
}
