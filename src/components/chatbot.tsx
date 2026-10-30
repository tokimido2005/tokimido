import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Languages, MessageCircle, Send, X } from "lucide-react";
import { askAssistant, CHAT_COPY, CHAT_LANGS, type ChatLang, type ChatTurn } from "@/lib/chat";
import { useT } from "@/lib/locale";
import { cn } from "@/lib/utils";

const LANG_KEY = "rabotaem-chat-lang";
const THREAD_KEY = "rabotaem-chat-thread";
const MAX_USER_TURNS = 24;

type Msg = ChatTurn & { id: string };

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function readLang(): ChatLang | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(LANG_KEY);
    return v === "ro" || v === "ru" ? v : null;
  } catch {
    return null;
  }
}

function readThread(): { lang: ChatLang | null; messages: Msg[] } {
  if (typeof window === "undefined") return { lang: null, messages: [] };
  try {
    const raw = window.sessionStorage.getItem(THREAD_KEY);
    if (!raw) return { lang: readLang(), messages: [] };
    const parsed = JSON.parse(raw) as { lang?: unknown; messages?: unknown };
    const lang = parsed.lang === "ro" || parsed.lang === "ru" ? parsed.lang : readLang();
    const messages = Array.isArray(parsed.messages)
      ? parsed.messages
          .filter(
            (m): m is Msg =>
              !!m &&
              typeof m === "object" &&
              (m as Msg).role !== undefined &&
              ((m as Msg).role === "user" || (m as Msg).role === "assistant") &&
              typeof (m as Msg).content === "string",
          )
          .map((m) => ({ id: m.id || uid(), role: m.role, content: m.content }))
          .slice(-40)
      : [];
    return { lang, messages };
  } catch {
    return { lang: readLang(), messages: [] };
  }
}

