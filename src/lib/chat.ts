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
      "Bună! Te ajut cu orice despre Rabotaem.md: cum găsești un kalîm sau o angajare, cum aplici, cum postezi, cum alegi oamenii, CV-ul, verificarea telefonului sau siguranța. Cu ce începem?",
    placeholder: "Scrie o întrebare…",
    send: "Trimite",
    typing: "Se scrie…",
    changeLang: "Schimbă limba",
    newChat: "Conversație nouă",
    error: "Nu am putut răspunde acum. Încearcă din nou peste o clipă.",
    limit: "Ai atins limita de mesaje pentru această sesiune. Poți începe o conversație nouă.",
    suggestions: [
      "Cum postez un kalîm?",
      "Cum aplic și când mă sună?",
      "Cum aleg oamenii care au aplicat?",
      "Cum fac un CV?",
      "Este gratuit?",
    ],
  },
  ru: {
    title: "Помощник",
    subtitle: "Rabotaem.md",
    greeting:
      "Здравствуйте! Помогу во всём, что касается Rabotaem.md: как найти калым или официальную работу, откликнуться, разместить объявление, выбрать людей, сделать резюме, подтвердить телефон и не попасться мошенникам. С чего начнём?",
    placeholder: "Напишите вопрос…",
    send: "Отправить",
    typing: "Печатает…",
    changeLang: "Сменить язык",
    newChat: "Новый разговор",
    error: "Сейчас не удалось ответить. Попробуйте ещё раз через мгновение.",
    limit: "Достигнут лимит сообщений за эту сессию. Можно начать новый разговор.",
    suggestions: [
      "Как разместить калым?",
      "Как откликнуться и когда мне позвонят?",
      "Как выбрать людей из откликов?",
      "Как сделать резюме?",
      "Это бесплатно?",
    ],
  },
};

