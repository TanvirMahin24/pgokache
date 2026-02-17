# Architecture

- Collector checks setup readiness and skips unready instances.
- Snapshots store top query metrics from `pg_stat_statements`.
- API exposes instances, setup states, snapshots, and recommendations.
