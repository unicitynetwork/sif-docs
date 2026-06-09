---
title: Production checklist
description: Pre-launch verification list.
---

The minimum items to verify before a deployment is considered production-ready. Tick each one.

## Security

- [ ] **`--dev-mode` is NOT set.** The gateway must require auth.
- [ ] **TLS terminates in front of the gateway.** No plain HTTP on the public path.
- [ ] **At least one admin API key exists** with a non-`default` name. The factory-shipped test key is rotated or revoked.
- [ ] **`DATABASE_URL` uses `sslmode=require`** if Postgres is anywhere off-host.
- [ ] **Secrets are not in environment files committed to VCS.** Use Docker secrets, a vault, or the platform's secret manager.
- [ ] **The `Authorization` header is forwarded** by the reverse proxy.

## Reliability

- [ ] **At least two gateway replicas.** A single replica is a single point of failure.
- [ ] **Postgres is managed or HA.** Daily backups. Point-in-time recovery if RPO < 24 h matters.
- [ ] **Redis is managed.** Persistence is optional.
- [ ] **Liveness probe → `/healthz`.** Readiness probe → `/readyz`.
- [ ] **Load balancer idle timeout ≥ 60 seconds** (WebSocket).

## Observability

- [ ] **`/metrics` is scraped** and at least the basic dashboards are wired up. See [Observability](observability.md).
- [ ] **Logs go to a queryable store** (Loki, Cloudwatch, Datadog, Splunk, …).
- [ ] **At least one paging alert configured**: gateway down. See [How-to → Monitor production traffic](../guides/monitor-production-traffic.md).
- [ ] **A runbook exists** for the common alerts. The alert links to the runbook.

## Configuration

- [ ] **`config.toml` is version-controlled.** Drift between replicas is a bug.
- [ ] **Custom rules directory is version-controlled.** Required for audit traceability — see [Concepts → Rules](../concepts/rules.md).
- [ ] **At least one non-default policy exists.** Editing `default` is reserved for emergencies.
- [ ] **API keys have meaningful names** that encode tenant ownership. See [Concepts → API keys and tenancy](../concepts/api-keys-and-tenancy.md).

## Operations

- [ ] **Backup restoration has been tested.** Untested backups are not backups.
- [ ] **Upgrade path is documented** — see [Operations → Upgrades and migrations](../operations/upgrades-and-migrations.md).
- [ ] **Key rotation procedure is documented** — see [How-to → Add and rotate API keys](../guides/add-and-rotate-api-keys.md).
- [ ] **On-call knows the gateway exists** and knows where the runbook lives.

## Sanity tests after each deploy

After every deploy, run this loop against the new replicas:

```bash
# 1. Health
curl -sf https://gateway.example.com/healthz || echo "FAIL: healthz"
curl -sf https://gateway.example.com/readyz  || echo "FAIL: readyz"

# 2. Auth (should 401 without a key)
[ "$(curl -so /dev/null -w "%{http_code}" -X POST https://gateway.example.com/api/v1/guard)" = "401" ] \
  || echo "FAIL: auth bypass"

# 3. Guard works
curl -sf -X POST https://gateway.example.com/api/v1/guard \
  -H "Authorization: Bearer ${TEST_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hello"}]}' \
  | jq -e '.action == "allow"' >/dev/null \
  || echo "FAIL: guard"

echo "OK"
```

If any line prints `FAIL: …`, do not promote the deploy.

## Related

- [Docker Compose](docker-compose.md) / [Kubernetes](kubernetes.md) — the platform.
- [Operations → Troubleshooting](../operations/troubleshooting.md) — runbook for when something fails.
