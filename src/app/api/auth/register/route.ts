import { z } from "zod";
import { fail, handleError, json, parseBody } from "@/lib/api";
import { createAuthCookie, hashPassword, toPublicUser } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  role: z.enum(["patient", "clinician"]),
});

export async function POST(request: Request) {
  try {
    const input = await parseBody(request, schema);
    const store = getStore();

    if (await store.getUserByEmail(input.email)) {
      return fail("An account with that email already exists", 409);
    }

    const user = await store.createUser({
      name: input.name,
      email: input.email,
      role: input.role,
      passwordHash: await hashPassword(input.password),
    });

    await createAuthCookie(user);
    return json({ user: toPublicUser(user) }, 201);
  } catch (error) {
    return handleError(error);
  }
}
