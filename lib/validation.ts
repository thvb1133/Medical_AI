import { z } from "zod";

export const emotionSchema = z.enum([
  "neutral",
  "happy",
  "sad",
  "angry",
  "fearful",
  "surprised",
  "disgusted",
]);

export const telemetrySchema = z.object({
  at: z.number(),
  video: z.object({
    bpm: z.number().nullable(),
    hrvMs: z.number().nullable(),
    quality: z.number().min(0).max(1),
    emotion: emotionSchema,
    emotionConfidence: z.number().min(0).max(1),
    eyeClosure: z.number().min(0).max(1),
    headMotion: z.number().min(0).max(1),
    faceDetected: z.boolean(),
  }),
  voice: z.object({
    pitchHz: z.number().nullable(),
    jitter: z.number(),
    shimmer: z.number(),
    energy: z.number(),
    pauseRatio: z.number(),
    monotony: z.number(),
    speaking: z.boolean(),
  }),
  scores: z.object({
    wellbeing: z.number(),
    stress: z.number(),
    arousal: z.number(),
    valence: z.number(),
    confidence: z.number(),
  }),
});

export const consentSchema = z.object({
  video: z.boolean(),
  audio: z.boolean(),
  shareWithClinician: z.boolean(),
  grantedAt: z.number().nullable(),
});

export const createSessionSchema = z.object({
  patientName: z.string().trim().min(1).max(80),
  patientRef: z.string().trim().max(40).optional(),
  consent: consentSchema,
});

export const chatSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().trim().min(1).max(4000),
  telemetry: telemetrySchema.nullable().optional(),
  /**
   * The client mirrors recent turns back to the server. Without a database the
   * store lives in a single instance's memory, so a request routed elsewhere
   * would otherwise restart the conversation mid-sentence.
   */
  history: z
    .array(
      z.object({
        role: z.enum(["patient", "assistant"]),
        text: z.string().max(4000),
      }),
    )
    .max(40)
    .optional(),
});

export const telemetryBatchSchema = z.object({
  samples: z.array(telemetrySchema).min(1).max(60),
});

export const ttsSchema = z.object({
  text: z.string().trim().min(1).max(1200),
});
