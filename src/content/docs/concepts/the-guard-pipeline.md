---
title: The guard pipeline
description: How one guard call becomes one verdict, stage by stage.
---

A guard call runs through five stages: **resolve** → **detect** → **combine** → **decide** → **persist**. Each stage has a clear contract, a defined failure mode, and an observable side-effect.

```
  POST /api/v1/guard
       │
       ▼
  ┌─────────────────────────────────────────────┐
  │ 1. RESOLVE                                  │
  │    Validate API key → look up bound policy. │
  │    Reject early on 401 / 403 / 429.         │
  └─────────────────────────────────────────────┘
       │  policy + request
       ▼
  ┌─────────────────────────────────────────────┐
  │ 2. DETECT (parallel)                        │
  │    Each enabled detector evaluates the      │
  │    request and emits zero or more           │
  │    detections with scores in [0, 1].        │
  └─────────────────────────────────────────────┘
       │  detector results
       ▼
  ┌─────────────────────────────────────────────┐
  │ 3. COMBINE                                  │
  │    Apply the policy's aggregation mode →    │
  │    overall risk score.                      │
  └─────────────────────────────────────────────┘
       │  risk_score
       ▼
  ┌─────────────────────────────────────────────┐
  │ 4. DECIDE                                   │
  │    Compare against policy thresholds:       │
  │       ≥ block_threshold → "block"           │
  │       ≥ flag_threshold  → "flag"            │
  │       otherwise         → "allow"           │
  │    (Or "modify" if a detector rewrote.)     │
  └─────────────────────────────────────────────┘
       │  verdict
       ▼
  ┌─────────────────────────────────────────────┐
  │ 5. PERSIST + EMIT                           │
  │    Write audit row → Postgres.              │
  │    Publish event → /ws/events.              │
  │    Return JSON verdict.                     │
  └─────────────────────────────────────────────┘
```

## 1 · Resolve

Validates the API key and looks up the bound policy. Failures here return before any detection runs:

| Code | Cause |
|---|---|
| `401` | Missing or malformed `Authorization` / `X-API-Key` |
| `401` | Key valid but expired |
| `403` | Key disabled or revoked |
| `429` | Key over its rate limit |

The resolved policy is passed forward; the request body is otherwise untouched.

## 2 · Detect

The detectors enabled by the policy run **in parallel**, each against the full message list. Detectors do not see each other's output. Each emits zero or more detection records:

```json
{ "category": "prompt_injection", "confidence": 0.91, "rule_id": "PI-014", "evidence": "..." }
```

Failure modes:

- **Detector errors** — handled per the policy's `fail_mode` (`allow`, `flag`, or `block`). Recorded in the audit row.
- **Detector timeout** — bounded by `global_timeout_ms`. An over-running detector is killed and counted as a fail.

The slowest enabled detector sets the per-request latency. Short-circuit (see step 3) lets the gateway return early.

## 3 · Combine

The combiner reduces per-detector scores to a single `risk_score`:

| Mode | Behaviour |
|---|---|
| `max` | The highest score across detectors. Most conservative. Default. |
| `weighted_sum` | Linear combination using per-detector weights from the policy. |

When `short_circuit = true`, evaluation stops as soon as any detector exceeds `short_circuit_threshold` — remaining detectors are cancelled. This is the latency-vs-completeness knob.

## 4 · Decide

The verdict is chosen from the per-category scores and the policy's thresholds:

| Score (per category) | Verdict |
|---|---|
| `≥ block_threshold` | `block` |
| `≥ flag_threshold` (and `< block_threshold`) | `flag` |
| `< flag_threshold` | `allow` |

A special case: if a detector returned a *modified* message list (PII redaction, jailbreak stripping), the verdict is `modify` regardless of the threshold check, and the response carries the rewritten messages.

## 5 · Persist + emit

The verdict is written to two places:

- **Audit row** in Postgres — durable, queryable via `GET /manage/audit/entries`. Source of truth for analysis.
- **WebSocket event** on `/ws/events` — ephemeral, fan-out to all connected subscribers. Drives the dashboard live feed.

The WebSocket emit happens *after* the audit row commits. A consumer that missed an event can fetch it via the audit endpoint.

## Related

- [Detectors](detectors.md) — what each detector kind does inside step 2.
- [Policies](policies.md) — the configuration surface for steps 3 and 4.
- [Threats and verdicts](threats-and-verdicts.md) — what gets stored in step 5 and how to query it.
- [HTTP API → Guard endpoint](../api/guard-endpoint.md) — the wire-level reference.
