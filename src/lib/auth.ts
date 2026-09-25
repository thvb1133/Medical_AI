import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { authSecret } from "./config";
import { getStore, type StoredUser } from "./store";
import type { PublicUser, Role } from "./types";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const COOKIE_NAME = "neura_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, KEY_LENGTH);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const derived = await scryptAsync(password, Buffer.from(saltHex, "hex"), KEY_LENGTH);
  const expected = Buffer.from(hashHex, "hex");
  // Length check first: timingSafeEqual throws on a mismatch rather than
  // returning false, which would leak the failure mode as an exception.
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(expected, derived);
}

export function toPublicUser(user: StoredUser): PublicUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function createAuthCookie(user: StoredUser): Promise<void> {
  const token = await new SignJWT({ role: user.role, name: user.name, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(authSecret());

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearAuthCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, authSecret());
    if (!payload.sub) return null;
    const user = await getStore().getUserById(payload.sub);
    return user ? toPublicUser(user) : null;
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Not signed in", 401);
  return user;
}

export async function requireRole(role: Role): Promise<PublicUser> {
  const user = await requireUser();
  if (user.role !== role) throw new AuthError(`Requires ${role} access`, 403);
  return user;
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}
