"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type PollState<T> = {
  data: T | null;
  error: "unauthorised" | "failed" | null;
  loading: boolean;
  refresh: () => void;
};

/**
 * Polls a JSON endpoint on an interval.
 *
 * Polling rather than websockets is a deliberate fit for Vercel's serverless
 * runtime, where a long-lived connection per clinician is awkward to hold
 * open. A two-second cadence is well inside what "live" needs to feel like for
 * biomarker trends.
 */
export function usePolling<T>(url: string | null, intervalMs = 2500): PollState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<"unauthorised" | "failed" | null>(null);
  const [loading, setLoading] = useState(true);
  const activeRef = useRef(true);

  const load = useCallback(async () => {
    if (!url) return;
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!activeRef.current) return;
      if (response.status === 401) {
        setError("unauthorised");
        return;
      }
      if (!response.ok) {
        setError("failed");
        return;
      }
      setData((await response.json()) as T);
      setError(null);
    } catch {
      if (activeRef.current) setError("failed");
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    activeRef.current = true;
    void load();
    const timer = setInterval(() => void load(), intervalMs);
    return () => {
      activeRef.current = false;
      clearInterval(timer);
    };
  }, [load, intervalMs]);

  return { data, error, loading, refresh: () => void load() };
}
