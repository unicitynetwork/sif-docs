---
title: Detectors
description: The detection mechanisms and what each one catches.
---

A **detector** is a software component that examines a message and produces a list of detections. Detectors are the atomic units of the pipeline — every check the gateway performs runs through one of them.

## What a detector emits

A detection is:

```json
{
  "category": "prompt_injection",
  "confidence": 0.91,
  "rule_id": "PI-014",
  "evidence": "Instruction override pattern detected",
  "message_index": 1,
  "span": [42, 78]
}
```

| Field | Meaning |
|---|---|
| `category` | A label that policies aggregate against. See [Reference → Detection categories](../reference/detection-categories.md). |
| `confidence` | A score in `[0, 1]`. Source-specific: rule-based detectors derive it from rule severity; ML detectors output it from the classifier directly. |
| `rule_id` | For rule-based detectors, the matched rule's ID. `null` for ML detectors. |
| `evidence` | A short human-readable summary, surfaced in the dashboard. |
| `message_index` | Which message in the request triggered the detection. |
| `span` | Optional character offsets in the message body. |

A detector can emit zero, one, or many detections per request.

## The five built-in families

### `regex`

Compiled regular expressions, evaluated on every message body. Cheapest detector — sub-millisecond per message at typical sizes. Best for known strings: specific exploit phrases, brand mentions, blocked keywords.

Configured via `.regex` files in the gateway's rules directory.

### `yara` (YARA-X)

Pattern combinations with logical operators. Strictly more expressive than regex — supports `and` / `or` between named patterns, bracketed conditions, modifiers (`nocase`, `wide`). Best for cases where a single regex would be too permissive or too brittle.

Configured via `.yar` files. See [Rules](rules.md) for the format and [How-to → Write a custom YARA rule](../guides/write-a-custom-yara-rule.md) for the recipe.

### `pii_scanner`

Built around identifier matchers (SSN, credit card, email, phone, API-key shapes). Higher false-positive rate than regex on its own — usually paired with bracketed rules so the matcher only fires in context. Latency: low-millisecond.

This detector is also the source of `action: modify` verdicts — it can redact matched values and return the rewritten message list.

### `prompt_injection_ml` and `jailbreak_ml`

ONNX-backed classifiers. Each loads a fine-tuned model and emits a score in `[0, 1]` per message. **Opt-in** — only loaded when the gateway is built with the `ml` feature flag. Latency: 5–15 ms per message; significantly more on Intel CPUs.

These detectors do not consult rule files. They are configured by which model file the gateway loads at startup, surfaced in the [Detectors page](../dashboard/detectors-page.md).

### `custom`

Any detector that implements the adapter interface. Lives in the same evaluation pipeline as the built-ins; gets the same input; emits detections in the same shape. Build one when you need:

- A vendor integration (third-party guard service)
- A bespoke ML pipeline with custom pre-processing
- A check that consults external state (allow-lists, customer config)

## How detectors interact with policies

Policies decide which detectors to *run* and how their scores aggregate. A detector that's loaded but disabled in the policy still consumes startup memory but contributes nothing to the verdict.

Conversely, a policy can reference a detector that isn't loaded — the gateway logs a warning at startup and treats it as always returning zero detections.

## When to add a new detector vs. a new rule

- **New rule** when the existing detectors can catch the pattern — most of the time, this is the answer. Faster, no code, hot-reloaded.
- **New detector** when the check needs ML, external state, or a fundamentally different shape (e.g. checking a hash against a denylist).

## Related

- [The guard pipeline](the-guard-pipeline.md) — where detectors sit in the request flow.
- [Rules](rules.md) — how rule-based detectors are configured.
- [Detectors page](../dashboard/detectors-page.md) — the operational view.
