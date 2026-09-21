/* ============================================================================
   NeuraSite AI — ЯДРО
   Конфиг, утилиты, работа с API Polza AI, поиск фотографий, ZIP.
   Все API-форматы проверены живыми запросами 21.09.2026 (см. src/API-NOTES.md).
   ========================================================================== */

/* ----------------------------- КОНФИГ ----------------------------- */
var CONFIG = {
  API: 'https://polza.ai/api/v1',

  // ВЛАДЕЛЕЦ: ключ по умолчанию. Виден всем, кто откроет сайт, — держите на нём мало денег.
  // Ключ владельца. ОСТАВЛЯЙТЕ ПУСТЫМ на публичном сайте: любой посетитель увидит его
  // в исходниках и потратит ваш баланс (так и произошло перед этой правкой).
  // Безопасный путь — запустить generator_server.py: там ключ хранится в переменной окружения.
  OWNER_KEY: '',

  // PIN владельца (снимает тарифы, включает безлимит). Поменяйте на свой.
  OWNER_PINS: ['2323gena', '2323гена', '2323'],

  DEFAULT_MODEL: 'anthropic/claude-sonnet-4.5',
  REFINE_MODEL: 'anthropic/claude-haiku-4.5',

  MAX_OUT_TOKENS: 32000,       // сколько токенов просим за один заход
  MAX_CONTINUATIONS: 3,        // сколько раз дописываем, если модель обрезала ответ
  REQUEST_TIMEOUT_MS: 600000,  // 10 минут на запрос
  IMAGE_POLL_TIMEOUT: 240000,  // 4 минуты на картинку

  LS_KEY: 'ns_polza_key_v2',
  LS_HISTORY: 'ns_history_v2',
  LS_UNSPLASH: 'ns_unsplash_key_v2',
  LS_OWNER: 'ns_owner_v2',
  LS_PHOTOS: 'ns_photo_cache_v2',

  PROXY: null,          // заполняется автоматически, если рядом запущен generator_server.py
  PROXY_PREFIX: '/api/proxy'
};

