import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions, type AppUser } from "./auth";

/**
 * Returns the authenticated user for server components / route handlers,
 * or throws a redirect to /login when unauthenticated.
 */
export async function requireUser(): Promise<AppUser> {
  const session = await getServerSession(authOptions);
  const user = session?.user as AppUser | undefined;
  if (!user || !user.organizationId) redirect("/login");
  return user;
}

/** Returns the authenticated user or null (for public pages). */
export async function getOptionalUser(): Promise<AppUser | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as AppUser | undefined;
  if (!user || !user.organizationId) return null;
  return user;
}

/**
 * For route handlers: returns the user or null. Callers should respond with
 * 401 when null (rather than redirecting, which is awkward for fetch calls).
 */
export async function requireApiUser(): Promise<AppUser | null> {
  return getOptionalUser();
}
