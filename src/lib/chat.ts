import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ChatLang = "ro" | "ru";
export type ChatRole = "user" | "assistant";
export type ChatTurn = { role: ChatRole; content: string };

export const CHAT_LANGS: Array<{ id: ChatLang; label: string }> = [
  { id: "ro", label: "Română" },
  { id: "ru", label: "Русский" },
];

export const CHAT_COPY: Record<
  ChatLang,
  {
    title: string;
    subtitle: string;
    greeting: string;
    placeholder: string;
    send: string;
    typing: string;
    changeLang: string;
    newChat: string;
    error: string;
    limit: string;
    suggestions: string[];
  }
> = {
  ro: {
    title: "Asistent",
    subtitle: "Rabotaem.md",
    greeting:
      "Bună! Te ajut să înțelegi cum funcționează Rabotaem.md — postare, aplicare, programări, evaluări, anulare sau reactivare. Cu ce vrei să începem?",
    placeholder: "Scrie o întrebare…",
    send: "Trimite",
    typing: "Se scrie…",
    changeLang: "Schimbă limba",
    newChat: "Conversație nouă",
    error: "Nu am putut răspunde acum. Încearcă din nou peste o clipă.",
    limit: "Ai atins limita de mesaje pentru această sesiune. Poți începe o conversație nouă.",
    suggestions: [
      "Ce diferență e între lucru rapid și angajare?",
      "Cum postez un job?",
      "Cum aplic la un job?",
      "Este gratuit?",
    ],
  },
  ru: {
    title: "Помощник",
    subtitle: "Rabotaem.md",
    greeting:
      "Здравствуйте! Помогу разобраться, как работает Rabotaem.md — размещение, отклики, расписание, оценки, отмена и реактивация. С чего начнём?",
    placeholder: "Напишите вопрос…",
    send: "Отправить",
    typing: "Печатает…",
    changeLang: "Сменить язык",
    newChat: "Новый разговор",
    error: "Сейчас не удалось ответить. Попробуйте ещё раз через мгновение.",
    limit: "Достигнут лимит сообщений за эту сессию. Можно начать новый разговор.",
    suggestions: [
      "Чем разовая работа отличается от найма?",
      "Как разместить работу?",
      "Как откликнуться?",
      "Это бесплатно?",
    ],
  },
};

