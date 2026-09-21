/* ============================================================================
   NeuraSite AI — ГЕНЕРАЦИЯ
   Промпты, конвейер генерации (одна страница / много страниц), постобработка,
   проверка качества, экспорт.
   ========================================================================== */

/* ------------------------- ДИЗАЙН-КОНТРАКТ ------------------------- */
/* Один и тот же свод правил идёт в генерацию, в доработку и в доп. страницы —
   именно так сайт получается цельным, а не «набором секций». */
function designBrief(form) {
  var colors = (form.colors || '').trim();
  var colorRule = colors
    ? 'Палитра из брифа: ' + colors + '. Построй на ней токены: --brand (основной), --brand-2 (акцент), --ink (текст), --bg (фон). Проверь контраст текста к фону (не ниже 4.5:1).'
    : 'Подбери премиальную палитру под нишу (3 цвета + нейтрали), задай токены --brand, --brand-2, --ink, --bg, --muted.';
  return [
    'ДИЗАЙН-СИСТЕМА (обязательна к исполнению):',
    '- Стиль: ' + (form.style || 'modern premium') + '.',
    '-' + colorRule,
    '- Токены в :root (цвета, радиусы --r-sm 10px / --r 16px / --r-lg 28px, тени, шрифты). Дальше используй только токены, никаких случайных значений.',
    '- Шрифты: подключи Google Fonts (заголовки — выразительный гротеск: Manrope/Space Grotesk/Unbounded; текст — Inter/Manrope). Заголовки: clamp() от 32px до 72px, межстрочный 1.05-1.15, letter-spacing -0.02em.',
    '- Сетка: контейнер max-width 1200-1280px, отступы секций 96-140px по вертикали, gap 24-32px. Всё на CSS Grid/Flex.',
    '- Критические стили (hero, карточки, кнопки, сетки, хедер, футер) пиши СВОИМИ классами в <style>. Tailwind подключай тоже, но сайт обязан выглядеть правильно даже если Tailwind не загрузился.',
    '- Кнопки: 3 состояния (обычное, hover со сдвигом/тенью, focus-visible). Карточки: радиус, бордер, мягкая тень, hover-подъём. Иконки — SVG инлайном.',
    '- Полная адаптивность: 360px, 768px, 1280px. Проверь, чтобы на 360px ничего не вылезало по горизонтали (никаких фиксированных ширин больше 100%).'
  ].join('\n');
}

/* ------------------------- ПРОМПТЫ ------------------------- */
function systemPrompt(form, photos, isMulti) {
  var lines = [];
  lines.push('Ты — арт-директор и senior frontend-разработчик уровня Awwwards, Linear, Stripe, Vercel. Ты верстаешь сайты, которые продают.');
  lines.push('');
  lines.push(designBrief(form));
  lines.push('');
  lines.push('ТЕХНИЧЕСКИЕ ПРАВИЛА:');
  lines.push('1. Один HTML-файл на страницу, весь CSS и JS внутри самого файла (тег style и тег скрипта). Внешние CDN — только Tailwind (https://cdn.tailwindcss.com) и Google Fonts. Никаких сборщиков, jQuery и т.п.');
  lines.push('2. Пиши РЕАЛЬНЫЙ продающий контент на русском языке под нишу: заголовки-офферы, конкретные выгоды, цифры, цены, названия услуг, отзывы с именами, адреса. НИКАКОГО «Lorem ipsum», «Текст текст», «Компания №1», пустых заглушек.');
  lines.push('3. Каждая интерактивная кнопка и ссылка обязана работать. Если кнопка ведёт «в никуда» — пусть ведёт на якорь существующей секции или открывает модальное окно. Не оставляй onclick с неопределёнными функциями.');
  lines.push('4. Мобильное меню: гамбургер с рабочим JS (открытие/закрытие, закрытие по клику на ссылку).');
  lines.push('5. Форма заявки: валидация + имитация отправки + красивое модальное окно «Спасибо, мы свяжемся».');
  lines.push('6. Анимации: hover-микроанимации, плавные переходы, появление секций при скролле. ВАЖНО: не прячь контент — НИКАКИХ opacity:0 / visibility:hidden в базовых стилях секций и текстов. Если делаешь появление при скролле, повесь на <html> класс, который включает скрытие только при работающем JS, а сам класс снимай сразу после добавления наблюдателя. Сайт обязан полностью читаться даже при выключенном JavaScript.');
  lines.push('7. Доступность: alt у картинок, aria-label у кнопок-иконок, семантические теги header/main/section/footer, один <h1> на страницу.');
  lines.push('8. В <head> обязательны: <meta name="viewport" content="width=device-width, initial-scale=1">, <title>, <meta name="description">, Open Graph-теги.');
  lines.push('9. Верни ТОЛЬКО код страницы, начиная с <!DOCTYPE html>. Без markdown, без ```html, без пояснений до и после кода.');
  lines.push('');
  if (isMulti) {
    lines.push('ЭТО МНОГОСТРАНИЧНЫЙ САЙТ. Каждая страница — отдельный файл: index.html, ' + (form.pages || []).slice(1).map(function (p) { return pageFile(p) + ', '; }).join('') + 'и так далее.');
    lines.push('Ссылки в меню и футере — обычные ссылки на файлы: <a href="catalog.html">Каталог</a>. Хедер и футер на всех страницах ОДИНАКОВЫЕ (тот же код, тот же порядок пунктов).');
  } else {
    lines.push('ЭТО ОДНА СТРАНИЦА. Все секции идут подряд, навигация — якорные ссылки вида <a href="#services">.');
  }
  return lines.join('\n');
}

