---
title: Overview page
description: The dashboard landing — KPIs, hourly traffic, and a live threat feed.
---

The Overview page (`/`) is the dashboard landing. It answers three questions at a glance: *Is the gateway healthy? What does the volume look like? What's happening right now?*

## What you see

### KPI cards (top row)

Sourced from `GET /api/status`, polled every 5 seconds.

| Card | Meaning |
|---|---|
| **Total requests** | Total `/api/v1/guard` calls handled since process start |
| **Blocked** | Requests where the policy returned `action: block` |
| **Flagged** | Requests where the policy returned `action: flag` or `action: modify` |
| **Allowed** | Requests that passed cleanly |
| **Avg latency** | Mean wall-clock latency across all guard calls |
| **p99 latency** | 99th-percentile latency — the slow tail |
| **Active rules** | Number of detection rules currently loaded |
| **Detectors loaded** | Number of detector adapters initialised |
| **Active models** | ML models currently held in memory |

The latency and counter values are kept in-memory by the gateway process and reset on restart. For historical numbers use the hourly chart below or query the audit log directly.

### Hourly traffic chart

Sourced from `GET /manage/audit/stats/hourly`, refreshed every 10 seconds. Stacked bars per hour break out `allow`, `block`, and `flagged` (which groups `flag` and `modify` together).

This chart is backed by the audit database, so the numbers persist across restarts.

### Live threat feed

A WebSocket connection to `/ws/events` streams verdicts as they happen. The header shows the connection state:

- 🟢 **connected** — receiving live events
- 🟡 **connecting** — handshake in progress
- 🔴 **disconnected** — connection dropped, auto-retry every 3 seconds

Each row shows the time, the action badge, the matched detector, and a short snippet of the offending content. Click a row to open the full detail panel on the [Threats page](threats-page.md).

## Failure modes

| Symptom | Likely cause |
|---|---|
| All KPIs read zero after the gateway has clearly served traffic | The in-memory counters were reset by a process restart. Check `/manage/audit/stats/hourly` for the persistent view. |
| Hourly chart blank but KPIs non-zero | Audit writes are failing — check Postgres connectivity. |
| Live feed stuck on "connecting" | Authentication: the WebSocket needs a valid API key. In `--dev-mode` no auth is required. |

## Related pages

- [Threats page](threats-page.md) — drill into individual detection events.
- [Reference → API error codes](../reference/api-error-codes.md) — what each non-200 status from `/api/status` means.
- [Operations → Troubleshooting](../operations/troubleshooting.md) — runbook entries for the common failure modes above.