const ANSWERS: Record<string, Record<ChatLang, string>> = {
  kinds: {
    ro: "Sunt două secțiuni, niciodată amestecate. Lucru rapid (kalîm): joburi scurte, plată pe loc, cu dată, oră, câți oameni, durată și sumă. Angajare oficială: firmă, salariu lunar, program, oraș și tip de contract. Când postezi, primul pas e «Ce fel de anunț pui?». Când cauți: «Caut lucru rapid» pe pagina principală sau «Caut angajare» pe pagina de angajare.",
    ru: "Есть два раздела, они никогда не смешиваются. Разовая работа (калым): короткие задания с оплатой на месте — дата, время, сколько людей, длительность и сумма. Официальный найм: компания, зарплата, график, город и тип договора. При публикации первый шаг — «Какое объявление вы размещаете?». Поиск: разовая работа на главной, официальные вакансии — на отдельной странице.",
  },
  post: {
    ro: "Apasă Postează. Primul pas e obligatoriu: «Ce fel de anunț pui?» — Lucru rapid sau Angajare oficială. Pentru lucru rapid completezi dată, oră, câți oameni, durata și suma (plată pe loc). Pentru angajare: firmă, salariu, program, oraș și tip de contract. Anunțul apare imediat în lista corespunzătoare, nu în ambele. Poți publica cel mult 3 anunțuri în 2 ore. Rabotaem.md nu ia comision.",
    ru: "Нажмите «Разместить». Первый шаг обязателен: какой тип объявления — разовая работа или официальный найм. Для разовой работы укажите дату, время, сколько людей, длительность и сумму (оплата на месте). Для найма: компания, зарплата, график, город и тип договора. Объявление появляется сразу в своей ленте, не в обеих. Не больше 3 объявлений за 2 часа. Комиссии нет.",
  },
  apply: {
    ro: "Ca să aplici, deschizi un anunț activ și apeși Aplică. Ai nevoie de cont. Completezi prenumele, numele, telefonul și un mesaj scurt (când poți ajunge, experiență). Cel care a postat te contactează direct — telefonul rămâne ascuns până aplici sau lucrați împreună. Nu poți aplica la propriul anunț, nici la unul anulat, expirat, finalizat sau fără locuri. Aplicațiile tale sunt în Contul meu; le poți retrage cu «Nu mai pot veni».",
    ru: "Чтобы откликнуться, откройте активное объявление и нажмите «Откликнуться». Нужен аккаунт. Укажите имя, фамилию, телефон и короткое сообщение (когда можете прийти, опыт). Автор свяжется с вами напрямую — телефон скрыт, пока вы не откликнетесь или не поработаете вместе. Нельзя откликаться на своё объявление, а также на отменённое, истёкшее, завершённое или без свободных мест. Ваши отклики — в «Мой аккаунт»; их можно снять кнопкой «Больше не могу прийти».",
  },
  rating: {
    ro: "După ce autorul marchează jobul ca finalizat (din Aplicații), ambele părți pot da 1–5 stele și un comentariu scurt, din inbox sau din Contul meu. Evaluările apar pe profilul public. Recenziile se lasă doar după o colaborare reală, finalizată.",
    ru: "Когда автор отмечает работу как завершённую (в разделе «Заявки»), обе стороны ставят 1–5 звёзд и короткий комментарий — из входящих или из «Мой аккаунт». Оценки видны в публичном профиле. Отзыв можно оставить только после реальной завершённой работы.",
  },
  schedule: {
    ro: "La lucrul rapid, fiecare anunț are dată și oră de începere — obligatoriu în viitor — și expiră automat după începere. Poți filtra Astăzi sau Urgent. Angajarea oficială nu are dată de expirare: rămâne deschisă până e ocupată sau anulată, cu program (full-time, part-time, ture) în loc de oră.",
    ru: "У разовой работы есть дата и время начала — обязательно в будущем — и объявление истекает после старта. Можно фильтровать «Сегодня» или «Срочно». Официальный найм не истекает по дате: остаётся открытым, пока вакансия не занята или не отменена, с графиком вместо часа начала.",
  },
  cancel: {
    ro: "Din Aplicații, autorul poate: anula anunțul (dispare din listă, nimeni nu mai aplică), șterge definitiv (se pierd și aplicațiile), marca ca finalizat, sau reactiva un anunț expirat ori finalizat — cu o dată și oră nouă, în viitor. Ștergerea nu se poate anula. Dacă ești muncitor, din Contul meu poți retrage aplicația («Nu mai pot veni»). Anunțurile anulate nu se reactivează; trebuie un anunț nou.",
    ru: "В разделе «Заявки» автор может: отменить объявление (оно скрывается, отклики больше не принимаются), удалить навсегда (вместе с заявками), отметить как завершённое или реактивировать истёкшее/завершённое — с новой датой и временем в будущем. Удаление необратимо. Если вы исполнитель, в «Мой аккаунт» можно снять отклик («Больше не могу прийти»). Отменённые объявления не реактивируются — нужно новое.",
  },
  free: {
    ro: "Da — Rabotaem.md este complet gratuit. Contul, postarea, aplicarea, salvarea joburilor și evaluările nu costă nimic. Nu luăm comision (0%). Plata pentru muncă se face direct între voi, pe loc.",
    ru: "Да — Rabotaem.md полностью бесплатен. Аккаунт, размещение, отклик, сохранение объявлений и оценки ничего не стоят. Нет комиссии (0%). Оплата за работу — напрямую между вами, на месте.",
  },
  freeFreemium: {
    ro: "Poți posta și aplica gratuit în limitele lunare. Pro scoate limitele. Nu luăm comision pe plățile dintre voi.",
    ru: "Можно размещать и откликаться бесплатно в пределах лимита. Pro снимает ограничения. Комиссии с выплат нет.",
  },
  freePaid: {
    ro: "Navigarea e gratuită. Ca să postezi sau să aplici ai nevoie de Pro. Nu luăm comision pe plățile dintre voi.",
    ru: "Просмотр бесплатный. Чтобы размещать или откликаться, нужен Pro. Комиссии с выплат нет.",
  },
  disclaimer: {
    ro: "Rabotaem.md este doar un intermediar de anunțuri: conectăm persoanele care oferă joburi de scurtă durată cu cele care caută de lucru. Nu suntem angajator și nu facem contracte. Nu purtăm nicio răspundere pentru plăți, calitatea muncii, întârzieri, siguranță sau orice conflict dintre utilizatori. Toate înțelegerile (sumă, oră, loc, condiții) se fac direct între voi.",
    ru: "Rabotaem.md — только посредник объявлений: мы соединяем тех, кто предлагает краткосрочную работу, с теми, кто её ищет. Мы не работодатель и не сторона договора. Мы не отвечаем за оплату, качество работы, задержки, безопасность или любые споры между пользователями. Все договорённости (сумма, время, место, условия) вы заключаете напрямую.",
  },
  account: {
    ro: "Contul e gratuit și e necesar ca să postezi sau să aplici. Te poți înregistra cu Google, X sau email. Telefonul e obligatoriu, unic pe platformă, și nu trimitem SMS de verificare. În Contul meu găsești joburile postate, aplicațiile, salvate, evaluările și rapoartele. Telefonul tău e vizibil celorlalți doar după o aplicație relevantă sau după ce ați lucrat împreună.",
    ru: "Аккаунт бесплатный и нужен, чтобы размещать работу или откликаться. Регистрация через Google, X или email. Телефон обязателен, один номер — один аккаунт, SMS-код мы не отправляем. В «Мой аккаунт» — ваши объявления, отклики, сохранённые, оценки и жалобы. Телефон виден другим только после релевантного отклика или совместной работы.",
  },
  search: {
    ro: "Căutarea e pe două pagini separate. «Caut lucru rapid» — pagina principală, cu dată, urgență și categorii de joburi scurte. «Caut angajare» — pagina Angajare, cu firmă, salariu, program și contract. Listele nu se amestecă. Pe fiecare filtruzi după cuvinte, raion și localitate.",
    ru: "Поиск идёт на двух отдельных страницах. Разовая работа — на главной, с датой, срочностью и короткими заданиями. Официальный найм — на странице «Найм», с компанией, зарплатой, графиком и договором. Ленты не смешиваются. На каждой можно фильтровать по словам, району и населённому пункту.",
  },
  hello: {
    ro: "Bună! Pot explica cum postezi un job, cum aplici, cum funcționează evaluările, programarea (dată și oră), anularea / ștergerea / reactivarea, și că platforma e gratuită. Rabotaem.md e doar intermediar — nu răspundem pentru plăți sau calitatea muncii. Ce te interesează?",
    ru: "Здравствуйте! Могу объяснить, как разместить работу, как откликнуться, как работают оценки, расписание (дата и время), отмена / удаление / реактивация, и что платформа бесплатная. Rabotaem.md — только посредник: мы не отвечаем за оплату и качество работы. Что вас интересует?",
  },
};