/* Список моделей — резервный. Рабочий список тянется из /v1/models (он доступен без ключа). */
var MODELS = {
  text: [
    { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', note: 'Лучший для вёрстки и дизайна', rIn: 239.5, rOut: 1202.8, out: 128000, badge: '🔥 Рекомендуем' },
    { id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5', note: 'Новое поколение, 1M контекст', rIn: 235.3, rOut: 1176.7, out: 128000, badge: '💎 Премиум' },
    { id: 'anthropic/claude-haiku-4.5', name: 'Claude Haiku 4.5', note: 'Быстрый и недорогой, для правок', rIn: 50.4, rOut: 50.4, out: 128000, badge: '💬 Правки' },
    { id: 'openai/gpt-5.6-sol-pro', name: 'GPT-5.6 Sol Pro', note: 'Сильная логика и структура', rIn: 117.7, rOut: 588.4, out: 128000, badge: '🧠 Сложные сайты' },
    { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', note: '1M контекст, креатив', rIn: 86.2, rOut: 680.8, out: 65536, badge: '🎨 Креатив' },
    { id: 'deepseek/deepseek-v3.2', name: 'DeepSeek V3.2', note: 'Очень дешёвый, быстрый', rIn: 24.6, rOut: 36.4, out: 147456, badge: '⚡ Экономия' },
    { id: 'qwen/qwen3-coder', name: 'Qwen3 Coder', note: 'Заточен под код, 262k', rIn: 25.9, rOut: 111.8, out: 262144, badge: '💻 Код' },
    { id: 'z-ai/glm-4.7', name: 'GLM 4.7', note: 'Хороший русский, недорого', rIn: 44.7, rOut: 204.7, out: 65536, badge: '🇷🇺 Русский' }
  ],
  image: [
    { id: 'google/gemini-2.5-flash-image', name: 'Nano Banana', note: 'Генерация и правка фото, дешевле всех', per: 2.9, badge: '⚡ Дешево' },
    { id: 'bytedance/seedream-4.5', name: 'Seedream 4.5', note: 'Фотореализм 2K/4K', per: 5.0, badge: '🔥 Фотореализм' },
    { id: 'black-forest-labs/flux.2-pro', name: 'Flux 2 Pro', note: 'Арт и фоны', per: 5.0, badge: '🎨 Арт' },
    { id: 'openai/gpt-image-1.5', name: 'GPT Image 1.5', note: 'Точный текст на картинке', per: 6.0, badge: '🎯 Точность' }
  ]
};

/* ----------------------------- МЕЛОЧИ ----------------------------- */
function $(id) { return document.getElementById(id); }
function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function slugify(s) {
  var map = { 'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya' };
  var out = String(s || '').toLowerCase().split('').map(function (ch) { return map[ch] !== undefined ? map[ch] : ch; }).join('');
  out = out.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return out || 'page';
}
function lsGet(k, def) { try { var v = localStorage.getItem(k); return v === null ? def : v; } catch (e) { return def; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
function lsJson(k, def) { try { return JSON.parse(localStorage.getItem(k) || def); } catch (e) { return def; } }

function toast(text, icon) {
  var t = $('toast'); if (!t) { console.log(icon || '', text); return; }
  $('toastText').textContent = text;
  $('toastIcon').textContent = icon || '✦';
  t.classList.remove('hidden');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(function () { t.classList.add('hidden'); }, 4000);
}

function fmtRub(v) { return (Math.round(v * 100) / 100).toFixed(2) + ' ₽'; }
function fmtSize(chars) { return (chars / 1024).toFixed(1) + ' KB'; }

/* ----------------------------- КЛЮЧ ----------------------------- */
function getKey() {
  var fromInput = ($('polzaKey') && $('polzaKey').value || '').trim();
  return fromInput || lsGet(CONFIG.LS_KEY, '') || CONFIG.OWNER_KEY || '';
}
function isOwnKey() {
  var k = getKey();
  return !!k && k !== CONFIG.OWNER_KEY;
}
function saveKeyValue(k) {
  k = (k || '').trim();
  if (!k) { toast('Вставь ключ Polza AI', '🔑'); return false; }
  if (!/^(pza_|sk-)/.test(k)) { toast('Ключ Polza начинается с pza_ (старые — sk-)', '⚠️'); return false; }
  lsSet(CONFIG.LS_KEY, k);
  ['polzaKey', 'polzaKeyMobile', 'keyModalInput'].forEach(function (id) { if ($(id)) $(id).value = k; });
  updateKeyUI();
  toast('Ключ сохранён', '✅');
  return true;
}
function updateKeyUI() {
  var pill = $('keyPill'); if (!pill) return;
  var mine = isOwnKey();

  // работа через сервер: ключ вообще не покидает сервер
  if (typeof isProxied === 'function' && isProxied()) {
    pill.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold border bg-[#00D9FF]/15 border-[#00D9FF]/40 text-[#00D9FF]';
    pill.textContent = '🛡 сервер';
    pill.title = 'Запросы идут через серверную часть: ключ Polza не виден посетителям. Ограничений по тратам нет.';
    return;
  }

  pill.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold border ' +
    (mine ? 'bg-[#00D492]/15 border-[#00D492]/40 text-[#00D492]' : 'bg-[#FFE17B]/15 border-[#FFE17B]/40 text-[#FFE17B]');
  pill.textContent = mine ? '🔑 мой ключ' : '🔑 ключ не задан';
  pill.title = mine ? 'Генерация идёт на вашем ключе Polza AI — он хранится только в вашем браузере.'
                    : 'Нажмите, чтобы вставить свой ключ Polza AI. Без него генерация недоступна.';
}

/* ----------------------------- БЭКЕНД (необязательно) ----------------------------- */
/* Если генератор открыт через generator_server.py, все запросы идут через него:
   ключ остаётся на сервере и не виден посетителям. На GitHub Pages прокси нет — работаем напрямую. */
async function detectProxy() {
  try {
    var res = await fetch('/health', { cache: 'no-store' });
    if (!res.ok) return null;
    var j = await res.json();
    if (j && j.ok) { CONFIG.PROXY = ''; return j; }
  } catch (e) { }
  return null;
}
function proxyUrl(path) { return CONFIG.PROXY === null ? null : CONFIG.PROXY + path; }
function proxyHeaders() {
  var h = { 'Content-Type': 'application/json' };
  if (isOwnKey()) h['X-Polza-Key'] = getKey();   // свой ключ уходит на сервер и используется вместо серверного
  return h;
}
function isProxied() { return CONFIG.PROXY !== null; }

/* ----------------------------- API POLZA ----------------------------- */

function polzaHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getKey() };
}
function polzaError(status, body) {
  var msg = '';
  try { var j = JSON.parse(body); msg = (j.error && (j.error.message || j.error.code)) || j.message || ''; } catch (e) { msg = String(body || '').slice(0, 200); }
  return new Error('Polza API ' + status + (msg ? ': ' + msg : ''));
}

/* Чат с потоковой отдачей. Возвращает {text, finishReason, usage, provider}. */
async function polzaChat(opts) {
  var model = opts.model, messages = opts.messages;
  var maxTokens = opts.maxTokens || CONFIG.MAX_OUT_TOKENS;
  var temperature = opts.temperature == null ? 0.7 : opts.temperature;
  var onDelta = opts.onDelta, signal = opts.signal;
  var stream = opts.stream !== false;

  var body = { model: model, messages: messages, max_tokens: maxTokens, temperature: temperature, stream: stream };
  if (stream) body.stream_options = { include_usage: true };

  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort('timeout'); }, opts.timeout || CONFIG.REQUEST_TIMEOUT_MS);
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener('abort', function () { ctrl.abort(); });
  }

  var url = proxyUrl(CONFIG.PROXY_PREFIX + '/chat/completions') || (CONFIG.API + '/chat/completions');
  var headers = isProxied() ? proxyHeaders() : polzaHeaders();
  var res;
  try {
    res = await fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body), signal: ctrl.signal });
  } catch (e) {
    clearTimeout(timer);
    if (String(e && e.name) === 'AbortError') throw new Error('Превышено время ожидания ответа модели (10 минут). Попробуйте модель побыстрее или короче описание.');
    throw new Error('Нет связи с Polza AI: ' + (e && e.message ? e.message : e));
  }
  if (!res.ok) { var b = await res.text(); clearTimeout(timer); throw polzaError(res.status, b); }

  // Без потока — просто JSON
  if (!stream || !res.body) {
    var j = await res.json(); clearTimeout(timer);
    var ch = (j.choices || [])[0] || {};
    return { text: (ch.message && ch.message.content) || '', finishReason: ch.finish_reason || null, usage: j.usage || null, provider: j.provider || null };
  }

  var reader = res.body.getReader(), dec = new TextDecoder('utf-8');
  var buf = '', text = '', finish = null, usage = null, provider = null;
  try {
    for (; ;) {
      var step = await reader.read();
      if (step.done) break;
      buf += dec.decode(step.value, { stream: true });
      var nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        var line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line || line.charAt(0) === ':') continue;
        if (line.indexOf('data:') !== 0) continue;
        var payload = line.slice(5).trim();
        if (payload === '[DONE]') continue;
        var chunk;
        try { chunk = JSON.parse(payload); } catch (e) { continue; }
        if (chunk.provider) provider = chunk.provider;
        var c0 = (chunk.choices || [])[0] || {};
        var d = c0.delta || {};
        if (typeof d.content === 'string' && d.content) {
          text += d.content;
          if (onDelta) { try { onDelta(d.content, text); } catch (e) { } }
        }
        if (c0.finish_reason) finish = c0.finish_reason;
        if (chunk.usage) usage = chunk.usage;
      }
    }
  } finally { clearTimeout(timer); }
  return { text: text, finishReason: finish, usage: usage, provider: provider };
}