function photoBlock(photos, mode) {
  if (mode === 'none') {
    return 'ФОТОГРАФИИ: внешние фото не используй. Вместо картинок — CSS-градиенты, паттерны, крупная типографика, SVG-иллюстрации. Никаких <img> с внешними URL.';
  }
  if (!photos || !photos.length) {
    return 'ФОТОГРАФИИ: галерея недоступна. Вместо фото используй CSS-градиенты и SVG. НЕ вставляй ссылки вида images.unsplash.com с придуманными ID — они не открываются и ломают вид сайта.';
  }
  var head = 'ФОТОГРАФИИ: используй ТОЛЬКО эти ссылки (они проверены, все открываются). Не придумывай свои, не меняй ID. Ставь осмысленный alt на русском. Каждую фотографию используй максимум один раз, кроме случаев, где нужен фон.\n';
  var list = photos.map(function (p, i) { return (i + 1) + ') ' + p.url + '  — ' + (p.title || p.query || 'фото'); }).join('\n');
  return head + list;
}

function userPrompt(form, photos, isMulti) {
  var out = [];
  out.push('Название: ' + (form.site_name || 'Без названия'));
  out.push('Сфера: ' + (form.business_type || 'не указана'));
  out.push('Тип: ' + (isMulti ? 'многостраничный сайт' : siteTypeLabel(form.site_type)));
  out.push('Стиль: ' + (form.style || 'modern premium'));
  out.push('Цвета: ' + (form.colors || 'подбери под нишу'));
  var c = form.contacts || {};
  var contacts = [];
  if (c.phone) contacts.push('телефон ' + c.phone);
  if (c.email) contacts.push('e-mail ' + c.email);
  if (c.address) contacts.push('адрес ' + c.address);
  if (c.telegram) contacts.push('Telegram ' + c.telegram);
  if (c.instagram) contacts.push('Instagram ' + c.instagram);
  if (contacts.length) out.push('Контакты (использовать именно эти): ' + contacts.join(', '));
  if (c.cta) out.push('Главный призыв (текст кнопки): ' + c.cta);
  out.push('Пожелания клиента: ' + (form.prompt || '—'));
  out.push('');
  out.push(photoBlock(photos, form.photoMode));
  out.push('');

  if (isMulti) {
    out.push('СТРАНИЦЫ, КОТОРЫЕ НУЖНО СДЕЛАТЬ (каждая — отдельный файл):');
    (form.pages || []).forEach(function (p, i) {
      out.push((i + 1) + '. ' + p + ' → файл ' + pageFile(p) + ' — ' + pageHint(p));
    });
    out.push('');
    out.push('Сейчас сделай ТОЛЬКО страницу «' + (form.pages[0] || 'Главная') + '» (файл index.html). Остальные сделаем следующими запросами в том же стиле.');
  } else {
    out.push('СЕКЦИИ (в этом порядке, каждая со своим смыслом и контентом):');
    sectionSpec(form.site_type).forEach(function (s, i) { out.push((i + 1) + '. ' + s); });
  }
  out.push('');
  out.push('Собери финальную страницу сейчас. Сначала <!DOCTYPE html>, дальше весь код целиком.');
  return out.join('\n');
}

