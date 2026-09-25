"use client";

/**
 * Owns a whole patient session: media permissions, both biomarker pipelines,
 * turn-taking, the conversation with Fergus, and telemetry upload.
 *
 * It lives in one hook because these concerns are genuinely coupled — the
 * microphone stream feeds both the voice biomarkers and turn detection, the
 * biomarkers are sent with every chat request, and playback has to mute
 * capture. Splitting them apart produced more wiring than it removed.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { MicPipeline } from "@/lib/client/audio";
import {
  browserSttAvailable,
  speak,
  startBrowserRecognition,
  transcribe,
} from "@/lib/client/speech";
import { ExpressionAnalyser, foreheadRoi } from "@/lib/expression";
import { RppgEstimator } from "@/lib/rppg";
import { scoreWellbeing } from "@/lib/wellbeing";
import type { VoiceReading } from "@/lib/voice";
import type {
  ConsentState,
  ProviderStatus,
  RiskLevel,
  Telemetry,
  TranscriptTurn,
} from "@/lib/types";
import type { CrisisResource } from "@/lib/crisis";

export type SessionStatus = "idle" | "starting" | "active" | "ending" | "ended" | "error";

const GREETING =
  "Hi there, I'm Fergus. I'd love to have a quick chat and learn a bit about how you're doing. What's your name?";

const TELEMETRY_INTERVAL_MS = 1000;
const TELEMETRY_FLUSH_MS = 5000;
/** 32x32 is ample for a colour average and keeps the per-frame cost trivial. */
const ROI_SIZE = 32;

const IDLE_VOICE: VoiceReading = {
  pitchHz: null,
  jitter: 0,
  shimmer: 0,
  energy: 0,
  pauseRatio: 1,
  monotony: 0,
  speaking: false,
};

export type NeuraSession = {
  status: SessionStatus;
  error: string | null;
  sessionId: string | null;
  telemetry: Telemetry | null;
  transcript: TranscriptTurn[];
  risk: RiskLevel;
  resources: CrisisResource[];
  listening: boolean;
  thinking: boolean;
  speaking: boolean;
  providers: ProviderStatus | null;
  /** True when expression analysis could not load, so the UI can say so. */
  expressionUnavailable: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  avatarAudio: HTMLAudioElement | null;
  start: (name: string, consent: ConsentState) => Promise<void>;
  sendText: (text: string) => Promise<void>;
  end: () => Promise<void>;
};

