"use client";

import { useState } from "react";

/**
 * Shared-passphrase gate. This is demo-grade authentication and the banner on
 * the dashboard says so — real deployments need per-clinician identity, an
 * audit log, and an information-governance review before any of this touches
 * patient data.
 */
export function AccessGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const response = await fetch("/api/clinician/session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code }),
            });
            if (!response.ok) {
              setError("That access code was not recognised.");
              return;
            }
            onUnlocked();
          } catch {
            setError("Could not reach the server. Try again.");
          } finally {
            setBusy(false);
          }
        }}
        className="w-full max-w-sm"
      >
        <h1 className="text-xl font-semibold text-calm-50">Clinician access</h1>
        <p className="mt-2 text-sm text-calm-400">
          This area shows patient biomarkers and conversation transcripts.
        </p>
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Access code"
          className="mt-6 w-full rounded-lg border border-calm-700 bg-calm-900/60 px-4 py-3 text-calm-50 placeholder:text-calm-500 focus:border-calm-400 focus:outline-none"
        />
        {error && <p className="mt-2 text-sm text-alert-300">{error}</p>}
        <button
          type="submit"
          disabled={busy || !code}
          className="mt-4 w-full rounded-lg bg-calm-400 px-5 py-2.5 font-medium text-calm-950 transition hover:bg-calm-300 disabled:opacity-50"
        >
          {busy ? "Checking..." : "Enter"}
        </button>
      </form>
    </main>
  );
}
