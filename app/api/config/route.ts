import { NextResponse } from "next/server";
import { providerStatus } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tells the client which integrations are live so it can pick the right
 * capture path (for example: browser speech recognition when Deepgram is not
 * configured) and show an honest status strip instead of failing silently.
 */
export async function GET() {
  return NextResponse.json(providerStatus());
}
