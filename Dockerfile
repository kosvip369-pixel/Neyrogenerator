FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# POLZA_API_KEY передавайте через переменные окружения, не в код
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn generator_server:app --host 0.0.0.0 --port ${PORT}"]