const TOPICS: Array<{ id: string; keys: string[] }> = [
  {
    id: "kinds",
    keys: [
      "lucru rapid",
      "angajare",
      "kalim",
      "kalîm",
      "oficial",
      "diferenț",
      "diferent",
      "tip de anunt",
      "tip de anunț",
      "калым",
      "разовая",
      "официальн",
      "найм",
      "чем отлича",
    ],
  },
  {
    id: "post",
    keys: [
      "postez",
      "posteaz",
      "public",
      "anunt",
      "adaug job",
      "pun un job",
      "cum post",
      "размест",
      "опублик",
      "добавить работ",
      "как подать объяв",
      "как размест",
    ],
  },
  {
    id: "apply",
    keys: [
      "aplic",
      "aplicare",
      "candidat",
      "cum ma inscriu",
      "cum ma înscriu",
      "отклик",
      "откликн",
      "как отклик",
      "как подать заявк",
      "как записаться",
    ],
  },
  {
    id: "rating",
    keys: [
      "evalu",
      "stele",
      "recenz",
      "rating",
      "nota",
      "отзыв",
      "оценк",
      "звезд",
      "рейтинг",
    ],
  },
  {
    id: "schedule",
    keys: [
      "program",
      "data",
      "dată",
      "ora",
      "oră",
      "cand incepe",
      "când începe",
      "astazi",
      "astăzi",
      "urgent",
      "расписан",
      "дата",
      "время",
      "сегодня",
      "срочно",
      "когда начина",
    ],
  },
  {
    id: "cancel",
    keys: [
      "anul",
      "sterg",
      "șterg",
      "sterge",
      "șterge",
      "reactiv",
      "inchid",
      "închid",
      "отмен",
      "удал",
      "реактив",
      "закрыть объяв",
    ],
  },
  {
    id: "free",
    keys: [
      "gratuit",
      "costa",
      "costă",
      "comision",
      "abonament",
      "pret",
      "preț",
      "banca",
      "платн",
      "бесплат",
      "комисс",
      "подписк",
      "сколько стоит",
      "это платн",
    ],
  },
  {
    id: "disclaimer",
    keys: [
      "responsab",
      "intermediar",
      "angajator",
      "conflict",
      "disput",
      "neplata",
      "calitatea",
      "siguranta",
      "siguranța",
      "plata muncii",
      "отвечает",
      "ответствен",
      "посредник",
      "работодател",
      "конфликт",
      "спор",
      "качество",
      "неоплат",
      "безопасн",
    ],
  },
  {
    id: "account",
    keys: [
      "cont",
      "inregistr",
      "înregistr",
      "autentific",
      "parola",
      "аккаунт",
      "регистр",
      "войти",
      "логин",
      "парол",
    ],
  },
  {
    id: "search",
    keys: [
      "caut",
      "filtru",
      "raion",
      "localitat",
      "categorie",
      "moldova",
      "поиск",
      "фильтр",
      "район",
      "село",
      "категор",
    ],
  },
  {
    id: "hello",
    keys: ["salut", "buna", "bună", "hello", "hi ", "hey", "привет", "здравств", "добрый"],
  },
];

