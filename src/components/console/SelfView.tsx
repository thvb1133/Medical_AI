"use client";

import type { RefObject } from "react";
import { CameraIcon, GearIcon, MicIcon, MicOffIcon, PulseIcon, ScreenIcon, VideoIcon, VideoOffIcon } from "@/components/ui/icons";

/** The canvas id is fixed because the Shen.AI SDK attaches to it by name. */
export const SHENAI_CANVAS_ID = "mxcanvas";

interface SelfViewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  cameraOn: boolean;
  micOn: boolean;
  listening: boolean;
  vitalsActive: boolean;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onToggleDictation: () => void;
}

function BarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-5 w-5 items-center justify-center rounded transition hover:bg-white/20 ${
        active ? "text-white" : "text-white/40"
      }`}
    >
      {children}
    </button>
  );
}

/** Non-interactive status glyph, for state the patient cannot change here. */
function BarStatus({ label, active, children }: { label: string; active: boolean; children: React.ReactNode }) {
  return (
    <span
      title={label}
      aria-label={label}
      role="img"
      className={`flex h-5 w-5 items-center justify-center ${active ? "text-white" : "text-white/40"}`}
    >
      {children}
    </span>
  );
}

/**
 * The patient's own camera feed.
 *
 * When Shen.AI is licensed it takes the camera over and paints its own
 * processed view into a canvas, so the raw <video> is kept mounted but hidden
 * rather than unmounted — tearing the element down mid-session drops the
 * MediaStream and restarting it costs a visible flicker.
 */
export function SelfView({
  videoRef,
  cameraOn,
  micOn,
  listening,
  vitalsActive,
  onToggleCamera,
  onToggleMic,
  onToggleDictation,
}: SelfViewProps) {
  return (
    <div className="panel-card relative aspect-[16/10] w-full overflow-hidden bg-[#1a1d21]">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`h-full w-full object-cover ${vitalsActive ? "invisible absolute" : ""}`}
      />
      <canvas
        id={SHENAI_CANVAS_ID}
        className={`h-full w-full object-cover ${vitalsActive ? "" : "hidden"}`}
      />

      {!cameraOn && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1a1d21]">
          <p className="text-[11px] text-white/50">Camera off</p>
        </div>
      )}

      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 rounded-md bg-black/55 px-1 py-0.5 backdrop-blur-sm">
        <BarButton
          label={listening ? "Stop voice input" : "Start voice input"}
          active={listening}
          onClick={onToggleDictation}
        >
          <GearIcon className="h-3 w-3" />
        </BarButton>
        <BarStatus label={cameraOn ? "Camera feed active" : "Camera feed stopped"} active={cameraOn}>
          <CameraIcon className="h-3 w-3" />
        </BarStatus>
        <BarButton
          label={cameraOn ? "Turn camera off" : "Turn camera on"}
          active={cameraOn}
          onClick={onToggleCamera}
        >
          {cameraOn ? <VideoIcon className="h-3 w-3" /> : <VideoOffIcon className="h-3 w-3" />}
        </BarButton>
        <BarButton
          label={micOn ? "Mute microphone" : "Unmute microphone"}
          active={micOn}
          onClick={onToggleMic}
        >
          {micOn ? <MicIcon className="h-3 w-3" /> : <MicOffIcon className="h-3 w-3" />}
        </BarButton>
        <BarStatus label="Screen sharing not available" active={false}>
          <ScreenIcon className="h-3 w-3" />
        </BarStatus>
        <BarStatus
          label={vitalsActive ? "Camera vitals live" : "Camera vitals simulated"}
          active={vitalsActive}
        >
          <PulseIcon className="h-3 w-3" />
        </BarStatus>
      </div>
    </div>
  );
}
