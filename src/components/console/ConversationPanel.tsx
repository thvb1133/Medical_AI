"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Panel } from "@/components/ui/Panel";
import { SendIcon } from "@/components/ui/icons";
import type { Message } from "@/lib/types";

function Bubble({ message }: { message: Message }) {
  const mine = message.author === "patient";
  return (
    <div className={mine ? "flex flex-col items-end" : "flex flex-col items-start"}>
      <span className="mb-1 text-[10px] text-ink-400">{mine ? "You" : "Agent"}</span>
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-[11.5px] leading-[16px] ${
          mine
            ? "bg-bubble-user text-white"
            : "bg-bubble-agent text-ink-900 dark:bg-hairline-dark dark:text-white"
        }`}
      >
        {message.text}
      </div>
    </div>
  );
}

export function ConversationPanel({
  messages,
  thinking,
  disabled,
  onSend,
}: {
  messages: Message[];
  thinking: boolean;
  disabled: boolean;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Pin to the newest turn. A consultation transcript is only ever read from
  // the bottom, and losing the latest reply behind the fold is disorienting.
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length, thinking]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || disabled) return;
    onSend(text);
    setDraft("");
  }

  return (
    <Panel className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-baseline justify-between px-3 pb-2 pt-2.5">
        <h2 className="text-[13px] font-semibold">Conversation</h2>
        <span className="text-[11px] text-ink-400">
          {messages.length} message{messages.length === 1 ? "" : "s"}
        </span>
      </header>

      <div ref={scrollRef} className="thin-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-3">
        {messages.length === 0 && (
          <p className="pt-6 text-center text-[11px] text-ink-400">
            The conversation will appear here once you start talking.
          </p>
        )}
        {messages.map((message) => (
          <Bubble key={message.id} message={message} />
        ))}
        {thinking && (
          <div className="flex flex-col items-start">
            <span className="mb-1 text-[10px] text-ink-400">Agent</span>
            <div className="rounded-lg bg-bubble-agent px-3 py-2 dark:bg-hairline-dark">
              <span className="flex gap-1" aria-label="Agent is replying">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-400"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={submit} className="flex items-center gap-2 p-3">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type a message"
          disabled={disabled}
          aria-label="Message"
          className="field py-2 text-[12px] disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={disabled || draft.trim().length === 0}
          aria-label="Send message"
          className="flex h-[34px] w-[38px] shrink-0 items-center justify-center rounded-md bg-accent text-white transition hover:bg-accent-hover disabled:opacity-40"
        >
          <SendIcon className="h-[15px] w-[15px]" />
        </button>
      </form>
    </Panel>
  );
}