function fold(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ș|ş/g, "s")
    .replace(/ț|ţ/g, "t");
}

export function localAnswer(lang: ChatLang, question: string, mode?: string): string {
  const q = fold(question);
  let best = { id: "hello", score: 0 };
  for (const topic of TOPICS) {
    let score = 0;
    for (const key of topic.keys) {
      if (q.includes(fold(key))) score += key.length > 6 ? 2 : 1;
    }
    if (score > best.score) best = { id: topic.id, score };
  }
  let topicId = best.score > 0 ? best.id : "hello";
  if (topicId === "free") {
    if (mode === "paid") topicId = "freePaid";
    else if (mode === "freemium") topicId = "freeFreemium";
  }
  const row = ANSWERS[topicId] ?? ANSWERS.hello;
  let text = row[lang];
  if (best.id !== "disclaimer" && /plat[aă]|оплат|conflict|спор|calitat|качеств/.test(q)) {
    text = `${text}\n\n${ANSWERS.disclaimer[lang]}`;
  }
  return text;
}

const SYSTEM_FACTS = `You are the official support assistant for Rabotaem.md — a free short-term jobs board covering all raions and villages of Moldova. Slogan: «lucru pe loc. bani pe loc.»

TONE: polite, clear, concise, helpful. Short paragraphs (2–5 sentences). No emojis. No markdown headings. No tables. You may use short numbered steps. Never invent features.

ALWAYS reply only in the language specified below. Never switch. Brand names stay as-is: Rabotaem.md, Google, X.

FACTS — never contradict:
- MONEY_MODE_FACT
- Rabotaem.md is ONLY an ads intermediary. Not an employer, not a staffing agency, not a party to contracts. NOT responsible for payments, work quality, delays, safety, or any disputes between users. All agreements (pay, time, place, conditions) are made directly between users. Repeat this clearly whenever the user asks about money, quality, conflicts, or liability.
- Account needed to post or apply. Sign in with Google, X, or email. Phone is required, unique per account; no SMS verification code. Phone stays hidden until someone applies or they have worked together.
- Post a job: menu «Postează» / «Разместить». Fields: title, description, category, raion, locality, payment in MDL, duration (hours or minutes), people needed, start date AND time (must be in the future), contact phone, anti-spam captcha. Listing goes live immediately. Limit: 3 listings per 2 hours.
- Categories: Mutări & Transport; Curățenie; Construcții & muncă fizică; Grădinărit & exterior; Ajutor casnic; Altele.
- Apply: open an active listing → Aplică / Откликнуться. First name, last name, phone, short message (when you can arrive, brief experience). Poster contacts the applicant directly. Cannot apply to own listing, or to cancelled / expired / completed / full listings. Withdraw an application from Contul meu / Мой аккаунт («Nu mai pot veni» / «Больше не могу прийти»).
- Scheduling: every listing has a start date and time. Filters: Astăzi / Сегодня = starts today; Urgent / Срочно = next 24 hours.
- Manage listings from Aplicații / Заявки (inbox of the poster): cancel (hidden, no more applications), delete permanently (also deletes applications — irreversible), mark completed, reactivate an expired or completed listing by choosing a new future date and time. Cancelled listings cannot be reactivated — post a new one.
- Ratings: after the poster marks the job completed, BOTH sides may leave 1–5 stars and a short comment (inbox or My account). Reviews show on the public profile. Only after a completed collaboration.
- Search/filter on the home page by keywords, raion, locality, category, Today, Urgent. Save with the heart → Salvate.
- Report and block are available on listings and profiles. Contact page for human support.
- Coverage: all of Moldova (raioane and sate), not just Chișinău.

If the question is unrelated to Rabotaem.md, politely say you only help with this platform and list the topics you can explain.
Do not offer to process payments, mediate disputes, or contact other users. Do not claim there is in-app chat, contracts, or SMS codes.`;