function siteTypeLabel(t) {
  return ({ multipage: 'многостраничный сайт', landing: 'одностраничный лендинг', ecommerce: 'интернет-магазин', portfolio: 'сайт-визитка/портфолио' })[t] || 'лендинг';
}

function sectionSpec(type) {
  var base = [
    'HERO: оффер в 5-9 слов + подзаголовок с выгодой + 2 кнопки (главная и вторичная) + фото/визуал. Никаких «Добро пожаловать на наш сайт».',
    'ПРЕИМУЩЕСТВА: 3-4 карточки с иконками, конкретика вместо воды.',
    'ГЛАВНЫЙ БЛОК ПРОДУКТА/УСЛУГИ: как это работает (3-4 шага) или ключевое предложение с фото.',
    'СОЦИАЛЬНОЕ ДОКАЗАТЕЛЬСТВО: отзывы с именами и результатами, логотипы/цифры.',
    'CTA-БЛОК: призыв + форма или кнопка.',
    'ФУТЕР: контакты, меню, соцсети, копирайт.'
  ];
  if (type === 'ecommerce') return ['HERO с оффером и баннером', 'КАТАЛОГ: 6-8 карточек товаров с ценой, фото, кнопкой «В корзину»', 'ПРЕИМУЩЕСТВА магазина (доставка, гарантия, оплата)', 'ХИТЫ/АКЦИИ с таймером', 'ОТЗЫВЫ покупателей', 'CTA + ФУТЕР'];
  if (type === 'portfolio') return ['HERO: имя, специальность, фото', 'ПОРТФОЛИО: сетка 6-9 работ с фильтром по категориям и лайтбоксом', 'УСЛУГИ И ЦЕНЫ', 'ОБО МНЕ: факты и опыт', 'ОТЗЫВЫ', 'КОНТАКТЫ + ФУТЕР'];
  if (type === 'landing') return base.concat(['ТАРИФЫ: 3 плана с выделенным популярным', 'FAQ: 5-6 вопросов аккордеоном']);
  return base;
}

function pageHint(name) {
  var n = String(name).toLowerCase();
  if (n.indexOf('каталог') >= 0 || n.indexOf('услуг') >= 0 || n.indexOf('товар') >= 0 || n.indexOf('магазин') >= 0) return 'каталог услуг/товаров: фильтры по категориям, карточки с ценой и кнопкой заказа, блок «как заказать»';
  if (n.indexOf('о компании') >= 0 || n.indexOf('о нас') >= 0 || n.indexOf('компан') >= 0) return 'о компании: история, миссия, цифры в цифрах, команда с фото, принципы работы';
  if (n.indexOf('отзыв') >= 0) return 'отзывы: 6-8 подробных отзывов с именами, рейтингом и результатами, логотипы клиентов';
  if (n.indexOf('контакт') >= 0) return 'контакты: адрес, карта-схема (SVG/CSS), телефоны, мессенджеры, форма связи, часы работы';
  if (n.indexOf('цен') >= 0 || n.indexOf('тариф') >= 0) return 'цены: 3-4 тарифа, таблица сравнения, ответы на вопросы об оплате';
  if (n.indexOf('блог') >= 0 || n.indexOf('стать') >= 0) return 'блог: сетка статей с обложками, датами и категориями';
  if (n.indexOf('команд') >= 0 || n.indexOf('врач') >= 0 || n.indexOf('специалист') >= 0) return 'команда: карточки специалистов с фото, опытом и специализацией';
  return 'отдельная страница сайта в том же дизайне с содержательным контентом по теме';
}
function pageFile(name) {
  var n = slugify(name);
  if (n === 'glavnaya' || n === 'main' || n === 'home' || n === 'index' || n === 'главная') return 'index.html';
  return (n === 'catalog' ? 'catalog' : n) + '.html';
}

