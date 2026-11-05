import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Signing key comes from the server environment; the old literal key was public.
function secret() {
  const fromEnv = process.env.CAPTCHA_SECRET?.trim() || process.env.BETTER_AUTH_SECRET?.trim();
  if (fromEnv) return `captcha-v2:${fromEnv}`;
  if (process.env.NODE_ENV === "production") {
    throw new Error("CAPTCHA_SECRET / BETTER_AUTH_SECRET is not configured");
  }
  return "captcha-v2:dev-only";
}

// The token no longer carries the operands: only a nonce, the expiry and an
// HMAC of the expected answer, so the answer cannot be read back out of it.
type Payload = { n: string; exp: number; h: string };

async function nodeCrypto() {
  return await import("node:crypto");
}

async function sign(payload: Payload) {
  const { createHmac } = await nodeCrypto();
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

async function answerHash(nonce: string, answer: number) {
  const { createHmac } = await nodeCrypto();
  return createHmac("sha256", secret()).update(`${nonce}:${answer}`).digest("base64url");
}

async function read(token: string): Promise<Payload | null> {
  const { createHmac, timingSafeEqual } = await nodeCrypto();
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload;
    if (typeof parsed.n !== "string" || typeof parsed.h !== "string" || !Number.isFinite(parsed.exp)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export const captchaSchema = z.object({
  token: z.string().min(10).max(400),
  answer: z.number().int().min(0).max(40),
});

export const issueCaptcha = createServerFn({ method: "GET" }).handler(async () => {
  const { randomInt, randomBytes } = await nodeCrypto();
  const a = randomInt(2, 11);
  const b = randomInt(1, 9);
  const exp = Date.now() + 10 * 60 * 1000;
  const n = randomBytes(12).toString("base64url");
  return { token: await sign({ n, exp, h: await answerHash(n, a + b) }), question: `${a} + ${b}` };
});

export async function assertCaptcha(token: string, answer: number) {
  const payload = await read(token);
  if (!payload) throw new Error("Verificarea a eșuat. Reîncarcă suma.");
  if (payload.exp < Date.now()) throw new Error("Verificarea a expirat. Reîncarcă suma.");
  const { timingSafeEqual } = await nodeCrypto();
  const got = Buffer.from(await answerHash(payload.n, Number(answer)));
  const want = Buffer.from(payload.h);
  if (got.length !== want.length || !timingSafeEqual(got, want)) {
    throw new Error("Rezultatul sumei este greșit.");
  }
}

export const verifyCaptcha = createServerFn({ method: "POST" })
  .validator((d: unknown) => captchaSchema.parse(d))
  .handler(async ({ data }) => {
    await assertCaptcha(data.token, data.answer);
    return { ok: true as const };
  });
