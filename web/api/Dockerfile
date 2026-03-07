FROM --platform=linux/amd64 python:3.12-slim

WORKDIR /app

# Copy requirements first for caching
COPY web/api/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the full project (scripts need to be accessible)
COPY scripts/ ./scripts/
COPY web/api/ ./web/api/

# Copy React dashboard build
COPY dashboard/dist/ ./dashboard/dist/

# Fly.io provides PORT env var (default 8000)
ENV PORT=8000

EXPOSE ${PORT}

CMD uvicorn web.api.main:app --host 0.0.0.0 --port ${PORT}
