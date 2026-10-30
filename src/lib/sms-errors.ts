/** Map server SMS errors to i18n keys. Safe to import from the client. */

export function formatSmsError(
  message: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
  fallbackKey = "sms.send",
) {
  const found = message.match(/(sms\.err\w+|reset\.err\w+)(?:\|([^\s|"']+))?/);
  if (found) {
    return t(found[1], found[2] ? { n: found[2] } : undefined);
  }
  return message || t(fallbackKey);
}
