# DO Managed Postgres

Syenite MCP uses **PostgreSQL** (DO Managed Database). The app spec attaches the cluster so the app receives `DATABASE_URL` at runtime.

## Cluster

- **Name:** `syenite-db`
- **Region:** nyc1
- **Engine:** PostgreSQL 18
- **Size:** db-s-1vcpu-1gb, 1 node

## App link

The `mcp/app-spec.yaml` includes:

```yaml
databases:
  - name: postgres
    engine: PG
    production: true
    cluster_name: syenite-db
    db_name: defaultdb
    db_user: doadmin
```

The **mcp-server** service has `DATABASE_URL` set to `${postgres.DATABASE_URL}` (bindable variable). No manual connection string in the repo.

## Useful commands

- List databases: `doctl databases list`
- Connection string: `doctl databases connection <cluster-id>` (cluster ID from list)
- App spec (after attaching DB): `doctl apps spec get <app-id>`

## Schema

Tables are created on startup by `initSchema()` in `mcp/src/data/db.ts`: `cache`, `api_keys`, `usage_logs`, `snapshots`.
