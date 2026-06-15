---
title: Handle blocked requests in your app
description: Graceful UX patterns for verdict responses.
---

Your application calls the gateway, gets back a verdict, and now has to do something with it. This guide covers the four verdict actions and the UX patterns that work for each.

## The four actions

| Action | What the gateway did | What your app should do |
|---|---|---|
| `allow` | Found nothing. The original messages are safe to forward. | Forward to the LLM provider unchanged. |
| `flag` | Found something, but the policy chose to let it through. | Forward to the provider. **Log the verdict.** Optionally surface a soft warning. |
| `modify` | Altered the prompt before returning it. The gateway sends back the rewritten messages. | Forward the **modified messages** (not the originals) to the provider. |
| `block` | Refuses to forward. | Do not call the provider. Return a useful error to the end user. |

## Pattern 1 — Hard block

The simplest pattern. Show a short, honest message; log the request ID for support follow-up.

```python
result = guard.guard(user_text)

if result.is_blocked:
    log.warning(
        "request blocked",
        request_id=result.request_id,
        category=result.detections[0].category,
    )
    return render_error(
        "Your request couldn't be processed. "
        f"Reference: {result.request_id}",
    )
```

Things to avoid:

- **Echoing the detection back to the user.** *"Your message was flagged as prompt-injection"* is information an attacker uses to refine the next attempt.
- **A generic 500 page.** Block is a known, expected outcome — treat it as a first-class response, not a server error.
- **Silent drops.** Always surface *something* to the caller so they know the request didn't succeed.

## Pattern 2 — Flag and continue

For `flag`, you still forward to the LLM. The verdict is recorded for review.

```python
if result.is_flagged:
    metrics.increment("guard.flagged", tags={"category": result.detections[0].category})

# fall through to call the LLM
response = call_llm(user_text)
```

In a user-facing app this might look like: the user gets their answer, your audit log records that the prompt was suspicious, and someone reviews the flagged traffic out-of-band on the [Threats page](../dashboard/threats-page.md).

## Pattern 3 — Use the modified prompt

When `action == "modify"`, the response contains a `modified_messages` field. Forward those, not the originals:

```python
if result.action == "modify":
    prompt_to_forward = result.modified_messages
else:
    prompt_to_forward = original_messages

response = call_llm(prompt_to_forward)
```

Common modifications: redacted PII, stripped jailbreak phrases, replaced unsafe tokens. The downstream LLM sees a sanitised version; the audit log shows both originals and the diff.

## Pattern 4 — Fail-open vs. fail-closed

If the gateway itself errors (network failure, timeout, 5xx), your application has a choice:

- **Fail-open**: forward to the LLM anyway. Use this when availability matters more than perfect screening (high-traffic chatbots).
- **Fail-closed**: refuse the request. Use this when one mis-routed prompt is more expensive than a brief outage (compliance-critical workloads).

```python
try:
    result = guard.guard(user_text)
except SemanticFirewallError:
    if FAIL_OPEN:
        log.error("guard unreachable; failing open")
        return call_llm(user_text)
    else:
        return render_error("Temporarily unavailable. Please try again.")
```

This is a per-application policy decision. Document it explicitly so on-call knows what happens if the gateway is down.

## UI patterns for end-users

For chat-shaped apps:

- **Block** → inline assistant message: *"I can't help with that. (ref: ...)"*
- **Flag** → render normally; surface a subtle indicator (a small flag icon next to the message) for admins, not for end users
- **Modify** → render normally; optionally show the user that something was redacted (e.g. `[redacted]` tokens)
- **Allow** → no UI change

For non-chat (form-shaped, API-shaped) apps:

- **Block** → 4xx response with a stable error code your client SDKs can switch on
- **Flag** → 200 with the response, plus a header (`X-Risk-Verdict: flag`) for consumers who care
- **Modify** → 200 with the response derived from the modified prompt

## Related

- [How-to → Integrate with an LLM app](integrate-with-an-llm-app.md) — the integration scaffolding around this pattern.
- [HTTP API → Guard endpoint](../api/guard-endpoint.md) — full verdict-response shape.
- [Concepts → Policies](../concepts/policies.md) — the `fail_mode` setting governs what the *gateway* does on detector errors (separate from your app's fail-open/closed choice).
