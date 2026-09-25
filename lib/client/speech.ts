/**
 * Speech in and out, each with a server-backed path and a browser fallback.
 *
 * The fallbacks are not decorative: without them the app is unusable for
 * anyone who has not bought Deepgram and ElevenLabs credit, which defeats the
 * point of a tool aimed at under-resourced services.
 */

export type SpeakHandle = { stop: () => void; done: Promise<void> };

/** Transcribes one utterance, returning empty string when nothing was said. */
export async function transcribe(audio: Blob): Promise<string> {
  const response = await fetch("/api/stt", {
    method: "POST",
    headers: { "Content-Type": audio.type || "audio/webm" },
    body: audio,
  });

  if (!response.ok) {
    if (response.status === 503) throw new SttUnavailable();
    throw new Error(`Transcription failed (${response.status})`);
  }

  const data = await response.json();
  return typeof data.text === "string" ? data.text.trim() : "";
}

export class SttUnavailable extends Error {
  constructor() {
    super("Server transcription is not configured");
    this.name = "SttUnavailable";
  }
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
};

function recognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function browserSttAvailable(): boolean {
  return recognitionCtor() !== null;
}

/**
 * Continuous browser speech recognition, used when Deepgram is unconfigured.
 * Chrome and Edge support this; Firefox does not, in which case the session
 * falls back to typed input.
 */
export function startBrowserRecognition(
  onFinal: (text: string) => void,
  onError?: (error: unknown) => void,
): { stop: () => void } {
  const Ctor = recognitionCtor();
  if (!Ctor) return { stop: () => {} };

  const recognition = new Ctor();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = "en-GB";

  let stopped = false;

  recognition.onresult = (event) => {
    const results = event.results;
    const latest = results[results.length - 1];
    const text = latest?.[0]?.transcript?.trim();
    if (text) onFinal(text);
  };
  recognition.onerror = (error) => onError?.(error);
  // Chrome ends recognition on its own after a silent stretch; restart unless
  // the caller asked us to stop.
  recognition.onend = () => {
    if (!stopped) {
      try {
        recognition.start();
      } catch {
        /* already starting */
      }
    }
  };

  try {
    recognition.start();
  } catch (error) {
    onError?.(error);
  }

  return {
    stop: () => {
      stopped = true;
      recognition.abort();
    },
  };
}

function speakWithBrowser(text: string): SpeakHandle {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return { stop: () => {}, done: Promise.resolve() };
  }

  const synth = window.speechSynthesis;
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.98;
  utterance.pitch = 1.0;

  const preferred = synth
    .getVoices()
    .find((v) => /en-GB/i.test(v.lang) && /male|daniel|arthur/i.test(v.name));
  if (preferred) utterance.voice = preferred;

  const done = new Promise<void>((resolve) => {
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
  });

  synth.speak(utterance);
  return { stop: () => synth.cancel(), done };
}

/**
 * Speaks a reply, preferring ElevenLabs. `onAudio` receives the element so the
 * avatar can drive its mouth from the same audio that is playing.
 */
export async function speak(
  text: string,
  onAudio?: (element: HTMLAudioElement | null) => void,
): Promise<SpeakHandle> {
  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) throw new Error(`tts ${response.status}`);

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    onAudio?.(audio);

    const done = new Promise<void>((resolve) => {
      const finish = () => {
        URL.revokeObjectURL(url);
        onAudio?.(null);
        resolve();
      };
      audio.onended = finish;
      audio.onerror = finish;
    });

    await audio.play().catch(() => {
      /* autoplay blocked until the user interacts; the transcript still shows */
    });

    return {
      stop: () => {
        audio.pause();
        URL.revokeObjectURL(url);
        onAudio?.(null);
      },
      done,
    };
  } catch {
    return speakWithBrowser(text);
  }
}
