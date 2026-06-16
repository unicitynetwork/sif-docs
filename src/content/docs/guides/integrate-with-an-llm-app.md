---
title: Integrate with an LLM app
description: Wire Semantic Firewall into your application's prompt path.
---

This guide walks through adding Semantic Firewall to an application that already calls an LLM provider. The result: every prompt is screened before it reaches the model, and your application reacts to the verdict.

## Where the gateway sits

```
your application  →  Semantic Firewall guard  →  decide  →  LLM provider
                                              │
                                              └─ block / flag → return early
```

The gateway sits *next to* your code, not in front of the provider as a transparent proxy. Your application makes two calls: one to the gateway, then (only if allowed) one to the provider.

## Python — using the SDK

Install the SDK:

```bash
pip install semantic-firewall
```

Wrap your existing prompt call:

```python
from semantic_firewall import SemanticFirewall, SemanticFirewallError

guard = SemanticFirewall(
    base_url="https://sif.unicity.network",
    api_key="semd_your_key_here",
)

def ask(user_text: str) -> str:
    # 1. Screen the prompt
    try:
        result = guard.guard(user_text)
    except SemanticFirewallError:
        # Network or server error — decide fail-open or fail-closed
        raise

    if result.blocked:
        return f"Request rejected: {result.detections[0].description}"

    if result.is_flagged:
        log_flag(result)

    # 2. Forward to your LLM provider — unchanged code from before
    return call_llm(user_text)
```

The `guard()` call returns a response with:

| Attribute | Meaning |
|---|---|
| `result.action` | `"allow"`, `"flag"`, `"modify"`, or `"block"` |
| `result.blocked` | Boolean — `true` iff `action == "block"` (mirrors the wire field) |
| `result.is_flagged` | SDK convenience: `True` for `action in ("flag", "modify", "block")` |
| `result.risk_score` | Float `[0.0, 1.0]` |
| `result.detections` | List of `Detection` objects: `category`, `confidence`, `description`, `rule_id` |
| `result.modified_content` | Present when `action == "modify"` — the preprocessed + redacted form of the combined request, as a single string. Use this instead of the originals |
| `result.processing_time_ms` | Server-side latency in ms |
| `result.policy_applied` | Name of the policy that decided the verdict |
| `result.request_id` | Correlation ID, also visible in the dashboard |

## Without the SDK — direct HTTP

Any language with an HTTP client works:

```bash
curl -X POST https://sif.unicity.network/api/v1/guard \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer semd_your_key" \
  -d '{
    "messages": [{"role": "user", "content": "..."}]
  }'
```

The response shape is documented at [HTTP API → Guard endpoint](../api/guard-endpoint.md). See [SDKs → REST via curl](../sdks/rest-via-curl.md) for JavaScript, Go, and shell examples.

## Response-side screening

For applications that want to screen what the model *returns* as well, send the model's response back through the gateway with `role: "assistant"`:

```python
model_text = call_llm(user_text)

response_check = guard.guard([
    {"role": "user", "content": user_text},
    {"role": "assistant", "content": model_text},
])

if response_check.blocked:
    return "Model response withheld."

return model_text
```

This runs the response-side rule set in addition to the request-side one. It doubles the per-request guard cost; consider whether the workload needs it.

## Latency budget

Allow ~10–20 ms p99 for the guard call against a local gateway with regex + YARA + PII detectors. The ML detectors add 5–15 ms each when enabled. The gateway runs detectors concurrently; the total is bounded by the slowest enabled detector plus a small overhead.

If your end-to-end p99 budget is tight, enable short-circuit on the policy ([Policies page](../dashboard/policies-page.md)) so the gateway stops evaluating once the first high-confidence detection fires.

## Related

- [How-to → Handle blocked requests](handle-blocked-requests.md) — UX patterns for showing block/flag to end users.
- [HTTP API → Guard endpoint](../api/guard-endpoint.md) — full request and response reference.
- [Concepts → The guard pipeline](../concepts/the-guard-pipeline.md) — what happens between request and verdict.
