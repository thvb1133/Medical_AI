"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SparkIcon } from "@/components/ui/icons";
import type { Role } from "@/lib/types";

type Mode = "login" | "register";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const registering = mode === "register";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("patient");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registering ? { name, email, password, role } : { email, password }),
      });

      const data = (await response.json()) as {
        user?: { role: Role };
        error?: string;
      };

      if (!response.ok || !data.user) {
        setError(data.error ?? "Could not sign you in");
        return;
      }

      router.replace(data.user.role === "clinician" ? "/clinician" : "/session");
      router.refresh();
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f7f8f9] px-4 py-10 dark:bg-canvas-dark">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <SparkIcon className="h-5 w-5 text-[#e07b26]" />
          <span className="text-lg font-semibold tracking-tight">Neura</span>
        </div>

        <div className="panel-card p-6">
          <h1 className="text-[17px] font-semibold">
            {registering ? "Create your account" : "Sign in"}
          </h1>
          <p className="mt-1 text-[12px] text-ink-500">
            {registering
              ? "Patients get a consultation room. Clinicians get the monitoring dashboard."
              : "Welcome back. Your sessions are waiting."}
          </p>

          <form onSubmit={submit} className="mt-5 space-y-3">
            {registering && (
              <div>
                <label htmlFor="name" className="mb-1 block text-[11.5px] font-medium text-ink-700">
                  Full name
                </label>
                <input
                  id="name"
                  className="field"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  required
                  minLength={2}
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-1 block text-[11.5px] font-medium text-ink-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                className="field"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-[11.5px] font-medium text-ink-700"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                className="field"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={registering ? "new-password" : "current-password"}
                required
                minLength={registering ? 8 : 1}
              />
              {registering && (
                <p className="mt-1 text-[10.5px] text-ink-400">At least 8 characters.</p>
              )}
            </div>

            {registering && (
              <fieldset>
                <legend className="mb-1 block text-[11.5px] font-medium text-ink-700">
                  I am a
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {(["patient", "clinician"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setRole(option)}
                      aria-pressed={role === option}
                      className={`rounded-md border px-3 py-2 text-[12px] capitalize transition ${
                        role === option
                          ? "border-accent bg-accent/5 font-medium text-accent"
                          : "border-hairline-light text-ink-700 hover:border-ink-300"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {error && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-[11.5px] text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-accent px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
            >
              {busy ? "Please wait…" : registering ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="mt-4 text-center text-[11.5px] text-ink-500">
            {registering ? "Already have an account? " : "No account yet? "}
            <Link
              href={registering ? "/login" : "/register"}
              className="font-medium text-accent hover:underline"
            >
              {registering ? "Sign in" : "Create one"}
            </Link>
          </p>
        </div>

        <p className="mt-5 text-center text-[10.5px] leading-[15px] text-ink-400">
          Neura is a monitoring aid for healthcare professionals. It is not a diagnostic device and
          does not replace clinical judgement or emergency care.
        </p>
      </div>
    </main>
  );
}
