import { handleError, json } from "@/lib/api";
import { getCapabilities, serverConfig } from "@/lib/config";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tells the browser which integrations are live so each panel can decide
 * between a real provider and the simulator. Only non-secret values are
 * returned: the Agora App ID is public by design, and tokens are minted
 * server-side.
 */
export async function GET() {
  try {
    return json({
      capabilities: getCapabilities(),
      agoraAppId: serverConfig.agoraAppId ?? null,
      shenaiApiKey: process.env.NEXT_PUBLIC_SHENAI_API_KEY ?? null,
      durableStorage: getStore().durable,
    });
  } catch (error) {
    return handleError(error);
  }
}
