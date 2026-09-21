/* ============================================================================
   NeuraSite AI — ИНТЕРФЕЙС
   Кнопки, генерация, предпросмотр, чат, картинки, экспорт, самопроверка.
   ========================================================================== */

var state = {
  html: '',
  files: [],          // многостраничник: [{name, content}]
  photos: [],
  generating: false,
  model: lsGet('ns_model_v2', CONFIG.DEFAULT_MODEL),
  imageModel: lsGet('ns_image_model_v2', 'google/gemini-2.5-flash-image'),
  balance: null,
  lastCost: 0
};

/* ------------------------- ФОРМА ------------------------- */
function currentPhotoMode() {
  var el = document.querySelector('input[name=photoMode]:checked');
  return el ? el.value : 'search';
}
function getFormData() {
  var pagesRaw = ($('pagesInput') && $('pagesInput').value) || 'Главная, Каталог, О компании, Отзывы, Контакты';
  var pages = pagesRaw.split(',').map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 8);
  if (!pages.length) pages = ['Главная'];
  return {
    prompt: ($('mainPrompt') && $('mainPrompt').value.trim()) || '',
    site_name: ($('siteName') && $('siteName').value.trim()) || 'NeuraSite',
    business_type: ($('businessType') && $('businessType').value) || '',
    site_type: ($('siteType') && $('siteType').value) || 'landing',
    style: ($('styleSelect') && $('styleSelect').value) || 'modern premium like Linear/Stripe',
    colors: ($('colorInput') && $('colorInput').value) || '',
    contacts: {
      phone: ($('contactPhone') && $('contactPhone').value) || '',
      email: ($('contactEmail') && $('contactEmail').value) || '',
      address: ($('contactAddress') && $('contactAddress').value) || '',
      telegram: ($('contactTg') && $('contactTg').value) || '',
      instagram: ($('contactInst') && $('contactInst').value) || '',
      cta: ($('ctaText') && $('ctaText').value) || ''
    },
    features: $$('.feature-check:checked').map(function (c) { return c.value; }),
    photoMode: currentPhotoMode(),
    pages: pages
  };
}
function isMultiForm(data) { return data.site_type === 'multipage'; }
function togglePagesBlock() {
  var block = $('pagesBlock');
  if (block) block.classList.toggle('hidden', ($('siteType') && $('siteType').value) !== 'multipage');
}

