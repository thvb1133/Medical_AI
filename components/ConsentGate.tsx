"use client";

/**
 * Consent is collected before any sensor is touched, in plain language, with
 * each permission separately refusable. The patient is told up front that a
 * clinician sees the conversation, because the alternative — discovering it
 * later — is the fastest way to destroy trust in a tool like this.
 */

import { useState } from "react";
import type { ConsentState } from "@/lib/types";

type Props = {
  onStart: (name: string, consent: ConsentState) => void;
  busy: boolean;
};

const CHECKS: Array<{
  key: keyof Omit<ConsentState, "grantedAt">;
  label: string;
  detail: string;
}> = [
  {
    key: "video",
    label: "Use my camera",
    detail:
      "Your camera estimates heart rate and facial expression on your own device. Video frames are never uploaded or stored.",
  },
  {
    key: "audio",
    label: "Use my microphone",
    detail:
      "Your voice is analysed for tone and pace. Speech is transcribed so the conversation can continue; the recording itself is not kept.",
  },
  {
    key: "shareWithClinician",
    label: "Share a summary with my care team",
    detail:
      "Your clinician sees the transcript, the wellbeing scores, and any safety alerts. You can end the session at any time.",
  },
];

export function ConsentGate({ onStart, busy }: Props) {
  const [name, setName] = useState("");
  const [consent, setConsent] = useState<Omit<ConsentState, "grantedAt">>({
    video: true,
    audio: true,
    shareWithClinician: true,
  });

  const canStart = name.trim().length > 0 && (consent.video || consent.audio) && !busy;

  return (
    <div className="mx-auto w-full max-w-xl animate-fade-up">
      <h1 className="text-2xl font-semibold text-calm-50">Before we start</h1>
      <p className="mt-3 text-calm-200">
        Neura is a support tool, not a doctor and not an emergency service. If you are in
        danger right now, please call 999, or Samaritans on 116 123.
      </p>

      <label className="mt-8 block">
        <span className="text-sm font-medium text-calm-200">What should we call you?</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="First name is fine"
          autoComplete="off"
          className="mt-2 w-full rounded-lg border border-calm-700 bg-calm-900/60 px-4 py-3 text-calm-50 placeholder:text-calm-500 focus:border-calm-400 focus:outline-none focus:ring-1 focus:ring-calm-400"
        />
      </label>

      <fieldset className="mt-6 space-y-3">
        <legend className="text-sm font-medium text-calm-200">
          You choose what Neura can use
        </legend>
        {CHECKS.map((check) => (
          <label
            key={check.key}
            className="flex cursor-pointer gap-3 rounded-lg border border-calm-800 bg-calm-900/40 p-4 transition hover:border-calm-600"
          >
            <input
              type="checkbox"
              checked={consent[check.key]}
              onChange={(e) =>
                setConsent((c) => ({ ...c, [check.key]: e.target.checked }))
              }
              className="mt-1 h-4 w-4 shrink-0 accent-calm-400"
            />
            <span>
              <span className="block font-medium text-calm-100">{check.label}</span>
              <span className="mt-1 block text-sm text-calm-300">{check.detail}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <button
        type="button"
        disabled={!canStart}
        onClick={() =>
          onStart(name.trim(), { ...consent, grantedAt: Date.now() })
        }
        className="mt-8 w-full rounded-lg bg-calm-400 px-6 py-3 font-medium text-calm-950 transition hover:bg-calm-300 disabled:cursor-not-allowed disabled:bg-calm-800 disabled:text-calm-500"
      >
        {busy ? "Connecting..." : "Start my session"}
      </button>

      {!consent.video && !consent.audio && (
        <p className="mt-3 text-center text-sm text-calm-400">
          Neura needs at least your camera or your microphone to work.
        </p>
      )}
    </div>
  );
}
