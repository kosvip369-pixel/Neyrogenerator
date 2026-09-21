#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NeuraSite AI — серверная часть (необязательная).

Зачем она нужна:
  1) Скрыть ключ Polza AI от посетителей (в браузерной версии ключ виден всем).
  2) Искать фотографии серверно через Unsplash / Pexels / Pixabay, если заданы их ключи.
  3) Раздавать сам генератор и отдавать прокси к API Polza.

Запуск:      uvicorn generator_server:app --host 0.0.0.0 --port 8000
Переменные:  POLZA_API_KEY, UNSPLASH_ACCESS_KEY, PEXELS_API_KEY, PIXABAY_API_KEY, ALLOW_OWN_KEY=0
"""
import base64
import hashlib
import json
import os
import re
import time
import urllib.parse
from typing import Any, Dict, List, Optional

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse

POLZA_BASE = os.environ.get("POLZA_BASE", "https://polza.ai/api/v1")
POLZA_API_KEY = os.environ.get("POLZA_API_KEY", "").strip()
UNSPLASH_ACCESS_KEY = os.environ.get("UNSPLASH_ACCESS_KEY", "").strip()
PEXELS_API_KEY = os.environ.get("PEXELS_API_KEY", "").strip()
PIXABAY_API_KEY = os.environ.get("PIXABAY_API_KEY", "").strip()

# Разрешить посетителям использовать свой ключ Polza (заголовок X-Polza-Key).
ALLOW_OWN_KEY = os.environ.get("ALLOW_OWN_KEY", "1") not in ("0", "false", "False")

# Модели по умолчанию (проверены в каталоге Polza 21.09.2026).
DEFAULT_TEXT_MODEL = os.environ.get("DEFAULT_TEXT_MODEL", "anthropic/claude-sonnet-4.5")
DEFAULT_REFINE_MODEL = os.environ.get("DEFAULT_REFINE_MODEL", "anthropic/claude-haiku-4.5")
DEFAULT_IMAGE_MODEL = os.environ.get("DEFAULT_IMAGE_MODEL", "google/gemini-2.5-flash-image")

ROOT = os.path.dirname(os.path.abspath(__file__))

app = FastAPI(title="NeuraSite AI backend", version="2.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=False,
    allow_methods=["*"], allow_headers=["*"], expose_headers=["*"],
)

TIMEOUT = httpx.Timeout(600.0, connect=30.0)

# Лимиты трат (защита от утечки ключа и от случайных зацикленных генераций).
MAX_DAILY_RUB = float(os.environ.get("MAX_DAILY_RUB", "100"))     # 0 = без лимита
MIN_BALANCE_RUB = float(os.environ.get("MIN_BALANCE_RUB", "5"))   # ниже этого баланса генерация не запускается
SPEND_FILE = os.environ.get("SPEND_FILE", os.path.join(ROOT, ".spend_log.json"))


def _load_spend() -> Dict[str, Any]:
    try:
        with open(SPEND_FILE, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        if data.get("date") != time.strftime("%Y-%m-%d"):
            return {"date": time.strftime("%Y-%m-%d"), "spent": 0.0, "requests": 0}
        return data
    except Exception:
        return {"date": time.strftime("%Y-%m-%d"), "spent": 0.0, "requests": 0}


def _add_spend(rub: float) -> None:
    data = _load_spend()
    data["spent"] = round(float(data.get("spent", 0)) + float(rub or 0), 4)
    data["requests"] = int(data.get("requests", 0)) + 1
    try:
        with open(SPEND_FILE, "w", encoding="utf-8") as fh:
            json.dump(data, fh)
    except Exception:
        pass


def _usage_cost(content: bytes) -> float:
    try:
        usage = (json.loads(content) or {}).get("usage") or {}
        return float(usage.get("cost_rub") or usage.get("cost") or 0)
    except Exception:
        return 0.0


def _cost_from_sse(raw: bytes) -> float:
    """Достаёт cost_rub из последних SSE-чанков стрима."""
    try:
        text = raw.decode("utf-8", "replace")
    except Exception:
        return 0.0
    best = 0.0
    for m in re.finditer(r'"cost_rub"\s*:\s*([0-9.]+)', text):
        try:
            best = max(best, float(m.group(1)))
        except Exception:
            pass
    return best


async def guard_spend(request: Request) -> None:
    """Не даём ключу утечь в ноль: лимит в сутки + минимальный остаток на балансе."""
    if MAX_DAILY_RUB > 0:
        data = _load_spend()
        if float(data.get("spent", 0)) >= MAX_DAILY_RUB:
            raise HTTPException(
                status_code=429,
                detail=f"Достигнут дневной лимит трат ({MAX_DAILY_RUB:.0f} ₽). Изменить: переменная MAX_DAILY_RUB.",
            )
    if MIN_BALANCE_RUB > 0:
        key = pick_key(request)
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(20.0)) as client:
                r = await client.get(f"{POLZA_BASE}/balance", headers={"Authorization": f"Bearer {key}"})
            if r.status_code == 200:
                available = float((r.json() or {}).get("available") or 0)
                if available < MIN_BALANCE_RUB:
                    raise HTTPException(
                        status_code=402,
                        detail=f"На балансе {available:.2f} ₽ — меньше минимума {MIN_BALANCE_RUB:.0f} ₽. Пополните счёт.",
                    )
        except HTTPException:
            raise
        except Exception:
            pass  # не смогли проверить баланс — не блокируем работу


def pick_key(request: Request) -> str:
    """Ключ сервера либо ключ посетителя (если разрешено)."""
    own = (request.headers.get("X-Polza-Key") or "").strip()
    if own and ALLOW_OWN_KEY:
        return own
    if POLZA_API_KEY:
        return POLZA_API_KEY
    if own:
        return own
    raise HTTPException(status_code=401, detail="Не задан POLZA_API_KEY на сервере и не передан X-Polza-Key")


def polza_error(resp: httpx.Response) -> HTTPException:
    text = resp.text[:400]
    try:
        body = resp.json()
        msg = body.get("error", {}).get("message") or body.get("detail") or text
    except Exception:
        msg = text
    return HTTPException(status_code=resp.status_code, detail=f"Polza API: {msg}")


# --------------------------------------------------------------------------- #
# Служебное
# --------------------------------------------------------------------------- #
@app.get("/health")
async def health():
    return {
        "ok": True,
        "polza_key": bool(POLZA_API_KEY),
        "own_key_allowed": ALLOW_OWN_KEY,
        "photo_sources": {
            "unsplash": bool(UNSPLASH_ACCESS_KEY),
            "pexels": bool(PEXELS_API_KEY),
            "pixabay": bool(PIXABAY_API_KEY),
            "openverse": True,
        },
        "models": {"text": DEFAULT_TEXT_MODEL, "refine": DEFAULT_REFINE_MODEL, "image": DEFAULT_IMAGE_MODEL},
        "limits": {"daily_rub": MAX_DAILY_RUB, "min_balance_rub": MIN_BALANCE_RUB, "spent_today": _load_spend().get("spent", 0)},
    }


@app.get("/")
async def index():
    path = os.path.join(ROOT, "index.html")
    if os.path.exists(path):
        return FileResponse(path)
    return JSONResponse({"detail": "index.html не найден рядом с сервером"}, status_code=404)


# --------------------------------------------------------------------------- #
# Прокси к Polza (ключ остаётся на сервере)
# --------------------------------------------------------------------------- #
@app.post("/api/proxy/chat/completions")
async def proxy_chat(request: Request):
    await guard_spend(request)
    body = await request.json()
    body.setdefault("model", DEFAULT_TEXT_MODEL)
    body.setdefault("max_tokens", 32000)
    stream = bool(body.get("stream"))
    headers = {"Authorization": f"Bearer {pick_key(request)}", "Content-Type": "application/json"}

    if stream:
        async def gen():
            tail = b""
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                async with client.stream("POST", f"{POLZA_BASE}/chat/completions", json=body, headers=headers) as resp:
                    if resp.status_code >= 400:
                        detail = (await resp.aread()).decode("utf-8", "replace")
                        yield f"data: {json.dumps({'error': {'message': detail[:400]}}, ensure_ascii=False)}\n\n"
                        return
                    async for chunk in resp.aiter_bytes():
                        tail = (tail + chunk)[-4000:]
                        yield chunk
            cost = _cost_from_sse(tail)
            if cost:
                _add_spend(cost)
        return StreamingResponse(gen(), media_type="text/event-stream")

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(f"{POLZA_BASE}/chat/completions", json=body, headers=headers)
    if resp.status_code >= 400:
        raise polza_error(resp)
    _add_spend(_usage_cost(resp.content))
    return Response(content=resp.content, media_type="application/json")


@app.post("/api/proxy/images/generations")
async def proxy_images(request: Request):
    await guard_spend(request)
    body = await request.json()
    body.setdefault("model", DEFAULT_IMAGE_MODEL)
    body.setdefault("n", 1)
    body.setdefault("response_format", "url")
    headers = {"Authorization": f"Bearer {pick_key(request)}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(f"{POLZA_BASE}/images/generations", json=body, headers=headers)
    if resp.status_code >= 400:
        raise polza_error(resp)
    return Response(content=resp.content, media_type="application/json")


@app.post("/api/proxy/media")
async def proxy_media_create(request: Request):
    await guard_spend(request)
    body = await request.json()
    body.setdefault("model", DEFAULT_IMAGE_MODEL)
    headers = {"Authorization": f"Bearer {pick_key(request)}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(f"{POLZA_BASE}/media", json=body, headers=headers)
    if resp.status_code >= 400:
        raise polza_error(resp)
    return Response(content=resp.content, media_type="application/json")


@app.get("/api/proxy/media/{media_id}")
async def proxy_media_status(media_id: str, request: Request):
    headers = {"Authorization": f"Bearer {pick_key(request)}"}
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.get(f"{POLZA_BASE}/media/{media_id}", headers=headers)
    if resp.status_code >= 400:
        raise polza_error(resp)
    # завершённая генерация картинки = потраченные деньги: учитываем их в лимите
    try:
        data = json.loads(resp.content)
        if data.get("status") == "completed":
            cost = (data.get("usage") or {}).get("cost_rub") or 0
            if cost and not data.get("__counted"):
                _add_spend(cost)
    except Exception:
        pass
    return Response(content=resp.content, media_type="application/json")


@app.get("/api/proxy/models")
async def proxy_models():
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.get(f"{POLZA_BASE}/models")
    if resp.status_code >= 400:
        raise polza_error(resp)
    return Response(content=resp.content, media_type="application/json")


@app.get("/api/proxy/balance")
async def proxy_balance(request: Request):
    headers = {"Authorization": f"Bearer {pick_key(request)}"}
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.get(f"{POLZA_BASE}/balance", headers=headers)
    if resp.status_code >= 400:
        raise polza_error(resp)
    return Response(content=resp.content, media_type="application/json")


# --------------------------------------------------------------------------- #
# Фотографии (серверный поиск: ключи остаются на сервере)
# --------------------------------------------------------------------------- #
ARCHIVE_WORDS = re.compile(
    r"(18\d\d|19\d\d|20[0-1]\d|archiv|historic|engraving|etching|lithograph|drawing|sketch|painting|"
    r"postcard|poster|stamp|manuscript|museum|memorial|monument|map of)", re.I)
BAD_TITLE = re.compile(r"(logo|clipart|icon|diagram|chart|screenshot|scan of|document|signature|coat of arms|qr code)", re.I)
_photo_cache: Dict[str, Dict[str, Any]] = {}


def _clean(items: List[Dict[str, Any]], query: str) -> List[Dict[str, Any]]:
    out, seen, seen_titles = [], set(), set()
    for it in items:
        url = it.get("url")
        if not url or not url.startswith("https://"):
            continue
        key = hashlib.md5(url.split("?")[0].lower().encode()).hexdigest()
        title_key = re.sub(r"[^a-zа-я0-9]+", "", (it.get("title") or "").lower())[:45]
        if key in seen or (title_key and title_key in seen_titles):
            continue
        seen.add(key)
        if title_key:
            seen_titles.add(title_key)
        text = f"{it.get('title','')} {it.get('tags','')}"
        if ARCHIVE_WORDS.search(text) or BAD_TITLE.search(text):
            continue
        w, h = it.get("width") or 0, it.get("height") or 0
        if w and h and (w < 900 or h < 600):
            continue
        if re.search(r"\.(svg|gif|tif|tiff)(\?|$)", url, re.I):
            continue
        words = [w2 for w2 in query.lower().split() if len(w2) > 3]
        score = sum(3 for w2 in words if w2 in text.lower())
        if w >= 2400:
            score += 2
        elif w >= 1400:
            score += 1.5
        if w and h and 1.2 < w / h < 2.4:
            score += 1
        score += {"pexels": 3, "pixabay": 3, "unsplash": 3, "openverse": 1}.get(it.get("source", ""), 0)
        it["score"] = score
        out.append(it)
    out.sort(key=lambda x: -x["score"])
    return out


async def _unsplash(client: httpx.AsyncClient, query: str, count: int) -> List[Dict[str, Any]]:
    if not UNSPLASH_ACCESS_KEY:
        return []
    r = await client.get("https://api.unsplash.com/search/photos", params={
        "query": query, "per_page": count, "orientation": "landscape"}, headers={"Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}"})
    if r.status_code != 200:
        return []
    return [{
        "url": (p["urls"].get("regular") or p["urls"]["full"]), "thumb": p["urls"].get("small"),
        "title": p.get("alt_description") or query, "author": (p.get("user") or {}).get("name", ""),
        "source": "unsplash", "width": p.get("width"), "height": p.get("height"),
    } for p in r.json().get("results", [])]


async def _pexels(client: httpx.AsyncClient, query: str, count: int) -> List[Dict[str, Any]]:
    if not PEXELS_API_KEY:
        return []
    r = await client.get("https://api.pexels.com/v1/search", params={
        "query": query, "per_page": count, "orientation": "landscape"}, headers={"Authorization": PEXELS_API_KEY})
    if r.status_code != 200:
        return []
    return [{
        "url": (p["src"].get("large2x") or p["src"]["large"]), "thumb": p["src"].get("medium"),
        "title": p.get("alt") or query, "author": p.get("photographer", ""),
        "source": "pexels", "width": p.get("width"), "height": p.get("height"),
    } for p in r.json().get("photos", [])]


async def _pixabay(client: httpx.AsyncClient, query: str, count: int) -> List[Dict[str, Any]]:
    if not PIXABAY_API_KEY:
        return []
    r = await client.get("https://pixabay.com/api/", params={
        "key": PIXABAY_API_KEY, "q": query, "image_type": "photo", "orientation": "horizontal",
        "safesearch": "true", "per_page": max(3, count)})
    if r.status_code != 200:
        return []
    return [{
        "url": h.get("largeImageURL") or h.get("webformatURL"), "thumb": h.get("webformatURL"),
        "title": h.get("tags") or query, "author": h.get("user", ""),
        "source": "pixabay", "width": h.get("imageWidth"), "height": h.get("imageHeight"),
    } for h in r.json().get("hits", [])]


async def _openverse(client: httpx.AsyncClient, query: str, count: int) -> List[Dict[str, Any]]:
    r = await client.get("https://api.openverse.org/v1/images/", params={
        "q": query, "page_size": min(20, count * 4), "license_type": "commercial", "mature": "false"})
    if r.status_code != 200:
        return []
    return [{
        "url": x.get("url"), "thumb": x.get("thumbnail") or x.get("url"),
        "title": x.get("title") or query, "author": x.get("creator", ""), "source": "openverse",
        "width": x.get("width"), "height": x.get("height"),
        "tags": " ".join(t.get("name", "") if isinstance(t, dict) else str(t) for t in (x.get("tags") or [])),
    } for x in r.json().get("results", [])]


@app.get("/api/photos")
async def photos(q: str, count: int = 8):
    q = (q or "").strip()
    if not q:
        raise HTTPException(status_code=400, detail="Пустой запрос")
    key = f"{q.lower()}|{count}"
    hit = _photo_cache.get(key)
    if hit and time.time() - hit["at"] < 3600:
        return {"images": hit["images"], "cached": True}

    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
        import asyncio
        results = await asyncio.gather(
            _pexels(client, q, count), _unsplash(client, q, count), _pixabay(client, q, count),
            return_exceptions=True)
        items: List[Dict[str, Any]] = []
        for r in results:
            if isinstance(r, list):
                items.extend(r)
        items = _clean(items, q)
        if len(items) < 3:
            extra = await asyncio.gather(_openverse(client, q, count), return_exceptions=True)
            for r in extra:
                if isinstance(r, list):
                    items.extend(_clean(r, q))
            items = _clean(items, q)

    images = items[:count]
    if images:
        _photo_cache[key] = {"at": time.time(), "images": images}
    return {"images": images, "cached": False}


# --------------------------------------------------------------------------- #
# Генерация (серверные обёртки: браузерная версия делает это сама)
# --------------------------------------------------------------------------- #
@app.post("/api/generate")
async def generate(payload: Dict[str, Any], request: Request):
    await guard_spend(request)
    prompt = (payload.get("prompt") or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Пустой prompt")
    system = payload.get("system") or "Ты senior frontend-разработчик. Верни только HTML-код страницы целиком."
    key = pick_key(request)
    body = {
        "model": payload.get("model") or DEFAULT_TEXT_MODEL,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
        "max_tokens": int(payload.get("max_tokens") or 32000),
        "temperature": float(payload.get("temperature") or 0.8),
    }
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(f"{POLZA_BASE}/chat/completions", json=body,
                                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    if resp.status_code >= 400:
        raise polza_error(resp)
    data = resp.json()
    choice = (data.get("choices") or [{}])[0]
    html = (choice.get("message") or {}).get("content", "")
    _add_spend(((data.get("usage") or {}).get("cost_rub") or 0))
    return {"html": html, "model": body["model"], "finish_reason": choice.get("finish_reason"), "usage": data.get("usage")}


@app.post("/api/refine")
async def refine(payload: Dict[str, Any], request: Request):
    await guard_spend(request)
    current_html = payload.get("current_html") or ""
    message = payload.get("message") or ""
    if not current_html or not message:
        raise HTTPException(status_code=400, detail="Нужны current_html и message")
    key = pick_key(request)
    body = {
        "model": payload.get("model") or DEFAULT_REFINE_MODEL,
        "messages": [
            {"role": "system", "content": "Ты senior frontend. Верни ПОЛНЫЙ обновлённый HTML, сохранив всё остальное. Только код."},
            {"role": "user", "content": f"Запрос: {message}\n\nТекущий HTML:\n{current_html[:400000]}\n\nВерни полный HTML."},
        ],
        "max_tokens": 32000, "temperature": 0.6,
    }
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(f"{POLZA_BASE}/chat/completions", json=body,
                                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    if resp.status_code >= 400:
        raise polza_error(resp)
    data = resp.json()
    _add_spend(((data.get("usage") or {}).get("cost_rub") or 0))
    return {"html": (data.get("choices") or [{}])[0].get("message", {}).get("content", ""), "model": body["model"]}


@app.post("/api/generate-image")
async def generate_image(payload: Dict[str, Any], request: Request):
    await guard_spend(request)
    prompt = (payload.get("prompt") or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Пустой prompt")
    key = pick_key(request)
    model = payload.get("model") or DEFAULT_IMAGE_MODEL
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        start = await client.post(f"{POLZA_BASE}/images/generations",
                                 json={"model": model, "prompt": prompt, "n": 1, "response_format": "url"}, headers=headers)
        if start.status_code >= 400:
            raise polza_error(start)
        data = start.json()
        media_id = data.get("requestId") or data.get("id")
        direct = ((data.get("data") or [{}])[0] or {}).get("url")
        if direct:
            return {"url": direct, "model": model}
        if not media_id:
            raise HTTPException(status_code=502, detail=f"Неожиданный ответ Polza: {str(data)[:200]}")

        deadline = time.time() + 240
        while time.time() < deadline:
            await __import__("asyncio").sleep(2.5)
            st = await client.get(f"{POLZA_BASE}/media/{media_id}", headers={"Authorization": f"Bearer {key}"})
            if st.status_code >= 400:
                continue
            sj = st.json()
            if sj.get("status") == "completed":
                url = ((sj.get("data") or [{}])[0] or {}).get("url")
                if url:
                    cost = (sj.get("usage") or {}).get("cost_rub") or 0
                    _add_spend(cost)
                    return {"url": url, "model": model, "cost_rub": cost}
                break
            if sj.get("status") in ("failed", "cancelled"):
                raise HTTPException(status_code=502, detail=f"Генерация не удалась: {str(sj.get('error'))[:200]}")
    raise HTTPException(status_code=504, detail="Картинка не дождалась результата")


# --------------------------------------------------------------------------- #
# Публикация статики (простой вариант «опубликовать сайт»)
# --------------------------------------------------------------------------- #
SITES_DIR = os.environ.get("SITES_DIR", os.path.join(ROOT, "published_sites"))


@app.post("/api/publish")
async def publish(payload: Dict[str, Any]):
    files = payload.get("files") or []
    if isinstance(payload.get("html"), str):
        files = [{"name": "index.html", "content": payload["html"]}] + files
    files = [f for f in files if f.get("name") and isinstance(f.get("content"), str)]
    if not files:
        raise HTTPException(status_code=400, detail="Нет файлов для публикации")
    slug = re.sub(r"[^a-z0-9-]", "", (payload.get("slug") or "").lower()) or hashlib.md5(
        ("".join(f["content"] for f in files)).encode()).hexdigest()[:10]
    target = os.path.join(SITES_DIR, slug)
    os.makedirs(target, exist_ok=True)
    for f in files:
        name = os.path.basename(f["name"])
        with open(os.path.join(target, name), "w", encoding="utf-8") as fh:
            fh.write(f["content"])
    return {"url": f"/p/{slug}/", "slug": slug, "files": [os.path.basename(f["name"]) for f in files]}


@app.get("/p/{slug}/")
@app.get("/p/{slug}/{filename}")
async def published(slug: str, filename: str = "index.html"):
    safe = os.path.basename(filename)
    if "." not in safe:
        safe += ".html"
    path = os.path.join(SITES_DIR, os.path.basename(slug), safe)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Страница не найдена")
    return FileResponse(path, media_type="text/html; charset=utf-8")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