const inputSchema = z.object({
  lang: z.enum(["ro", "ru"]),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(1200),
      }),
    )
    .min(1)
    .max(12),
});

export const askAssistant = createServerFn({ method: "POST" })
  .validator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    const lang = data.lang;
    const history = data.messages.slice(-8);
    const lastUser = [...history].reverse().find((m) => m.role === "user");
    const fallback = localAnswer(lang, lastUser?.content ?? "", "free");
    const moneyFact =
      "- Completely free right now. Account, posting, applying, saving jobs, ratings: 0 cost, 0% commission. Do NOT mention Pro, subscriptions, paid plans, Boost, or upgrades.";

    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: true as const, text: fallback, source: "local" as const };

    const langLine =
      lang === "ro"
        ? "LANGUAGE: Reply ONLY in Romanian (limba română). Never use Russian or English except for brand names."
        : "LANGUAGE: Reply ONLY in Russian. Never use Romanian or English except for brand names.";

    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4.5",
          temperature: 0.3,
          max_tokens: 420,
          messages: [
            { role: "system", content: `${SYSTEM_FACTS.replace("MONEY_MODE_FACT", moneyFact)}\n\n${langLine}` },
            ...history.map((m) => ({ role: m.role, content: m.content })),
          ],
        }),
        signal: AbortSignal.timeout(22000),
      });
      if (!res.ok) return { ok: true as const, text: fallback, source: "local" as const };
      const body = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = body.choices?.[0]?.message?.content?.trim();
      if (!text) return { ok: true as const, text: fallback, source: "local" as const };
      return { ok: true as const, text, source: "grok" as const };
    } catch {
      return { ok: true as const, text: fallback, source: "local" as const };
    }
  });