/* Каталог моделей: доступен без ключа, поэтому цены/лимиты всегда актуальные. */
async function polzaModels() {
  if (window.__modelsCache && Date.now() - window.__modelsCache.at < 3600000) return window.__modelsCache.data;
  var res = await fetch(proxyUrl(CONFIG.PROXY_PREFIX + '/models') || (CONFIG.API + '/models'));
  if (!res.ok) throw polzaError(res.status, await res.text());
  var j = await res.json();
  var list = (j.data || j || []).map(function (m) {
    var tp = m.top_provider || {};
    var p = tp.pricing || {};
    return {
      id: m.id, name: m.name || m.id, type: m.type || 'chat',
      ctx: tp.context_length || null, out: tp.max_completion_tokens || null,
      rIn: p.prompt_per_million ? parseFloat(p.prompt_per_million) : null,
      rOut: p.completion_per_million ? parseFloat(p.completion_per_million) : null,
      per: p.per_request ? parseFloat(p.per_request) : null
    };
  });
  window.__modelsCache = { at: Date.now(), data: list };
  return list;
}

async function polzaBalance() {
  var res = await fetch(proxyUrl(CONFIG.PROXY_PREFIX + '/balance') || (CONFIG.API + '/balance'),
    { headers: isProxied() ? proxyHeaders() : { 'Authorization': 'Bearer ' + getKey() } });
  if (!res.ok) throw polzaError(res.status, await res.text());
  var j = await res.json();
  return { available: parseFloat(j.available || j.amount || 0), spent: parseFloat(j.spentAmount || 0) };
}

