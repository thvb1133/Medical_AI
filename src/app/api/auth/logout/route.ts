import { handleError, json } from "@/lib/api";
import { clearAuthCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  try {
    await clearAuthCookie();
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