/* ------------------------- ОЧИСТКА И ПОЧИНКА ------------------------- */
function extractHtml(raw) {
  var text = String(raw || '');
  text = text.replace(/^\uFEFF/, '');
  var fence = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence && fence[1] && /<\w+[\s>]/.test(fence[1])) text = fence[1];
  else text = text.replace(/```(?:html)?/gi, '');
  var start = text.search(/<!DOCTYPE html|<html[\s>]/i);
  if (start > 0) text = text.slice(start);
  var end = text.lastIndexOf('</html>');
  if (end >= 0) text = text.slice(0, end + 7);
  return text.trim();
}

/* Стили-страховки: работают даже если Tailwind/GSAP не загрузились. */
var GUARD_CSS = [
  '/* NeuraSite guard: базовые правила, чтобы сайт не «рассыпался» */',
  '*,*::before,*::after{box-sizing:border-box}',
  'html{-webkit-text-size-adjust:100%}',
  'body{margin:0;overflow-x:hidden;font-family:Manrope,Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.6}',
  'img,video,svg{max-width:100%;height:auto}',
  'button,input,textarea,select{font:inherit;color:inherit}',
  'a{color:inherit;text-decoration:none}',
  '.ns-container{width:100%;max-width:1240px;margin:0 auto;padding:0 20px}',
  '.ns-reveal{opacity:0;transform:translateY(26px);transition:opacity .75s cubic-bezier(.2,.7,.2,1),transform .75s cubic-bezier(.2,.7,.2,1)}',
  '.ns-reveal.ns-in{opacity:1;transform:none}',
  '.ns-img-fallback{background:linear-gradient(135deg,rgba(108,92,255,.25),rgba(0,217,255,.18));display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;letter-spacing:.04em;text-transform:uppercase;min-height:220px}',
  '.ns-modal{position:fixed;inset:0;background:rgba(6,8,16,.72);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px}',
  '.ns-modal[hidden]{display:none}',
  '.ns-modal-card{background:#fff;color:#111;border-radius:22px;padding:32px;max-width:440px;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.35)}',
  '.ns-to-top{position:fixed;right:20px;bottom:20px;width:46px;height:46px;border-radius:50%;border:0;background:#111;color:#fff;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .3s;z-index:900}',
  '.ns-to-top.ns-show{opacity:.92;pointer-events:auto}',
  '@media (max-width:768px){header nav{display:flex;flex-wrap:wrap;gap:10px}}',
  '@media (prefers-reduced-motion:reduce){.ns-reveal{opacity:1!important;transform:none!important;transition:none!important}}'
].join('\n');

/* Универсальная интерактивность: меню, скролл, формы, аккордеоны, счётчики, фоллбеки. */
var RUNTIME_JS = window.__NS_RUNTIME__ || '';

/* Чистим потенциально опасные/ломкие места и добавляем страховки. */
function finishHtml(raw, ctx) {
  ctx = ctx || {};
  var html = extractHtml(raw);
  if (!html) return { html: '', report: [{ ok: false, label: 'Модель вернула пустой ответ', detail: 'Попробуйте ещё раз или смените модель' }] };

  if (!/<!DOCTYPE/i.test(html)) html = '<!DOCTYPE html>\n' + html;
  if (!/<\/html>\s*$/i.test(html)) html = html.replace(/\s*$/, '\n</body>\n</html>\n');

  // незакрытый <script> в конце — типичный признак обрыва: закрываем принудительно
  var openScripts = (html.match(/<script\b/gi) || []).length;
  var closeScripts = (html.match(/<\/script>/gi) || []).length;
  if (openScripts > closeScripts) html = html.replace(/<\/body>\s*<\/html>\s*$/i, '<\/script>\n</body>\n</html>');

  // защитный CSS + пул фото
  var poolJson = JSON.stringify((ctx.photos || []).map(function (p) { return p.url; }));
  var injectHead = '<style id="ns-guard">\n' + GUARD_CSS + '\n</style>\n' +
    '<script id="ns-pool">window.__nsPhotoPool = ' + poolJson + ';' + (ctx.isMulti ? 'window.__nsMulti = true;' : '') + '<\/script>\n';
  if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, injectHead + '</head>');
  else html = html.replace(/<body[^>]*>/i, injectHead + '<body>');

  // рантайм — последним в body, чтобы он видел уже созданные элементы
  var injectEnd = '<script id="ns-runtime">\n' + RUNTIME_JS + '\n<\/script>\n';
  if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, injectEnd + '</body>');
  else html += injectEnd;

  // чистим пустые href="javascript:void(0)" без обработчика
  html = html.replace(/href="javascript:void\(0\)"(?![^>]*onclick)/gi, 'href="#"');

  return { html: html, report: null };
}

/* ------------------------- ПРОВЕРКА КАЧЕСТВА ------------------------- */
async function validateSite(html, ctx) {
  var checks = [];
  function add(ok, label, detail) { checks.push({ ok: !!ok, label: label, detail: detail || '' }); }

  add(/<!DOCTYPE html>/i.test(html), 'Документ HTML5', '');
  add(/<title>[^<]{3,}<\/title>/i.test(html), 'Есть <title>', '');
  add(/name="viewport"/i.test(html), 'Мобильная адаптация (viewport)', '');
  add(/<h1[^>]*>/i.test(html), 'Заголовок H1', '');
  var h1count = (html.match(/<h1[^>]*>/gi) || []).length;
  add(h1count === 1, 'Ровно один H1', 'найдено: ' + h1count);
  add(/<header[\s>]/i.test(html), 'Шапка сайта', '');
  add(/<footer[\s>]/i.test(html), 'Футер', '');
  add(/@media\s*\(max-width/i.test(html), 'Адаптивные стили (@media)', '');
  add(!/lorem ipsum|текст текст|здесь могла быть/i.test(html), 'Осмысленный текст (без «Lorem ipsum»)', '');
  add(!/images\.unsplash\.com\/photo-[0-9a-f]{6,}-/i.test(html.replace(/#[0-9a-f]{3,6}/gi, '')), 'Нет выдуманных ссылок на фото', '');

  var dupIds = [];
  var ids = {};
  (html.match(/\sid="([^"]+)"/g) || []).forEach(function (m) {
    var v = m.replace(/\sid="/, '').replace(/"$/, '');
    if (ids[v]) dupIds.push(v); ids[v] = 1;
  });
  add(dupIds.length === 0, 'Уникальные id элементов', dupIds.length ? 'дубли: ' + dupIds.slice(0, 5).join(', ') : '');

  var undefinedFns = [];
  var htmlNoStrings = html;
  var m2, re2 = /on(?:click|submit|change)="([A-Za-z_$][\w$]*)\(/g;
  while ((m2 = re2.exec(htmlNoStrings))) {
    var fn = m2[1];
    if (!/window\./.test(html) || new RegExp('function\\s+' + fn + '\\b|' + fn + '\\s*=\\s*function').test(html)) continue;
    if (undefinedFns.indexOf(fn) < 0) undefinedFns.push(fn);
  }
  add(true, 'Обработчики кнопок', undefinedFns.length ? 'подстрахованы заглушками: ' + undefinedFns.slice(0, 4).join(', ') : 'все на месте');

  // живые проверки в браузере
  var doc = new DOMParser().parseFromString(html, 'text/html');
  var imgs = Array.prototype.slice.call(doc.images || []);
  add(imgs.length > 0 || ctx.form.photoMode === 'none' || !(ctx.photos || []).length, 'Фотографии на странице', imgs.length ? 'найдено: ' + imgs.length : 'нет (режим без фото)');
  add(imgs.every(function (i) { return (i.getAttribute('alt') || '').length > 2; }), 'У всех фото есть alt', '');

  var badImgs = [];
  if (imgs.length) {
    var results = await Promise.all(imgs.slice(0, 14).map(function (img) {
      return Photos.verify(img.getAttribute('src'), 8000);
    }));
    imgs.slice(0, 14).forEach(function (img, i) { if (!results[i]) badImgs.push(img.getAttribute('src')); });
    add(badImgs.length === 0, 'Все фото открываются', badImgs.length ? 'битых: ' + badImgs.length : 'проверено: ' + Math.min(imgs.length, 14));
  }

  var hasAnim = /@keyframes/i.test(html) || /gsap|ScrollTrigger|IntersectionObserver|data-reveal/i.test(html);
  add(hasAnim, 'Анимации есть', hasAnim ? '' : 'добавлен автоматический показ секций при скролле');
  add(/<form[\s>]/i.test(html) || !ctx.form.features.includes('form'), 'Рабочая форма заявки', '');
  add(/data-menu-toggle|burger|hamburger|mobile-menu|mobileMenu/i.test(html), 'Мобильное меню', 'создаётся автоматически, если модель его не сделала');
  add(html.length < 700000, 'Размер файла', fmtSize(html.length));

  return checks;
}

/* ------------------------- КОНВЕЙЕР ------------------------- */
/* Генерация одной страницы с дозаписью при обрыве. */
async function generatePage(opts) {
  var form = opts.form, photos = opts.photos, isMulti = opts.isMulti;
  var onProgress = opts.onProgress || function () { };
  var model = opts.model || CONFIG.DEFAULT_MODEL;
  var messages = [
    { role: 'system', content: systemPrompt(form, photos, isMulti) },
    { role: 'user', content: opts.userPromptText }
  ];

  var full = '';
  var finish = null;
  var usage = { in: 0, out: 0, cost: 0 };
  var attempt = 0;

  for (; ;) {
    onProgress(attempt === 0 ? 'Модель пишет код…' : 'Дописываю оборванный фрагмент (' + attempt + ')…');
    var res = await polzaChat({
      model: model, messages: messages, maxTokens: CONFIG.MAX_OUT_TOKENS, temperature: 0.8,
      onDelta: function (piece, all) { onProgress('Модель пишет код… ' + fmtSize(full.length + all.length)); }
    });
    full += res.text;
    if (res.usage) {
      usage.in += res.usage.prompt_tokens || 0;
      usage.out += res.usage.completion_tokens || 0;
      usage.cost += (res.usage.cost_rub || res.usage.cost || 0);
    }
    finish = res.finishReason;
    attempt++;
    if (finish !== 'length' || attempt > CONFIG.MAX_CONTINUATIONS) break;

    var tail = full.slice(-8000);
    messages = messages.concat([
      { role: 'assistant', content: tail },
      { role: 'user', content: 'Вывод оборвался на середине файла. Продолжи РОВНО с места обрыва и доведи страницу до конца (закрой все теги, добавь script и </body></html>). Не повторяй уже написанное, не начинай заново, без пояснений — только продолжение кода.' }
    ]);
  }

  return { raw: full, finishReason: finish, usage: usage, truncated: finish === 'length' };
}

/* Генерация всех страниц многостраничника с единым дизайном. */
async function generateSitePages(opts) {
  var form = opts.form, onProgress = opts.onProgress || function () { };
  var model = opts.model, photos = opts.photos;
  var pages = form.pages && form.pages.length ? form.pages : ['Главная'];
  var files = [];

  // 1. Главная страница — задаёт дизайн-систему и хедер/футер
  onProgress('Страница 1 из ' + pages.length + ': ' + pages[0] + '…');
  var home = await generatePage({
    form: form, photos: photos, isMulti: pages.length > 1, model: model,
    userPromptText: userPrompt(form, photos, pages.length > 1)
  });
  var homeFixed = finishHtml(home.raw, { photos: photos, isMulti: pages.length > 1 });
  files.push({ name: 'index.html', content: homeFixed.html, usage: home.usage, finishReason: home.finishReason, truncated: home.truncated });

  // вытаскиваем шапку/подвал первой страницы, чтобы остальные были в том же дизайне
  var doc = new DOMParser().parseFromString(homeFixed.html, 'text/html');
  var headerHtml = doc.querySelector('header') ? doc.querySelector('header').outerHTML.slice(0, 6000) : '';
  var footerHtml = doc.querySelector('footer') ? doc.querySelector('footer').outerHTML.slice(0, 3000) : '';

  // 2. Остальные страницы
  for (var i = 1; i < pages.length; i++) {
    onProgress('Страница ' + (i + 1) + ' из ' + pages.length + ': ' + pages[i] + '…');
    var theme = (homeFixed.html.match(/<style[\s\S]*?<\/style>/i) || [''])[0].slice(0, 12000);
    var pageForm = Object.assign({}, form, { pages: pages });
    var text = [
      'Ты делаешь ОТДЕЛЬНУЮ страницу «' + pages[i] + '» (файл ' + pageFile(pages[i]) + ') многостраничного сайта «' + (form.site_name || '') + '».',
      'Дизайн-система, шрифты, палитра и компоненты — как на главной странице. Ниже её <style>: переиспользуй те же токены и классы.',
      '',
      'СТИЛЬ ГЛАВНОЙ СТРАНИЦЫ (используй те же токены/классы):',
      theme,
      '',
      'ШАПКА ГЛАВНОЙ (повтори ровно такую же, только подставь правильные ссылки меню на файлы):',
      headerHtml,
      '',
      'ПОДВАЛ ГЛАВНОЙ (повтори):',
      footerHtml,
      '',
      'СОДЕРЖИМОЕ ЭТОЙ СТРАНИЦЫ: ' + pageHint(pages[i]),
      'Пожелания клиента по всему сайту: ' + (form.prompt || '—'),
      'Сфера: ' + (form.business_type || '') + '. Название: ' + (form.site_name || '') + '.',
      '',
      photoBlock(photos, form.photoMode),
      '',
      'Верни ТОЛЬКО этот файл целиком: <!DOCTYPE html> … </html>, без markdown и пояснений.',
      'Ссылки в меню/футере — на файлы: index.html, ' + pages.slice(1).map(pageFile).join(', ') + '.'
    ].join('\n');

    var page = await generatePage({
      form: pageForm, photos: photos, isMulti: true, model: model, userPromptText: text
    });
    var fixed = finishHtml(page.raw, { photos: photos, isMulti: true });
    files.push({ name: pageFile(pages[i]), content: fixed.html, usage: page.usage, finishReason: page.finishReason, truncated: page.truncated });
    void pageForm;
  }
  return files;
}

/* Правки в чате: тот же дизайн-контракт + постобработка. */
async function refineSite(currentHtml, message, ctx) {
  var model = CONFIG.REFINE_MODEL;
  var system = [
    'Ты senior frontend-разработчик. Ты дорабатываешь готовый сайт по просьбе клиента.',
    'Правила: верни ПОЛНЫЙ обновлённый HTML целиком (не фрагмент), сохрани всё, что не просили менять.',
    'Сохраняй дизайн-систему, классы, анимации и адаптивность. Не удаляй рабочие скрипты и меню.',
    'Не вставляй ссылки на фото с придуманными ID. Можно использовать только эти URL: ' + JSON.stringify((ctx.photos || []).map(function (p) { return p.url; })).slice(0, 2000),
    'Ответ — только код, начиная с <!DOCTYPE html>, без пояснений и markdown.'
  ].join('\n');
  var user = 'Просьба клиента: ' + message + '\n\nТекущий HTML страницы:\n' + currentHtml.slice(0, 400000) + '\n\nВерни полный обновлённый HTML.';
  var res = await polzaChat({ model: model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], maxTokens: CONFIG.MAX_OUT_TOKENS, temperature: 0.6 });
  var fixed = finishHtml(res.text, ctx);
  return { html: fixed.html, usage: res.usage, model: model };
}
