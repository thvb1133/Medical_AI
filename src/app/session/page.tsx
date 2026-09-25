import { redirect } from "next/navigation";
import { Console } from "@/components/console/Console";
import { getCurrentUser } from "@/lib/auth";
import { GREETING, getCapabilities, serverConfig } from "@/lib/config";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function SessionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const store = getStore();

  // Resume an in-progress consultation rather than starting a new one on every
  // navigation; a refresh mid-session must not orphan the transcript.
  const existing = await store.listSessions({ patientId: user.id, limit: 10 });
  const active = existing.find((session) => session.status === "active");
  const session =
    active ??
    (await store.createSession({
      patientId: user.id,
      patientName: user.name,
      clinicianId: null,
    }));

  let messages = await store.listMessages(session.id);
  if (messages.length === 0) {
    await store.addMessage(session.id, "agent", GREETING);
    messages = await store.listMessages(session.id);
  }

  return (
    <Console
      sessionId={session.id}
      user={user}
      capabilities={getCapabilities()}
      shenaiApiKey={process.env.NEXT_PUBLIC_SHENAI_API_KEY ?? null}
      durableStorage={store.durable}
      initialMessages={messages}
      title={serverConfig.appTitle}
      subtitle={serverConfig.appSubtitle}
      personaName={serverConfig.anamPersonaName}
      /*
       * The console shows the full biomarker rail by default. Setting
       * NEXT_PUBLIC_HIDE_PATIENT_ANALYTICS=true switches patients to the
       * minimal view the clinical design argues for, where readings are
       * visible to the clinician but not to the person being measured.
       */
      showAnalytics={
        user.role === "clinician" ||
        process.env.NEXT_PUBLIC_HIDE_PATIENT_ANALYTICS !== "true"
      }
    />
  );
}
