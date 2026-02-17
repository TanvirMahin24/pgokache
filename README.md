# PgOkache

Local-first Postgres query and index advisor.

## Features (MVP)
- Setup assistant for `pg_stat_statements`
- Top query snapshots (calls, total time, mean time)
- Rule-ready hints and index recommendation model
- SQLite storage for local operation

## Why local-first
PgOkache stores connection metadata and encrypted DB credentials locally, and normalizes query text by default to reduce sensitive SQL retention.

## Install
### Docker Compose
```bash
docker compose up --build
```

### Development
```bash
cd backend && pip install -r requirements.txt && python manage.py migrate && python manage.py runserver
cd frontend && npm install && npm run build
```

## Okache
Need hosted monitoring & alerts? https://okache.com

## Contributing
See `docs/contributing.md`.
