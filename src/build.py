#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Сборка index.html / generator.html генератора NeuraSite.

Идея: разметка и стили интерфейса берутся из src/index.original.html (это тот самый
интерфейс, что был в репозитории), а вся логика — из src/app.*.js (написана заново).

Запуск:  python3 src/build.py
Результат: index.html и его копия generator.html в корне репозитория.
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
ORIGINAL = SRC / "index.original.html"

TAILWIND = '<script src="https://cdn.tailwindcss.com"></script>'


def fail(msg: str):
    print(f"ОШИБКА СБОРКИ: {msg}", file=sys.stderr)
    sys.exit(1)


def patch(markup: str, old: str, new: str, what: str, required: bool = True) -> str:
    if old not in markup:
        if required:
            fail(f"не найден фрагмент: {what}")
        return markup
    return markup.replace(old, new, 1)


def main():
    if not ORIGINAL.exists():
        fail(f"нет {ORIGINAL}")

    lines = ORIGINAL.read_text(encoding="utf-8").split("\n")

    # --- 1. head (строки 1..9) ---
    head = "\n".join(lines[0:9])

    # --- 2. конфиг Tailwind (строки 203..210) ---
    tw_config = "\n".join(lines[202:210]).strip()

    # --- 3. разметка интерфейса: от <style> до конца body (строки 403..981) ---
    markup = "\n".join(lines[402:981])

    # ==================== ПРАВКИ РАЗМЕТКИ ====================

    # 3.1 Убираем захардкоженный ключ из скрытых полей (ключ теперь только в CONFIG внутри JS)
    import re
    markup2 = re.sub(r'(<input id="(?:polzaKey|polzaKeyMobile|keyModalInput)"[^>]*?) value="[^"]*"', r"\1", markup)
    markup = markup2
    pass

    # 3.15 Второй (скрытый) keyModalInput создавал дубль id — переименовываем
    markup = markup.replace('<input id="keyModalInput" type="hidden"', '<input id="keyModalInputMirror" type="hidden"', 1)

    # 3.2 Правильные id моделей в статичном тексте
    for a, b in [("claude-sonnet-4-5", "claude-sonnet-4.5"), ("claude-haiku-4-5", "claude-haiku-4.5")]:
        markup = markup.replace(a, b)
    markup = patch(markup, 'placeholder="Вставь сюда sk-polza-', 'placeholder="Вставь сюда pza_', "подсказка ключа", required=False)

    # 3.25 Настройки источников фото (свои ключи) — в модалке ключа
    markup = patch(markup,
        '''          <button onclick="saveKeyFromModal()" class="btn-primary px-6 py-3 rounded-xl text-[14px] font-bold text-white">💾 Сохранить ключ</button>
        </div>
      </div>
    </div>
  </div>
</div>''',
        '''          <button onclick="saveKeyFromModal()" class="btn-primary px-6 py-3 rounded-xl text-[14px] font-bold text-white">💾 Сохранить ключ</button>
        </div>

        <div class="mt-4 pt-4 border-t border-white/10">
          <div class="text-[13px] font-bold mb-1">📷 Источники фотографий (по желанию)</div>
          <div class="text-[11px] text-white/50 leading-relaxed mb-2">
            Без ключей фото ищутся в свободных базах (Openverse, Wikimedia) — бесплатно, но подбор грубее.
            Свой бесплатный ключ Unsplash / Pexels / Pixabay даёт заметно более точные фото под нишу.
          </div>
          <div class="grid md:grid-cols-3 gap-2">
            <input id="unsplashKeyInput" class="input-field px-3 py-2 rounded-xl text-[12px] font-mono" placeholder="Unsplash Access Key">
            <input id="pexelsKeyInput" class="input-field px-3 py-2 rounded-xl text-[12px] font-mono" placeholder="Pexels API Key">
            <input id="pixabayKeyInput" class="input-field px-3 py-2 rounded-xl text-[12px] font-mono" placeholder="Pixabay API Key">
          </div>
          <div class="flex gap-2 mt-2">
            <button onclick="savePhotoKeys()" class="btn-ghost px-4 py-2 rounded-xl text-[12px]">Сохранить фото-ключи</button>
            <span id="photoKeysState" class="text-[11px] text-white/40 self-center"></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>''',
        "настройки источников фото")

    # 3.3 Дубли id в панелях картинок -> у второй панели свои id
    markup = patch(markup,
        '''      <div class="flex gap-2">
        <input id="imageQuery" class="input-field flex-1 px-3 py-2 rounded-xl text-[13px]" placeholder="Найти картинку: business team">
        <button onclick="searchImages()" class="btn-ghost px-3 py-2 rounded-xl text-[12px]">🔍</button>
      </div>
      <div class="flex gap-2">
        <input id="imagePrompt" class="input-field flex-1 px-3 py-2 rounded-xl text-[13px]" placeholder="Сгенерить: futuristic office, neon">
        <button onclick="generateImage()" class="btn-primary px-3 py-2 rounded-xl text-[12px] text-white">✦ Gen</button>
      </div>
      <div id="imageResults" class="grid grid-cols-3 gap-2 max-h-[180px] overflow-y-auto hidden"></div>''',
        '''      <div class="flex gap-2">
        <input id="imageQuery2" class="input-field flex-1 px-3 py-2 rounded-xl text-[13px]" placeholder="Найти картинку: business team">
        <button onclick="searchImages('imageQuery2','imageResults2')" class="btn-ghost px-3 py-2 rounded-xl text-[12px]">🔍</button>
      </div>
      <div class="flex gap-2">
        <input id="imagePrompt2" class="input-field flex-1 px-3 py-2 rounded-xl text-[13px]" placeholder="Сгенерить: futuristic office, neon">
        <button onclick="generateImage('imagePrompt2','imageResults2')" class="btn-primary px-3 py-2 rounded-xl text-[12px] text-white">✦ Gen</button>
      </div>
      <div id="imageResults2" class="grid grid-cols-3 gap-2 max-h-[180px] overflow-y-auto hidden"></div>''',
        "уникальные id панели картинок")

    # 3.4 Кнопки первой панели (вкладки «Фотошоп & Картинки») — передаём id явно
    markup = patch(markup,
        '<button type="button" onclick="searchImages()" class="btn-ghost px-3 py-2 rounded-xl text-[12px]">🔍 Найти</button>',
        '<button type="button" onclick="searchImages(\'imageQuery\',\'imageResults1\')" class="btn-ghost px-3 py-2 rounded-xl text-[12px]">🔍 Найти</button>',
        "кнопка поиска №1")
    markup = patch(markup,
        '<button type="button" onclick="generateImage()" class="btn-primary px-3 py-2 rounded-xl text-[12px] text-white">✦ Создать</button>',
        '<button type="button" onclick="generateImage(\'imagePrompt\',\'imageResults1\')" class="btn-primary px-3 py-2 rounded-xl text-[12px] text-white">✦ Создать</button>',
        "кнопка генерации №1")
    markup = patch(markup,
        '<div id="imageResults" class="grid grid-cols-3 gap-2 max-h-[160px] overflow-y-auto hidden"></div>',
        '<div id="imageResults1" class="grid grid-cols-3 gap-2 max-h-[160px] overflow-y-auto hidden"></div>',
        "id панели результатов №1")

    # 3.5 Переключатель источника фотографий + список страниц многостраничника
    markup = patch(markup,
        '''      <div class="flex flex-wrap gap-1.5 pt-1">
        <label class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/5 text-[11px] cursor-pointer hover:bg-white/10"><input type="checkbox" value="animations" checked class="feature-check accent-[#6C5CFF]"> Анимации</label>''',
        '''      <div class="pt-1">
        <label class="text-[11px] font-mono text-white/50 uppercase tracking-wider">Откуда фото на сайте</label>
        <div class="grid grid-cols-3 gap-1.5 mt-1.5 text-[11px]">
          <label class="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 text-center">
            <input type="radio" name="photoMode" value="search" checked class="accent-[#6C5CFF]"> <span>🔎 Реальные фото</span><span class="text-[9px] text-white/40">поиск, бесплатно</span>
          </label>
          <label class="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 text-center">
            <input type="radio" name="photoMode" value="ai" class="accent-[#6C5CFF]"> <span>✨ ИИ-фото</span><span class="text-[9px] text-white/40">~3-5 ₽ за фото</span>
          </label>
          <label class="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 text-center">
            <input type="radio" name="photoMode" value="none" class="accent-[#6C5CFF]"> <span>🎨 Без фото</span><span class="text-[9px] text-white/40">градиенты и CSS</span>
          </label>
        </div>
      </div>
      <div id="pagesBlock" class="pt-1">
        <label class="text-[11px] font-mono text-white/50 uppercase tracking-wider">Страницы сайта (для многостраничника)</label>
        <input id="pagesInput" class="input-field w-full mt-1.5 px-3 py-2 rounded-xl text-[12px]" value="Главная, Каталог, О компании, Отзывы, Контакты" placeholder="Главная, Каталог, Контакты">
        <div class="text-[10px] text-white/40 mt-1">Каждая страница — отдельный HTML-файл, навигация между ними рабочая.</div>
      </div>
      <div class="flex flex-wrap gap-1.5 pt-1">
        <label class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/5 text-[11px] cursor-pointer hover:bg-white/10"><input type="checkbox" value="animations" checked class="feature-check accent-[#6C5CFF]"> Анимации</label>''',
        "блок настроек фото и страниц")

    # 3.55 Индикаторы ключа и баланса в шапке
    markup = patch(markup,
        '''    <div class="flex items-center gap-2">
      <button type="button" onclick="loadExample()"''',
        '''    <div class="flex items-center gap-2">
      <button type="button" id="keyPill" onclick="openKeyModal()" class="px-2.5 py-1 rounded-full text-[11px] font-bold border bg-white/5 border-white/10 cursor-pointer hover:brightness-125 transition">ключ…</button>
      <span id="balancePill" class="hidden px-2.5 py-1 rounded-full text-[11px] font-mono glass">Баланс —</span>
      <button type="button" onclick="loadExample()"''',
        "индикаторы ключа и баланса")

    # 3.56 Четвёртая плитка статистики — стоимость генерации
    markup = patch(markup,
        '''    <!-- Quick Stats -->
    <div class="grid grid-cols-3 gap-3">''',
        '''    <!-- Quick Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">''',
        "сетка статистики")
    markup = patch(markup,
        '''        <div><div class="text-[12px] font-medium" id="statModel">—</div><div class="text-[11px] text-white/40">Модель Polza</div></div>
      </div>
    </div>''',
        '''        <div><div class="text-[12px] font-medium" id="statModel">—</div><div class="text-[11px] text-white/40">Модель Polza</div></div>
      </div>
      <div class="glass rounded-xl p-3 flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-[#00D492]/20 flex items-center justify-center text-[14px]">💰</div>
        <div><div class="text-[12px] font-medium" id="statCost">—</div><div class="text-[11px] text-white/40">Стоимость</div></div>
      </div>
    </div>''',
        "плитка стоимости")

    # 3.6 Кнопки ZIP-архива и самопроверки в тулбаре предпросмотра
    markup = patch(markup,
        '<button onclick="downloadSite()" class="btn-primary px-4 py-1.5 rounded-lg text-[12px] font-bold text-white">⬇ Скачать</button>',
        '''<button onclick="downloadSite()" class="btn-primary px-4 py-1.5 rounded-lg text-[12px] font-bold text-white">⬇ Скачать</button>
        <button onclick="downloadZip()" id="zipBtn" class="btn-ghost px-3 py-1.5 rounded-lg text-[12px] hidden">🗂 ZIP всех страниц</button>
        <button onclick="runSelfTest()" id="testBtn" class="btn-ghost px-3 py-1.5 rounded-lg text-[12px]">🧪 Проверить сайт</button>''',
        "кнопки ZIP и самопроверки")

    # 3.7 Модалки тарифов и PIN владельца + панель диагностики — перед тостом
    markup = patch(markup,
        '<!-- Toast -->',
        '''<!-- Pricing Modal -->
<div id="pricingModal" class="hidden fixed inset-0 z-[110] bg-black/80 backdrop-blur-xl p-4 md:p-8 overflow-y-auto">
  <div class="max-w-[980px] mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h2 class="font-space font-bold text-[24px] md:text-[30px]">💳 Тарифы</h2>
      <button onclick="document.getElementById('pricingModal').classList.add('hidden')" class="w-9 h-9 rounded-xl glass flex items-center justify-center">✕</button>
    </div>
    <div class="grid md:grid-cols-3 gap-4">
      <div class="glass rounded-[20px] p-5 border border-white/10">
        <div class="text-[12px] font-mono text-white/50 uppercase">Старт</div>
        <div class="text-[28px] font-bold mt-1">0 ₽</div>
        <div class="text-[12px] text-white/50 mt-1">Свой ключ Polza AI</div>
        <ul class="text-[12px] text-white/70 mt-3 space-y-1.5">
          <li>✓ Все модели Polza на вашем ключе</li>
          <li>✓ Одностраничники и многостраничники</li>
          <li>✓ Реальный поиск фото</li>
          <li>✓ Скачивание HTML и ZIP</li>
        </ul>
      </div>
      <div class="glass rounded-[20px] p-5 border border-[#6C5CFF]/40 relative">
        <div class="absolute -top-3 left-5 px-3 py-1 rounded-full bg-[#6C5CFF] text-[10px] font-bold text-white">ХИТ</div>
        <div class="text-[12px] font-mono text-white/50 uppercase">Про</div>
        <div class="text-[28px] font-bold mt-1">под ключ</div>
        <div class="text-[12px] text-white/50 mt-1">Сайты для клиентов</div>
        <ul class="text-[12px] text-white/70 mt-3 space-y-1.5">
          <li>✓ Генерация без лимитов владельца</li>
          <li>✓ Многостраничные сайты + ZIP</li>
          <li>✓ ИИ-фото прямо в сайт</li>
          <li>✓ Публикация на домене (по запросу)</li>
        </ul>
      </div>
      <div class="glass rounded-[20px] p-5 border border-white/10">
        <div class="text-[12px] font-mono text-white/50 uppercase">Студия</div>
        <div class="text-[28px] font-bold mt-1">индивидуально</div>
        <div class="text-[12px] text-white/50 mt-1">Поток сайтов и брендинг</div>
        <ul class="text-[12px] text-white/70 mt-3 space-y-1.5">
          <li>✓ Оптовые пакеты генераций</li>
          <li>✓ Свои дизайн-системы и шаблоны</li>
          <li>✓ Поддержка и доработки</li>
        </ul>
      </div>
    </div>
    <div class="glass rounded-[20px] p-5 mt-4 flex flex-wrap items-center justify-between gap-3">
      <div class="text-[12px] text-white/60">Владелец? Введите PIN, чтобы снять лимиты и скрыть тарифы.</div>
      <button onclick="document.getElementById('pricingModal').classList.add('hidden'); document.getElementById('ownerPinModal').classList.remove('hidden')" class="btn-ghost px-4 py-2 rounded-xl text-[12px]">👑 Вход владельца</button>
    </div>
  </div>
</div>

<!-- Owner PIN Modal -->
<div id="ownerPinModal" class="hidden fixed inset-0 z-[120] bg-black/80 backdrop-blur-xl p-4 flex items-center justify-center">
  <div class="glass-strong rounded-[20px] p-6 w-full max-w-[360px]">
    <h3 class="font-space font-bold text-[16px] mb-1">👑 Режим владельца</h3>
    <p class="text-[12px] text-white/50 mb-3">PIN-код скрывает тарифы и включает безлимит.</p>
    <input id="ownerPinInput" type="password" class="input-field w-full px-3 py-2.5 rounded-xl text-[13px]" placeholder="PIN" onkeydown="if(event.key==='Enter') tryOwnerPin()">
    <div class="flex gap-2 mt-3">
      <button onclick="tryOwnerPin()" class="flex-1 btn-primary py-2.5 rounded-xl text-[13px] font-bold text-white">Войти</button>
      <button onclick="document.getElementById('ownerPinModal').classList.add('hidden')" class="btn-ghost px-4 py-2.5 rounded-xl text-[12px]">Отмена</button>
    </div>
  </div>
</div>

<!-- Test Report Modal -->
<div id="testModal" class="hidden fixed inset-0 z-[130] bg-black/80 backdrop-blur-xl p-4 md:p-8 overflow-y-auto">
  <div class="max-w-[760px] mx-auto glass-strong rounded-[20px] p-5">
    <div class="flex items-center justify-between mb-3">
      <h2 class="font-space font-bold text-[18px]">🧪 Проверка сайта</h2>
      <button onclick="document.getElementById('testModal').classList.add('hidden')" class="w-9 h-9 rounded-xl glass flex items-center justify-center">✕</button>
    </div>
    <div id="testReport" class="text-[12px] space-y-1.5 font-mono"></div>
  </div>
</div>

<!-- Toast -->''',
        "модалки тарифов/PIN/диагностики")

    # ==================== СБОРКА ====================

    import json
    runtime_src = (SRC / "runtime.js").read_text(encoding="utf-8")
    js_parts = [f"window.__NS_RUNTIME__ = {json.dumps(runtime_src, ensure_ascii=False)};"]
    for name in ["app.core.js", "app.gen.js", "app.ui.js"]:
        p = SRC / name
        if not p.exists():
            fail(f"нет {p}")
        js_parts.append(f"/* ===== {name} ===== */\n" + p.read_text(encoding="utf-8"))
    app_js = "\n\n".join(js_parts)

    html = f"""{head}
{TAILWIND}
<script>
{tw_config}
</script>
{markup}
<script>
{app_js}
</script>
</body>
</html>
"""
    (ROOT / "index.html").write_text(html, encoding="utf-8")
    (ROOT / "generator.html").write_text(html, encoding="utf-8")

    print(f"Готово: index.html ({len(html)} байт, {html.count(chr(10)) + 1} строк) + generator.html")
    print(f"JS-часть: {len(app_js)} байт")


if __name__ == "__main__":
    main()
