import { createClient, type AnamClient } from "@anam-ai/js-sdk";

/**
 * Anam avatar stream.
 *
 * Neura drives the conversation itself (the transcript, risk assessment and
 * persistence all live server-side), so the avatar is used purely as a mouth:
 * `talk()` speaks a line we already generated and stored, rather than letting
 * Anam run its own LLM turn that the clinical record would never see.
 */
export interface AvatarController {
  speak(text: string): Promise<void>;
  onSpeakingChange(handler: (speaking: boolean) => void): void;
  stop(): void;
}

export async function startAvatar(videoElementId: string): Promise<AvatarController> {
  const response = await fetch("/api/anam/token", { method: "POST" });
  if (!response.ok) throw new Error("Could not obtain an Anam session token");

  const { sessionToken } = (await response.json()) as { sessionToken: string };
  const client: AnamClient = createClient(sessionToken);

  let speakingHandler: ((speaking: boolean) => void) | null = null;
  let stopped = false;
  let speakingTimer: ReturnType<typeof setTimeout> | undefined;

  await client.streamToVideoElement(videoElementId);

  /**
   * The SDK exposes no "persona finished speaking" event, so the indicator is
   * timed from the utterance itself at a typical speaking rate. It only drives
   * a caption, so drifting by a beat costs nothing clinically.
   */
  const estimateSpeechMs = (text: string) =>
    Math.max(1200, (text.trim().split(/\s+/).length / 2.7) * 1000);

  return {
    async speak(text: string) {
      if (stopped) return;
      try {
        speakingHandler?.(true);
        clearTimeout(speakingTimer);
        speakingTimer = setTimeout(() => speakingHandler?.(false), estimateSpeechMs(text));
        await client.talk(text);
      } catch (error) {
        speakingHandler?.(false);
        console.warn("[neura] Avatar speech failed:", error);
      }
    },
    onSpeakingChange(handler) {
      speakingHandler = handler;
    },
    stop() {
      if (stopped) return;
      stopped = true;
      clearTimeout(speakingTimer);
      try {
        void client.stopStreaming();
      } catch (error) {
        console.warn("[neura] Avatar teardown failed:", error);
      }
    },
  };
}
