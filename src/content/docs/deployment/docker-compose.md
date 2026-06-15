---
title: Docker Compose
description: The reference production stack.
---

The recommended way to run Semantic Firewall in production is the bundled Docker Compose file. It brings up the gateway, Postgres, and Redis with sensible defaults that are documented and overridable.

## What's in the stack

```yaml
services:
  gateway:
    image: semantic-firewall/gateway:0.4.1
    ports:
      - "8080:8080"     # HTTP API
      - "8081:8081"     # Dashboard
    environment:
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/unicity
      REDIS_URL: redis://redis:6379
      RUST_LOG: info
    volumes:
      - ./config.toml:/etc/unicity/config.toml:ro
      - ./rules:/etc/unicity/rules:ro
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: unicity
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s

volumes:
  pgdata:
  redisdata:
```

## Bring up

```bash
docker compose up -d
docker compose logs -f gateway
```

The gateway runs migrations on startup. The first boot creates the schema, applies the seed (one `default` policy, one test key), and starts serving.

## Configuration

Three layers, in priority order:

1. **Environment variables** in `docker-compose.yml` (e.g. `RUST_LOG=debug`)
2. **`config.toml`** mounted at `/etc/unicity/config.toml` — see [Reference → config.toml](../reference/config-toml.md)
3. **Compiled defaults** — what the gateway uses if nothing is set

For production, externalise secrets via Docker secrets or a vault — do **not** put them in the compose file:

```yaml
secrets:
  database_url:
    external: true

services:
  gateway:
    secrets:
      - database_url
    environment:
      DATABASE_URL_FILE: /run/secrets/database_url
```

## Custom rules

Mount your custom rules directory as a read-only volume:

```yaml
volumes:
  - ./rules:/etc/unicity/rules:ro
```

The gateway watches this path. Adding `.yar` files to `./rules` on the host appears in the gateway within seconds.

## Multi-replica

For higher throughput, scale the `gateway` service horizontally:

```bash
docker compose up -d --scale gateway=3
```

You'll need a reverse proxy in front to distribute traffic — see [TLS and reverse proxy](tls-and-reverse-proxy.md). All replicas share the same Postgres and Redis; no further coordination is required.

## Tear down

```bash
docker compose down              # stop containers, keep volumes
docker compose down -v           # stop AND delete volumes — DESTROYS data
```

## Related

- [Postgres and Redis](postgres-and-redis.md) — when to use managed services instead.
- [TLS and reverse proxy](tls-and-reverse-proxy.md) — TLS termination and request distribution.
- [Reference → config.toml](../reference/config-toml.md) — every configuration key.
- [Production checklist](production-checklist.md) — what to verify before going live.
