"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startAvatar, type AvatarController } from "@/lib/client/anam";
import { joinVoiceChannel, type VoiceTransport } from "@/lib/client/agora";
import { startCameraVitals, type VitalsController } from "@/lib/client/shenai";
import { cancelSpeech, speak, startListening, type Listener } from "@/lib/client/speech";
import { simulateSnapshot } from "@/lib/simulation";
import { BASELINE_SAFETY, type Message, type MetricSnapshot, type SafetyAnalysis } from "@/lib/types";
import { AVATAR_VIDEO_ID } from "@/components/console/AvatarStage";
import { SHENAI_CANVAS_ID } from "@/components/console/SelfView";

/** How often the rail refreshes, and how often a sample is persisted. */
const SAMPLE_INTERVAL_MS = 1000;
const PERSIST_EVERY_MS = 5000;

export interface ConsultationConfig {
  sessionId: string;
  initialMessages: Message[];
  capabilities: {
    llm: boolean;
    avatar: boolean;
    realtimeVoice: boolean;
    cameraVitals: boolean;
    voiceBiomarkers: boolean;
    persistence: boolean;
  };
  shenaiApiKey: string | null;
  userId: string;
}

export function useConsultation(config: ConsultationConfig) {
  const [messages, setMessages] = useState<Message[]>(config.initialMessages);
  const [snapshot, setSnapshot] = useState<MetricSnapshot>(() =>
    simulateSnapshot({ seed: config.sessionId, elapsedSec: 0, distress: 0.08 }),
  );
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [ending, setEnding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [vitalsLive, setVitalsLive] = useState(false);
  const [avatarLive, setAvatarLive] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const avatarVideoRef = useRef<HTMLVideoElement>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const vitalsRef = useRef<VitalsController | null>(null);
  const avatarRef = useRef<AvatarController | null>(null);
  const transportRef = useRef<VoiceTransport | null>(null);
  const listenerRef = useRef<Listener | null>(null);

  const startedAtRef = useRef(Date.now());
  const distressRef = useRef(0.08);
  const safetyRef = useRef<SafetyAnalysis>(BASELINE_SAFETY);
  const lastPersistRef = useRef(0);
  // Guards against a second send while a turn is in flight, without waiting a
  // render for `thinking` to settle.
  const busyRef = useRef(false);

  /* ----------------------------------------------------- media + providers */

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        if (!cancelled) {
          setNotice("Camera and microphone access was denied. You can still type below.");
          setCameraOn(false);
        }
      }

      if (config.capabilities.cameraVitals && config.shenaiApiKey && !cancelled) {
        try {
          vitalsRef.current = await startCameraVitals(
            config.shenaiApiKey,
            config.userId,
            SHENAI_CANVAS_ID,
          );
          if (!cancelled) setVitalsLive(true);
        } catch (error) {
          console.warn("[neura] Camera vitals unavailable, simulating:", error);
        }
      }

      if (config.capabilities.avatar && !cancelled) {
        try {
          const avatar = await startAvatar(AVATAR_VIDEO_ID);
          avatar.onSpeakingChange(setSpeaking);
          avatarRef.current = avatar;
          if (!cancelled) setAvatarLive(true);
        } catch (error) {
          console.warn("[neura] Avatar unavailable, using local voice:", error);
        }
      }

      if (config.capabilities.realtimeVoice && !cancelled) {
        try {
          transportRef.current = await joinVoiceChannel(`neura-${config.sessionId}`);
        } catch (error) {
          console.warn("[neura] Agora voice transport unavailable:", error);
        }
      }
    }

    void boot();

    return () => {
      cancelled = true;
      vitalsRef.current?.stop();
      avatarRef.current?.stop();
      void transportRef.current?.leave();
      listenerRef.current?.stop();
      cancelSpeech();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
    // Providers are booted once per session; config is stable for its lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------------------------------------------------------- sampling loop */

  useEffect(() => {
    const timer = setInterval(() => {
      const elapsedSec = (Date.now() - startedAtRef.current) / 1000;

      // Emotion and voice-biomarker panels are always simulated for now; the
      // vitals half is replaced wholesale when Shen.AI is reporting.
      const base = simulateSnapshot({
        seed: config.sessionId,
        elapsedSec,
        distress: distressRef.current,
        safety: safetyRef.current,
      });

      const reading = vitalsRef.current?.read();
      const next: MetricSnapshot = reading
        ? {
            ...base,
            measurementProgressPct: reading.progressPct,
            realtime: reading.realtime,
            results: reading.results,
            live: true,
          }
        : base;

      setSnapshot(next);

      const now = Date.now();
      if (now - lastPersistRef.current >= PERSIST_EVERY_MS) {
        lastPersistRef.current = now;
        void fetch(`/api/sessions/${config.sessionId}/metrics`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        }).catch(() => undefined);
      }
    }, SAMPLE_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [config.sessionId]);

  /* ------------------------------------------------------------ speaking */

  const voice = useCallback(
    (text: string) => {
      const avatar = avatarRef.current;
      if (avatar) {
        void avatar.speak(text);
        return;
      }
      setSpeaking(true);
      speak(text, () => setSpeaking(false));
    },
    [],
  );

  /* ------------------------------------------------------------- sending */

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busyRef.current) return;
      busyRef.current = true;
      setThinking(true);

      // Show the patient's own words immediately; the server assigns the real
      // id when it persists the turn.
      const optimistic: Message = {
        id: `local-${crypto.randomUUID()}`,
        sessionId: config.sessionId,
        author: "patient",
        text: trimmed,
        at: new Date().toISOString(),
      };
      setMessages((current) => [...current, optimistic]);

      try {
        const response = await fetch(`/api/sessions/${config.sessionId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed }),
        });

        if (!response.ok) {
          const { error } = (await response.json().catch(() => ({ error: null }))) as {
            error: string | null;
          };
          throw new Error(error ?? "The agent could not respond");
        }

        const data = (await response.json()) as {
          reply: Message;
          safety: SafetyAnalysis;
          distress: number;
        };

        safetyRef.current = data.safety;
        distressRef.current = data.distress;
        setMessages((current) => [...current, data.reply]);
        setSnapshot((current) => ({ ...current, safety: data.safety }));
        voice(data.reply.text);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Something went wrong");
      } finally {
        busyRef.current = false;
        setThinking(false);
      }
    },
    [config.sessionId, voice],
  );

  /* -------------------------------------------------------------- controls */

  const toggleListening = useCallback(() => {
    if (listenerRef.current) {
      listenerRef.current.stop();
      listenerRef.current = null;
      setListening(false);
      return;
    }

    const listener = startListening({
      onUtterance: (text) => void send(text),
      onError: (message) => setNotice(`Voice input error: ${message}`),
    });

    if (!listener) {
      setNotice("Voice input is not supported in this browser. Please type instead.");
      return;
    }
    listenerRef.current = listener;
    setListening(true);
  }, [send]);

  const toggleMic = useCallback(() => {
    const next = !micOn;
    setMicOn(next);
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });
    void transportRef.current?.setMuted(!next);

    // The mic button is the natural place to start and stop dictation, so it
    // controls both the track and the recogniser.
    if (!next && listenerRef.current) {
      listenerRef.current.stop();
      listenerRef.current = null;
      setListening(false);
    } else if (next && !listenerRef.current) {
      toggleListening();
    }
  }, [micOn, toggleListening]);

  const toggleCamera = useCallback(() => {
    const next = !cameraOn;
    setCameraOn(next);
    streamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = next;
    });
  }, [cameraOn]);

  const end = useCallback(async () => {
    setEnding(true);
    listenerRef.current?.stop();
    cancelSpeech();
    vitalsRef.current?.stop();
    avatarRef.current?.stop();
    await transportRef.current?.leave();
    streamRef.current?.getTracks().forEach((track) => track.stop());

    try {
      await fetch(`/api/sessions/${config.sessionId}`, { method: "PATCH" });
    } catch {
      /* the session is ended locally regardless */
    }
    window.location.href = "/session/ended";
  }, [config.sessionId]);

  return {
    messages,
    snapshot,
    thinking,
    speaking,
    listening,
    micOn,
    cameraOn,
    ending,
    notice,
    vitalsLive,
    avatarLive,
    videoRef,
    avatarVideoRef,
    send,
    toggleMic,
    toggleCamera,
    toggleListening,
    end,
    dismissNotice: () => setNotice(null),
  };
}
