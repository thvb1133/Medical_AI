import type { IAgoraRTCClient, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";

/**
 * Agora RTC audio transport.
 *
 * This carries the consultation audio on the same channel the Agora
 * Conversational AI agent joins, so a server-side agent can be attached later
 * without the client changing. Transcription still happens in the browser, so
 * a failure here costs the call quality path, not the transcript.
 */
export interface VoiceTransport {
  setMuted(muted: boolean): Promise<void>;
  leave(): Promise<void>;
}

export async function joinVoiceChannel(channel: string): Promise<VoiceTransport> {
  const response = await fetch("/api/agora/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel }),
  });
  if (!response.ok) throw new Error("Could not obtain an Agora token");

  const { token, appId, uid } = (await response.json()) as {
    token: string;
    appId: string;
    uid: number;
  };

  // Imported lazily: the SDK touches browser globals at module scope and must
  // not be pulled into the server bundle.
  const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
  AgoraRTC.setLogLevel(3);

  const client: IAgoraRTCClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
  await client.join(appId, channel, token, uid);

  let microphone: IMicrophoneAudioTrack | null = null;
  try {
    microphone = await AgoraRTC.createMicrophoneAudioTrack({
      AEC: true,
      ANS: true,
      AGC: true,
    });
    await client.publish([microphone]);
  } catch (error) {
    console.warn("[neura] Could not publish microphone to Agora:", error);
  }

  return {
    async setMuted(muted: boolean) {
      await microphone?.setEnabled(!muted);
    },
    async leave() {
      try {
        microphone?.stop();
        microphone?.close();
        await client.leave();
      } catch (error) {
        console.warn("[neura] Agora teardown failed:", error);
      }
    },
  };
}