/* ------------------------- МОДЕЛИ ------------------------- */
function applyModelToSelects(id) {
  ['modelSelect', 'modelSelectMobile'].forEach(function (sid) {
    var sel = $(sid); if (!sel) return;
    if (!Array.prototype.some.call(sel.options, function (o) { return o.value === id; })) {
      var o = document.createElement('option'); o.value = id; sel.appendChild(o);
    }
    sel.value = id;
  });
}
function getModel() { return state.model || CONFIG.DEFAULT_MODEL; }
function selectModel(id, type) {
  if (type === 'image') {
    state.imageModel = id; lsSet('ns_image_model_v2', id);
    toast('Модель картинок: ' + id.split('/').pop(), '🎨');
  } else {
    state.model = id; lsSet('ns_model_v2', id); applyModelToSelects(id);
    toast('Модель: ' + id.split('/').pop(), '🧠');
  }
  renderModels();
  var m = $('brainsModal'); if (m) m.classList.add('hidden');
}
function renderModels() {
  var live = (window.__modelsCache && window.__modelsCache.data) || [];
  function priceOf(id, fallbackIn, fallbackOut, fallbackPer) {
    var m = live.filter(function (x) { return x.id === id; })[0];
    if (!m) return { in: fallbackIn, out: fallbackOut, per: fallbackPer };
    return { in: m.rIn || fallbackIn, out: m.rOut || fallbackOut, per: m.per || fallbackPer };
  }
  var textEl = $('textModelsList');
  if (textEl) {
    textEl.innerHTML = MODELS.text.map(function (m) {
      var p = priceOf(m.id, m.rIn, m.rOut);
      var perSite = m.out ? Math.round((p.out || 0) * (CONFIG.MAX_OUT_TOKENS / 1000000) + (p.in || 0) * 0.01) : null;
      var active = getModel() === m.id;
      return '<div class="rounded-xl p-3 cursor-pointer transition border ' + (active ? 'bg-[#6C5CFF]/15 border-[#6C5CFF]/50' : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06]') + '" onclick="selectModel(\'' + m.id + '\')">' +
        '<div class="flex items-center justify-between mb-1"><span class="font-bold text-[13px]">' + esc(m.name) + '</span><span class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 border border-white/10">' + esc(m.badge) + '</span></div>' +
        '<div class="text-[11px] text-white/50">' + esc(m.note) + '</div>' +
        '<div class="flex flex-wrap gap-2 mt-2 text-[10px] font-mono"><span class="px-1.5 py-0.5 rounded bg-black/30">' + (p.in ? Math.round(p.in) + ' ₽/1M вх' : '—') + '</span><span class="px-1.5 py-0.5 rounded bg-black/30">' + (p.out ? Math.round(p.out) + ' ₽/1M исх' : '—') + '</span>' + (perSite ? '<span class="px-1.5 py-0.5 rounded bg-[#00D492]/20">≈ ' + perSite + ' ₽ / сайт</span>' : '') + '</div>' +
        '<div class="text-[10px] font-mono text-[#8B7DFF] mt-1 truncate">' + esc(m.id) + '</div></div>';
    }).join('');
  }
  var imgEl = $('imageModelsList');
  if (imgEl) {
    imgEl.innerHTML = MODELS.image.map(function (m) {
      var p = priceOf(m.id, null, null, m.per);
      var active = state.imageModel === m.id;
      return '<div class="rounded-xl p-3 cursor-pointer transition border ' + (active ? 'bg-[#FF4D8D]/15 border-[#FF4D8D]/50' : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06]') + '" onclick="selectModel(\'' + m.id + '\',\'image\')">' +
        '<div class="flex items-center justify-between mb-1"><span class="font-bold text-[13px]">' + esc(m.name) + '</span><span class="text-[10px] px-2 py-0.5 rounded-full bg-white/10 border border-white/10">' + esc(m.badge) + '</span></div>' +
        '<div class="text-[11px] text-white/50">' + esc(m.note) + '</div>' +
        '<div class="mt-2 text-[10px] font-mono"><span class="px-1.5 py-0.5 rounded bg-black/30">' + (p.per ? p.per + ' ₽ / фото' : 'по токенам') + '</span></div>' +
        '<div class="text-[10px] font-mono text-[#FF4D8D] mt-1 truncate">' + esc(m.id) + '</div></div>';
    }).join('');
  }
  var vidEl = $('videoModelsList');
  if (vidEl) vidEl.innerHTML = '<div class="text-[11px] text-white/40">Видео в генераторе сайтов пока не используется: дорого и долго. Доступно в Polza API отдельно.</div>';
}

/* ------------------------- ИНДИКАТОР ЗАГРУЗКИ ------------------------- */
function setProgress(text, percent) {
  var step = $('loadingStep'); if (step) step.textContent = text;
  var bar = $('loadingBar'); if (bar && percent != null) bar.style.width = Math.max(5, Math.min(100, percent)) + '%';
}
function showLoading(on) {
  var overlay = $('loadingOverlay'); if (!overlay) return;
  overlay.classList.toggle('hidden', !on);
  overlay.classList.toggle('flex', on);
}

/* ------------------------- ГЕНЕРАЦИЯ ------------------------- */
async function generateSite() {
  var data = getFormData();
  if (!data.prompt) { toast('Опиши, какой сайт нужен', '⚠️'); if ($('mainPrompt')) $('mainPrompt').focus(); return; }
  if (state.generating) { toast('Генерация уже идёт', '⏳'); return; }
  if (!getKey() && !isProxied()) { if ($('keyModal')) $('keyModal').classList.remove('hidden'); toast('Нужен ключ Polza AI', '🔑'); return; }

  state.generating = true;
  var multi = isMultiForm(data);
  var btn = $('generateBtn'); if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Генерирую…'; }
  showLoading(true);
  if ($('previewPlaceholder')) $('previewPlaceholder').classList.add('hidden');

  var t0 = Date.now();
  var cost = 0;
  try {
    /* 1. Фотографии */
    state.photos = [];
    if (data.photoMode === 'search') {
      setProgress('Ищу реальные фото под нишу…', 8);
      try {
        state.photos = await Photos.collect(data.business_type, 12);
        setProgress('Нашёл ' + state.photos.length + ' проверенных фото', 16);
      } catch (e) { toast('Поиск фото не сработал — сделаю сайт на градиентах', '⚠️'); }
      if (!state.photos.length) setProgress('Реальные фото не найдены — использую CSS-графику', 16);
    } else if (data.photoMode === 'ai') {
      setProgress('Генерирую фото для сайта через ИИ…', 6);
      try {
        state.photos = await generateNichePhotos(data, function (i, n) { setProgress('Фото ' + i + ' из ' + n + '…', 6 + i * 4); });
      } catch (e) { toast('ИИ-фото не получились: ' + e.message, '⚠️'); }
    }

    /* 2. Код сайта */
    var files = [];
    if (multi) {
      setProgress('Собираю многостраничный сайт…', 25);
      files = await generateSitePages({
        form: data, photos: state.photos, model: getModel(),
        onProgress: function (msg) { setProgress(msg, 40); }
      });
    } else {
      setProgress('Модель пишет сайт…', 25);
      var page = await generatePage({
        form: data, photos: state.photos, isMulti: false, model: getModel(),
        userPromptText: userPrompt(data, state.photos, false),
        onProgress: function (msg) { setProgress(msg, 45); }
      });
      var fixed = finishHtml(page.raw, { photos: state.photos, isMulti: false });
      cost += (page.usage && page.usage.cost) || 0;
      if (page.truncated) toast('Ответ модели был обрезан — дотянул, но проверьте страницу', '⚠️');
      files = [{ name: 'index.html', content: fixed.html, usage: page.usage }];
    }

    files.forEach(function (f) { cost += (f.usage && f.usage.cost) || 0; });
    state.files = files.map(function (f) { return { name: f.name, content: f.content }; });
    state.html = files[0].content;

    /* 3. Проверка качества */
    setProgress('Проверяю, что всё работает…', 80);
    var problems = files.filter(function (f) { return !f.content || f.content.length < 800; });
    if (problems.length) toast('Страница «' + problems[0].name + '» получилась пустой — сгенерируйте её заново', '⚠️');

    /* 4. Показ */
    setProgress('Готово', 100);
    renderPreview(state.html, multi);
    renderPagesBar();
    var el = Date.now() - t0;
    if ($('statTime')) $('statTime').textContent = (el / 1000).toFixed(1) + ' сек';
    if ($('statSize')) $('statSize').textContent = fmtSize(state.html.length) + (multi ? ' × ' + files.length + ' стр.' : '');
    if ($('statModel')) $('statModel').textContent = getModel().split('/').pop();
    state.lastCost = cost;
    if ($('statCost')) $('statCost').textContent = cost ? fmtRub(cost) : '—';

    var report = await validateSite(state.html, { photos: state.photos, form: data });
    var bad = report.filter(function (c) { return !c.ok; });
    addChatMessage('assistant', 'Готово! ' + (multi ? 'Сделал сайт из ' + files.length + ' страниц' : 'Сделал сайт') +
      ' за ' + (el / 1000).toFixed(1) + ' сек на модели ' + getModel().split('/').pop() + '.' +
      (bad.length ? ' Замечания: ' + bad.map(function (b) { return b.label; }).join('; ') + '.' : ' Все проверки пройдены: фото открываются, меню и формы рабочие, анимации на месте.') +
      ' Что улучшить?');
    toast(multi ? 'Сайт из ' + files.length + ' страниц готов! 🔥' : 'Сайт готов! 🔥', '✦');

    genHistory.unshift({ name: data.site_name, prompt: data.prompt.slice(0, 60), time: new Date().toLocaleTimeString(), size: state.html.length, multi: multi, pages: files.length });
    genHistory = genHistory.slice(0, 12);
    lsSet(CONFIG.LS_HISTORY, JSON.stringify(history));
    renderHistory();
    refreshBalance();
  } catch (e) {
    toast('Ошибка: ' + e.message, '❌');
    addChatMessage('assistant', 'Ошибка генерации: ' + e.message);
    if ($('previewPlaceholder')) $('previewPlaceholder').classList.remove('hidden');
  } finally {
    state.generating = false;
    showLoading(false);
    if (btn) { btn.disabled = false; btn.innerHTML = '<span class="text-[18px]">✦</span> Сгенерировать сайт <span class="text-[11px] font-mono bg-white/20 px-2 py-0.5 rounded-full">⌘ + Enter</span>'; }
  }
}

/* ИИ-фото для сайта (по желанию): 3 картинки под нишу. */
async function generateNichePhotos(data, onStep) {
  var niche = data.business_type || 'business';
  var prompts = [
    'Профессиональная фотография для сайта: ' + niche + '. Широкий кадр интерьера/сцены, естественный свет, премиальная рекламная подача, без текста и логотипов.',
    'Крупный план деталей по теме «' + niche + '»: атмосферная предметная съёмка, мягкий свет, размытый фон, без текста.',
    'Команда или клиент в среде «' + niche + '»: живая естественная сцена, профессиональная репортажная подача, без текста.'
  ];
  var out = [];
  for (var i = 0; i < prompts.length; i++) {
    onStep && onStep(i + 1, prompts.length);
    var r = await polzaImage({ model: state.imageModel, prompt: prompts[i], onTick: function () { } });
    out.push({ url: r.url, title: niche, source: 'ai', query: niche });
  }
  return out;
}

/* ------------------------- ПРЕДПРОСМОТР ------------------------- */
function inlineAssets(html, files) {
  // для предпросмотра многостраничника подставляем содержимое страниц вместо переходов
  return html;
}
function renderPreview(html, isMulti) {
  var frame = $('previewFrame');
  if (!frame) return;
  var placeholder = $('previewPlaceholder'); if (placeholder) placeholder.classList.add('hidden');
  frame.classList.remove('hidden');
  frame.srcdoc = html;
  state.html = html;
  if ($('codeContent')) $('codeContent').textContent = html;
  if ($('codeSize')) $('codeSize').textContent = fmtSize(html.length);
  if ($('zipBtn')) $('zipBtn').classList.toggle('hidden', !(state.files && state.files.length > 1));
}
function renderPagesBar() {
  var bar = $('pagesBar'); if (!bar) bar = ensurePagesBar();
  if (!bar) return;
  if (!state.files || state.files.length < 2) { bar.innerHTML = ''; bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  var current = state.html;
  bar.innerHTML = '<span class="text-[11px] text-white/40 mr-1">Страницы:</span>' + state.files.map(function (f) {
    var active = f.content === current;
    return '<button onclick="showPreviewFile(\'' + f.name + '\')" class="px-2.5 py-1 rounded-lg text-[11px] ' + (active ? 'bg-[#6C5CFF] text-white font-bold' : 'btn-ghost') + '">' + esc(f.name.replace('.html', '')) + '</button>';
  }).join('');
}
function ensurePagesBar() {
  var host = $('previewWrapper'); if (!host) return null;
  var bar = document.createElement('div');
  bar.id = 'pagesBar';
  bar.className = 'hidden flex flex-wrap items-center gap-1.5 glass rounded-[12px] px-2.5 py-1.5 mb-2';
  host.parentNode.insertBefore(bar, host);
  return bar;
}
function showPreviewFile(name) {
  var f = (state.files || []).filter(function (x) { return x.name === name; })[0];
  if (!f) return;
  renderPreview(f.content, true);
  renderPagesBar();
}
function setDevice(type) {
  var wrapper = $('previewWrapper');
  $$('.device-btn').forEach(function (b) { b.classList.remove('bg-white', 'text-black'); b.classList.add('text-white/60'); });
  var btn = $('btn-' + type); if (btn) { btn.classList.add('bg-white', 'text-black'); btn.classList.remove('text-white/60'); }
  if (!wrapper) return;
  if (type === 'desktop') { wrapper.style.width = '100%'; wrapper.style.margin = '0'; }
  if (type === 'tablet') { wrapper.style.width = '768px'; wrapper.style.margin = '0 auto'; }
  if (type === 'mobile') { wrapper.style.width = '390px'; wrapper.style.margin = '0 auto'; }
}
function toggleCode() { var v = $('codeView'); if (v) v.classList.toggle('hidden'); }
function copyCode() {
  if (!state.html) { toast('Сначала сгенерируй сайт', '⚠️'); return; }
  navigator.clipboard.writeText(state.html).then(function () { toast('Код скопирован', '📋'); }).catch(function () { toast('Не удалось скопировать', '⚠️'); });
}
function downloadSite() {
  if (!state.html) { toast('Сначала сгенерируй сайт', '⚠️'); return; }
  var name = (($('siteName') && $('siteName').value) || 'site').trim();
  var blob = new Blob([state.html], { type: 'text/html;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = (state.files && state.files.length > 1 ? 'index' : slugify(name)) + '.html';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast('Файл скачан', '⬇');
}
function downloadZip() {
  var files = (state.files && state.files.length ? state.files : [{ name: 'index.html', content: state.html }]).filter(function (f) { return f.content; });
  if (!files.length) { toast('Сначала сгенерируй сайт', '⚠️'); return; }
  files = files.concat([{
    name: 'README.txt',
    content: 'Сайт сгенерирован в NeuraSite AI.\n\nФайлы:\n' + files.map(function (f) { return ' - ' + f.name; }).join('\n') +
      '\n\nКак опубликовать:\n1) Загрузите все файлы в одну папку на хостинге (или перетащите папку на netlify.com/drop).\n' +
      '2) Главная страница — index.html.\n3) Если картинки не грузятся на вашем домене — проверьте, что файлы лежат рядом (пути относительные).\n'
  }]);
  var blob = Zip.create(files);
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = slugify((($('siteName') && $('siteName').value) || 'site')) + '.zip';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast('Архив со всеми страницами скачан', '🗂');
}
function openInNewTab() {
  if (!state.html) { toast('Сначала сгенерируй сайт', '⚠️'); return; }
  var w = window.open('', '_blank');
  if (!w) { toast('Браузер заблокировал новую вкладку', '⚠️'); return; }
  w.document.write(state.html); w.document.close();
}
function openFullscreen() {
  var frame = $('previewFrame');
  if (frame && frame.requestFullscreen) frame.requestFullscreen();
}
function shareSite() {
  if (!state.html) { toast('Сначала сгенерируй сайт', '⚠️'); return; }
  var html = state.html;
  function fallback() {
    var blob = new Blob([html], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    navigator.clipboard.writeText(url).then(function () { toast('Ссылка на сайт скопирована (работает, пока открыта эта вкладка)', '🔗'); })
      .catch(function () { toast('Скачайте HTML — так надёжнее', '⬇'); });
  }
  if (!('CompressionStream' in window)) return fallback();
  try {
    var stream = new Blob([html]).stream().pipeThrough(new CompressionStream('gzip'));
    new Response(stream).arrayBuffer().then(function (buf) {
      var bytes = new Uint8Array(buf), bin = '';
      for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      var b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      var link = location.origin + location.pathname + '#site=' + b64;
      location.hash = 'site=' + b64;
      navigator.clipboard.writeText(link).then(function () { toast('Ссылка со сайтом скопирована — можно отправлять клиенту', '🔗'); })
        .catch(function () { toast('Ссылка в адресной строке — скопируйте её', '🔗'); });
    }).catch(fallback);
  } catch (e) { fallback(); }
}
async function loadSharedSite() {
  var m = location.hash.match(/#site=([A-Za-z0-9_\-]+)/);
  if (!m) return;
  if (!('DecompressionStream' in window)) return;
  try {
    var b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    var bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    var html = await new Response(stream).text();
    state.html = html;
    state.files = [{ name: 'index.html', content: html }];
    renderPreview(html, false);
    toast('Загружен присланный сайт', '🔗');
  } catch (e) { toast('Не удалось открыть ссылку', '⚠️'); }
}

/* ------------------------- ЧАТ ------------------------- */
function addChatMessage(role, text) {
  var cont = $('chatMessages'); if (!cont) return;
  var div = document.createElement('div');
  div.className = 'chat-bubble ' + (role === 'user' ? 'ml-8 bg-[#6C5CFF] text-white rounded-[14px] rounded-br-[4px]' : 'glass rounded-[14px] rounded-bl-[4px]') + ' p-3 text-[13px] leading-relaxed';
  div.textContent = text;
  cont.appendChild(div);
  cont.scrollTop = cont.scrollHeight;
}
function quickChat(text) { if ($('chatInput')) { $('chatInput').value = text; sendChat(); } }
async function sendChat() {
  var input = $('chatInput'); if (!input) return;
  var msg = input.value.trim();
  if (!msg) return;
  if (!state.html) { toast('Сначала сгенерируй сайт', '⚠️'); return; }
  if (state.generating) { toast('Дождись окончания генерации', '⏳'); return; }
  addChatMessage('user', msg);
  input.value = '';
  var typing = document.createElement('div');
  typing.id = 'typing';
  typing.className = 'chat-bubble glass rounded-[14px] rounded-bl-[4px] p-3 flex gap-1';
  typing.innerHTML = '<span class="w-2 h-2 rounded-full bg-white/40 typing-dot"></span><span class="w-2 h-2 rounded-full bg-white/40 typing-dot"></span><span class="w-2 h-2 rounded-full bg-white/40 typing-dot"></span>';
  $('chatMessages').appendChild(typing);
  $('chatMessages').scrollTop = 999999;
  try {
    var res = await refineSite(state.html, msg, { photos: state.photos, form: getFormData() });
    var t = $('typing'); if (t) t.remove();
    state.html = res.html;
    state.files = [{ name: (state.files[0] && state.files[0].name) || 'index.html', content: res.html }];
    renderPreview(res.html, false);
    renderPagesBar();
    if ($('statCost')) $('statCost').textContent = res.usage && (res.usage.cost_rub || res.usage.cost) ? fmtRub(res.usage.cost_rub || res.usage.cost) : $('statCost').textContent;
    addChatMessage('assistant', 'Готово, обновил. Что ещё поправить?');
    toast('Сайт обновлён', '✦');
  } catch (e) {
    var t2 = $('typing'); if (t2) t2.remove();
    addChatMessage('assistant', 'Ошибка: ' + e.message);
    toast('Ошибка: ' + e.message, '❌');
  }
}

/* ------------------------- КАРТИНКИ ------------------------- */
async function searchImages(queryId, resultsId) {
  queryId = queryId || 'imageQuery'; resultsId = resultsId || 'imageResults1';
  var q = ($(queryId) && $(queryId).value.trim()) || '';
  if (!q) { toast('Напиши, что искать', '⚠️'); return; }
  var cont = $(resultsId); if (!cont) return;
  cont.classList.remove('hidden');
  cont.innerHTML = '<div class="col-span-3 text-center py-4 text-[12px] text-white/40">Ищу настоящие фото…</div>';
  try {
    var items = await Photos.search(q, 9);
    if (!items.length) { cont.innerHTML = '<div class="col-span-3 text-[12px] text-white/50">Ничего не нашлось. Попробуйте по-английски: coffee shop interior</div>'; return; }
    cont.innerHTML = items.map(function (img) {
      return '<div class="group relative rounded-xl overflow-hidden aspect-[4/3] bg-white/5 border border-white/10 cursor-pointer hover:border-[#6C5CFF]/50" onclick="insertImage(\'' + img.url + '\')">' +
        '<img src="' + esc(img.thumb || img.url) + '" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">' +
        '<div class="absolute bottom-0 left-0 right-0 p-1 text-[9px] text-white bg-black/60 opacity-0 group-hover:opacity-100 transition truncate">' + esc(img.title || q) + '</div></div>';
    }).join('');
    state.photos = items.concat(state.photos || []);
  } catch (e) {
    cont.innerHTML = '<div class="col-span-3 text-[12px] text-red-400">' + esc(e.message) + '</div>';
  }
}
function insertImage(url) {
  if (!state.html) { toast('Сначала сгенерируй сайт', '⚠️'); return; }
  quickChat('Замени неудачное фото из блока на это: ' + url + '. Вставь его в подходящее по смыслу место, размеры сохрани.');
  toast('Отправил в чат — сайт обновится', '🖼');
}
async function generateImage(promptId, resultsId) {
  promptId = promptId || 'imagePrompt'; resultsId = resultsId || 'imageResults1';
  var p = ($(promptId) && $(promptId).value.trim()) || '';
  if (!p) { toast('Опиши картинку', '⚠️'); return; }
  var cont = $(resultsId);
  if (cont) { cont.classList.remove('hidden'); cont.innerHTML = '<div class="col-span-3 text-center py-4 text-[12px] text-white/40">Рисую… 10-40 секунд</div>'; }
  try {
    var r = await polzaImage({
      model: state.imageModel, prompt: p,
      onTick: function (status, sec) { if (cont) cont.innerHTML = '<div class="col-span-3 text-center py-4 text-[12px] text-white/40">Статус: ' + status + ' (' + sec + ' сек)</div>'; }
    });
    if (cont) cont.innerHTML = '<div class="col-span-3 rounded-xl overflow-hidden border border-[#6C5CFF]/30">' +
      '<img src="' + esc(r.url) + '" class="w-full aspect-square object-cover">' +
      '<div class="p-2 flex gap-2"><button onclick="insertImage(\'' + r.url + '\')" class="flex-1 btn-primary py-1.5 rounded-lg text-[11px] text-white">Вставить в сайт</button>' +
      '<a href="' + esc(r.url) + '" target="_blank" class="btn-ghost px-3 py-1.5 rounded-lg text-[11px]">Открыть</a></div></div>' + (cont.innerHTML || '');
    toast('Картинка готова' + (r.cost ? ' (' + fmtRub(r.cost) + ')' : ''), '✦');
    state.photos = [{ url: r.url, title: p, source: 'ai', query: p }].concat(state.photos || []);
  } catch (e) { toast('Не получилось: ' + e.message, '❌'); }
}
function switchImgTool(tool) {
  ['photoshop', 'generate', 'search'].forEach(function (t) {
    var panel = $('toolPanel' + t.charAt(0).toUpperCase() + t.slice(1));
    var tab = $('toolTab' + (t === 'generate' ? 'Gen' : t.charAt(0).toUpperCase() + t.slice(1)));
    if (panel) panel.classList.toggle('hidden', t !== tool);
    if (tab) tab.className = t === tool ? 'px-2.5 py-1 rounded-md bg-[#6C5CFF] text-white font-bold transition' : 'px-2.5 py-1 rounded-md text-white/60 hover:text-white transition';
  });
}
function handleUserPhotoSelected(event) {
  var file = event.target.files[0]; if (!file) return;
  var reader = new FileReader();
  reader.onload = function (e) {
    window.__userPhoto = e.target.result;
    if ($('photoshopThumb')) $('photoshopThumb').src = window.__userPhoto;
    if ($('photoshopFileName')) $('photoshopFileName').textContent = file.name;
    if ($('photoshopUploadPrompt')) $('photoshopUploadPrompt').classList.add('hidden');
    if ($('photoshopPreviewWrap')) $('photoshopPreviewWrap').classList.remove('hidden');
    toast('Фото загружено', '✓');
  };
  reader.readAsDataURL(file);
}
async function applyAiPhotoshop() {
  if (!window.__userPhoto) { toast('Сначала загрузите фотографию', '⚠️'); return; }
  var prompt = ($('photoshopPrompt') && $('photoshopPrompt').value.trim()) || '';
  if (!prompt) { toast('Напишите, что изменить на фото', '⚠️'); return; }
  var btn = $('aiPhotoshopBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Обработка…'; }
  toast('Нейросеть обрабатывает фото…', '🎨');
  try {
    var r = await polzaEditImage({
      model: state.imageModel, dataUrl: window.__userPhoto,
      prompt: 'Professional photo editing for a website: ' + prompt,
      onTick: function (status, sec) { if (btn) btn.innerHTML = '⏳ ' + status + ' ' + sec + 'с'; }
    });
    if (r.url) { insertImage(r.url); toast('Фото готово и отправлено в сайт' + (r.cost ? ' (' + fmtRub(r.cost) + ')' : ''), '🪄'); }
  } catch (e) { toast('Ошибка фотошопа: ' + e.message, '⚠️'); }
  finally { if (btn) { btn.disabled = false; btn.innerHTML = '🪄 Изменить'; } }
}

/* ------------------------- ГОЛОС ------------------------- */
function startVoiceInput(inputId, btnId) {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var btn = $(btnId), input = $(inputId);
  if (!SR) { toast('Голосовой ввод не поддерживается браузером', '⚠️'); return; }
  if (!btn || !input) return;
  if (btn.dataset.recording === 'true') {
    if (window.__speechRec) { try { window.__speechRec.stop(); } catch (e) { } }
    btn.dataset.recording = 'false';
    btn.classList.remove('bg-red-500/30', 'text-red-400', 'animate-pulse');
    return;
  }
  try {
    var rec = new SR();
    rec.lang = 'ru-RU'; rec.continuous = false; rec.interimResults = false;
    rec.onstart = function () { btn.dataset.recording = 'true'; btn.classList.add('bg-red-500/30', 'text-red-400', 'animate-pulse'); toast('Слушаю вас…', '🎙️'); };
    rec.onresult = function (e) {
      var text = e.results[0][0].transcript;
      if (text) { input.value = input.value ? input.value + ' ' + text : text; toast('Распознано', '✓'); }
    };
    rec.onerror = function () { toast('Не удалось распознать голос', '⚠️'); btn.dataset.recording = 'false'; btn.classList.remove('bg-red-500/30', 'text-red-400', 'animate-pulse'); };
    rec.onend = function () { btn.dataset.recording = 'false'; btn.classList.remove('bg-red-500/30', 'text-red-400', 'animate-pulse'); };
    window.__speechRec = rec;
    rec.start();
  } catch (e) { toast('Ошибка микрофона: ' + e.message, '⚠️'); }
}

/* ------------------------- КЛЮЧ, ВЛАДЕЛЕЦ, ТАРИФЫ ------------------------- */
function toggleKey() {
  ['polzaKey', 'polzaKeyMobile'].forEach(function (id) {
    var i = $(id); if (i) i.type = i.type === 'password' ? 'text' : 'password';
  });
}
function saveKey() { saveKeyValue(getKey()); }
function saveKeyFromModal() {
  var k = ($('keyModalInput') && $('keyModalInput').value) || '';
  if (saveKeyValue(k)) { var m = $('keyModal'); if (m) m.classList.add('hidden'); }
}
function savePhotoKeys() {
  var pairs = [['unsplashKeyInput', 'ns_unsplash_key_v2'], ['pexelsKeyInput', 'ns_pexels_key_v2'], ['pixabayKeyInput', 'ns_pixabay_key_v2']];
  var saved = [];
  pairs.forEach(function (pr) {
    var el = $(pr[0]); if (!el) return;
    var v = (el.value || '').trim();
    if (v) { lsSet(pr[1], v); saved.push(pr[0].replace('KeyInput', '')); }
  });
  photoKeysState();
  toast(saved.length ? 'Ключи сохранены: ' + saved.join(', ') : 'Ключи можно оставить пустыми — поиск фото работает и без них', saved.length ? '📷' : '💡');
}
function photoKeysState() {
  var el = $('photoKeysState'); if (!el) return;
  var have = [['unsplashKeyInput', 'ns_unsplash_key_v2'], ['pexelsKeyInput', 'ns_pexels_key_v2'], ['pixabayKeyInput', 'ns_pixabay_key_v2']];
  var names = have.filter(function (pr) { return (lsGet(pr[1], '') || '').trim(); }).map(function (pr) { return pr[0].replace('KeyInput', ''); });
  el.textContent = names.length ? 'подключено: ' + names.join(', ') : 'ключи не заданы — работают бесплатные источники';
  have.forEach(function (pr) { var i = $(pr[0]); if (i && !i.value) i.value = lsGet(pr[1], ''); });
}
function openPricingModal() { var m = $('pricingModal'); if (m) m.classList.remove('hidden'); }
function checkOwnerAuth() {
  var isOwner = lsGet(CONFIG.LS_OWNER, '') === 'true';
  var badge = $('ownerStatusBadge'); if (badge) badge.classList.toggle('hidden', !isOwner);
  var tariffs = $('tariffsHeaderBtn'); if (tariffs) tariffs.style.display = isOwner ? 'none' : '';
  var pin = $('ownerPinInput'); if (pin) pin.value = '';
}
function verifyOwnerPassword(pass) {
  if (CONFIG.OWNER_PINS.indexOf(String(pass || '').trim()) >= 0) {
    lsSet(CONFIG.LS_OWNER, 'true');
    checkOwnerAuth();
    var m = $('ownerPinModal'); if (m) m.classList.add('hidden');
    toast('Режим владельца включён: без лимитов', '👑');
    return true;
  }
  return false;
}
function tryOwnerPin() {
  var pin = ($('ownerPinInput') && $('ownerPinInput').value) || '';
  if (!verifyOwnerPassword(pin)) {
    toast('Неверный PIN', '⚠️');
    var i = document.querySelector('#ownerPinModal input'); if (i) { i.style.outline = '2px solid #e5484d'; setTimeout(function () { i.style.outline = ''; }, 1200); }
  }
}
async function refreshBalance() {
  try {
    var b = await polzaBalance();
    state.balance = b.available;
    var el = $('balancePill');
    if (el) { el.textContent = 'Баланс ' + fmtRub(b.available); el.classList.remove('hidden'); }
  } catch (e) { }
}
async function checkKeyOnStart() {
  updateKeyUI();
  refreshBalance();
  try {
    var list = await polzaModels();
    window.__modelsCache = { at: Date.now(), data: list };
  } catch (e) { }
  renderModels();
  if (!getKey() && !isProxied()) { var m = $('keyModal'); if (m) m.classList.remove('hidden'); }
}

/* ------------------------- ПРОЧЕЕ ------------------------- */
var genHistory = lsJson(CONFIG.LS_HISTORY, '[]');
function setPrompt(t) { if ($('mainPrompt')) $('mainPrompt').value = t; }
function setColors(c) { if ($('colorInput')) $('colorInput').value = c; }
function randomize() {
  var niches = ['IT / SaaS / Стартап', 'Ресторан / Кафе', 'Клиника / Медицина', 'Фитнес / Спорт', 'Недвижимость', 'Образование / Курсы', 'Красота / Салон', 'Креатив / Агентство / Дизайн'];
  var styles = ['modern premium like Linear/Stripe', 'glassmorphism + gradients', 'minimalism + typography', 'luxury dark + gold', 'corporate trust blue'];
  var prompts = [
    'Лендинг для AI-агентства: тёмный премиум как Linear, градиенты, анимации, тарифы, кейсы',
    'Сайт speciality-кофейни: уютный, тёплый, много фото, меню, история, карта',
    'Клиника косметологии: светлый премиум, доверие, услуги, врачи, до/после, отзывы',
    'Фитнес-клуб: тёмный мощный дизайн, тарифы, тренеры, расписание, отзывы',
    'Агентство недвижимости: корпоративный синий, каталог квартир, преимущества, отзывы'
  ];
  if ($('businessType')) $('businessType').value = niches[Math.floor(Math.random() * niches.length)];
  if ($('styleSelect')) $('styleSelect').value = styles[Math.floor(Math.random() * styles.length)];
  if ($('mainPrompt')) $('mainPrompt').value = prompts[Math.floor(Math.random() * prompts.length)];
  if ($('siteName')) $('siteName').value = ['Lumen', 'Aurora', 'Nova', 'Pulse', 'Velo', 'Astra', 'Flux'][Math.floor(Math.random() * 7)] + ' Studio';
  toast('Рандомайзер', '🎲');
}
function clearAll() {
  $$('input, textarea').forEach(function (i) {
    if (['polzaKey', 'polzaKeyMobile'].indexOf(i.id) >= 0) return;
    if (i.type === 'radio' || i.type === 'checkbox') return;
    i.value = '';
  });
  toast('Поля очищены', '↺');
}
function loadExample() {
  if ($('siteName')) $('siteName').value = 'Lumen AI Studio';
  if ($('businessType')) $('businessType').value = 'IT / SaaS / Стартап';
  if ($('siteType')) $('siteType').value = 'landing';
  togglePagesBlock();
  if ($('styleSelect')) $('styleSelect').value = 'modern premium like Linear/Stripe';
  if ($('colorInput')) $('colorInput').value = '#6C5CFF, #00D9FF';
  if ($('mainPrompt')) $('mainPrompt').value = 'Современный SaaS-лендинг для AI-студии, которая делает сайты за 30 секунд. Тёмный премиум как Linear и Vercel. Hero с анимированным градиентом и мокапом интерфейса, 6 преимуществ с иконками, «как это работает» в 3 шага, тарифы, отзывы с фото, FAQ, финальный CTA. Glassmorphism, анимации при скролле, вау-эффект.';
  if ($('contactPhone')) $('contactPhone').value = '+7 999 123-45-67';
  if ($('contactEmail')) $('contactEmail').value = 'hello@lumen.studio';
  if ($('ctaText')) $('ctaText').value = 'Создать сайт за 30 секунд';
  toast('Пример загружен', '📄');
}
function renderHistory() {
  var el = $('historyList'); if (!el) return;
  if (!genHistory.length) { el.innerHTML = '<div class="text-[11px] text-white/30">Пока пусто</div>'; return; }
  el.innerHTML = genHistory.map(function (h) {
    return '<div class="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 cursor-pointer" onclick="restoreHistory(' + JSON.stringify(esc(h.name)) + ',' + JSON.stringify(esc(h.prompt)) + ')">' +
      '<div><div class="text-[12px] font-medium truncate max-w-[150px]">' + esc(h.name) + '</div>' +
      '<div class="text-[10px] text-white/40 truncate max-w-[150px]">' + esc(h.prompt) + (h.multi ? ' · ' + (h.pages || 1) + ' стр.' : '') + '</div></div>' +
      '<div class="text-[10px] font-mono text-white/30">' + esc(h.time) + '</div></div>';
  }).join('');
}
function restoreHistory(name, prompt) {
  if ($('siteName')) $('siteName').value = name;
  if ($('mainPrompt')) $('mainPrompt').value = prompt;
  toast('Параметры из истории подставлены', '↺');
}

/* ------------------------- САМОПРОВЕРКА ------------------------- */
async function runSelfTest(realMode) {
  var checks = [];
  function add(ok, label, detail) { checks.push({ ok: !!ok, label: label, detail: detail || '' }); }

  // 1. функции из разметки
  var missing = [];
  var re = /on(?:click|input|change|submit)="([A-Za-z_$][\w$]*)\(/g, m, seen = {};
  var markup = document.body.innerHTML;
  while ((m = re.exec(markup))) {
    var fn = m[1];
    if (seen[fn]) continue; seen[fn] = 1;
    if (typeof window[fn] !== 'function') missing.push(fn);
  }
  add(missing.length === 0, 'Все кнопки привязаны к функциям', missing.length ? 'не найдены: ' + missing.join(', ') : 'проверено ' + Object.keys(seen).length + ' обработчиков');

  // 2. обязательные элементы
  var required = ['generateBtn', 'mainPrompt', 'previewFrame', 'chatInput', 'chatMessages', 'toast', 'pricingModal', 'ownerPinModal', 'testModal'];
  var absent = required.filter(function (id) { return !$(id); });
  add(absent.length === 0, 'Все элементы интерфейса на месте', absent.length ? 'нет: ' + absent.join(', ') : '');

  // 3. дубли id
  var dups = [], idmap = {};
  $$('[id]').forEach(function (el) { if (idmap[el.id]) dups.push(el.id); idmap[el.id] = 1; });
  add(dups.length === 0, 'Нет дублирующихся id', dups.length ? 'дубли: ' + dups.slice(0, 5).join(', ') : '');

  // 4. скрипты не падают
  add(!window.__nsJsError, 'JavaScript без ошибок', window.__nsJsError ? String(window.__nsJsError).slice(0, 120) : '');

  // 5. ключ и модели
  var hasKey = !!getKey() || isProxied();
  add(true, 'Ключ Polza', isProxied() ? 'хранится на сервере, посетителям не виден'
    : (hasKey ? (isOwnKey() ? 'используется ваш ключ (только в вашем браузере)' : 'используется ключ из конфига сайта') : 'пока не задан — вставьте свой в окне «🔑 ключ»'));
  if (hasKey) {
    try {
      var b = await polzaBalance();
      add(true, 'Баланс доступен', fmtRub(b.available));
    } catch (e) { add(false, 'Баланс недоступен', e.message); }
  } else {
    add(true, 'Баланс', 'проверим, когда будет указан ключ');
  }
  try {
    var list = await polzaModels();
    add(list.length > 100, 'Каталог моделей', list.length + ' моделей');
  } catch (e) { add(false, 'Каталог моделей', e.message); }

  // 6. фото-поиск
  try {
    var photos = await Photos.search('business team office', 3);
    add(photos.length > 0, 'Поиск фотографий работает', 'нашлось: ' + photos.length);
  } catch (e) { add(false, 'Поиск фотографий', e.message); }

  // 7. сгенерированный сайт
  if (state.html) {
    var report = await validateSite(state.html, { photos: state.photos, form: getFormData() });
    var bad = report.filter(function (c) { return !c.ok; });
    add(bad.length === 0, 'Проверки сгенерированного сайта', bad.length ? bad.map(function (x) { return x.label; }).join('; ') : report.length + ' проверок пройдено');
  } else {
    add(true, 'Сгенерированный сайт', 'сайт пока не генерировали');
  }

  // 8. ZIP-сборка
  try {
    var blob = Zip.create([{ name: 'test.txt', content: 'hello' }]);
    add(blob.size > 0, 'Экспорт в ZIP работает', blob.size + ' байт');
  } catch (e) { add(false, 'Экспорт в ZIP', e.message); }

  // 9. реальная генерация (по запросу)
  if (realMode) {
    try {
      var res = await polzaChat({ model: 'deepseek/deepseek-v3.2', messages: [{ role: 'user', content: 'Ответь одним словом: работает' }], maxTokens: 10, stream: false });
      add(!!res.text, 'Реальный запрос к модели', res.text.slice(0, 40) + ' (' + fmtRub((res.usage && res.usage.cost_rub) || 0) + ')');
    } catch (e) { add(false, 'Реальный запрос к модели', e.message); }
  }

  var html = checks.map(function (c) {
    return '<div class="flex items-start gap-2"><span>' + (c.ok ? '✅' : '❌') + '</span><div><div>' + esc(c.label) + '</div>' +
      (c.detail ? '<div class="text-[11px] text-white/50">' + esc(c.detail) + '</div>' : '') + '</div></div>';
  }).join('');
  var okCount = checks.filter(function (c) { return c.ok; }).length;
  html = '<div class="mb-2 text-[13px] font-bold ' + (okCount === checks.length ? 'text-[#00D492]' : 'text-[#FFE17B]') + '">' +
    okCount + ' из ' + checks.length + ' проверок пройдено</div>' + html;

  if ($('testReport')) $('testReport').innerHTML = html;
  if ($('testModal')) $('testModal').classList.remove('hidden');
  window.__nsLastReport = checks;
  return checks;
}

/* ------------------------- СТАРТ ------------------------- */
window.addEventListener('error', function (e) { window.__nsJsError = (e && e.message) || 'unknown'; });

document.addEventListener('DOMContentLoaded', function () {
  applyModelToSelects(getModel());
  renderModels();
  renderHistory();
  updateKeyUI();
  checkOwnerAuth();
  togglePagesBlock();
  photoKeysState();
  if ($('siteType')) $('siteType').addEventListener('change', togglePagesBlock);
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'ns-goto' && e.data.file) showPreviewFile(e.data.file);
  });
  window.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); generateSite(); }
  });
  setTimeout(async function () {
    var info = await detectProxy();
    if (info) {
      var pill = $('keyPill');
      if (pill) { pill.textContent = '🛡 сервер (ключ скрыт)'; pill.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold border bg-[#00D9FF]/15 border-[#00D9FF]/40 text-[#00D9FF]'; }
      toast('Работаю через сервер: ключ скрыт от посетителей', '🛡');
    }
    checkKeyOnStart();
  }, 300);
  loadSharedSite();
});
