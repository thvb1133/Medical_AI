import { z } from "zod";
import { fail, handleError, json, parseBody } from "@/lib/api";
import { createAuthCookie, toPublicUser, verifyPassword } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export async function POST(request: Request) {
  try {
    const input = await parseBody(request, schema);
    const user = await getStore().getUserByEmail(input.email);

    // Same message for unknown account and wrong password, so the response
    // cannot be used to enumerate which emails are registered.
    const invalid = fail("Email or password is incorrect", 401);
    if (!user) return invalid;
    if (!(await verifyPassword(input.password, user.passwordHash))) return invalid;

    await createAuthCookie(user);
    return json({ user: toPublicUser(user) });
  } catch (error) {
    return handleError(error);
  }
}
