import { z } from "zod";
import { handleError, json, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  patientId: z.string().uuid().optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const store = getStore();
    // Patients only ever see their own history; clinicians see the caseload.
    const sessions = await store.listSessions(
      user.role === "clinician" ? { limit: 100 } : { patientId: user.id },
    );
    return json({ sessions });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const store = getStore();
    const body = await parseBody(request, createSchema).catch(() => ({ patientId: undefined }));

    if (user.role === "clinician" && body.patientId) {
      const patient = await store.getUserById(body.patientId);
      if (!patient) return handleError(new Error("Unknown patient"));
      const session = await store.createSession({
        patientId: patient.id,
        patientName: patient.name,
        clinicianId: user.id,
      });
      return json({ session }, 201);
    }

    const session = await store.createSession({
      patientId: user.id,
      patientName: user.name,
      clinicianId: null,
    });
    return json({ session }, 201);
  } catch (error) {
    return handleError(error);
  }
}