/* Ожидание результата генерации картинки: POST возвращает id, результат забираем опросом. */
async function polzaWaitMedia(id, onTick) {
  var t0 = Date.now();
  while (Date.now() - t0 < CONFIG.IMAGE_POLL_TIMEOUT) {
    await sleep(2500);
    var res = await fetch(proxyUrl(CONFIG.PROXY_PREFIX + '/media/' + id) || (CONFIG.API + '/media/' + id),
      { headers: isProxied() ? proxyHeaders() : { 'Authorization': 'Bearer ' + getKey() } });
    if (!res.ok) continue;
    var j = await res.json();
    if (onTick) { try { onTick(j.status, Math.round((Date.now() - t0) / 1000)); } catch (e) { } }
    if (j.status === 'completed') {
      var url = (j.data && j.data[0] && (j.data[0].url || j.data[0])) || j.url || j.content || null;
      if (!url) throw new Error('Генерация завершилась без ссылки на файл');
      return { url: url, cost: (j.usage && j.usage.cost_rub) || 0, raw: j };
    }
    if (j.status === 'failed' || j.status === 'cancelled') {
      throw new Error('Генерация картинки не удалась: ' + JSON.stringify((j.error || {})).slice(0, 160));
    }
  }
  throw new Error('Картинка не дождалась результата (4 минуты)');
}

/* Генерация картинки по описанию. */
async function polzaImage(opts) {
  var model = opts.model || 'google/gemini-2.5-flash-image';
  var prompt = opts.prompt;
  var start = await fetch(proxyUrl(CONFIG.PROXY_PREFIX + '/images/generations') || (CONFIG.API + '/images/generations'), {
    method: 'POST', headers: isProxied() ? proxyHeaders() : polzaHeaders(),
    body: JSON.stringify({ model: model, prompt: prompt, n: 1, size: 'auto', response_format: 'url' })
  });
  if (!start.ok) throw polzaError(start.status, await start.text());
  var j = await start.json();
  var id = j.requestId || j.id || (j.data && j.data[0] && j.data[0].id);
  if (!id) {
    var direct = j.data && j.data[0] && j.data[0].url;
    if (direct) return { url: direct, cost: (j.usage && j.usage.cost_rub) || 0 };
    throw new Error('Не понял ответ генератора картинок: ' + JSON.stringify(j).slice(0, 160));
  }
  return await polzaWaitMedia(id, opts.onTick);
}

