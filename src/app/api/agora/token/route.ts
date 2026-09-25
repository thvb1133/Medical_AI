import { RtcRole, RtcTokenBuilder } from "agora-token";
import { z } from "zod";
import { fail, handleError, json, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { serverConfig } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  channel: z.string().trim().min(1).max(64),
  uid: z.number().int().nonnegative().optional(),
});

const TOKEN_TTL_SECONDS = 60 * 60;

/**
 * Mints a short-lived Agora RTC token. The App Certificate never leaves the
 * server, and the channel is bound to a session id the caller already has
 * access to, so a token cannot be minted for someone else's consultation.
 */
export async function POST(request: Request) {
  try {
    await requireUser();

    const { agoraAppId, agoraAppCertificate } = serverConfig;
    if (!agoraAppId || !agoraAppCertificate) {
      return fail("Agora is not configured on this deployment", 503);
    }

    const { channel, uid = 0 } = await parseBody(request, schema);
    const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;

    const token = RtcTokenBuilder.buildTokenWithUid(
      agoraAppId,
      agoraAppCertificate,
      channel,
      uid,
      RtcRole.PUBLISHER,
      TOKEN_TTL_SECONDS,
      expiresAt,
    );

    return json({ token, appId: agoraAppId, channel, uid, expiresAt });
  } catch (error) {
    return handleError(error);
  }
}
