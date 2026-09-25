import { handleError, json } from "@/lib/api";
import { summariseSession } from "@/lib/agent";
import { assessTranscript } from "@/lib/safety";
import { loadAuthorisedSession } from "@/lib/session-access";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { session } = await loadAuthorisedSession(id);
    const store = getStore();
    const [messages, snapshots] = await Promise.all([
      store.listMessages(id),
      store.listSnapshots(id, 300),
    ]);
    return json({ session, messages, snapshots });
  } catch (error) {
    return handleError(error);
  }
}

/** Ends the session and writes a clinician-facing summary of the transcript. */
export async function PATCH(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { session } = await loadAuthorisedSession(id);
    if (session.status === "ended") return json({ session });

    const store = getStore();
    const messages = await store.listMessages(id);
    const summary = await summariseSession(messages, assessTranscript(messages));

    await store.endSession(id, summary);
    return json({ session: await store.getSession(id) });
  } catch (error) {
    return handleError(error);
  }
}
