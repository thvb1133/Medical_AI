"use client";

import type { RefObject } from "react";

/** Anam streams into this element by id, so it must be stable and unique. */
export const AVATAR_VIDEO_ID = "neura-avatar-video";

/**
 * The therapist's video window.
 *
 * Without an Anam licence there is no avatar to stream, so rather than show a
 * dead black rectangle the stage falls back to a calm presence indicator that
 * still reflects speaking/listening state — the conversation itself works
 * identically either way.
 */
export function AvatarStage({
  videoRef,
  live,
  speaking,
  personaName,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  live: boolean;
  speaking: boolean;
  personaName: string;
}) {
  return (
    <div className="panel-card relative aspect-[4/3] w-full overflow-hidden bg-[#0f1113]">
      <video
        id={AVATAR_VIDEO_ID}
        ref={videoRef}
        autoPlay
        playsInline
        className={`h-full w-full object-cover ${live ? "" : "hidden"}`}
      />

      {!live && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4">
          <div
            className={`flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#3b6fd4] to-[#6f4fd8] text-2xl font-semibold text-white transition-transform duration-300 ${
              speaking ? "scale-110" : "scale-100"
            }`}
          >
            {personaName.charAt(0).toUpperCase()}
          </div>
          <div className="text-center">
            <p className="text-[12px] font-medium text-white/90">{personaName}</p>
            <p className="mt-0.5 text-[10px] text-white/45">
              {speaking ? "Speaking…" : "Listening"}
            </p>
          </div>
        </div>
      )}

      {live && speaking && (
        <span className="absolute bottom-2 left-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white backdrop-blur-sm">
          {personaName} is speaking
        </span>
      )}
    </div>
  );
}