const ANSWERS: Record<string, Record<ChatLang, string>> = {
  kinds: {
    ro: "Pe Rabotaem.md sunt două feluri de anunțuri, în liste separate:\n• Lucru rapid (kalîm): o lucrare scurtă, de câteva ore sau o zi, cu dată, oră, câți oameni, durată și suma plătită pe loc. E pe pagina principală.\n• Angajare oficială: un loc de muncă la o firmă, cu salariu lunar, program, oraș și tip de contract. E pe pagina Angajare, unde trimiți CV-ul.",
    ru: "На Rabotaem.md два вида объявлений, в отдельных лентах:\n• Быстрая работа (калым): короткая работа на несколько часов или день, с датой, временем, количеством людей, длительностью и оплатой на месте. Она на главной странице.\n• Официальная работа: место в компании с месячной зарплатой, графиком, городом и типом договора. Она на странице «Найм», туда отправляют резюме.",
  },
  post: {
    ro: "Apasă Postează și alege întâi tipul: Lucru rapid sau Angajare oficială.\n• La kalîm poți porni de la un șablon (Mutare, Curățenie, Cosit etc.), apoi completezi suma, locul, data, ora, durata și câți oameni îți trebuie. Poți pune și punctul exact pe hartă: îl văd doar oamenii pe care îi selectezi.\n• La angajare completezi firma, salariul (de la – până la), programul, contractul, responsabilitățile, cerințele și ce oferi.\nAnunțul apare imediat. Ai nevoie de cont cu telefonul verificat. Limita este de 3 anunțuri în 2 ore. După publicare îl poți trimite din pagină pe Viber, Telegram, WhatsApp sau Facebook.",
    ru: "Нажмите «Разместить» и сначала выберите тип: быстрая работа или официальная.\n• Для калыма можно начать с шаблона (переезд, уборка, покос и т.д.), затем указать сумму, место, дату, время, длительность и сколько людей нужно. Можно отметить точку на карте — её видят только выбранные вами люди.\n• Для официальной работы укажите компанию, зарплату (от – до), график, договор, обязанности, требования и что вы предлагаете.\nОбъявление появляется сразу. Нужен аккаунт с подтверждённым телефоном. Лимит — 3 объявления за 2 часа. После публикации его можно отправить со страницы в Viber, Telegram, WhatsApp или Facebook.",
  },
  apply: {
    ro: "Deschizi anunțul și apeși Aplică. Ai nevoie de cont cu telefonul verificat.\n• La kalîm scrii un mesaj scurt: când poți veni și ce experiență ai.\n• La angajare trimiți CV-ul: cel făcut pe site sau un fișier (PDF, Word, poză).\nCel care a postat vede aplicația și te sună. Când te selectează sau te invită la interviu, primești notificare, iar în pagina anunțului apare telefonul lui. Răspunsurile le vezi în Aplicații → „La care am aplicat”. Te poți retrage cu „Nu mai pot veni”.",
    ru: "Откройте объявление и нажмите «Откликнуться». Нужен аккаунт с подтверждённым телефоном.\n• Для калыма напишите короткое сообщение: когда можете прийти и какой у вас опыт.\n• Для официальной работы отправьте резюме — сделанное на сайте или файл (PDF, Word, фото).\nАвтор видит отклик и звонит вам. Когда вас выбирают или приглашают на собеседование, приходит уведомление, а на странице объявления появляется его телефон. Ответы — в «Заявки» → «Мои отклики». Отказаться можно кнопкой «Не смогу прийти».",
  },
  manage: {
    ro: "Oamenii care au aplicat la anunțurile tale sunt în Aplicații → „Primite”. Apeși pe un nume și ai butoanele mari:\n• Sună: îl suni direct.\n• Selectează (verde): l-ai ales; primește notificare și vede telefonul tău.\n• Refuză (roșu): cu confirmare; primește notificare că nu a fost ales.\nVezi mereu câte locuri sunt ocupate. La angajări poți invita la interviu, marca „Angajat” și ține notițe private. Din „Gestionează anunțul” îl marchezi ca finalizat, îl anulezi, îl ștergi, îl reactivezi cu o dată nouă sau îl repostezi.",
    ru: "Люди, откликнувшиеся на ваши объявления, — в «Заявки» → «Полученные». Нажмите на имя — появятся крупные кнопки:\n• «Позвонить»: звоните напрямую.\n• «Выбрать» (зелёная): человек получает уведомление и видит ваш телефон.\n• «Отказать» (красная): с подтверждением; человек получает уведомление.\nВсегда видно, сколько мест занято. Для официальной работы можно пригласить на собеседование, отметить «Принят» и вести личные заметки. В «Управлять объявлением» можно завершить, отменить, удалить, возобновить с новой датой или разместить снова.",
  },
  repost: {
    ro: "Ca să pui din nou un anunț vechi (finalizat, expirat sau anulat), apeși „Repostează”: în Contul meu → Anunțurile mele, în Aplicații → Gestionează sau pe pagina anunțului. Formularul se completează cu tot ce aveai, alegi doar data nouă și publici. Un anunț expirat îl poți și reactiva din Aplicații, cu o dată nouă.",
    ru: "Чтобы снова разместить старое объявление (завершённое, истёкшее или отменённое), нажмите «Разместить снова»: в «Мой аккаунт» → «Мои объявления», в «Заявки» → «Управлять объявлением» или на странице объявления. Форма заполнится как раньше — выберите новую дату и опубликуйте. Истёкшее объявление можно также возобновить в «Заявках» с новой датой.",
  },
  rating: {
    ro: "După ce lucrul e marcat ca finalizat, ambele părți pot lăsa 1–5 stele și un comentariu scurt. Recenziile apar pe profilul public și îi ajută pe ceilalți să aleagă. Poți evalua doar după o colaborare reală.",
    ru: "Когда работа отмечена как завершённая, обе стороны могут поставить 1–5 звёзд и оставить короткий комментарий. Отзывы видны в публичном профиле и помогают другим выбирать. Оценивать можно только после реальной совместной работы.",
  },
  schedule: {
    ro: "Un kalîm are dată și oră de început (în viitor) și dispare din listă când începe. Pe pagina principală poți filtra: Azi, Urgent (în 24 de ore) sau 3 ore. Angajările oficiale nu au dată de început și rămân active până le închide firma.",
    ru: "У калыма есть дата и время начала (в будущем), и он пропадает из ленты, когда начинается. На главной можно фильтровать: «Сегодня», «Срочно» (в течение 24 часов) или «В течение 3 часов». У официальных вакансий нет даты начала — они активны, пока компания их не закроет.",
  },
  cancel: {
    ro: "Din Aplicații → „Gestionează anunțul” poți:\n• marca lucrul ca finalizat;\n• anula anunțul (dispare din listă);\n• șterge definitiv (se șterg și aplicațiile);\n• reactiva un anunț expirat cu o dată nouă;\n• reposta anunțul ca unul nou.",
    ru: "В «Заявки» → «Управлять объявлением» можно:\n• отметить работу завершённой;\n• отменить объявление (оно скрывается);\n• удалить навсегда (удаляются и отклики);\n• возобновить истёкшее с новой датой;\n• разместить его снова как новое.",
  },
  free: {
    ro: "Da, Rabotaem.md este complet gratuit: contul, postarea, aplicarea, CV-ul și alertele. Nu luăm comision. Banii pentru lucru îi primești direct de la cel care angajează.",
    ru: "Да, Rabotaem.md полностью бесплатен: аккаунт, размещение, отклики, резюме и уведомления. Комиссии нет. Деньги за работу вы получаете напрямую от заказчика.",
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
    ro: "Rabotaem.md este doar o platformă de anunțuri: nu suntem angajator și nu facem contracte. Suma, ora și condițiile le stabiliți direct între voi, iar plata se face direct între voi. Nu răspundem pentru plată, calitatea muncii sau neînțelegeri. Dacă ceva nu e în regulă, raportează anunțul sau persoana.",
    ru: "Rabotaem.md — только площадка объявлений: мы не работодатель и не заключаем договоров. Сумму, время и условия вы согласуете напрямую, и оплата идёт напрямую между вами. Мы не отвечаем за оплату, качество работы или споры. Если что-то не так — пожалуйтесь на объявление или человека.",
  },
  account: {
    ro: "Contul e gratuit. Te înregistrezi cu Google sau cu email. Ca să postezi sau să aplici trebuie să-ți verifici telefonul o singură dată: prin Telegram (botul @RabotaemMdBot, gratuit, fără cod) sau prin SMS cu cod. Un număr poate fi folosit la un singur cont. Telefonul nu e public: îl vede doar omul cu care lucrezi.",
    ru: "Аккаунт бесплатный. Регистрация через Google или email. Чтобы размещать или откликаться, один раз подтвердите телефон: через Telegram (бот @RabotaemMdBot, бесплатно, без кода) или по SMS с кодом. Один номер — один аккаунт. Телефон не публичный: его видит только тот, с кем вы работаете.",
  },
  password: {
    ro: "Ai uitat parola? Pe pagina de intrare apasă „Ai uitat parola?” și alege: prin Telegram (primești un link de la botul nostru) sau prin SMS cu cod pe telefonul din cont. După ce pui parola nouă, ești deconectat de pe celelalte dispozitive.",
    ru: "Забыли пароль? На странице входа нажмите «Забыли пароль?» и выберите: через Telegram (бот пришлёт ссылку) или по SMS с кодом на телефон из аккаунта. После смены пароля вы выходите со всех других устройств.",
  },
  cv: {
    ro: "Pentru angajări ai nevoie de CV. În Contul meu → „CV-ul meu” îl faci în 6 pași simpli: postul dorit, experiența, studiile, limbile, abilitățile și o poză opțională. Poți și să încarci un fișier (PDF, Word sau poză). La „Aplică” alegi ce CV trimiți. CV-ul îl vede doar firma la care aplici.",
    ru: "Для официальной работы нужно резюме. В «Мой аккаунт» → «Моё резюме» его можно сделать за 6 простых шагов: желаемая должность, опыт, образование, языки, навыки и фото по желанию. Можно и загрузить файл (PDF, Word или фото). При отклике вы выбираете, какое резюме отправить. Резюме видит только компания, куда вы откликаетесь.",
  },
  alerts: {
    ro: "Poți primi anunțurile noi potrivite pentru tine: în Contul meu → „Alertele mele” alegi raionul, categoriile și tipul de lucru. Primești notificări în browser sau pe Telegram (cel mult câteva pe zi), iar seara un rezumat.",
    ru: "Можно получать новые подходящие объявления: в «Мой аккаунт» → «Мои оповещения» выберите район, категории и тип работы. Уведомления приходят в браузер или в Telegram (не больше нескольких в день), а вечером — сводка.",
  },
  age: {
    ro: "Contul se poate face de la 16 ani. La kalîmuri se poate lucra de la 16 ani, dar munca fizică grea (mutări, construcții) și anunțurile marcate „Doar 18+” sunt doar de la 18 ani. Angajarea oficială e doar de la 18 ani. Anul nașterii nu se arată nimănui.",
    ru: "Аккаунт можно создать с 16 лет. На калымах можно работать с 16 лет, но тяжёлая физическая работа (переезды, стройка) и объявления с отметкой «Только 18+» — только с 18 лет. Официальная работа — только с 18 лет. Год рождения никому не показывается.",
  },
  safety: {
    ro: "Nu plăti niciodată bani în avans pentru un loc de muncă: la un kalîm tu primești banii, după lucru. Firmele corecte nu cer bani pentru angajare, instruire sau acte. Dacă cineva îți cere bani sau ceva pare suspect, apasă „Raportează” pe anunț sau pe profil și alege motivul. Echipa verifică și îți răspunde.",
    ru: "Никогда не платите деньги вперёд за работу: на калыме деньги получаете вы, после работы. Честные компании не берут деньги за трудоустройство, обучение или документы. Если у вас просят деньги или что-то кажется подозрительным, нажмите «Пожаловаться» на объявлении или в профиле и выберите причину. Команда проверит и ответит вам.",
  },
  company: {
    ro: "Dacă angajezi ca firmă, fă-ți pagina firmei din Contul meu → „Pagina firmei”: nume, oraș, descriere, site. Pagina e publică, arată toate angajările voastre și apare la fiecare anunț. Firmele verificate primesc o bifă.",
    ru: "Если вы нанимаете как компания, создайте страницу компании в «Мой аккаунт» → «Страница компании»: название, город, описание, сайт. Страница публичная, показывает все ваши вакансии и видна в каждом объявлении. Проверенные компании получают отметку.",
  },
  share: {
    ro: "Pe pagina fiecărui anunț apasă „Distribuie” și alege Viber, Telegram, WhatsApp sau Facebook. Mesajul vine gata scris, iar linkul arată o imagine cu titlul, suma și locul. Imediat după publicare îți propunem să-l trimiți în grupurile din zona ta: așa găsești oameni mai repede.",
    ru: "На странице объявления нажмите «Поделиться» и выберите Viber, Telegram, WhatsApp или Facebook. Сообщение уже готово, а ссылка показывает картинку с названием, суммой и местом. Сразу после публикации мы предложим отправить его в группы вашего района — так людей найти быстрее.",
  },
  account_delete: {
    ro: "Contul îl ștergi din Contul meu → „Șterge contul”. Se șterg profilul, CV-urile, anunțurile și aplicațiile. Datele tale le poți cere oricând pe tokimidoofficial@gmail.com.",
    ru: "Удалить аккаунт можно в «Мой аккаунт» → «Удалить аккаунт». Удаляются профиль, резюме, объявления и отклики. Свои данные можно запросить по адресу tokimidoofficial@gmail.com.",
  },
  search: {
    ro: "Kalîmurile sunt pe pagina principală, iar angajările pe pagina Angajare. Poți căuta după cuvinte, raion, localitate și categorie, iar la kalîmuri și după Azi / Urgent. Apasă inima ca să salvezi un anunț (îl găsești la Salvate). Sunt și pagini gata făcute: Lucru azi, În weekend, Cu plata zilnică, Fără experiență, Pentru studenți.",
    ru: "Калымы — на главной странице, официальная работа — на странице «Найм». Можно искать по словам, району, населённому пункту и категории, а для калымов — ещё «Сегодня» / «Срочно». Нажмите сердечко, чтобы сохранить объявление (оно будет в «Сохранённых»). Есть и готовые подборки: работа сегодня, на выходных, с ежедневной оплатой, без опыта, для студентов.",
  },
  hello: {
    ro: "Bună! Te pot ajuta cu: cum găsești un kalîm sau o angajare, cum aplici, cum postezi (și șabloanele), cum alegi oamenii care au aplicat, CV-ul, verificarea telefonului și parola, alertele, vârsta minimă și siguranța. Întreabă-mă orice despre Rabotaem.md.",
    ru: "Здравствуйте! Я помогу: как найти калым или официальную работу, откликнуться, разместить объявление (и шаблоны), выбрать людей из откликов, сделать резюме, подтвердить телефон и сменить пароль, настроить уведомления, а также про возраст и безопасность. Спрашивайте что угодно о Rabotaem.md.",
  },
};

