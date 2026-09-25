import { z } from "zod";
import { generateReply } from "@/lib/agent";
import { fail, handleError, json, parseBody } from "@/lib/api";
import { assessTranscript, distressFromMessages } from "@/lib/safety";
import { loadAuthorisedSession } from "@/lib/session-access";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  text: z.string().trim().min(1, "Message cannot be empty").max(2000),
});

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await loadAuthorisedSession(id);
    return json({ messages: await getStore().listMessages(id) });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * One patient turn: persist it, re-assess risk over the whole transcript, then
 * generate the reply. Risk is assessed before the model runs so the persona is
 * already operating under the correct safety instructions for this turn.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { session } = await loadAuthorisedSession(id);
    if (session.status === "ended") return fail("This session has already ended", 409);

    const { text } = await parseBody(request, schema);
    const store = getStore();

    await store.addMessage(id, "patient", text);
    const history = await store.listMessages(id);

    const safety = assessTranscript(history);
    const reply = await generateReply(history, session.patientName, safety);
    const agentMessage = await store.addMessage(id, "agent", reply.text);

    return json({
      reply: agentMessage,
      safety: reply.safety,
      distress: distressFromMessages(history),
      fromModel: reply.fromModel,
    });
  } catch (error) {
    return handleError(error);
  }
}
