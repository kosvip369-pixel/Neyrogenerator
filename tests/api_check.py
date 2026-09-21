#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Проверка API без браузера: форматы Polza AI, поиск фотографий, сборка ZIP-логики.
Тратит копейки (несколько коротких запросов) либо ничего, если ключ не передан.

Запуск:  POLZA_API_KEY=pza_... python tests/api_check.py
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

POLZA = os.environ.get("POLZA_BASE", "https://polza.ai/api/v1")
KEY = os.environ.get("POLZA_API_KEY", "").strip()
ok, bad = [], []


def check(cond, label, detail=""):
    (ok if cond else bad).append(label + (f" — {detail}" if detail else ""))
    print(("  ✅ " if cond else "  ❌ ") + label + (f" — {detail}" if detail else ""))


def req(url, data=None, headers=None, method=None):
    h = {"Content-Type": "application/json"}
    if KEY:
        h["Authorization"] = f"Bearer {KEY}"
    if headers:
        h.update(headers)
    r = urllib.request.Request(url, data=(json.dumps(data).encode() if data is not None else None), headers=h,
                               method=method or ("POST" if data is not None else "GET"))
    with urllib.request.urlopen(r, timeout=90) as resp:
        return resp.status, json.loads(resp.read())


print("1. Каталог моделей Polza")
try:
    _, cat = req(f"{POLZA}/models")
    models = {m["id"] for m in cat["data"]}
    check(len(models) > 100, "каталог доступен", f"{len(models)} моделей")
    for mid in ["anthropic/claude-sonnet-4.5", "anthropic/claude-haiku-4.5", "deepseek/deepseek-v3.2",
                "google/gemini-2.5-flash-image", "bytedance/seedream-4.5"]:
        check(mid in models, f"модель в каталоге: {mid}")
    check("anthropic/claude-sonnet-4-5" not in models, "старый id с дефисом отсутствует (его и не должно быть)")
except Exception as e:
    check(False, "каталог моделей", str(e)[:120])

print("\n2. Поиск фотографий (Openverse, без ключей)")
try:
    url = "https://api.openverse.org/v1/images/?" + urllib.parse.urlencode(
        {"q": "coffee shop interior", "page_size": 5, "license_type": "commercial"})
    r = urllib.request.Request(url, headers={"User-Agent": "NeuraSite-check/1.0"})
    data = json.loads(urllib.request.urlopen(r, timeout=30).read())
    check(len(data.get("results", [])) > 0, "фото находятся", f"{len(data.get('results', []))} шт.")
except Exception as e:
    check(False, "поиск фото", str(e)[:120])

print("\n3. Wikimedia Commons (запасной источник)")
try:
    url = ("https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch="
           + urllib.parse.quote("filetype:bitmap modern office") + "&gsrlimit=3&gsrnamespace=6&prop=imageinfo"
           "&iiprop=url&iiurlwidth=1200&format=json&origin=*")
    r = urllib.request.Request(url, headers={"User-Agent": "NeuraSite-check/1.0"})
    data = json.loads(urllib.request.urlopen(r, timeout=30).read())
    check(bool(data.get("query", {}).get("pages")), "Commons отвечает")
except Exception as e:
    check(False, "Wikimedia Commons", str(e)[:120])

if KEY:
    print("\n4. Реальный вызов модели (ключ передан)")
    try:
        t0 = time.time()
        st, j = req(f"{POLZA}/chat/completions", {
            "model": "deepseek/deepseek-v3.2",
            "messages": [{"role": "user", "content": "Ответь одним словом: работает"}],
            "max_tokens": 10, "stream": False})
        text = j["choices"][0]["message"]["content"].strip()
        cost = (j.get("usage") or {}).get("cost_rub")
        check(bool(text), "модель ответила", f"«{text[:30]}» за {time.time() - t0:.1f} сек, {cost} ₽")
    except urllib.error.HTTPError as e:
        check(False, "вызов модели", f"HTTP {e.code}: {e.read().decode()[:120]}")
    except Exception as e:
        check(False, "вызов модели", str(e)[:120])

    print("\n5. Генерация изображения (проверяем только постановку задачи)")
    try:
        st, j = req(f"{POLZA}/images/generations",
                    {"model": "google/gemini-2.5-flash-image", "prompt": "тестовая картинка", "n": 1,
                     "response_format": "url"})
        task_id = j.get("requestId") or j.get("id")
        check(bool(task_id), "задача генерации принята", f"id={task_id}")
    except Exception as e:
        check(False, "генерация изображения", str(e)[:150])
else:
    print("\n4-5. Вызовы моделей пропущены: не передан POLZA_API_KEY")

print(f"\nИТОГ: успешно {len(ok)}, ошибок {len(bad)}")
for b in bad:
    print("  ❌", b)
sys.exit(1 if bad else 0)
