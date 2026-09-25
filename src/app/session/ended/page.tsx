import Link from "next/link";
import { redirect } from "next/navigation";
import { SparkIcon } from "@/components/ui/icons";
import { getCurrentUser } from "@/lib/auth";
import { CRISIS_RESOURCES } from "@/lib/safety";

export const dynamic = "force-dynamic";

export default async function SessionEndedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f7f8f9] px-4 py-10 dark:bg-canvas-dark">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex items-center justify-center gap-2">
          <SparkIcon className="h-5 w-5 text-[#e07b26]" />
          <span className="text-lg font-semibold tracking-tight">Neura</span>
        </div>

        <div className="panel-card p-6">
          <h1 className="text-[17px] font-semibold">Thank you for talking</h1>
          <p className="mt-2 text-[12.5px] leading-[18px] text-ink-500">
            Your session has ended and a summary is available to your care team. If things feel
            worse later, you do not have to wait for the next appointment.
          </p>

          <ul className="mt-5 space-y-2 text-left">
            {CRISIS_RESOURCES.map((resource) => (
              <li
                key={resource.name}
                className="flex items-baseline justify-between gap-3 rounded-md bg-[#f7f8f9] px-3 py-2 dark:bg-hairline-dark"
              >
                <div>
                  <p className="text-[12px] font-medium">{resource.name}</p>
                  <p className="text-[10.5px] text-ink-400">{resource.detail}</p>
                </div>
                <span className="shrink-0 text-[12.5px] font-semibold text-accent">
                  {resource.contact}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex justify-center gap-2">
            <Link
              href="/session"
              className="rounded-md bg-accent px-4 py-2 text-[12.5px] font-semibold text-white transition hover:bg-accent-hover"
            >
              Start another session
            </Link>
            {user.role === "clinician" && (
              <Link
                href="/clinician"
                className="rounded-md border border-hairline-light px-4 py-2 text-[12.5px] font-medium text-ink-700 transition hover:border-ink-300"
              >
                Dashboard
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
