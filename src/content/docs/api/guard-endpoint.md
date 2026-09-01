---
title: Guard endpoint (beta)
description: POST /api/v1/guard — the primary detection endpoint.
---

> **Status: beta.** The request shape is stable; the response may add fields before 1.0. Existing fields will not be removed or renamed.

The single endpoint that screens a prompt and returns a verdict.

## Request

```http
POST /api/v1/guard
Authorization: Bearer semd_...
Content-Type: application/json
```

### Body

Request shape from [`crates/semd-core/src/types/request.rs::GuardRequest`](https://github.com/unicitynetwork/semanticd/blob/main/crates/semd-core/src/types/request.rs):

```json
{
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user",   "content": "What's the weather today?"}
  ],
  "policy_id": "default",
  "config": {
    "return_detections": true,
    "threshold": null,
    "categories": []
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `messages` | array | yes | One or more messages. `role` is `"system"`, `"user"`, or `"assistant"`. `content` is a string. |
| `policy_id` | string | no | Top-level field — **not** `config.policy`. Whether it is required or refused depends on the key — see below. |
| `config.return_detections` | bool | no | Include the `detections` array in the response. Default `false` in code; SDK defaults to `true`. |
| `config.threshold` | float \| null | no | Per-call risk-score override. `null` ⇒ use the policy threshold. |
| `config.categories` | array of string | no | If non-empty, only run detectors emitting these categories. Empty ⇒ run all enabled. |

Messages are evaluated together as a single context. Request-side rules run on `user` messages; if the most recent message is `assistant`, response-side rules run too.

## Agent classes and `policy_id`

Whether a key may send `policy_id` at all now depends on whether the key is
bound to an **agent class** (see [Fleet › Agents](../dashboard/fleet-agents.md)):

- **Class-led** — the key is bound to a class. The policies its classes
  attach are the only source — any number of them, possibly none; sending
  `policy_id` on the request is refused, not silently ignored.
- **Caller-led** — the key carries no class. The request's `policy_id` is the
  only source; omitting it is refused once enforcement reaches `block` (see
  below).

**Dev mode is caller-led too.** `--dev-mode` (`require_auth = false`) does
not exempt a call from this rule. A request with no valid key resolves to
the built-in anonymous identity, which carries no agent class — so it is
caller-led like any other unclassed key. Once the tenant's dial reaches
`block`, an anonymous dev-mode call still needs `policy_id`; a demo built
against `--dev-mode` that dropped it because "auth is off" 400s the moment
the dial moves. See [Installation](../getting-started/installation.md) for
`--dev-mode` itself.

**Endpoint credentials are exempt from the caller-led refusal.** An enrolled
endpoint's own credential (used by the poll and telemetry routes, on a
`Product::Plane` deployment) is not an `api_keys` row, so it can never be
bound to an agent class. It is a different kind of credential, not a
misconfigured key — omitting `policy_id` on an endpoint credential is served
at every enforcement setting, including `block`.

Both refusals are **400**, with the exact message copied here from
[`crates/semd-api/src/error.rs`](https://github.com/unicitynetwork/semanticd/blob/main/crates/semd-api/src/error.rs):

| Situation | Message |
|---|---|
| Class-led key, request carries `policy_id` | `This key's policy is set by its agent class '<class>'; remove policy_id from the request` |
| Caller-led key, request has no `policy_id` | `This key has no agent class, so the request must name a policy_id` |

### The rollout dial

Both refusals are gated on the tenant's `class_policy_enforcement` setting —
`off`, `flag`, or `block` — read with `GET /manage/registry/enforcement` and
changed with `PUT /manage/registry/enforcement` (see [Management endpoints →
Agent classes and enforcement](management-endpoints.md#agent-classes-and-enforcement)).
Every tenant ships at `block`. Migration 036
(`120260828165959_enforcement_default.sql`) moved the column default there and
moved every tenant still sitting at `off` with it; a tenant an operator had
deliberately set to `flag` was left alone, and an unrecognised stored value
reads as `block` too (`semd-api/src/policy_store.rs:346-372`).

| Setting | Class-led key sends `policy_id` anyway | Caller-led key sends none |
|---|---|---|
| `off` | Served on the caller's `policy_id`, no refusal | Served on the tenant default, no refusal |
| `flag` | Same as `off`, plus the violation is logged | Same as `off`, plus the violation is logged |
| `block` | **400** — `PolicyIsClassLed` | **400** — `PolicyRequired` |

**One escape hatch, and only for the caller-led refusal.** With
`tenants.caller_led_policy_fallback` on, a caller-led key that names no
`policy_id` resolves through the tenant's default policy instead of being
refused at `block` — the pre-036 behaviour, for a deployment with legacy
callers it cannot change. It is `false` by default and does **not** relax the
class-led refusal: there is no honest fallback for a caller contradicting its
own class.

"Logged" at `flag` means a `tracing::warn!` line — nothing durable is written
and nothing is queryable from the dashboard or the audit API. There is no
audit row for a `flag`-mode violation today.

**Binding a key to a class is not gated by this dial.** The moment a key is
bound to a class, its calls resolve through the class's policies — that part of
the change is unconditional and takes effect immediately, at `off` included
(`crates/semd-api/tests/class_policy_modes.rs:125-139` pins this: a classed
key omitting `policy_id` resolves through the class even at `off`). So "off
changes nothing" holds only for a tenant that has never registered a class or
bound a key to one — the moment it registers a class, that class's keys
reroute regardless of the dial.

For a classless fleet, `off` and `flag` genuinely change nothing: the
caller-led refusal only fires at `block`, and every key is caller-led when
there are no classes. `block` is different. The caller-led refusal
(`crates/semd-api/src/handlers/guard.rs:627`) fires for **any** unclassed key
that omits `policy_id`, whether or not the tenant ever registered a class —
so flipping a fully classless tenant straight to `block` can break every
caller that was omitting `policy_id`. "No behaviour change at all, at any
dial setting" is true only up through `flag`; plan the move to `block`
accordingly.

See "Rolling out enforcement" below for the operational sequence.

## Response — Allow

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "request_id": "019ed01f-eb73-7f21-8cbf-c82798df3c94",
  "action": "allow",
  "blocked": false,
  "risk_score": 0.02,
  "processing_time_ms": 8
}
```

Schema-present-but-omitted-when-empty/null on a clean low-risk call: `detections`, `policy_applied`, `degraded`, `timestamp`, `versions`, `modified_content`. So a real `allow` response can be as small as the envelope above.

## Response — Block

```json
{
  "request_id": "019ed01f-eeb3-7540-8959-c1142415dc57",
  "action": "block",
  "blocked": true,
  "risk_score": 1.0,
  "detections": [
    {
      "category": "injection",
      "confidence": 0.91,
      "description": "Instruction override pattern detected",
      "rule_id": "PI-014"
    }
  ],
  "processing_time_ms": 12,
  "policy_applied": "default",
  "timestamp": "2026-06-16T11:10:14.574Z"
}
```

## Response — Modify

```json
{
  "request_id": "019ed01f-c1f9-a3d7-…",
  "action": "modify",
  "blocked": false,
  "risk_score": 0.65,
  "detections": [
    {
      "category": "pii",
      "confidence": 0.99,
      "description": "Credit card number detected",
      "rule_id": "PII-CC-001"
    }
  ],
  "processing_time_ms": 11,
  "policy_applied": "default",
  "modified_content": "You are a helpful assistant.\nMy card is [REDACTED] — when does it expire?"
}
```

When `action == "modify"`, the redactor returns the combined request as a single string in `modified_content` (preprocessed + redacted). Forward that to the LLM, not the original `messages`. See [How-to → Handle blocked requests](../guides/handle-blocked-requests.md).

## Response fields

Grounded in `crates/semd-core/src/types/response.rs::GuardResponse`.

| Field | Always present | Meaning |
|---|---|---|
| `request_id` | yes | Server-generated UUIDv7 |
| `action` | yes | One of `allow`, `flag`, `modify`, `block` |
| `blocked` | yes | `true` iff `action == "block"` |
| `risk_score` | yes | Combined score `[0.0, 1.0]` |
| `processing_time_ms` | yes | Server-side latency in ms |
| `detections` | omitted when empty | Array of `Detection` objects (`category`, `confidence`, `description`, `rule_id`) |
| `policy_applied` | omitted when null | Name of the policy used for thresholds |
| `degraded` | omitted when null | `true` if part of the pipeline failed (fail-open) |
| `timestamp` | omitted when null | UTC processing timestamp |
| `versions` | omitted when null | Model / ruleset versions used (`AnalysisVersions` shape) |
| `modified_content` | only when `action == modify` | Preprocessed + redacted form of the combined request, as a single string |

See [Verdict shapes reference](../reference/verdict-shapes.md) for the full field-by-field and the `Detection` sub-shape.

## Errors

The wire shape is a flat object — there is no `error` wrapper — and `code`
is the Rust enum variant's `Debug` name (PascalCase), not
`SCREAMING_SNAKE_CASE`
(`crates/semd-api/src/error.rs`'s `ErrorResponse::new` builds `code` via
`format!("{code:?}")`, not `ErrorCode`'s own `Serialize` impl). Neither
`request_id` nor `details` is populated by the endpoints below — the request
id is echoed on the `X-Request-Id` response header instead, not in the body:

```json
{
  "code": "InvalidRequest",
  "message": "messages array is empty"
}
```

| HTTP status | `code` | Typical cause for this endpoint |
|---|---|---|
| `400` | `InvalidRequest` | Missing / malformed `messages`, unknown role, invalid `policy_id`, or oversize message count |
| `400` | `PolicyIsClassLed` | The key is bound to an agent class, and the request sent a `policy_id` anyway. **Remove `policy_id`** — the class picks. `message` names the class |
| `400` | `PolicyRequired` | The key is bound to no agent class, and the request sent no `policy_id`. **Add one** — nothing else can pick |
| `401` | `Unauthorized` | Missing or invalid API key |
| `401` | `ApiKeyExpired` | API key's `expires_at` has passed |
| `403` | `Forbidden` | Key is suspended / revoked |
| `413` | `PayloadTooLarge` | Body exceeds `server.request_body_limit` |
| `429` | `RateLimited` | Key exceeded `rate_limit_rpm` |
| `500` | `InternalError` | Detector exception or generic gateway failure |
| `503` | `ServiceUnavailable` | Dependency unreachable, pipeline timeout, or shutdown in progress |

See [Reference → API error codes](../reference/api-error-codes.md) for the
full `/api/v1/*` catalogue and fail-open behaviour (`action` / `degraded`
top-level fields on a 200 that still failed internally). `/manage/*`
endpoints use a **different** error type with a different wire shape — see
that same reference page for the split.

## Rolling out enforcement

The dial exists so enforcement can be staged rather than flipped. Since
migration 036 a tenant starts at `block`, so this is no longer the path a new
deployment walks — it is the path back for one that rolled a tenant to `off`
to keep legacy callers serving while it fixes them. The sequence:

1. **Register classes and bind keys, at any dial setting.** This step alone
   has no dial dependency — a class's policies govern its keys' calls the
   moment you bind them, whether the tenant is at `off`, `flag`, or `block`.
2. **Move the dial to `flag`.** `PUT /manage/registry/enforcement`
   `{"enforcement": "flag"}`. Nothing is rejected yet — every violation that
   would 400 at `block` is served exactly as it is at `off`, and only logged.
3. **Check the key inventory** on [Fleet › Agents](../dashboard/fleet-agents.md),
   shown while the dial reads `flag`. It tells you how many keys are
   caller-led at the guard — keys with no class, plus keys bound to a class
   nobody registered, which the guard also treats as caller-led.

   **This is inventory, not readiness, and there is no number that means
   "safe to switch".** Whether a call breaks at `block` depends on the
   request, not the key:

   | credential | request | at `block` |
   |---|---|---|
   | caller-led | sends `policy_id` | succeeds |
   | caller-led | omits `policy_id` | fails |
   | class-led | sends `policy_id` | fails |
   | class-led | omits `policy_id` | succeeds |

   The dashboard cannot see what a caller sends, so it can neither promise a
   caller-led key will break nor promise a class-led one will not. Endpoint
   credentials are exempt from the caller-led refusal and are not counted.
4. **Confirm from your own logs before moving to `block`.** At `flag` every
   would-be refusal is logged by the guard process that served it. Those log
   lines — not the dashboard count — are the evidence that no live caller
   still breaks the rules. There is no queryable record behind them yet, so
   this step is a log search rather than a screen you can read off.

Moving the dial takes effect immediately. `PUT /manage/registry/enforcement`
writes the new setting to Postgres and pushes it into the running guard in
the same request — no restart or redeploy needed.

**On more than one gateway replica, this reaches only the replica that
served the request.** The push is an in-process update to that replica's
policy store; there is no broadcast to the others. The write to Postgres is
durable, but a sibling replica keeps its old enforcement value even across
an unrelated policy reload — reload deliberately carries the existing
enforcement forward rather than re-reading it — until that replica is
restarted. This cuts both ways: moving the dial to `block` behind a load
balancer leaves some replicas still open at the old setting until every one
of them restarts, and moving it back to `off` mid-incident is exactly as
incomplete — a replica that already had `block` keeps enforcing it until it,
too, restarts. Single-replica deployments are unaffected. This is a
deliberate deferral, not a bug: cross-replica propagation is unimplemented
today.

## Related

- [Concepts → The guard pipeline](../concepts/the-guard-pipeline.md) — what happens between request and response.
- [Batch guard](batch-guard.md) — multiple prompts in one request.
- [How-to → Integrate with an LLM app](../guides/integrate-with-an-llm-app.md) — usage patterns.
