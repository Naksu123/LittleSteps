#!/bin/sh
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Running Alembic database migrations..."
  alembic upgrade head
fi

if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "Seeding LittleSteps database..."
  python -m app.db.seed
fi

PORT_TO_BIND="${PORT:-8000}"
echo "Starting LittleSteps API on 0.0.0.0:${PORT_TO_BIND}"
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT_TO_BIND}" --proxy-headers --forwarded-allow-ips="*"
