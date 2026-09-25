import { handleError, json } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { getStore } from "@/lib/store";
import type { ConsultationSession } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Caseload view: every patient with their most recent session attached. */
export async function GET() {
  try {
    await requireRole("clinician");
    const store = getStore();

    const [patients, sessions] = await Promise.all([
      store.listUsersByRole("patient"),
      store.listSessions({ limit: 500 }),
    ]);

    const latestByPatient = new Map<string, ConsultationSession>();
    for (const session of sessions) {
      // listSessions returns newest first, so the first hit wins.
      if (!latestByPatient.has(session.patientId)) {
        latestByPatient.set(session.patientId, session);
      }
    }

    return json({
      patients: patients.map((patient) => {
        const patientSessions = sessions.filter((s) => s.patientId === patient.id);
        return {
          ...patient,
          sessionCount: patientSessions.length,
          latestSession: latestByPatient.get(patient.id) ?? null,
          peakSafetyLevel: patientSessions.reduce(
            (max, s) => Math.max(max, s.peakSafetyLevel),
            0,
          ),
        };
      }),
    });
  } catch (error) {
    return handleError(error);
  }
}
