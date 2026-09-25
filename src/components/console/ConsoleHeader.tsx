"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GearIcon, MoonIcon, SparkIcon, SunIcon } from "@/components/ui/icons";
import type { PublicUser, RuntimeCapabilities } from "@/lib/types";

const CAPABILITY_LABELS: Record<keyof RuntimeCapabilities, string> = {
  llm: "Conversation model (OpenAI)",
  avatar: "Video avatar (Anam)",
  realtimeVoice: "Realtime voice (Agora)",
  cameraVitals: "Camera vitals (Shen.AI)",
  voiceBiomarkers: "Voice biomarkers (Thymia)",
  persistence: "Database persistence",
};

function useTheme() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("neura-theme");
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(stored ? stored === "dark" : prefers);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    window.localStorage.setItem("neura-theme", dark ? "dark" : "light");
  }, [dark]);

  return { dark, toggle: () => setDark((value) => !value) };
}

function SettingsMenu({
  capabilities,
  durableStorage,
  user,
}: {
  capabilities: RuntimeCapabilities;
  durableStorage: boolean;
  user: PublicUser | null;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Settings"
        aria-expanded={open}
        className="flex h-7 w-7 items-center justify-center rounded-md text-ink-500 transition hover:bg-[#f1f2f4] dark:hover:bg-hairline-dark"
      >
        <GearIcon className="h-4 w-4" />
      </button>

      {open && (
        <div className="panel-card absolute right-0 top-9 z-30 w-72 p-3 text-[11.5px]">
          <p className="section-heading mb-2">Integrations</p>
          <ul className="space-y-1.5">
            {(Object.keys(CAPABILITY_LABELS) as (keyof RuntimeCapabilities)[]).map((key) => (
              <li key={key} className="flex items-center justify-between gap-3">
                <span className="text-ink-700 dark:text-ink-300">{CAPABILITY_LABELS[key]}</span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    capabilities[key]
                      ? "bg-safe-bg text-safe-text"
                      : "bg-[#f1f2f4] text-ink-500 dark:bg-hairline-dark dark:text-ink-300"
                  }`}
                >
                  {capabilities[key] ? "Live" : "Simulated"}
                </span>
              </li>
            ))}
          </ul>

          {!durableStorage && (
            <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10.5px] leading-[14px] text-amber-800">
              No DATABASE_URL is set, so sessions are held in memory and will be lost when the
              server restarts.
            </p>
          )}

          <div className="mt-3 space-y-1 border-t border-hairline-light pt-2.5 dark:border-hairline-dark">
            {user?.role === "clinician" && (
              <Link
                href="/clinician"
                className="block rounded px-1 py-1 text-ink-700 hover:bg-[#f1f2f4] dark:text-ink-300 dark:hover:bg-hairline-dark"
              >
                Clinician dashboard
              </Link>
            )}
            {user && (
              <>
                <p className="px-1 py-1 text-[10.5px] text-ink-400">
                  Signed in as {user.name} ({user.role})
                </p>
                <button
                  type="button"
                  onClick={signOut}
                  className="block w-full rounded px-1 py-1 text-left text-ink-700 hover:bg-[#f1f2f4] dark:text-ink-300 dark:hover:bg-hairline-dark"
                >
                  Sign out
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ConsoleHeader({
  title,
  subtitle,
  capabilities,
  durableStorage,
  user,
}: {
  title: string;
  subtitle: string;
  capabilities: RuntimeCapabilities;
  durableStorage: boolean;
  user: PublicUser | null;
}) {
  const { dark, toggle } = useTheme();

  return (
    <header className="flex items-center justify-between border-b border-hairline-light bg-panel-light px-3 py-2 dark:border-hairline-dark dark:bg-panel-dark">
      <div className="flex items-center gap-2">
        <SparkIcon className="h-3.5 w-3.5 text-[#e07b26]" />
        <div className="leading-tight">
          <h1 className="text-[13px] font-semibold">{title}</h1>
          <p className="text-[10px] text-ink-400">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={toggle}
          aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-500 transition hover:bg-[#f1f2f4] dark:hover:bg-hairline-dark"
        >
          {dark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
        </button>
        <SettingsMenu capabilities={capabilities} durableStorage={durableStorage} user={user} />
      </div>
    </header>
  );
}
