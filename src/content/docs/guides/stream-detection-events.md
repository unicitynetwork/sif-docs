---
title: Stream detection events
description: Consume the WebSocket feed from /ws/events.
---

The gateway publishes a live event stream over WebSocket. Every verdict produces an event; consumers can subscribe to drive dashboards, push to a SIEM, or trigger alerting.

## Connect

```
wss://<gateway-host>/ws/events
```

Authentication is per-API-key, same as the REST API. Pass the key in the WebSocket upgrade headers:

```
GET /ws/events HTTP/1.1
Host: gateway.internal
Upgrade: websocket
Connection: Upgrade
Authorization: Bearer semd_your_key
```

In `--dev-mode` no auth is required. In any other mode an unauthenticated upgrade is rejected with `401`.

## Event shape

Each event is a single JSON message. See [HTTP API → Events WebSocket](../api/events-websocket.md) for the source-of-truth shape and the alpha-pending caveat — there's currently no `WsEvent` Rust struct, so the envelope below is the documented intent.

```json
{
  "type": "verdict",
  "request_id": "019ed01f-eeb3-7540-8959-c1142415dc57",
  "timestamp": "2026-06-16T11:10:14.574Z",
  "action": "block",
  "blocked": true,
  "risk_score": 1.0,
  "policy_applied": "default",
  "detections": [
    {
      "category": "direct_injection",
      "confidence": 0.91,
      "description": "Instruction override pattern detected",
      "rule_id": "PI-014"
    }
  ]
}
```

Event types currently emitted:

| `type` | When |
|---|---|
| `verdict` | After any guard call completes — for every `action`, including `allow` |
| `rule_loaded` | When a rule file is hot-reloaded |
| `rule_error` | When a rule file fails to parse |
| `detector_state` | When a detector transitions between active / degraded / disabled |

## Subscribe to a subset

By default the stream emits all event types. To narrow:

```
GET /ws/events?types=verdict,rule_error HTTP/1.1
```

For verdict events, filter by action:

```
GET /ws/events?types=verdict&actions=block,modify HTTP/1.1
```

Filtering happens server-side, so this scales better than client-side filtering on a high-volume stream.

## A consumer in Python

```python
import asyncio, json, websockets

async def main():
    uri = "wss://gateway.internal/ws/events?types=verdict&actions=block,modify"
    headers = {"Authorization": "Bearer semd_your_key"}
    async with websockets.connect(uri, additional_headers=headers) as ws:
        async for raw in ws:
            event = json.loads(raw)
            handle(event)

def handle(event: dict) -> None:
    if event["action"] == "block":
        send_to_siem(event)
    elif event["action"] == "modify":
        log_diff(event)

asyncio.run(main())
```

## Operational notes

- **Reconnection** — the server sends ping frames every 30 s. If the connection drops, reconnect with exponential backoff. The stream does not replay missed events; for guaranteed delivery, pair with periodic polls of `GET /manage/audit`.
- **Backpressure** — the server buffers up to 1000 events per connection. Slow consumers exceeding the buffer are disconnected with code 1009 (message too big) or 1011 (server error). Don't do heavy work in the receive loop; hand off to a queue.
- **Multiple consumers** — every connected consumer sees every matching event. There is no fan-out partitioning; if you need per-consumer guarantees, build them in your consumer layer.
- **Volume** — at sustained high traffic (>500 rps) consider polling the audit endpoint instead. The stream is designed for low-latency review and dashboards, not for bulk log shipping.

## Related

- [HTTP API → Events WebSocket](../api/events-websocket.md) — reference for the URL, query parameters, and close codes.
- [How-to → Monitor production traffic](monitor-production-traffic.md) — picking between the stream, audit-poll, and metrics for the right job.
- [Dashboard → Overview page](../dashboard/overview-page.md) — the dashboard's live feed is a UI on top of this same stream.