/* Правка/ретушь загруженного фото (Photoshop-вкладка). */
async function polzaEditImage(opts) {
  var model = opts.model || 'google/gemini-2.5-flash-image';
  var data = opts.dataUrl;
  var start = await fetch(proxyUrl(CONFIG.PROXY_PREFIX + '/media') || (CONFIG.API + '/media'), {
    method: 'POST', headers: isProxied() ? proxyHeaders() : polzaHeaders(),
    body: JSON.stringify({ model: model, input: { prompt: opts.prompt, images: [{ type: 'base64', data: data }] } })
  });
  if (!start.ok) throw polzaError(start.status, await start.text());
  var j = await start.json();
  var id = j.id || j.requestId;
  if (!id) throw new Error('Не понял ответ медиа-API: ' + JSON.stringify(j).slice(0, 160));
  return await polzaWaitMedia(id, opts.onTick);
}

/* ----------------------------- ФОТОГРАФИИ ----------------------------- */

var NICHE_QUERIES = {
  'IT / SaaS / Стартап': ['startup office team working', 'software developer laptop code', 'business meeting whiteboard', 'abstract technology gradient'],
  'E-commerce / Магазин': ['online shopping delivery boxes', 'product photography studio', 'warehouse logistics shelves', 'customer unboxing parcel'],
  'Ресторан / Кафе': ['coffee shop interior', 'espresso cup barista', 'restaurant table served food', 'fresh bakery pastries'],
  'Клиника / Медицина': ['modern clinic interior', 'doctor patient consultation', 'medical equipment clean room', 'dentist chair office'],
  'Фитнес / Спорт': ['modern gym interior', 'personal trainer workout', 'fitness dumbbells equipment', 'running treadmill gym'],
  'Недвижимость': ['modern apartment interior design', 'luxury house exterior', 'real estate agent handshake keys', 'city residential buildings'],
  'Образование / Курсы': ['students studying classroom', 'laptop online course notebook', 'teacher explaining whiteboard', 'library books reading'],
  'Красота / Салон': ['beauty salon interior', 'hairdresser styling client hair', 'manicure nails closeup', 'cosmetics products flatlay'],
  'Авто / Детейлинг': ['car detailing polishing', 'luxury car showroom', 'auto repair service garage', 'car wash foam'],
  'Юрист / Консалтинг': ['law office interior books', 'business handshake meeting', 'contract documents signing', 'consultant presentation office'],
  'Портфолио / Личный бренд': ['photographer holding camera', 'creative workspace desk', 'professional portrait businessperson', 'designer studio monitor'],
  'Креатив / Агентство / Дизайн': ['creative agency office', 'designer working monitor', 'photo studio lighting setup', 'brainstorming sticky notes']
};
var DEFAULT_QUERIES = ['modern office team meeting', 'business workspace laptop', 'city architecture modern', 'professional portrait business'];

