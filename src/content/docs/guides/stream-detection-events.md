---
title: Stream detection events
description: Consume the WebSocket feed from /ws/events.
---

The gateway publishes a live event stream over WebSocket on the management API port. Every guard call produces one `threat` event (across all keys / all policies, including allows). Consumers can drive dashboards, push to a SIEM, or trigger alerting.

See [HTTP API → Events WebSocket](../api/events-websocket.md) for the source-of-truth envelope and event types. This page is the recipe for building a consumer.

## Connect

```
wss://<manage-host>/ws/events
```

The WS lives on the **management port** (default `SEMANTICD_PORT + 1`). Authenticate with the same JWT used for `/manage/*` calls:

```
GET /ws/events HTTP/1.1
Host: …
Upgrade: websocket
Connection: Upgrade
Authorization: Bearer <jwt>
```

Get the JWT via `POST /manage/auth/login`. Unauthenticated upgrades are rejected with `401` during the HTTP handshake.

## Event shape

The envelope is always `{type, payload, timestamp}`. See [HTTP API → Events WebSocket](../api/events-websocket.md) for the full schema. Quick reference:

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

Two `type` values are emitted today: `heartbeat` (on connect + every 30 s) and `threat` (one per guard call, including `allow`).

## A consumer in Python

The stream does **not** support filter query parameters in the current build — every consumer sees every guard event. Filter client-side.

```python
import asyncio, json, websockets

JWT = "..."

async def main():
    uri = "wss://<manage-host>/ws/events"
    headers = {"Authorization": f"Bearer {JWT}"}
    async with websockets.connect(uri, additional_headers=headers) as ws:
        async for raw in ws:
            event = json.loads(raw)
            handle(event)

def handle(event: dict) -> None:
    if event["type"] == "heartbeat":
        return  # liveness signal; nothing to do
    if event["type"] != "threat":
        return  # forward-compat: ignore unknown types
    payload = event["payload"]
    action = payload["action"]
    if action == "block":
        send_to_siem(payload)
    elif action == "modify":
        log_diff(payload)
    elif action == "flag":
        log_flag(payload)
    # allow: skip

asyncio.run(main())
```

## Operational notes

- **Reconnection** — The server sends a `heartbeat` event on connect and every 30 seconds. If the connection drops, reconnect with exponential backoff. The stream does **not** replay missed events; for guaranteed delivery, pair with periodic polls of `GET /manage/audit?since=<watermark>`.
- **Backpressure** — The broadcast channel buffer is 256 events. If your consumer falls behind, the server logs `RecvError::Lagged(n)` and you skip ahead — dropped events are not redelivered. Don't do heavy work in the receive loop; hand off to a queue.
- **Multiple consumers** — Every connected consumer sees every event. There is no fan-out partitioning. If you need per-consumer guarantees, build them in your consumer layer.
- **Volume** — At sustained high traffic (>500 rps) consider polling `/manage/audit` instead. The stream is designed for low-latency review and dashboards, not for bulk log shipping.
- **Alpha gotcha** — `payload.detections` mirrors `GuardResponse.detections`, which the live alpha build is not populating even on hard blocks. The block decision (`action`, `risk_score`) is correct; the detection-evidence array is just empty. See [Verdict shapes](../reference/verdict-shapes.md).

## Related

- [HTTP API → Events WebSocket](../api/events-websocket.md) — reference for the URL, envelope, and close codes.
- [How-to → Monitor production traffic](monitor-production-traffic.md) — picking between the stream, audit-poll, and metrics for the right job.
- [Dashboard → Overview page](../dashboard/overview-page.md) — the dashboard's live feed is a UI on top of this same stream.
