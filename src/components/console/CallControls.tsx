"use client";

import { MicIcon, MicOffIcon, VideoIcon, VideoOffIcon } from "@/components/ui/icons";

function RoundButton({
  label,
  enabled,
  onClick,
  children,
}: {
  label: string;
  enabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={enabled}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
        enabled
          ? "bg-accent text-white hover:bg-accent-hover"
          : "bg-[#eceef1] text-ink-500 hover:bg-[#e2e5e9] dark:bg-hairline-dark dark:text-ink-300"
      }`}
    >
      {children}
    </button>
  );
}

export function CallControls({
  micOn,
  cameraOn,
  ending,
  onToggleMic,
  onToggleCamera,
  onEnd,
}: {
  micOn: boolean;
  cameraOn: boolean;
  ending: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onEnd: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2.5">
      <RoundButton
        label={micOn ? "Mute microphone" : "Unmute microphone"}
        enabled={micOn}
        onClick={onToggleMic}
      >
        {micOn ? <MicIcon className="h-4 w-4" /> : <MicOffIcon className="h-4 w-4" />}
      </RoundButton>

      <RoundButton
        label={cameraOn ? "Turn camera off" : "Turn camera on"}
        enabled={cameraOn}
        onClick={onToggleCamera}
      >
        {cameraOn ? <VideoIcon className="h-4 w-4" /> : <VideoOffIcon className="h-4 w-4" />}
      </RoundButton>

      <button
        type="button"
        onClick={onEnd}
        disabled={ending}
        className="rounded-md bg-danger px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-danger-hover disabled:opacity-60"
      >
        {ending ? "Ending…" : "End Call"}
      </button>
    </div>
  );
}
