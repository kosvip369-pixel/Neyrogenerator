#!/usr/bin/env bash
# Запуск NeuraSite AI — генератора сайтов на Polza AI
set -e

PORT="${PORT:-8000}"

# Виртуальное окружение (если есть) — иначе системный python
if [ -d ".venv" ] && [ -x ".venv/bin/python" ]; then
  PY=".venv/bin/python"
else
  PY="python3"
fi

if ! command -v "$PY" >/dev/null 2>&1; then
  echo "Python не найден. Установите зависимости: pip install -r requirements.txt" >&2
  exit 1
fi

echo "▶ NeuraSite AI запускается на порту ${PORT}..."
exec "$PY" generator_server.py
