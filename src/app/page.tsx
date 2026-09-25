import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Entry point: everyone lands on the surface that matches their role. */
export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(user.role === "clinician" ? "/clinician" : "/session");
}
