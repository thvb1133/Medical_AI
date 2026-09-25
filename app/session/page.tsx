"use client";

/**
 * The patient's view.
 *
 * Deliberately minimal: no heart rate, no stress score, no wellbeing number.
 * Showing someone a live readout of their own distress during a distressing
 * conversation makes the conversation worse, and it invites them to perform
 * for the sensor rather than talk. Everything measured here is visible on the
 * clinician side instead, which the consent screen says plainly.
 */

import { useState } from "react";
import Link from "next/link";
import { AvatarStage } from "@/components/AvatarStage";
import { ConsentGate } from "@/components/ConsentGate";
import { ConversationPanel } from "@/components/ConversationPanel";
import { CrisisOverlay } from "@/components/CrisisOverlay";
import { useNeuraSession } from "@/hooks/useNeuraSession";
import { atLeast } from "@/lib/crisis";

export default function SessionPage() {
  const session = useNeuraSession();
  const [resourcesHidden, setResourcesHidden] = useState(false);

  const showCrisis =
    atLeast(session.risk, "high") && session.resources.length > 0 &&
    (session.risk === "crisis" || !resourcesHidden);

  if (session.status === "idle" || session.status === "starting" || session.status === "error") {
    return (
      <main className="flex min-h-dvh items-center justify-center px-5 py-12">
        <div className="w-full">
          <ConsentGate onStart={session.start} busy={session.status === "starting"} />
          {session.error && (
            <p className="mx-auto mt-6 max-w-xl rounded-lg border border-alert-500/50 bg-alert-700/20 px-4 py-3 text-sm text-alert-100">
              {session.error}
            </p>
          )}
        </div>
      </main>
    );
  }

  if (session.status === "ended") {
    return (
      <main className="flex min-h-dvh items-center justify-center px-5 py-12">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold text-calm-50">Thank you for talking</h1>
          <p className="mt-3 text-calm-300">
            Your session has ended and your care team can see the summary. If things feel
            worse later, Samaritans are on 116 123, any hour of any day.
          </p>
          <Link
            href="/"
            className="mt-8 inline-block rounded-lg bg-calm-700 px-5 py-2.5 text-sm font-medium text-calm-50 hover:bg-calm-600"
          >
            Back to start
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-5 py-8">
      <header className="flex items-center justify-between">
        <span className="text-sm font-medium tracking-wide text-calm-400">NEURA</span>
        <button
          type="button"
          onClick={() => void session.end()}
          className="rounded-lg border border-calm-700 px-4 py-2 text-sm text-calm-200 transition hover:border-calm-500 hover:text-calm-50"
        >
          End session
        </button>
      </header>

      <div className="mt-8 grid flex-1 gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col items-center gap-6">
          <AvatarStage
            speaking={session.speaking}
            thinking={session.thinking}
            listening={session.listening}
            audio={session.avatarAudio}
          />
          <p className="max-w-xs text-center text-sm text-calm-400">
            Take your time. There is no right answer, and you can stop whenever you want.
          </p>

          {/*
            The patient's own camera feed is kept off-screen: the pipeline needs
            the frames, but a mirror of your own face is a well-known source of
            self-consciousness in video consultations.
          */}
          <video
            ref={session.videoRef}
            playsInline
            muted
            className="sr-only"
            aria-hidden="true"
          />
        </div>

        <div className="flex flex-col gap-4">
          {showCrisis && (
            <CrisisOverlay
              resources={session.resources}
              level={session.risk === "crisis" ? "crisis" : "high"}
              onDismiss={() => setResourcesHidden(true)}
            />
          )}

          <div className="flex min-h-[26rem] flex-1 flex-col rounded-xl border border-calm-800 bg-calm-900/30 p-4">
            <ConversationPanel
              transcript={session.transcript}
              thinking={session.thinking}
              listening={session.listening}
              speaking={session.speaking}
              disabled={session.thinking || session.status !== "active"}
              onSend={(text) => void session.sendText(text)}
            />
          </div>
        </div>
      </div>

      {session.expressionUnavailable && (
        <p className="mt-6 text-center text-xs text-calm-500">
          Expression analysis could not load on this device. The conversation works
          normally; your clinician will see fewer signals.
        </p>
      )}
    </main>
  );
}