export function useNeuraSession(): NeuraSession {
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [risk, setRisk] = useState<RiskLevel>("none");
  const [resources, setResources] = useState<CrisisResource[]>([]);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [providers, setProviders] = useState<ProviderStatus | null>(null);
  const [expressionUnavailable, setExpressionUnavailable] = useState(false);
  const [avatarAudio, setAvatarAudio] = useState<HTMLAudioElement | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const micRef = useRef<MicPipeline | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const rppgRef = useRef(new RppgEstimator());
  const expressionRef = useRef(new ExpressionAnalyser());
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const telemetryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const voiceRef = useRef<VoiceReading>(IDLE_VOICE);
  const videoReadingRef = useRef({
    bpm: null as number | null,
    hrvMs: null as number | null,
    quality: 0,
    emotion: "neutral" as Telemetry["video"]["emotion"],
    emotionConfidence: 0,
    eyeClosure: 0,
    headMotion: 0,
    faceDetected: false,
  });
  const latestTelemetryRef = useRef<Telemetry | null>(null);
  const pendingTelemetryRef = useRef<Telemetry[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const transcriptRef = useRef<TranscriptTurn[]>([]);
  const busyRef = useRef(false);
  const endedRef = useRef(false);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ProviderStatus | null) => data && setProviders(data))
      .catch(() => setProviders(null));
  }, []);

  const pushTurn = useCallback((turn: TranscriptTurn) => {
    transcriptRef.current = [...transcriptRef.current, turn];
    setTranscript(transcriptRef.current);
  }, []);

  const flushTelemetry = useCallback(async () => {
    const id = sessionIdRef.current;
    const batch = pendingTelemetryRef.current;
    if (!id || !batch.length) return;
    pendingTelemetryRef.current = [];
    try {
      await fetch(`/api/sessions/${id}/telemetry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samples: batch }),
      });
    } catch {
      // A dropped batch is not worth interrupting a session for; the next one
      // carries the current state anyway.
    }
  }, []);

  const say = useCallback(
    async (text: string) => {
      setSpeaking(true);
      micRef.current?.setMuted(true);
      try {
        const handle = await speak(text, setAvatarAudio);
        await handle.done;
      } finally {
        setSpeaking(false);
        setAvatarAudio(null);
        micRef.current?.setMuted(false);
      }
    },
    [],
  );

  const handlePatientText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      const id = sessionIdRef.current;
      if (!trimmed || !id || busyRef.current || endedRef.current) return;

      busyRef.current = true;
      setThinking(true);
      pushTurn({ id: `local-${Date.now()}`, role: "patient", text: trimmed, at: Date.now() });

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: id,
            message: trimmed,
            telemetry: latestTelemetryRef.current,
            history: transcriptRef.current
              .slice(-20)
              .map((t) => ({ role: t.role, text: t.text })),
          }),
        });

        if (!response.ok) throw new Error(`chat ${response.status}`);
        const data = await response.json();

        setRisk(data.risk as RiskLevel);
        setResources((data.resources ?? []) as CrisisResource[]);
        pushTurn({
          id: data.turnId ?? `reply-${Date.now()}`,
          role: "assistant",
          text: data.reply,
          at: Date.now(),
        });
        await say(data.reply);
      } catch {
        setError("Fergus couldn't respond just then. Your session is still recording.");
      } finally {
        setThinking(false);
        busyRef.current = false;
      }
    },
    [pushTurn, say],
  );

  const handleUtterance = useCallback(
    async (audio: Blob) => {
      if (busyRef.current || endedRef.current) return;
      try {
        const text = await transcribe(audio);
        if (text) await handlePatientText(text);
      } catch {
        // Transcription failures are silent by design: a visible error on
        // every dropped utterance would be more distressing than useful.
      }
    },
    [handlePatientText],
  );

  /** Per-frame loop: expression model, then rPPG on the forehead region. */
  const runFrameLoop = useCallback(() => {
    const step = () => {
      rafRef.current = requestAnimationFrame(step);

      const video = videoRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth) return;

      const now = performance.now();
      const expression = expressionRef.current.detect(video, now);

      if (expression.available) {
        videoReadingRef.current.emotion = expression.emotion;
        videoReadingRef.current.emotionConfidence = expression.emotionConfidence;
        videoReadingRef.current.eyeClosure = expression.eyeClosure;
        videoReadingRef.current.headMotion = expression.headMotion;
        videoReadingRef.current.faceDetected = expression.faceDetected;
      }

      const roi = expression.faceBox
        ? foreheadRoi(expression.faceBox)
        : {
            x: video.videoWidth * 0.35,
            y: video.videoHeight * 0.15,
            w: video.videoWidth * 0.3,
            h: video.videoHeight * 0.25,
          };

      if (!canvasRef.current) {
        canvasRef.current = document.createElement("canvas");
        canvasRef.current.width = ROI_SIZE;
        canvasRef.current.height = ROI_SIZE;
      }
      const ctx = canvasRef.current.getContext("2d", { willReadFrequently: true });
      if (!ctx || roi.w < 4 || roi.h < 4) return;

      ctx.drawImage(video, roi.x, roi.y, roi.w, roi.h, 0, 0, ROI_SIZE, ROI_SIZE);
      rppgRef.current.push(ctx.getImageData(0, 0, ROI_SIZE, ROI_SIZE), now);
    };

    rafRef.current = requestAnimationFrame(step);
  }, []);

  const start = useCallback(
    async (name: string, consent: ConsentState) => {
      if (status === "starting" || status === "active") return;
      setStatus("starting");
      setError(null);
      endedRef.current = false;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: consent.video
            ? { width: { ideal: 640 }, height: { ideal: 480}, frameRate: { ideal: 30 } }
            : false,
          audio: consent.audio
            ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            : false,
        });
        streamRef.current = stream;

        const created = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patientName: name, consent }),
        });
        if (!created.ok) throw new Error("Could not start a session");
        const session = await created.json();
        sessionIdRef.current = session.id;
        setSessionId(session.id);

        if (consent.video && videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          await expressionRef.current.load();
          setExpressionUnavailable(expressionRef.current.unavailable);
          runFrameLoop();
        }

        if (consent.audio) {
          const mic = new MicPipeline({
            onReading: (reading) => {
              voiceRef.current = reading;
            },
            onUtterance: (audio) => void handleUtterance(audio),
            onSpeakingChange: setListening,
          });
          await mic.start(stream);
          micRef.current = mic;

          // Deepgram is more accurate, so the browser recogniser only takes
          // over turn-taking when no server transcription exists.
          const useBrowserStt =
            providers?.stt === "browser" || providers === null;
          if (useBrowserStt && browserSttAvailable()) {
            mic.setCaptureEnabled(false);
            recognitionRef.current = startBrowserRecognition((text) => {
              void handlePatientText(text);
            });
          }
        }

        telemetryTimerRef.current = setInterval(() => {
          const rppg = rppgRef.current.read();
          const video = videoReadingRef.current;
          const voice = voiceRef.current;

          const sample: Telemetry = {
            at: Date.now(),
            video: {
              bpm: rppg.bpm,
              hrvMs: rppg.hrvMs,
              quality: rppg.quality,
              emotion: video.emotion,
              emotionConfidence: video.emotionConfidence,
              eyeClosure: video.eyeClosure,
              headMotion: video.headMotion,
              faceDetected: video.faceDetected,
            },
            voice,
            scores: scoreWellbeing(
              { ...video, bpm: rppg.bpm, hrvMs: rppg.hrvMs, quality: rppg.quality },
              voice,
            ),
          };

          latestTelemetryRef.current = sample;
          setTelemetry(sample);
          pendingTelemetryRef.current.push(sample);
        }, TELEMETRY_INTERVAL_MS);

        flushTimerRef.current = setInterval(() => void flushTelemetry(), TELEMETRY_FLUSH_MS);

        setStatus("active");
        pushTurn({
          id: "greeting",
          role: "assistant",
          text: GREETING,
          at: Date.now(),
        });
        await say(GREETING);
      } catch (err) {
        console.error("[neura] session start failed", err);
        setError(
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Neura needs camera and microphone access to run. You can grant it in your browser's address bar and try again."
            : "Something went wrong starting your session. Please try again.",
        );
        setStatus("error");
      }
    },
    [status, providers, handleUtterance, handlePatientText, runFrameLoop, flushTelemetry, pushTurn, say],
  );

  const end = useCallback(async () => {
    endedRef.current = true;
    setStatus("ending");

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (telemetryTimerRef.current) clearInterval(telemetryTimerRef.current);
    if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    rafRef.current = null;
    telemetryTimerRef.current = null;
    flushTimerRef.current = null;

    recognitionRef.current?.stop();
    recognitionRef.current = null;
    micRef.current?.stop();
    micRef.current = null;
    expressionRef.current.close();
    rppgRef.current.reset();

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;

    await flushTelemetry();

    const id = sessionIdRef.current;
    if (id) {
      await fetch(`/api/sessions/${id}`, { method: "DELETE" }).catch(() => {});
    }

    setStatus("ended");
  }, [flushTelemetry]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (telemetryTimerRef.current) clearInterval(telemetryTimerRef.current);
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      recognitionRef.current?.stop();
      micRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return {
    status,
    error,
    sessionId,
    telemetry,
    transcript,
    risk,
    resources,
    listening,
    thinking,
    speaking,
    providers,
    expressionUnavailable,
    videoRef,
    avatarAudio,
    start,
    sendText: handlePatientText,
    end,
  };
}
