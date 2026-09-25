import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AuthError } from "./auth";

export function json<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Routes throw; this turns the throw into the right status code. Keeping the
 * mapping in one place stops auth failures from leaking as 500s.
 */
export function handleError(error: unknown): NextResponse {
  if (error instanceof AuthError) return fail(error.message, error.status);
  if (error instanceof ZodError) {
    return fail(error.issues.map((i) => i.message).join("; "), 422);
  }
  console.error("[neura] Unhandled route error:", error);
  return fail("Something went wrong. Please try again.", 500);
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ZodError([
      { code: "custom", path: [], message: "Request body must be valid JSON" },
    ]);
  }
  return schema.parse(raw);
}
