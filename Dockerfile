FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

WORKDIR /app

COPY pyproject.toml uv.lock .python-version README.md ./
RUN uv sync --frozen --no-dev --no-install-project

COPY main.py name_fortune.py ./
COPY scripts ./scripts
COPY static ./static

RUN mkdir -p /app/data/sources /app/data/generated

VOLUME ["/app/data/sources", "/app/data/generated"]
EXPOSE 8000

CMD ["sh", "-c", "uv run --no-sync python name_fortune.py --ensure-data && exec uv run --no-sync uvicorn main:app --host 0.0.0.0 --port 8000"]
