import "server-only";
import { AuthError, requireUser } from "./auth";
import { getStore } from "./store";
import type { ConsultationSession, PublicUser } from "./types";

/**
 * Loads a session only if the caller is entitled to it: the patient it belongs
 * to, or any clinician. Every session route goes through here so the ownership
 * rule exists in exactly one place.
 */
export async function loadAuthorisedSession(
  sessionId: string,
): Promise<{ user: PublicUser; session: ConsultationSession }> {
  const user = await requireUser();
  const session = await getStore().getSession(sessionId);

  // Same 404 for "missing" and "not yours" so ids cannot be probed.
  if (!session) throw new AuthError("Session not found", 404);
  if (user.role !== "clinician" && session.patientId !== user.id) {
    throw new AuthError("Session not found", 404);
  }
  return { user, session };
}
