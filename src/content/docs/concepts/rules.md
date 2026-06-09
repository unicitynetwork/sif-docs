---
title: Rules
description: Rule format, built-in vs custom, and the hot-reload mechanism.
---

A **rule** is a named pattern that a detector evaluates against the request. The same rule format is used by built-in and operator-authored rules; the only difference is where the file lives.

## File format — YARA-X

The primary rule format is [YARA-X](https://virustotal.github.io/yara-x/). Each rule is a self-contained block:

```yara
rule pi_override_instructions
{
    meta:
        description = "Direct instruction-override patterns"
        category    = "prompt_injection"
        severity    = "high"

    strings:
        $a = "ignore previous instructions"  nocase
        $b = "disregard the above"           nocase
        $c = "forget your guidelines"        nocase

    condition:
        any of them
}
```

Required sections:

| Section | Purpose |
|---|---|
| `rule <name>` | Unique identifier; used in the dashboard, the audit log, and the verdict response |
| `meta:` | Tags consumed by the gateway: `description`, `category`, `severity` |
| `strings:` | Named patterns the rule will look for |
| `condition:` | When the rule fires (boolean combination of strings) |

Other formats — regex (`.regex` files), PII matchers (`.pii` files) — follow the same convention: a header block with metadata, then the matching logic.

## Built-in vs. custom rules

| | Built-in | Custom |
|---|---|---|
| Location | Shipped with the gateway binary | Operator's rules directory |
| Lifecycle | Updated by upgrading the gateway | Live; hot-reloadable |
| Editable from dashboard | Metadata only (severity, notes) | Metadata only (body via files) |
| Version-controlled by | The gateway repository | Your operations repository |
| Best for | Coverage of well-known attack patterns | Bespoke patterns specific to your workload |

The two are evaluated equivalently. The only operational difference is where the source-of-truth lives.

## Hot reload

The rules directory is watched at runtime. On any change (file added, modified, deleted) the gateway:

1. Parses the new file.
2. If parsing succeeds, swaps the rule set atomically — no in-flight requests see a mixed state.
3. If parsing fails, logs the error and leaves the previous rule set in place.

There is no detection gap during reload — the previous rule set continues to evaluate until the new one is fully loaded.

The [Rules page](../dashboard/rules-page.md) shows the post-load state, including any rules that failed to parse.

## Disabled rules

A rule can be disabled without deleting the file. Toggling the **Enabled** flag on the [Rules page](../dashboard/rules-page.md) calls `PATCH /manage/rules/{id}` with `{"enabled": false}`. Disabled rules are still loaded — the file is parsed, the rule is held in memory — but they're skipped during evaluation.

Use disable instead of delete when:

- You're testing whether a rule is the source of a false-positive surge.
- You want to keep the rule definition around for an upcoming policy change.
- The rule is provisional and not yet trusted enough to run on production traffic.

## Versioning

Rules are not individually versioned. The gateway tracks an overall **ruleset version** that bumps on every reload. The current ruleset version is included in every `GET /api/status` response and on every audit row, so old verdicts can be traced back to the exact rules that produced them.

For audit-grade traceability, keep the custom rules directory in version control — the audit row records the ruleset version; your VCS records what was in that version.

## Related

- [Detectors](detectors.md) — rules are consumed by rule-based detectors.
- [How-to → Write a custom YARA rule](../guides/write-a-custom-yara-rule.md) — recipe for authoring a new rule.
- [Rules page](../dashboard/rules-page.md) — operational view of the loaded ruleset.
