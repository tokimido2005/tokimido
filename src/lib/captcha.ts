import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SECRET = "rabotaem-captcha-v1";

type Payload = { a: number; b: number; exp: number };

async function nodeCrypto() {
  return await import("node:crypto");
}

async function sign(payload: Payload) {
  const { createHmac } = await nodeCrypto();
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${mac}`;
}

async function read(token: string): Promise<Payload | null> {
  const { createHmac, timingSafeEqual } = await nodeCrypto();
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", SECRET).update(body).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload;
    if (!Number.isFinite(parsed.a) || !Number.isFinite(parsed.b) || !Number.isFinite(parsed.exp)) {
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
  const { randomInt } = await nodeCrypto();
  const a = randomInt(2, 11);
  const b = randomInt(1, 9);
  const exp = Date.now() + 12 * 60 * 1000;
  return { token: await sign({ a, b, exp }), question: `${a} + ${b}` };
});

export async function assertCaptcha(token: string, answer: number) {
  const payload = await read(token);
  if (!payload) throw new Error("Verificarea a eșuat. Reîncarcă suma.");
  if (payload.exp < Date.now()) throw new Error("Verificarea a expirat. Reîncarcă suma.");
  if (payload.a + payload.b !== Number(answer)) throw new Error("Rezultatul sumei este greșit.");
}

export const verifyCaptcha = createServerFn({ method: "POST" })
  .validator((d: unknown) => captchaSchema.parse(d))
  .handler(async ({ data }) => {
    await assertCaptcha(data.token, data.answer);
    return { ok: true as const };
  });
