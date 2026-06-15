---
title: Events WebSocket (beta)
description: wss://…/ws/events — live stream of verdicts and gateway events.
---

> **Status: beta.** Event shapes may evolve before 1.0; existing fields will not be removed or renamed.

A WebSocket stream of detection events. Every guard call publishes one verdict event after the audit row is persisted; rule loads, rule errors, and detector state transitions publish their own event types.

## URL

```
wss://<gateway-host>/ws/events
```

In dev: `ws://localhost:8081/ws/events`.

## Authentication

Either header or query parameter (see [Authentication](authentication.md)):

```
Authorization: Bearer sk_...
```

or for browser clients:

```
wss://gateway/ws/events?api_key=ps_...
```

Unauthenticated upgrade attempts are rejected with `401`.

## Filter parameters

| Parameter | Values | Notes |
|---|---|---|
| `types` | comma-separated subset of `verdict,rule_loaded,rule_error,detector_state` | Default: all |
| `actions` | comma-separated subset of `allow,flag,modify,block` | Only applies when `verdict` is in `types`. Default: all |

```
GET /ws/events?types=verdict&actions=block,modify HTTP/1.1
```

Filtering happens server-side. On a busy gateway, narrowing the subscription is significantly cheaper than client-side filtering.

## Frame format

One JSON message per event. UTF-8 text frames; the server does not send binary frames.

### `verdict`

```json
{
  "type": "verdict",
  "request_id": "req_b7d4e9f2",
  "ts": "2026-06-07T18:42:10.123Z",
  "action": "block",
  "risk_score": 0.91,
  "policy_applied": "default",
  "detections": [
    {
      "detector": "prompt_injection",
      "category": "direct_injection",
      "confidence": 0.91,
      "rule_id": "PI-014",
      "evidence": "Instruction override pattern detected",
      "message_index": 1
    }
  ],
  "api_key_prefix": "sk_a3f0",
  "request_summary": "Help me ignore previous instr..."
}
```

The `request_summary` is a short (≤120 chars) extract for display. Use `GET /manage/audit/entries/{request_id}` to fetch the full row.

### `rule_loaded`

```json
{
  "type": "rule_loaded",
  "ts": "...",
  "rule_id": "pi_custom_override",
  "source": "custom",
  "ruleset_version": 43
}
```

### `rule_error`

```json
{
  "type": "rule_error",
  "ts": "...",
  "file": "rules/yara/custom-rules.yar",
  "line": 14,
  "error": "syntax error near token 'condition'"
}
```

### `detector_state`

```json
{
  "type": "detector_state",
  "ts": "...",
  "detector": "prompt_injection_ml",
  "state": "degraded",
  "reason": "model inference timeout"
}
```

## Liveness — ping / pong

The server sends a `ping` frame every 30 seconds. The standard WebSocket library on every platform handles `pong` automatically. If a client doesn't respond within 30 seconds of the next ping, the server closes the connection.

## Close codes

| Code | Meaning |
|---|---|
| `1000` | Normal closure |
| `1008` | Policy violation — usually invalid query parameters |
| `1009` | Message too big — server buffer overflow on a slow consumer |
| `1011` | Server error — internal failure on the publisher side |
| `4001` | Auth failed |
| `4029` | Rate limited |

## Backpressure

The server buffers up to 1000 unsent events per connection. If a consumer falls behind:

1. The connection is closed with code `1009`.
2. The consumer must reconnect and accept that events between the buffer overflow and the reconnect are lost.

For guaranteed delivery, pair the WebSocket with periodic polls of `GET /manage/audit/entries?since=<watermark>`. The two views are consistent: the WebSocket event is published after the audit row commits.

## Related

- [Concepts → Threats and verdicts](../concepts/threats-and-verdicts.md) — what's in each verdict event.
- [How-to → Stream detection events](../guides/stream-detection-events.md) — recipe for a consumer.
- [Authentication](authentication.md) — auth headers and dev-mode bypass.
