import { handleError, json } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return json({ user: await getCurrentUser() });
  } catch (error) {
    return handleError(error);
  }
}
