import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";

/** Words the user must type to confirm (one per UI language). */
export const DELETE_CONFIRM_WORDS = ["STERGE", "ȘTERGE", "УДАЛИТЬ", "DELETE"] as const;

export function isDeleteConfirmWord(value: string) {
  const v = value.trim().toUpperCase();
  return (DELETE_CONFIRM_WORDS as readonly string[]).includes(v);
}

/**
 * Permanently delete the signed-in user's account and personal data.
 * See `deleteUserData` for exactly what is removed vs anonymized.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => z.object({ confirm: z.string().max(20) }).parse(d))
  .handler(async ({ context, data }) => {
    if (!isDeleteConfirmWord(data.confirm)) throw new Error("account.deleteConfirmWrong");
    const { deleteUserData } = await import("./account-delete.server");
    await deleteUserData(context.userId);
    // Expire the auth cookies now: the signed `session_data` cache cookie
    // would otherwise keep the deleted user "signed in" for up to 5 minutes.
    const { setCookie } = await import("@tanstack/react-start/server");
    for (const name of [
      "__Host-grok-auth.session_token",
      "__Host-grok-auth.session_data",
      "__Host-grok-auth.account_data",
      "__Host-grok-auth.dont_remember",
    ]) {
      setCookie(name, "", { path: "/", secure: true, sameSite: "lax", httpOnly: true, maxAge: 0 });
    }
    return { ok: true as const };
  });
