"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { SparkIcon } from "@/components/ui/icons";
import type { PublicUser } from "@/lib/types";

export function DashboardShell({
  user,
  children,
  breadcrumb,
}: {
  user: PublicUser;
  children: ReactNode;
  breadcrumb?: ReactNode;
}) {
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="min-h-dvh bg-[#f7f8f9] dark:bg-canvas-dark">
      <header className="flex items-center justify-between border-b border-hairline-light bg-panel-light px-4 py-2.5 dark:border-hairline-dark dark:bg-panel-dark">
        <div className="flex items-center gap-2">
          <SparkIcon className="h-4 w-4 text-[#e07b26]" />
          <Link href="/clinician" className="text-[13px] font-semibold">
            Neura
          </Link>
          {breadcrumb && <span className="text-[12px] text-ink-400">/ {breadcrumb}</span>}
        </div>

        <div className="flex items-center gap-3">
          <Link href="/session" className="text-[12px] text-accent hover:underline">
            Open consultation console
          </Link>
          <span className="text-[11.5px] text-ink-400">{user.name}</span>
          <button
            type="button"
            onClick={signOut}
            className="rounded-md border border-hairline-light px-2.5 py-1 text-[11.5px] text-ink-700 transition hover:border-ink-300 dark:border-hairline-dark dark:text-ink-300"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