export function Chatbot() {
  const { t } = useT();
  const panelId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<ChatLang | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = readThread();
    setLang(saved.lang);
    setMessages(saved.messages);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (lang) window.localStorage.setItem(LANG_KEY, lang);
      window.sessionStorage.setItem(THREAD_KEY, JSON.stringify({ lang, messages }));
    } catch {
      /* ignore */
    }
  }, [hydrated, lang, messages]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, messages, pending, lang]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open && lang) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 80);
      return () => window.clearTimeout(id);
    }
  }, [open, lang]);

  const copy = lang ? CHAT_COPY[lang] : null;
  const userTurns = messages.filter((m) => m.role === "user").length;
  const atLimit = userTurns >= MAX_USER_TURNS;

  function pickLang(next: ChatLang) {
    setLang(next);
    try {
      window.localStorage.setItem(LANG_KEY, next);
    } catch {
      /* ignore */
    }
    setMessages([{ id: uid(), role: "assistant", content: CHAT_COPY[next].greeting }]);
    setDraft("");
  }

  function resetLang() {
    setLang(null);
    setMessages([]);
    setDraft("");
    try {
      window.localStorage.removeItem(LANG_KEY);
      window.sessionStorage.removeItem(THREAD_KEY);
    } catch {
      /* ignore */
    }
  }

  async function send(text: string) {
    const trimmed = text.trim().slice(0, 500);
    if (!lang || !trimmed || pending || atLimit) return;
    const history = [...messages, { id: uid(), role: "user" as const, content: trimmed }];
    setMessages(history);
    setDraft("");
    setPending(true);
    try {
      const result = await askAssistant({
        data: {
          lang,
          messages: history.map(({ role, content }) => ({ role, content })),
        },
      });
      const reply =
        result.ok && result.text.trim()
          ? result.text.trim()
          : CHAT_COPY[lang].error;
      setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: CHAT_COPY[lang].error }]);
    } finally {
      setPending(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(draft);
  }

  function onInputKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(draft);
    }
  }

  const showPicker = hydrated && open && !lang;
  const showThread = hydrated && open && !!lang && copy;
  const showSuggestions = showThread && userTurns === 0 && !pending;

  return (
    <div className="rbt-chat-dock pointer-events-none fixed inset-x-0 bottom-0 z-[46] flex justify-end px-3 pt-3 pb-[calc(var(--rbt-tab-h)+var(--rbt-tab-bottom)+0.55rem)] pr-[max(0.75rem,env(safe-area-inset-right))] lg:p-5">
      <div className="pointer-events-auto flex flex-col items-end gap-2.5">
        {open ? (
          <section
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-label={copy ? `${copy.subtitle} — ${copy.title}` : "Rabotaem.md"}
            data-testid="chat-panel"
            className="chat-panel flex w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[28px] glass-strong"
            style={{ maxHeight: "min(36rem, calc(100dvh - 6rem))" }}
          >
            <header className="flex items-center gap-2.5 border-b border-line px-3 py-2.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-full glass-orange">
                <MessageCircle className="size-5 text-white" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-navy">{copy?.subtitle ?? "Rabotaem.md"}</p>
                <p className="truncate text-xs text-muted">{copy?.title ?? "Asistent / Помощник"}</p>
              </div>
              {lang ? (
                <button
                  type="button"
                  className="grid size-10 shrink-0 place-items-center rounded-full text-navy hover:bg-navy/8"
                  aria-label={copy?.changeLang}
                  title={copy?.changeLang}
                  onClick={resetLang}
                >
                  <Languages className="size-4" />
                </button>
              ) : null}
              <button
                type="button"
                className="grid size-10 shrink-0 place-items-center rounded-full text-navy hover:bg-navy/8"
                aria-label={t("chat.close")}
                data-testid="chat-close"
                onClick={() => setOpen(false)}
              >
                <X className="size-5" />
              </button>
            </header>

            <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3" aria-live="polite">
              {showPicker ? (
                <div className="chat-msg">
                  <p className="chat-bubble-bot">
                    În ce limbă doriți să vorbim? / На каком языке вы хотите говорить?
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {CHAT_LANGS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        data-testid={`chat-lang-${item.id}`}
                        onClick={() => pickLang(item.id)}
                        className={cn(
                          "h-12 rounded-full text-sm font-semibold transition-transform duration-150 active:scale-[0.98]",
                          item.id === "ro" ? "glass-navy" : "glass-orange",
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {showThread
                ? messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn("chat-msg flex", m.role === "user" ? "justify-end" : "justify-start")}
                    >
                      <p className={m.role === "user" ? "chat-bubble-user" : "chat-bubble-bot"}>{m.content}</p>
                    </div>
                  ))
                : null}

              {pending ? (
                <div className="chat-msg flex justify-start">
                  <p className="chat-bubble-bot chat-typing" aria-label={copy?.typing}>
                    <span />
                    <span />
                    <span />
                  </p>
                </div>
              ) : null}

              {showSuggestions ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {copy.suggestions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => void send(item)}
                      className="h-10 max-w-full rounded-full bg-navy/8 px-3 text-left text-xs font-medium text-navy dark:bg-white/8"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              ) : null}

              {showThread && atLimit ? <p className="px-1 text-xs text-muted">{copy.limit}</p> : null}
            </div>

            {showThread ? (
              <form onSubmit={onSubmit} className="border-t border-line p-2.5">
                <div className="flex items-end gap-1.5 rounded-[18px] bg-navy/6 p-1 dark:bg-white/6">
                  <input
                    ref={inputRef}
                    data-testid="chat-input"
                    className="min-h-10 min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-navy outline-none placeholder:text-subtle"
                    value={draft}
                    maxLength={500}
                    disabled={pending || atLimit}
                    placeholder={copy.placeholder}
                    aria-label={copy.placeholder}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onInputKey}
                  />
                  <button
                    type="submit"
                    data-testid="chat-send"
                    disabled={pending || atLimit || !draft.trim()}
                    aria-label={copy.send}
                    className="grid size-10 shrink-0 place-items-center rounded-full glass-orange disabled:opacity-40"
                  >
                    <Send className="size-4 text-white" />
                  </button>
                </div>
              </form>
            ) : null}
          </section>
        ) : null}

        {!open ? (
          <button
            type="button"
            data-testid="chat-fab"
            aria-haspopup="dialog"
            aria-label={t("chat.open")}
            onClick={() => setOpen(true)}
            className="chat-fab grid size-11 place-items-center rounded-full glass-orange"
          >
            <MessageCircle className="size-5 text-white" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
