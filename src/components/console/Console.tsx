"use client";

import { AnalyticsRail } from "./AnalyticsRail";
import { AvatarStage } from "./AvatarStage";
import { CallControls } from "./CallControls";
import { ConsoleHeader } from "./ConsoleHeader";
import { ConversationPanel } from "./ConversationPanel";
import { MeasurementPanel } from "./MeasurementPanel";
import { SelfView } from "./SelfView";
import { AlertIcon } from "@/components/ui/icons";
import { useConsultation } from "@/hooks/useConsultation";
import { CRISIS_RESOURCES } from "@/lib/safety";
import type { Message, PublicUser, RuntimeCapabilities } from "@/lib/types";

export interface ConsoleProps {
  sessionId: string;
  user: PublicUser;
  capabilities: RuntimeCapabilities;
  shenaiApiKey: string | null;
  durableStorage: boolean;
  initialMessages: Message[];
  title: string;
  subtitle: string;
  personaName: string;
  /**
   * Patients do not see their own biomarker rail. Watching a live distress
   * readout during a distressing conversation changes the conversation, and
   * invites performing for the sensor instead of talking.
   */
  showAnalytics: boolean;
}

function CrisisBanner() {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-card border border-red-300 bg-red-50 px-3 py-2 text-red-900"
    >
      <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="text-[11px] leading-[15px]">
        <p className="font-semibold">If you are in danger right now, please get help immediately.</p>
        <p className="mt-0.5">
          {CRISIS_RESOURCES.map((resource) => `${resource.name}: ${resource.contact}`).join(" · ")}
        </p>
      </div>
    </div>
  );
}

export function Console(props: ConsoleProps) {
  const session = useConsultation({
    sessionId: props.sessionId,
    initialMessages: props.initialMessages,
    capabilities: props.capabilities,
    shenaiApiKey: props.shenaiApiKey,
    userId: props.user.id,
  });

  const columns = props.showAnalytics
    ? "lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1.5fr)_minmax(0,1fr)]"
    : "lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1.5fr)]";

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <ConsoleHeader
        title={props.title}
        subtitle={props.subtitle}
        capabilities={props.capabilities}
        durableStorage={props.durableStorage}
        user={props.user}
      />

      <main className={`grid min-h-0 flex-1 gap-2.5 p-2.5 ${columns}`}>
        <div className="flex min-h-0 flex-col gap-2.5">
          {session.snapshot.safety.level >= 3 && <CrisisBanner />}
          <ConversationPanel
            messages={session.messages}
            thinking={session.thinking}
            disabled={session.ending}
            onSend={(text) => void session.send(text)}
          />
          <SelfView
            videoRef={session.videoRef}
            cameraOn={session.cameraOn}
            micOn={session.micOn}
            vitalsActive={session.vitalsLive}
            onToggleCamera={session.toggleCamera}
            onToggleMic={session.toggleMic}
            onOpenSettings={session.toggleListening}
          />
        </div>

        <div className="thin-scroll flex min-h-0 flex-col gap-2.5 overflow-y-auto">
          <AvatarStage
            videoRef={session.avatarVideoRef}
            live={session.avatarLive}
            speaking={session.speaking}
            personaName={props.personaName}
          />
          <MeasurementPanel snapshot={session.snapshot} />
          <div className="pb-1 pt-0.5">
            <CallControls
              micOn={session.micOn}
              cameraOn={session.cameraOn}
              ending={session.ending}
              onToggleMic={session.toggleMic}
              onToggleCamera={session.toggleCamera}
              onEnd={() => void session.end()}
            />
          </div>
        </div>

        {props.showAnalytics && (
          <div className="thin-scroll min-h-0 overflow-y-auto">
            <AnalyticsRail snapshot={session.snapshot} />
          </div>
        )}
      </main>

      {session.notice && (
        <div className="fixed bottom-3 left-1/2 z-40 w-[min(92vw,30rem)] -translate-x-1/2">
          <div className="panel-card flex items-start justify-between gap-3 px-3 py-2 text-[11.5px]">
            <p className="text-ink-700 dark:text-ink-300">{session.notice}</p>
            <button
              type="button"
              onClick={session.dismissNotice}
              className="shrink-0 text-ink-400 hover:text-ink-700"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
