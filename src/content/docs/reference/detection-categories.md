---
title: Detection categories
description: The taxonomy of what gets detected and where each category fires.
---

Detectors emit detections tagged with a **category**. Policies aggregate by category. Built-in rules use a small set of well-known categories; custom rules may define new ones.

## Built-in categories

| Category | Meaning | Fired by |
|---|---|---|
| `prompt_injection` | Attempts to override the system prompt or hijack the conversation | YARA rules, `prompt_injection_ml` |
| `jailbreak` | Role-play and indirect exploits that bypass safety policies | YARA rules, `jailbreak_ml` |
| `pii` | Personally identifiable information in either input or output | `pii_scanner` |
| `dlp` | Sensitive non-personal data: credentials, internal identifiers, API keys | `pii_scanner`, custom rules |
| `data_exfiltration` | Phrasing aimed at extracting protected data | YARA rules |
| `policy_violation` | Catch-all for operator-defined patterns not fitting the above | Custom rules |
| `unsafe_output` | Response-side: model emitted content that violates the safety policy | Response-side YARA rules, ML detectors |

## Category-to-detector mapping (default rules)

| Category | Built-in YARA | Regex | PII matcher | ML model |
|---|---|---|---|---|
| `prompt_injection` | ✓ | ✓ | ✗ | ✓ (opt-in) |
| `jailbreak` | ✓ | ✓ | ✗ | ✓ (opt-in) |
| `pii` | ✗ | ✗ | ✓ | ✗ |
| `dlp` | ✓ | ✓ | ✓ | ✗ |
| `data_exfiltration` | ✓ | ✓ | ✗ | ✗ |
| `policy_violation` | (custom) | (custom) | ✗ | ✗ |
| `unsafe_output` | ✓ (response-side) | ✓ (response-side) | ✗ | ✗ |

## Defining a custom category

A custom YARA rule can use any string for `meta: category`. Three things follow:

1. The category appears in detection records and audit rows.
2. Policies can configure per-category thresholds for it.
3. The dashboard's category filter will list it once a detection fires.

Convention: lowercase, snake_case. Avoid colliding with built-in names.

```yara
rule custom_internal_url_leak
{
    meta:
        description = "Mentions of internal URLs in model output"
        category    = "internal_disclosure"   // custom category
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

- **Categories are not severity** — severity is a separate `meta` key (`low`/`medium`/`high`/`critical`).
- **Categories are not detectors** — multiple detectors can emit the same category, and one detector can emit multiple categories.
- **Categories are not enforcement** — they describe what was detected; the policy decides whether to block.

## Related

- [Concepts → Detectors](../concepts/detectors.md) — which detectors emit which categories.
- [Concepts → Policies](../concepts/policies.md) — how per-category thresholds work.
- [How-to → Write a custom YARA rule](../guides/write-a-custom-yara-rule.md) — rule authoring with `meta: category`.
