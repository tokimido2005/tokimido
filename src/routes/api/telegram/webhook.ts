import { createFileRoute } from "@tanstack/react-router";

/**
 * Telegram bot webhook. Telegram signs every call with the secret we gave it
 * in setWebhook (X-Telegram-Bot-Api-Secret-Token); anything else is refused.
 * Always answers 200 quickly so Telegram doesn't retry.
 */
export const Route = createFileRoute("/api/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const tg = await import("@/lib/telegram.server");
        if (!tg.telegramEnabled()) return new Response("disabled", { status: 404 });
        if (request.headers.get("x-telegram-bot-api-secret-token") !== tg.webhookSecret()) {
          return new Response("forbidden", { status: 401 });
        }
        try {
          const update = (await request.json()) as Parameters<typeof tg.handleUpdate>[0];
          await tg.handleUpdate(update);
        } catch (err) {
          console.error("[telegram] update failed", err);
        }
        return new Response("ok");
      },
    },
  },
});
