/**
 * Voice input and output using the browser's built-in speech APIs.
 *
 * These are the fallback path. When Agora and Anam are configured the audio
 * runs through them instead, but the Web Speech API means voice still works on
 * a bare deployment with no third-party keys at all — which is how the app is
 * usable the moment it is deployed.
 */

interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  0: SpeechRecognitionAlternative;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResult };
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionConstructor = new () => SpeechRecognitionLike;

function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechInputSupported(): boolean {
  return recognitionConstructor() !== null;
}

export interface Listener {
  stop(): void;
}

/**
 * Starts continuous dictation, emitting only finalised utterances. Interim
 * results are requested because they make the browser commit sooner, but they
 * are never sent to the agent — a half-finished sentence would be assessed for
 * risk on incomplete words.
 */
export function startListening(handlers: {
  onUtterance: (text: string) => void;
  onInterim?: (text: string) => void;
  onError?: (message: string) => void;
}): Listener | null {
  const Recognition = recognitionConstructor();
  if (!Recognition) return null;

  const recognition = new Recognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-GB";

  let stopped = false;

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const text = result[0].transcript.trim();
      if (!text) continue;
      if (result.isFinal) handlers.onUtterance(text);
      else handlers.onInterim?.(text);
    }
  };

  recognition.onerror = (event) => {
    // "no-speech" and "aborted" are routine during a pause; they are not
    // failures worth surfacing to someone mid-consultation.
    if (event.error !== "no-speech" && event.error !== "aborted") {
      handlers.onError?.(event.error);
    }
  };

  // Browsers end recognition on their own schedule; restart until told to stop.
  recognition.onend = () => {
    if (!stopped) {
      try {
        recognition.start();
      } catch {
        /* already restarting */
      }
    }
  };

  try {
    recognition.start();
  } catch (error) {
    handlers.onError?.(String(error));
    return null;
  }

  return {
    stop() {
      stopped = true;
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
    },
  };
}

export function speak(text: string, onDone?: () => void): void {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onDone?.();
    return;
  }
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-GB";
  utterance.rate = 0.98;
  utterance.pitch = 1;
  utterance.onend = () => onDone?.();
  utterance.onerror = () => onDone?.();
  window.speechSynthesis.speak(utterance);
}

export function cancelSpeech(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