var Photos = {
  memo: lsJson(CONFIG.LS_PHOTOS, '{}'),

  queriesFor(businessType) {
    var key = String(businessType || '').trim();
    if (NICHE_QUERIES[key]) return NICHE_QUERIES[key];
    for (var k in NICHE_QUERIES) { if (k.split(' ')[0] && key.indexOf(k.split(' ')[0]) === 0) return NICHE_QUERIES[k]; }
    return DEFAULT_QUERIES;
  },

  /* Настоящий поиск фотографий. Без ключей и без бэкенда:
     1) Openverse (свободные лицензии, CORS разрешён);
     2) свои ключи Unsplash / Pexels / Pixabay, если пользователь их вставил;
     3) Wikimedia Commons — как запасной вариант.
     Дальше результаты фильтруются от архивных чёрно-белых снимков и сортируются по качеству. */
  ARCHIVE_WORDS: /(18\d\d|19\d\d|20[0-1]\d|archiv|historic|history|engraving|etching|lithograph|drawing|sketch|painting|postcard|poster|stamp|manuscript|museum|memorial|monument|map of|carte|пикант|gravure)/i,
  BAD_TITLE: /(logo|clipart|icon|diagram|chart|screenshot|scan of|document|text|signature|seal|banner of|coat of arms|qr code)/i,

  score(item, query) {
    var sc = 0;
    var t = (String(item.title || '') + ' ' + String(item.tags || '')).toLowerCase();
    var words = query.toLowerCase().split(/\s+/).filter(function (w) { return w.length > 3; });
    var hits = words.filter(function (w) { return t.indexOf(w) >= 0; }).length;
    sc += hits * 3;
    var w = item.width || 0, h = item.height || 0;
    if (w >= 2400) sc += 2; else if (w >= 1400) sc += 1.5; else if (w >= 1000) sc += 0.5; else sc -= 2;
    if (w && h) { var ratio = w / h; if (ratio > 1.2 && ratio < 2.4) sc += 1; if (ratio < 0.75) sc -= 1.5; }
    if (this.ARCHIVE_WORDS.test(t)) sc -= 6;
    if (this.BAD_TITLE.test(t)) sc -= 8;
    if (item.source === 'pexels' || item.source === 'pixabay' || item.source === 'unsplash') sc += 3;
    if (item.source === 'openverse') sc += 1;
    if (item.source === 'commons') sc -= 0.5;
    return sc;
  },

  clean(list, query) {
    var self = this;
    var seen = {}, seenTitles = {};
    return list.filter(function (x) {
      if (!x || !x.url || !/^https:\/\//.test(x.url)) return false;
      var key = x.url.replace(/[?#].*$/, '').toLowerCase();
      var titleKey = String(x.title || '').toLowerCase().replace(/[^a-zа-я0-9]+/g, '').slice(0, 45);
      if (seen[key] || (titleKey && seenTitles[titleKey])) return false;
      seen[key] = 1;
      if (titleKey) seenTitles[titleKey] = 1;
      var t = String(x.title || '') + ' ' + String(x.tags || '');
      if (self.ARCHIVE_WORDS.test(t) || self.BAD_TITLE.test(t)) return false;
      if (x.width && x.height && (x.width < 900 || x.height < 600)) return false;
      if (/\.(svg|gif|tif|tiff)(\?|$)/i.test(x.url)) return false;
      return true;
    }).sort(function (a, b) { return self.score(b, query) - self.score(a, query); });
  },

  async search(query, count) {
    count = count || 8;
    var memoKey = query + '|' + count;
    if (this.memo[memoKey] && Date.now() - this.memo[memoKey].at < 86400000) return this.memo[memoKey].items;

    if (isProxied()) {
      try {
        var sres = await fetch(proxyUrl('/api/photos') + '?q=' + encodeURIComponent(query) + '&count=' + count);
        if (sres.ok) {
          var sj = await sres.json();
          var serverItems = (sj.images || []).map(function (x) { return Object.assign({}, x, { query: query }); });
          if (serverItems.length) {
            this.memo[memoKey] = { at: Date.now(), items: serverItems };
            lsSet(CONFIG.LS_PHOTOS, JSON.stringify(this.memo));
            return serverItems;
          }
        }
      } catch (e) { }
    }

    var bag = [];
    async function tryProvider(name, fn) {
      try { var r = await fn.call(Photos); if (r && r.length) bag = bag.concat(r); } catch (e) { }
    }
    await Promise.all([
      tryProvider('pexels', function () { return this.searchPexels(query, count); }),
      tryProvider('unsplash', function () { return this.searchUnsplash(query, count); }),
      tryProvider('pixabay', function () { return this.searchPixabay(query, count); })
    ]);
    bag = this.clean(bag, query);
    if (bag.length < 3) bag = bag.concat(this.clean(await this.searchOpenverse(query, count).catch(function () { return []; }), query));
    if (bag.length < 3) bag = bag.concat(this.clean(await this.searchCommons(query, count).catch(function () { return []; }), query));
    bag = this.clean(bag.concat([]), query);
    var items = bag.slice(0, count);
    if (items.length) { this.memo[memoKey] = { at: Date.now(), items: items }; lsSet(CONFIG.LS_PHOTOS, JSON.stringify(this.memo)); }
    return items;
  },

  async searchOpenverse(query, count) {
    var url = 'https://api.openverse.org/v1/images/?q=' + encodeURIComponent(query) +
      '&page_size=' + Math.min(20, count * 4) + '&license_type=commercial&mature=false';
    var res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) return [];
    var j = await res.json();
    return (j.results || []).map(function (r) {
      var full = r.url || r.foreign_landing_url;
      return {
        url: full, thumb: r.thumbnail || full,
        title: r.title || query, author: r.creator || '', license: (r.license || '') + ' ' + (r.license_version || ''),
        source: 'openverse', query: query,
        width: r.width || 0, height: r.height || 0,
        tags: (r.tags || []).map(function (t) { return t.name || t; }).join(' ')
      };
    }).filter(function (x) { return x.url; });
  },

  async searchPexels(query, count) {
    var key = (lsGet('ns_pexels_key_v2', '') || '').trim();
    if (!key) return [];
    var res = await fetch('https://api.pexels.com/v1/search?query=' + encodeURIComponent(query) +
      '&per_page=' + count + '&orientation=landscape', { headers: { 'Authorization': key } });
    if (!res.ok) return [];
    var j = await res.json();
    return (j.photos || []).map(function (r) {
      return {
        url: (r.src && (r.src.large2x || r.src.large)) || r.url, thumb: (r.src && r.src.medium) || r.url,
        title: r.alt || query, author: r.photographer || '', license: 'Pexels License',
        source: 'pexels', query: query, width: r.width, height: r.height
      };
    }).filter(function (x) { return x.url; });
  },

  async searchPixabay(query, count) {
    var key = (lsGet('ns_pixabay_key_v2', '') || '').trim();
    if (!key) return [];
    var res = await fetch('https://pixabay.com/api/?key=' + encodeURIComponent(key) + '&q=' + encodeURIComponent(query) +
      '&image_type=photo&orientation=horizontal&safesearch=true&per_page=' + Math.max(3, count));
    if (!res.ok) return [];
    var j = await res.json();
    return (j.hits || []).map(function (r) {
      return {
        url: r.largeImageURL || r.webformatURL, thumb: r.webformatURL,
        title: (r.tags || query), author: r.user || '', license: 'Pixabay License',
        source: 'pixabay', query: query, width: r.imageWidth, height: r.imageHeight
      };
    }).filter(function (x) { return x.url; });
  },

  async searchUnsplash(query, count) {
    var key = (lsGet(CONFIG.LS_UNSPLASH, '') || '').trim();
    if (!key) return [];
    var res = await fetch('https://api.unsplash.com/search/photos?query=' + encodeURIComponent(query) +
      '&per_page=' + count + '&orientation=landscape&client_id=' + encodeURIComponent(key));
    if (!res.ok) return [];
    var j = await res.json();
    return (j.results || []).map(function (r) {
      return {
        url: r.urls && (r.urls.regular || r.urls.full), thumb: r.urls && r.urls.small,
        title: r.alt_description || query, author: r.user && r.user.name, license: 'Unsplash License', source: 'unsplash', query: query
      };
    }).filter(function (x) { return x.url; });
  },

  async searchCommons(query, count) {
    var api = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search' +
      '&gsrsearch=' + encodeURIComponent('filetype:bitmap ' + query) + '&gsrlimit=' + count + '&gsrnamespace=6' +
      '&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1600&format=json&origin=*';
    var res = await fetch(api);
    if (!res.ok) return [];
    var j = await res.json();
    var pages = (j.query && j.query.pages) || {};
    var out = [];
    Object.keys(pages).forEach(function (k) {
      var p = pages[k], ii = (p.imageinfo || [])[0];
      if (!ii) return;
      out.push({
        url: ii.thumburl || ii.url, thumb: ii.thumburl || ii.url,
        title: (p.title || '').replace(/^File:/, ''), author: '', license: 'Wikimedia Commons',
        source: 'commons', query: query
      });
    });
    return out;
  },

  /* Проверяем, что ссылка реально открывается как картинка (в браузере). */
  verify(url, timeoutMs) {
    return new Promise(function (resolve) {
      if (!url) return resolve(false);
      var img = new Image();
      var done = false;
      var t = setTimeout(function () { if (!done) { done = true; img.src = ''; resolve(false); } }, timeoutMs || 9000);
      img.onload = function () { if (!done) { done = true; clearTimeout(t); resolve(img.naturalWidth > 40 && img.naturalHeight > 40); } };
      img.onerror = function () { if (!done) { done = true; clearTimeout(t); resolve(false); } };
      img.src = url;
    });
  },

  /* Собирает набор проверенных фото под нишу: 4 запроса параллельно, отбор по качеству, проверка загрузки. */
  async collect(businessType, want) {
    want = want || 12;
    var queries = this.queriesFor(businessType);
    var self = this;
    var lists = await Promise.all(queries.map(function (q) { return self.search(q, 8).catch(function () { return []; }); }));

    // поочерёдно из каждого запроса — чтобы набор был разнообразным
    var ordered = [];
    var maxLen = Math.max.apply(null, lists.map(function (l) { return l.length; }).concat([0]));
    for (var i = 0; i < maxLen; i++) {
      for (var k = 0; k < lists.length; k++) { if (lists[k][i] && ordered.length < want + 6) ordered.push(lists[k][i]); }
    }
    var checks = await Promise.all(ordered.map(function (item) { return self.verify(item.url); }));
    return ordered.filter(function (item, i) { return checks[i]; }).slice(0, want);
  }
};

/* ----------------------------- ZIP ----------------------------- */
var Zip = {
  crcTable: (function () {
    var table = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })(),
  crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = this.crcTable[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  },
  /* files: [{name, content}] -> Blob (zip, без сжатия — быстро и без зависимостей) */
  create(files) {
    var enc = new TextEncoder();
    var parts = [], central = [], offset = 0;
    var now = new Date();
    var time = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() / 2)) & 0xFFFF;
    var date = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;

    function u16(v) { return [v & 0xFF, (v >> 8) & 0xFF]; }
    function u32(v) { return [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]; }

    files.forEach(function (f) {
      var nameBytes = enc.encode(f.name);
      var data = enc.encode(f.content);
      var crc = Zip.crc32(data);
      var local = [].concat([0x50, 0x4B, 0x03, 0x04], u16(20), u16(0), u16(0), u16(time), u16(date),
        u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0));
      parts.push(new Uint8Array(local), nameBytes, data);
      central.push({ name: nameBytes, crc: crc, size: data.length, offset: offset });
      offset += local.length + nameBytes.length + data.length;
    });

    var centralStart = offset, centralSize = 0;
    central.forEach(function (c) {
      var rec = [].concat([0x50, 0x4B, 0x01, 0x02], u16(20), u16(20), u16(0), u16(0), u16(time), u16(date),
        u32(c.crc), u32(c.size), u32(c.size), u16(c.name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(c.offset));
      var arr = new Uint8Array(rec);
      parts.push(arr, c.name);
      centralSize += rec.length + c.name.length;
    });
    var end = [].concat([0x50, 0x4B, 0x05, 0x06], u16(0), u16(0), u16(files.length), u16(files.length),
      u32(centralSize), u32(centralStart), u16(0));
    parts.push(new Uint8Array(end));
    return new Blob(parts, { type: 'application/zip' });
  }
};
