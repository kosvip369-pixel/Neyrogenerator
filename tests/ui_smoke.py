#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Дымовой тест интерфейса генератора: открывает страницу в настоящем браузере,
кликает по кнопкам и проверяет, что всё живо.

Подготовка:
    pip install playwright && python -m playwright install chromium
Запуск:
    python tests/ui_smoke.py                     # только интерфейс, без обращения к платному API
    python tests/ui_smoke.py --generate          # ещё и реальная генерация сайта (тратит деньги)
    python tests/ui_smoke.py --url http://127.0.0.1:8000/   # проверка серверной версии
"""
import argparse
import json
import os
import pathlib
import sys
import time

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sys.exit("Нужен playwright: pip install playwright && python -m playwright install chromium")

FUNCTIONS = [
    "generateSite", "downloadSite", "downloadZip", "copyCode", "openInNewTab", "shareSite",
    "sendChat", "quickChat", "searchImages", "generateImage", "insertImage", "randomize",
    "clearAll", "loadExample", "setDevice", "toggleCode", "openPricingModal", "tryOwnerPin",
    "runSelfTest", "renderModels", "selectModel", "saveKeyFromModal", "savePhotoKeys",
    "switchImgTool", "handleUserPhotoSelected", "applyAiPhotoshop", "startVoiceInput",
    "showPreviewFile", "restoreHistory", "setPrompt", "setColors",
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default=os.environ.get("NS_URL", "http://127.0.0.1:8321/index.html"))
    ap.add_argument("--generate", action="store_true", help="выполнить реальную генерацию (тратит баланс Polza)")
    ap.add_argument("--key", default=os.environ.get("POLZA_API_KEY", ""), help="ключ Polza для режима --generate")
    args = ap.parse_args()

    problems = []
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        page = browser.new_page(viewport={"width": 1440, "height": 950})
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(args.url, wait_until="domcontentloaded")
        page.wait_for_timeout(2000)

        print("1. Ошибки JavaScript:", errors or "нет ✅")
        if errors:
            problems.append("ошибки JS: " + "; ".join(errors[:3]))

        missing = [f for f in FUNCTIONS if not page.evaluate(f"typeof window['{f}'] === 'function'")]
        print("2. Функции кнопок:", "все на месте ✅" if not missing else f"НЕТ: {missing}")
        if missing:
            problems.append("нет функций: " + ", ".join(missing))

        dupes = page.evaluate(
            "() => { const seen={},d=[]; document.querySelectorAll('[id]').forEach(e=>{ if(seen[e.id]) d.push(e.id); seen[e.id]=1 }); return d }")
        print("3. Дубли id:", dupes or "нет ✅")
        if dupes:
            problems.append("дубли id: " + ", ".join(dupes))

        report = page.evaluate("async () => (await runSelfTest(false)).map(c => ({ok:c.ok, l:c.label, d:c.detail}))")
        page.evaluate("document.getElementById('testModal').classList.add('hidden')")
        for c in report:
            print(("   ✅ " if c["ok"] else "   ❌ ") + c["l"] + (f" — {c['d']}" if c["d"] else ""))
        problems += [c["l"] for c in report if not c["ok"]]

        if args.generate:
            if args.key:
                page.fill("#keyModalInput", args.key)
                page.click("text=💾 Сохранить ключ")
                page.wait_for_timeout(800)
            page.fill("#siteName", "Smoke Test")
            page.select_option("#businessType", "IT / SaaS / Стартап")
            page.select_option("#siteType", "landing")
            page.fill("#mainPrompt", "Тестовый лендинг: герой, три преимущества, контакты.")
            page.check("input[name=photoMode][value=search]")
            page.evaluate("state.model = 'deepseek/deepseek-v3.2'")
            print("4. Генерация сайта…")
            t0 = time.time()
            page.evaluate("generateSite()")
            for _ in range(140):
                page.wait_for_timeout(3000)
                st = page.evaluate("({gen: state.generating, len:(state.html||'').length})")
                if not st["gen"] and st["len"] > 0:
                    break
            page.wait_for_timeout(3000)
            res = page.evaluate("""() => { const d = document.getElementById('previewFrame').contentDocument; return {
                len: (window.state && state.html || '').length,
                sections: d.querySelectorAll('section').length,
                imgs: d.images.length,
                broken: [...d.images].filter(i => i.complete && i.naturalWidth === 0).length,
                invisible: [...d.querySelectorAll('section')].filter(s => parseFloat(getComputedStyle(s).opacity) < 0.05).length } }""")
            print(f"   за {time.time() - t0:.0f} сек: HTML {res['len']} символов, секций {res['sections']}, "
                  f"фото {res['imgs']} (битых {res['broken']}), невидимых секций {res['invisible']}")
            if res["len"] < 3000 or res["broken"] or res["invisible"]:
                problems.append("проблемы в сгенерированном сайте: " + json.dumps(res, ensure_ascii=False))

        pathlib.Path("smoke_result.json").write_text(json.dumps({"problems": problems}, ensure_ascii=False), encoding="utf-8")
        browser.close()

    print("\nИТОГ:", "всё в порядке ✅" if not problems else f"проблемы: {problems}")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
