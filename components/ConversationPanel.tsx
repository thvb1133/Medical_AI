"use client";

/**
 * Captions plus a typed-input fallback.
 *
 * Captions are not optional decoration here: they carry the session for
 * anyone deaf or hard of hearing, and they let someone check what Fergus
 * actually said rather than what they think they heard while distressed.
 */

import { useEffect, useRef, useState } from "react";
import type { TranscriptTurn } from "@/lib/types";

type Props = {
  transcript: TranscriptTurn[];
  thinking: boolean;
  listening: boolean;
  speaking: boolean;
  disabled: boolean;
  onSend: (text: string) => void;
};

export function ConversationPanel({
  transcript,
  thinking,
  listening,
  speaking,
  disabled,
  onSend,
}: Props) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [transcript, thinking]);

  const statusLabel = speaking
    ? "Fergus is speaking"
    : thinking
      ? "Fergus is thinking"
      : listening
        ? "Listening"
        : "Ready when you are";

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex-1 space-y-3 overflow-y-auto pr-1"
        role="log"
        aria-live="polite"
        aria-label="Conversation"
      >
        {transcript.map((turn) => (
          <div
            key={turn.id}
            className={`animate-fade-up max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              turn.role === "assistant"
                ? "bg-calm-800/70 text-calm-100"
                : "ml-auto bg-calm-400/90 text-calm-950"
            }`}
          >
            {turn.text}
          </div>
        ))}
        {thinking && (
          <div className="flex w-16 items-center gap-1 rounded-2xl bg-calm-800/70 px-4 py-3">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-calm-300"
                style={{ animationDelay: `${i * 120}ms` }}
              />
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center gap-2 text-xs text-calm-400">
          <span
            className={`h-2 w-2 rounded-full ${
              listening ? "bg-calm-300 animate-pulse" : "bg-calm-700"
            }`}
          />
          {statusLabel}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const text = draft.trim();
            if (!text || disabled) return;
            onSend(text);
            setDraft("");
          }}
          className="flex gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={disabled}
            placeholder="Or type instead of speaking"
            className="flex-1 rounded-lg border border-calm-700 bg-calm-900/60 px-4 py-2.5 text-sm text-calm-50 placeholder:text-calm-500 focus:border-calm-400 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={disabled || !draft.trim()}
            className="rounded-lg bg-calm-700 px-4 py-2.5 text-sm font-medium text-calm-50 transition hover:bg-calm-600 disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
