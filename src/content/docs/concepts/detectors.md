---
title: Detectors
description: The detection mechanisms and what each one catches.
---

A **detector** is a software component that examines a message and produces a list of detections (e.g. classification of whether to block a particular request or allow it). Detectors are the atomic units of the pipeline — every check the gateway performs runs through one of them.

Detectors fall into two main types: a) pattern matching (rule or string matching), and machine learning (e.g. supervised classifier models, anomaly detection).

## Pattern based detectors

### What a detector emits

A detection is shaped per [`Detection`](https://github.com/unicitynetwork/semanticd/blob/main/crates/semd-core/src/types/response.rs):

```json
{
  "category": "injection",
  "confidence": 0.91,
  "description": "Instruction override pattern detected",
  "rule_id": "PI-014"
}
```

| Field | Meaning |
|---|---|
| `category` | A label that policies aggregate against. See [Reference → Detection categories](../reference/detection-categories.md). Built-ins emit `injection`, `jailbreak`, `pii`, or `yara`. |
| `confidence` | A score in `[0.0, 1.0]`. Source-specific: rule-based detectors derive it from rule severity; ML detectors output it from the classifier directly. |
| `description` | A short human-readable summary, surfaced in the dashboard and audit row. |
| `rule_id` | For rule-based detectors, the matched rule's ID. Omitted from the wire when `null` (e.g. ML detectors). |

A detector can emit zero, one, or many detections per request. The wire `Detection` is intentionally minimal — no `evidence` blob, no `message_index`, no `span`. Richer per-detection metadata lives in the persisted audit row.

### The built-in detector families

The in-tree detectors live in [`crates/semd-engine/src/detectors/`](https://github.com/unicitynetwork/semanticd/tree/main/crates/semd-engine/src/detectors). Each emits one or more **categories** on the wire — see [Detection categories](../reference/detection-categories.md) for the full mapping.

#### `regex_detector`

Compiled regular expressions, evaluated on every message body. Cheapest detector — sub-millisecond per message at typical sizes. Category is per-rule configurable; common values: `injection`, `jailbreak`, or a custom string.

Best for known strings: specific exploit phrases, brand mentions, blocked keywords. Configured via per-rule YAML in the rules directory ([Rules](rules.md)).

#### `keyword`

Aho-Corasick-style multi-pattern matcher. Category is per-rule configurable. Very low latency for thousands of keywords. Good when you have a static block-list.

#### `rule_engine`

The unified rule-engine pipeline emitting `injection` and `jailbreak` categories from in-tree pattern rules. Used as the workhorse for the built-in detection coverage.

#### `yara_detector` (YARA-X)

Pattern combinations with logical operators. Strictly more expressive than regex — supports `and` / `or` between named patterns, bracketed conditions, modifiers (`nocase`, `wide`). Default category is `yara`; per-rule override via `meta: category = "..."` (rule authors typically set `injection` / `jailbreak` / a custom category).

Configured via `.yar` files. See [Rules](rules.md) for the format and [How-to → Write a custom YARA rule](../guides/write-a-custom-yara-rule.md) for the recipe.

#### `dlp_scanner`

The DLP / PII matcher. Built around entity-type detectors (SSN, credit card, email, phone, IP address). All five entity types collapse to the single `pii` category on the wire; the specific entity type is in the `description` field.

This detector is the source of `action: modify` verdicts when redaction is enabled — it can rewrite the combined request as `modified_content`. Latency: low-millisecond.

#### `ml_classifier`

ONNX-backed classifier emitting `injection` and `jailbreak` categories. Loads a fine-tuned model per category and emits a confidence score in `[0.0, 1.0]` per message. **Opt-in** — only loaded when the gateway is built with the `ml` feature flag. Latency: 5–15 ms per message; significantly more on Intel CPUs.

Not configured via rule files. The model artefacts are configured at startup via `[engine.models.*]` in `config.toml` ([Reference → config.toml](../reference/config-toml.md)). Surfaced in the [Detectors page](../dashboard/detectors-page.md).

#### Custom detectors

Any detector that implements the adapter interface. Lives in the same evaluation pipeline as the built-ins; gets the same input; emits detections in the same shape. Build one when you need:

- A vendor integration (third-party guard service)
- A bespoke ML pipeline with custom pre-processing
- A check that consults external state (allow-lists, customer config)

## How detectors interact with policies

Policies decide which detectors to *run* and how their scores aggregate - in effect the policy determines the topology of detectors assigned to scan the request. Polcies can be applied on a per-request basis. 

Within a policy there is flexibility to run multiple detectors in parellel, and in series. This enables users to configure a wide variety of polcies, accounting for different request types and contexts (e.g., strict latency demands on less senstive requests, or deep inspection for regulated environments).

Note: 
- A detector that's loaded but disabled in the policy still consumes startup memory but contributes nothing to the verdict.
- Conversely, a policy can reference a detector that isn't loaded — the gateway logs a warning at startup and treats it as always returning zero detections.

## When to add a new detector vs. a new rule

- **New rule** when the existing detectors can catch the pattern — most of the time, this is the answer. Faster, no code, hot-reloaded.
- **New detector** when the check needs ML, external state, or a fundamentally different shape (e.g. checking a hash against a denylist).

## Related

- [The guard pipeline](the-guard-pipeline.md) — where detectors sit in the request flow.
- [Rules](rules.md) — how rule-based detectors are configured.
- [Detectors page](../dashboard/detectors-page.md) — the operational view.
