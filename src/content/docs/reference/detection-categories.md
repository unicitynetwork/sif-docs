---
title: Detection categories
description: The taxonomy of what gets detected and where each category fires.
---

Detectors emit detections tagged with a **category** (the `category` field on each `Detection`; see [Verdict shapes](verdict-shapes.md)). Policies aggregate by category.

Source of truth: [`crates/semd-engine/src/detectors/*`](https://github.com/unicitynetwork/semanticd/tree/main/crates/semd-engine/src/detectors). The categories below are the ones actually written by built-in detectors today.

## Built-in categories (live on the wire today)

| Category | Meaning | Emitted by |
|---|---|---|
| `injection` | Prompt-injection attempts — instruction overrides, system-prompt manipulation, conversation hijacks | Rule engine (`SQL Injection`-style + built-in injection rules), ML classifier (`prompt_injection.onnx` when the `ml` feature is enabled), YARA rules tagged `meta: category = "injection"` |
| `jailbreak` | Role-play and indirect exploits that bypass safety policies (DAN, persona attacks, hypothetical scenarios) | Rule engine, ML classifier (`jailbreak.onnx`), YARA rules tagged `meta: category = "jailbreak"` |
| `pii` | Personally identifiable information — SSN, credit-card number, email, phone, IP address | DLP scanner (`dlp_scanner` detector). All five entity types collapse to the single `pii` category on the wire. |
| `yara` | Default category for any YARA rule that doesn't set `meta: category` | YARA detector default — anything `meta:`-less |

> **That's it for the built-ins.** The seven categories the older docs claimed (`prompt_injection`, `data_exfiltration`, `policy_violation`, `unsafe_output`, `dlp`) **are not emitted** by any in-tree detector today. Rule authors can define them as custom categories via YARA `meta:` — see below.

## Category-to-detector mapping

| Category | Rule engine | Regex | DLP / PII | YARA | ML model |
|---|---|---|---|---|---|
| `injection` | ✓ | (configurable) | — | (rule-tagged) | ✓ (opt-in) |
| `jailbreak` | ✓ | (configurable) | — | (rule-tagged) | ✓ (opt-in) |
| `pii` | — | — | ✓ | — | — |
| `yara` | — | — | — | ✓ (default tag) | — |

(`configurable` = the regex detector takes its category from per-rule config — see [Rules](../concepts/rules.md). `(rule-tagged)` = YARA rules can emit any category via `meta: category = "..."`.)

## DLP / PII entity types

The DLP scanner can detect five distinct entity types but emits them all under the single `pii` category on the wire. The specific entity type is in `description` (or in the audit row's richer per-detection metadata), not in `category`:

| Entity type | Example match |
|---|---|
| SSN | `123-45-6789` |
| Credit card | `4111-1111-1111-1111` |
| Email | `alice@example.com` |
| Phone | `+1 (555) 123-4567` |
| IP address | `192.168.1.1` |

If your policy needs to threshold on a specific entity type rather than `pii` as a whole, that's a rule-authoring change — emit a custom category from a YARA / regex rule for the entity type you care about.

## Defining a custom category

A custom YARA rule can use any string for `meta: category`. Three things follow:

1. The category appears in `Detection.category` and on the audit row.
2. Policies can configure per-category thresholds for it.
3. The dashboard's category filter will list it once a detection fires.

Convention: lowercase, snake_case. Avoid colliding with the four built-ins above.

```yara
rule custom_internal_url_leak
{
    meta:
        description = "Mentions of internal URLs in model output"
        category    = "internal_disclosure"   // your custom category
        severity    = "high"
        direction   = "response"

    strings:
        $a = /https?:\/\/(?:[a-z0-9-]+\.)*internal\.acme\.com\/[^\s]*/

    condition:
        $a
}
```

After this rule loads, `internal_disclosure` becomes a usable category on the [Policies page](../dashboard/policies-page.md) for per-category thresholds.

## What category does NOT do

- **Categories are not severity.** Severity is a separate `meta` key (`low` / `medium` / `high` / `critical`).
- **Categories are not detectors.** Multiple detectors can emit the same category, and one detector can emit multiple categories across requests.
- **Categories are not enforcement.** They describe what was detected; the policy decides whether to block.

## Related

- [Concepts → Detectors](../concepts/detectors.md) — which detectors emit which categories.
- [Concepts → Policies](../concepts/policies.md) — how per-category thresholds work.
- [How-to → Write a custom YARA rule](../guides/write-a-custom-yara-rule.md) — rule authoring with `meta: category`.
- [Verdict shapes](verdict-shapes.md) — the `Detection` wire shape.