const TOPICS: Array<{ id: string; keys: string[] }> = [
  { id: "kinds", keys: ["lucru rapid", "angajare", "diferen", "kalim", "calim", "oficial", "калым", "официальн", "разница", "чем отлича"] },
  { id: "post", keys: ["postez", "postare", "public", "anunt", "sablon", "разместить", "размещ", "объявлен", "опубликов", "шаблон"] },
  { id: "apply", keys: ["aplic", "aplicare", "ma suna", "candidat", "откликн", "отклик", "позвонят"] },
  { id: "manage", keys: ["care au aplicat", "oamenii care", "au aplicat la", "aleg", "selectez", "selectat", "refuz", "primite", "cine a aplicat", "interviu", "angajat", "выбрать", "выбор", "отказать", "собеседован", "полученн"] },
  { id: "repost", keys: ["repostez", "reposta", "anunt vechi", "anunțul vechi", "repost", "din nou", "iar anuntul", "reactiv", "снова", "повторно", "возобнов"] },
  { id: "rating", keys: ["evalu", "stele", "recenz", "rating", "оценк", "звезд", "отзыв"] },
  { id: "schedule", keys: ["data", "ora", "urgent", "azi", "expira", "дата", "время", "срочно", "сегодня", "истек"] },
  { id: "cancel", keys: ["anulez", "anula", "sterg anunt", "finaliz", "отмен", "удалить объявл", "заверш"] },
  { id: "free", keys: ["gratuit", "cost", "pret", "plat", "comision", "бесплатн", "стоим", "цена", "комисси"] },
  { id: "disclaimer", keys: ["raspund", "garant", "contract", "conflict", "nu m-a platit", "ответствен", "гарант", "договор", "спор", "не заплатил"] },
  { id: "account", keys: ["cont", "inregistr", "telefon", "verific", "telegram", "sms", "аккаунт", "регистрац", "телефон", "подтверд", "смс"] },
  { id: "password", keys: ["parol", "am uitat", "reset", "пароль", "забыл"] },
  { id: "cv", keys: ["cv", "resume", "rezume", "резюме"] },
  { id: "alerts", keys: ["alert", "notific", "anunturi noi", "уведомлен", "новые объявлен", "оповещ"] },
  { id: "age", keys: ["varst", "de ani", "16 ani", "18 ani", "minor", "18+", "возраст", "лет", "несовершеннолет"] },
  { id: "safety", keys: ["bani in avans", "cerut bani", "cere bani", "avans", "frauda", "inselat", "teapa", "suspect", "raport", "мошен", "вперед", "вперёд", "развод", "пожалов"] },
  { id: "company", keys: ["firma", "companie", "pagina firmei", "компани", "фирм"] },
  { id: "share", keys: ["distribui", "trimit anuntul", "viber", "whatsapp", "facebook", "grup", "поделит", "отправить объявл", "групп"] },
  { id: "account_delete", keys: ["sterg contul", "stergere cont", "datele mele", "удалить аккаунт", "мои данные"] },
  { id: "search", keys: ["caut", "filtr", "salvat", "salvez", "найти", "поиск", "фильтр", "сохран"] },
  { id: "hello", keys: ["salut", "buna", "bună", "hello", "hi ", "hey", "привет", "здравств", "добрый"] },
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

const SYSTEM_FACTS = `You are the official support assistant for Rabotaem.md, a free job board for all of Moldova (every raion and village, not just Chișinău). Slogan: «lucru pe loc. bani pe loc.» Many users are older people on phones: be very clear and practical.

TONE: polite, clear, concise. Short paragraphs (2–5 sentences) or short bullet steps. No markdown headings, no tables. Name the exact buttons and menu items. Never invent features.

ALWAYS reply only in the language specified below. Brand names stay as-is: Rabotaem.md, Google, Telegram, Viber.

FACTS — never contradict:
- MONEY_MODE_FACT
- Rabotaem.md is ONLY an ads platform. Not an employer, not an agency, not a party to any agreement. Pay, time, place and conditions are agreed directly between users and paid directly between them. Not responsible for payments, work quality, safety or disputes. Say this clearly when asked about money, quality, conflicts or liability.
- Two kinds of listings, in separate lists: Lucru rapid / kalîm (short job of hours or a day, with start date and time, duration, number of people, pay in MDL on the spot; home page) and Angajare oficială (company job with monthly salary range, schedule, city, contract type, responsibilities, requirements, offer; page «Angajare»).
- Account: sign up with Google or email (no other providers). Phone must be verified once before posting or applying: via Telegram bot @RabotaemMdBot (free, no code, share contact) or SMS code. One phone number per account. Phone is never public; it is shown only to the person you work with.
- Forgot password: «Ai uitat parola?» → reset via Telegram link or SMS code to the account's phone. Resetting signs out other devices.
- Age: account from 16. Kalîm from 16, but heavy physical work (moving, construction) and listings marked «Doar 18+» are 18+ only. Official jobs are 18+ only. Birth year is never shown publicly.
- Post: menu «Postează» → choose type first. Kalîm: optional template (Mutare/hamali, Descărcat marfă, Curățenie după renovare, Curățenie apartament, Cosit iarbă, Tăiat lemne, Ajutor la construcție, Săpat grădina), title, description, category, raion, locality, optional exact map pin (visible only to selected workers), pay, duration, people, start date and time in the future. Official: company, title, description, salary from–to or negotiable, schedule, contract, openings, responsibilities, requirements, offer, experience, education, languages, address, HR name. Live immediately. Limit: 3 listings per 2 hours. Captcha.
- After publishing: a box suggests sharing to Viber, Telegram, WhatsApp, Facebook; every listing has «Distribuie» with those buttons; shared links show a preview image (title, pay, place).
- Kalîm categories: Mutări & Transport; Curățenie; Construcții & muncă fizică; Grădinărit & exterior; Ajutor casnic; Altele.
- Apply: open a listing → «Aplică». Kalîm: short message. Official: send a CV (built on the site in «CV-ul meu», 6 steps, or an uploaded PDF/Word/photo file). Only the company applied to sees the CV. Withdraw with «Nu mai pot veni». Applicants see answers in «Aplicații» → «La care am aplicat».
- Choosing people: «Aplicații» → «Primite». Tap a name: big buttons «Sună» (call), «Selectează» (green; person gets a notification and sees the poster's phone), «Refuză» (red, with confirmation; person is notified). Slots counter shows how many places are filled; you cannot select more than needed. Official jobs: invite to interview (date + message), mark «Angajat», private notes.
- Manage a listing: «Aplicații» → «Gestionează anunțul»: mark done, cancel, delete permanently (also deletes applications), reactivate an expired one with a new date, «Repostează» (copy into a new listing; also in «Contul meu» → anunțurile mele and on the listing page).
- Kalîm listings expire automatically when their start time passes. Filters: Azi, Urgent (24h), 3 ore. Ready pages: Lucru azi, În weekend, Cu plata zilnică, Fără experiență, Pentru studenți.
- Alerts: «Contul meu» → «Alertele mele»: raion, categories, kind; browser push or Telegram, a few per day plus an evening digest.
- Company page: «Pagina firmei» (name, city, description, site), public, shown on official listings; verified companies get a check mark.
- Ratings: after the job is marked done, both sides can leave 1–5 stars and a comment; shown on public profiles.
- Safety: never pay money upfront; honest employers never charge for hiring, training or documents. «Raportează» on listings and profiles (reasons include «Cere bani în avans»); the team reviews and replies. Users can also block others.
- Contact page for human support. Delete account: «Contul meu» → «Șterge contul». Privacy questions: tokimidoofficial@gmail.com.
- The site works in Romanian and Russian (also English).

There is NO in-app chat between users: people talk by phone. Do not offer to process payments, mediate disputes or contact other users. If the question is unrelated to Rabotaem.md, politely say you only help with this platform and list a few topics you can explain.`;

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
    // Every Grok call costs money: cap it per IP. Over the cap, answer locally.
    try {
      const { assertRateLimit } = await import("./rate-limit.server");
      await assertRateLimit("assistant", 30, 60);
    } catch {
      return { ok: true as const, text: fallback, source: "local" as const };
    }
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
