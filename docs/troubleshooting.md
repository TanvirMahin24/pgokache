# Troubleshooting

- If setup is `NEEDS_PRELOAD`, add `pg_stat_statements` to `shared_preload_libraries` and restart Postgres.
- If setup is `NEEDS_CREATE_EXTENSION`, run `CREATE EXTENSION IF NOT EXISTS pg_stat_statements;`.
