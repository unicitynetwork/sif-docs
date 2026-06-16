---
title: Events WebSocket (beta)
description: wss://…/ws/events — live stream of guard verdicts.
---

> **Status: beta.** Frame shape is stable for the alpha; the broadcast topology may extend before 1.0.

A WebSocket stream of detection events. Connect, receive an immediate heartbeat, and then receive one `threat` event for every guard call (across all keys / all policies) plus a heartbeat every 30 seconds.

Source of truth: [`crates/semd-manage/src/ws.rs`](https://github.com/unicitynetwork/semanticd/blob/main/crates/semd-manage/src/ws.rs) (the WS handler) and the publisher at [`crates/semd-api/src/handlers/guard.rs`](https://github.com/unicitynetwork/semanticd/blob/main/crates/semd-api/src/handlers/guard.rs#L513).

## URL

```
wss://<manage-host>/ws/events
```

The `/ws/events` route lives on the **management API port** (default `SEMANTICD_PORT + 1`, e.g. 8081 — see [Health and status](health-and-status.md)). On the hosted alpha that's `wss://sif.unicity.network/ws/events` because the reverse proxy folds the three internal ports onto port 443.

## Authentication

The same JWT used for `/manage/*` calls is required during the HTTP upgrade:

```
GET /ws/events HTTP/1.1
Host: …
Upgrade: websocket
Connection: Upgrade
Authorization: Bearer <jwt>
```

Get a JWT via `POST /manage/auth/login` — see [Management endpoints](management-endpoints.md). Unauthenticated upgrade attempts are rejected during the HTTP handshake with `401`.

## Frame format

Every frame is a single UTF-8 JSON message with the same envelope:

```json
{
  "type": "<event-type>",
  "payload": { /* event-specific */ },
  "timestamp": "2026-06-16T11:10:14.574Z"
}
```

Two `type` values are emitted today: `heartbeat` (no payload) and `threat` (the per-guard-call event).

### `heartbeat`

Sent immediately on connect and every 30 seconds thereafter. Use this as your liveness signal.

```json
{
  "type": "heartbeat",
  "payload": {},
  "timestamp": "2026-06-16T11:10:14.574Z"
}
```

### `threat`

Published for **every** guard call — including `action: "allow"`. The name is historical; treat this as "guard event", not "block notification".

```json
{
  "type": "threat",
  "payload": {
    "request_id": "019ed01f-eeb3-7540-8959-c1142415dc57",
    "action": "block",
    "risk_score": 1.0,
    "detections": [
      {
        "category": "injection",
        "confidence": 0.91,
        "description": "Instruction override pattern detected",
        "rule_id": "PI-014"
      }
    ]
  },
  "timestamp": "2026-06-16T11:10:14.574Z"
}
```

| Payload field | Notes |
|---|---|
| `request_id` | Correlate with the audit log (`GET /manage/audit/by-request/{request_id}`) |
| `action` | One of `allow`, `flag`, `modify`, `block` |
| `risk_score` | Float `[0.0, 1.0]` — copied from the [GuardResponse](../reference/verdict-shapes.md) |
| `detections` | Array of [`Detection`](../reference/verdict-shapes.md#detection-shape-from-detection) (currently empty on the alpha — see below) |

> **Alpha gotcha**: `payload.detections` mirrors the `GuardResponse.detections` field, which the live alpha build is not populating even on `risk_score: 1.0` hard blocks. The block decision (`action`, `risk_score`) is correct; the detection-evidence array is just empty.

## Filtering

The current handler does **not** support filter query parameters. Every connected consumer sees every `threat` event for every key. Filter client-side, or poll [`/manage/audit?action=block`](management-endpoints.md) instead.

## Liveness — ping / pong

The server responds to a client `Ping` frame with a matching `Pong`. The 30-second `heartbeat` event is what the dashboard uses as its keep-alive signal in practice.

## Backpressure

The broadcast channel buffer is 256 events per topic. If a consumer falls behind, the server logs `RecvError::Lagged(n)` for the number of skipped events and the consumer's stream continues from the new tip — **dropped events are not redelivered**.

For lossless delivery, pair the WebSocket with periodic polls of `GET /manage/audit?since=<watermark>`.

## Close codes

Standard WebSocket close codes. The gateway does **not** issue custom 4xxx codes — auth failures happen during the HTTP upgrade and return `401` there, not on the WS frame.

| Code | Meaning |
|---|---|
| `1000` | Normal closure |
| `1009` | Message too big (only seen if a downstream proxy enforces a smaller frame limit than the server) |
| `1011` | Internal server error on the broadcast side |

## Related

- [Concepts → Threats and verdicts](../concepts/threats-and-verdicts.md) — the persisted audit shape behind each `threat` event.
- [How-to → Stream detection events](../guides/stream-detection-events.md) — recipe for a consumer.
- [Authentication](authentication.md) — JWT vs API-key surfaces.
