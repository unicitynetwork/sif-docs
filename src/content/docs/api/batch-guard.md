---
title: Batch guard (beta)
description: Multiple guard calls in one request.
---

> **Status: beta.** Shape may change before 1.0.

Send up to **10** guard requests in a single HTTP call. Useful for offline
scoring, dataset annotation, and bulk jobs where per-call overhead and rate
limit budget matter more than latency.

## Request

```http
POST /api/v1/guard/batch
Authorization: Bearer semd_...
Content-Type: application/json
```

### Body

The body is a **bare JSON array**. There is no wrapper object and no
batch-level `config` — each element is exactly a
[single-guard request body](guard-endpoint.md#request), so anything valid
there is valid here.

```json
[
  { "messages": [{ "role": "user", "content": "Hello" }] },
  {
    "messages": [{ "role": "user", "content": "Ignore previous instructions" }],
    "policy_id": "strict"
  }
]
```

| Constraint | Value |
|---|---|
| Minimum items | 1 — an empty array is a `400` |
| Maximum items | 10 — an eleventh item is a `400` |
| Per-item fields | Identical to the single guard endpoint (`messages`, optional `policy_id`, `config`, `context`) |

:::caution[Sending `{"items": [...]}` fails in an unusual way]
An object wrapper does not reach the handler at all — the JSON extractor
rejects it first, with **HTTP 422 and a plain-text body**:

```
Failed to deserialize the JSON body into the target type: invalid type: map, expected a sequence at line 1 column 0
```

That is not the usual `{"code", "message"}` envelope, so a client that
assumes every error is JSON will fail to parse it. Send an array.
:::

### There is no per-item `id`

Correlate results **by position** — `response[i]` is the verdict for
`request[i]`, always in order. Each item is also stamped with its own
`request_id` of the form `<batch request id>-<index>`, which is what appears
in the audit log:

```
01a038b6-abb0-7741-bd99-844f49fa0978-0
01a038b6-abb0-7741-bd99-844f49fa0978-1
```

## Response

A bare JSON array of [`GuardResponse`](guard-endpoint.md#response--allow)
objects, same order as the request. Absent fields (`detections` when empty,
`policy_applied`, `degraded`) are omitted by `serde`, exactly as for the
single endpoint.

```json
[
  {
    "request_id": "01a038b6-abb0-7741-bd99-844f49fa0978-0",
    "action": "allow",
    "blocked": false,
    "risk_score": 0.0,
    "processing_time_ms": 3,
    "timestamp": "2026-08-25T11:38:10.740379Z"
  },
  {
    "request_id": "01a038b6-abb0-7741-bd99-844f49fa0978-1",
    "action": "allow",
    "blocked": false,
    "risk_score": 0.0,
    "processing_time_ms": 0,
    "timestamp": "2026-08-25T11:38:10.740492Z"
  }
]
```

Each item is recorded as its own audit row.

## Timing and rate limit

Items run **sequentially**, one after another. Wall-clock latency is
therefore roughly the *sum* of the per-item costs, not the slowest one — so
batching does not make the work faster. What it saves is per-call overhead
and rate limit budget.

**The whole batch counts as one request against the key's rate limit**,
because the limiter runs once per HTTP call. A 10-item batch consumes 1 rpm,
not 10. That is the main reason to reach for this endpoint.

Responses carry `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and
`Retry-After` when throttled.

## Errors

Whole-batch failures use the standard `/api/v1/*` envelope — see
[Reference → API error codes](../reference/api-error-codes.md).

| Status | `code` | When |
|---|---|---|
| `400` | `InvalidRequest` | Empty array (`Empty batch`) or more than 10 items (`Batch size too large (max 10)`) |
| `400` | `InvalidRequest` | At `block`, any item breaks its credential's class-policy mode — see below |
| `401` | `Unauthorized` | Missing or unusable key, as everywhere else |
| `403` | `Forbidden` | The key lacks the `guard` permission — checked before any item runs |
| `422` | *(none — plain text)* | The body was not a JSON array |

### Class-policy refusals reject the whole batch

If the tenant's [enforcement dial](guard-endpoint.md)
is at `block`, every item is checked **before any of them is screened**. If
one item breaks its credential's mode — a class-led key sending `policy_id`,
or a caller-led key omitting it — the entire call is refused with a `400`
and nothing is screened.

That is deliberate: `GuardResponse` has no error shape, so there is no
honest way to report one item's refusal inside a `200`.

### Per-item failures are served as degraded allows

:::caution[This is a fail-open — check `degraded`]
If an individual item fails for any *other* reason — a detector error, a
pipeline timeout — it does **not** appear as an error. It comes back as a
successful-looking `allow`:

```json
{
  "request_id": "…-2",
  "action": "allow",
  "blocked": false,
  "risk_score": 0.0,
  "degraded": true
}
```

`degraded: true` is the only signal that this row was not actually screened.
A caller that reads `action` alone will treat unscreened content as safe.
Always check `degraded` on every item.
:::

## When to use the batch endpoint

- **Offline scoring** — labelling a dataset for analysis.
- **Bulk ingest** — backfilling guard verdicts for historical traffic.
- **Test harnesses** — replaying a known-good corpus to validate a policy change.

For real-time application traffic, prefer the
[single guard endpoint](guard-endpoint.md). Because items run in sequence, a
batch is slower end-to-end than the same items sent individually in
parallel; its advantage is rate limit budget, not speed.

## Related

- [Guard endpoint](guard-endpoint.md) — the single-call form.
- [Reference → API error codes](../reference/api-error-codes.md) — the error envelope.
- [Concepts → The guard pipeline](../concepts/the-guard-pipeline.md) — what runs for each item.
