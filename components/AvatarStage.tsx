"use client";

/**
 * The face the patient talks to.
 *
 * With an Anam key the real video avatar streams in; without one this renders
 * a calm abstract presence that breathes and reacts to the reply audio. The
 * fallback is deliberately not a cartoon face — a low-fidelity human face in a
 * mental-health context lands somewhere between unconvincing and unsettling,
 * so an ambient form is the safer default.
 */

import { useEffect, useRef } from "react";

type Props = {
  speaking: boolean;
  thinking: boolean;
  listening: boolean;
  audio: HTMLAudioElement | null;
  /** Streams from Anam when configured. */
  remoteStream?: MediaStream | null;
};

export function AvatarStage({ speaking, thinking, listening, audio, remoteStream }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const amplitudeRef = useRef(0);

  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
      void videoRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  // Tap the reply audio so the visual pulse matches the actual speech envelope
  // rather than a generic animation.
  useEffect(() => {
    if (!audio) {
      amplitudeRef.current = 0;
      return;
    }

    let context: AudioContext | null = null;
    let raf = 0;

    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      context = new Ctor();
      const source = context.createMediaElementSource(audio);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(context.destination);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        raf = requestAnimationFrame(tick);
        analyser.getByteTimeDomainData(data as Uint8Array<ArrayBuffer>);
        let peak = 0;
        for (let i = 0; i < data.length; i++) {
          peak = Math.max(peak, Math.abs(data[i] - 128) / 128);
        }
        amplitudeRef.current = amplitudeRef.current * 0.7 + peak * 0.3;
      };
      tick();
    } catch {
      amplitudeRef.current = 0;
    }

    return () => {
      cancelAnimationFrame(raf);
      void context?.close();
    };
  }, [audio]);

  useEffect(() => {
    if (remoteStream) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let t = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      t += 0.016;

      const { width: w, height: h } = canvas;
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      // A slow breath cycle at rest, replaced by the speech envelope when
      // Fergus is talking.
      const breath = Math.sin(t * 0.9) * 0.02 + 1;
      const amp = speaking ? amplitudeRef.current : 0;
      const base = Math.min(w, h) * 0.26;
      const radius = base * breath * (1 + amp * 0.35);

      const rings = 3;
      for (let i = rings; i >= 1; i--) {
        const spread = radius * (1 + i * 0.28 + amp * 0.15 * i);
        const gradient = ctx.createRadialGradient(cx, cy, radius * 0.4, cx, cy, spread);
        gradient.addColorStop(0, `rgba(98, 154, 149, ${0.16 / i})`);
        gradient.addColorStop(1, "rgba(98, 154, 149, 0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, spread, 0, Math.PI * 2);
        ctx.fill();
      }

      const core = ctx.createRadialGradient(
        cx - radius * 0.3,
        cy - radius * 0.35,
        radius * 0.1,
        cx,
        cy,
        radius,
      );
      core.addColorStop(0, "#dceae8");
      core.addColorStop(0.55, "#8fbab5");
      core.addColorStop(1, "#477e7a");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      if (thinking) {
        // Three orbiting dots: the same "working on it" signal people already
        // recognise, without a spinner's urgency.
        for (let i = 0; i < 3; i++) {
          const angle = t * 1.6 + (i * Math.PI * 2) / 3;
          const orbit = radius * 1.32;
          ctx.fillStyle = `rgba(242, 247, 246, ${0.35 + 0.35 * Math.sin(t * 3 + i)})`;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(angle) * orbit, cy + Math.sin(angle) * orbit, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (listening) {
        ctx.strokeStyle = `rgba(143, 186, 181, ${0.3 + 0.2 * Math.sin(t * 4)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 1.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [speaking, thinking, listening, remoteStream]);

  return (
    <div className="relative aspect-square w-full max-w-sm overflow-hidden rounded-full bg-calm-950/40">
      {remoteStream ? (
        <video
          ref={videoRef}
          playsInline
          autoPlay
          className="h-full w-full object-cover"
          aria-label="Fergus, your conversational companion"
        />
      ) : (
        <canvas
          ref={canvasRef}
          width={512}
          height={512}
          className="h-full w-full"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
