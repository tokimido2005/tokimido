/** Client-safe admin identity. Never put the password in this file. */
export const ADMIN_EMAIL = "tokimido@rabotaem.md";
export const ADMIN_USERNAME = "tokimido";

export function resolveLoginIdentifier(raw: string) {
  const value = raw.trim();
  if (value.toLowerCase() === ADMIN_USERNAME) return ADMIN_EMAIL;
  return value;
}

export function isAdminEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase() === ADMIN_EMAIL;
}
