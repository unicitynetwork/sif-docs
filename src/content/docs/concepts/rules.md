---
title: Rules
description: Rule format, built-in vs custom, and the hot-reload mechanism.
---

A **rule** is a named pattern that the rule engine evaluates against the
request. The same format is used by built-in and operator-authored rules; the
difference is only where each one is stored.

Rules are read by exactly one detector — `rule_engine`. The other detectors
carry their own content. See [How the pieces fit](how-the-pieces-fit.md) for
the full relationship between detectors, rules, packs and policies.

## File format — YAML

A pack is a YAML document: a `ruleset:` header, then a list of `rules:`. This
is from `rules/pii-detection.yaml`, shipped with the gateway:

```yaml
ruleset:
  id: pii-detection
  version: "1.0.0"
  description: "Rules for detecting personally identifiable information"
  enabled: true

rules:
  - id: pii-fin-001
    name: "Credit card number"
    category: pii
    severity: critical
    action: flag
    applies_to: [prompt, generated_code]
    description: "Detects credit card numbers"
    match:
      type: regex
      patterns:
        - "\\b4[0-9]{3}[\\s-]?[0-9]{4}[\\s-]?[0-9]{4}[\\s-]?[0-9]{4}\\b"
      mode: any
    score: 0.95
    tags: [financial]
```

| Field | Purpose |
|---|---|
| `id` | Stable identifier; appears in the dashboard, the audit log and the verdict |
| `category` | Groups rules. A policy can set thresholds per category |
| `severity` | How serious a match is |
| `action` | What to do when it matches — `allow`, `flag`, `ask` or `block` |
| `applies_to` | Which corpora it is matched against |
| `match` | The matching logic (below) |
| `score` | Confidence when it matches, 0 to 1 |

`match.type` is one of five:

| Type | Carries |
|---|---|
| `regex` | `patterns`, `mode`, `case_insensitive` |
| `keywords` | `keywords`, `mode`, `case_insensitive` |
| `composite` | nested `conditions` plus a `mode` |
| `transform_then_match` | `transforms`, then a nested match |
| `semantic_similarity` | an embedding comparison |

`action` and `applies_to` deliberately have no default. An unclassified rule
is surfaced at author time and listed as `uncompiled`, rather than having an
action guessed from its severity or score.

:::note[YARA is a separate thing]
YARA signatures live in `rules/yara/*.yar` and are run by the `yara_detector`,
which is its own detector. They are not the rule format described here and are
not authored through the dashboard.
:::

## Built-in vs. custom rules

| | Built-in | Custom |
|---|---|---|
| Stored in | `rules/*.yaml`, shipped with the gateway | The database |
| Created by | Upgrading the gateway | `POST /manage/rulesets` and `/manage/rules`, or the dashboard |
| Marked | `is_builtin: true` | `is_builtin: false` |
| Editable in place | No — the file owns the body | Yes |
| Tunable | Yes, via a rule override | Directly |
| Best for | Coverage of well-known attack patterns | Bespoke patterns specific to your workload |

Both are compiled and evaluated identically. What differs is who owns the
body.

### Overrides, and cloning

A built-in rule's body cannot be edited, because the file is the source of
truth and a re-sync would discard the change. Instead there is a **rule
override**, carrying `enabled`, `score` and `severity` — any of which may be
null, in which case the file's value stands.

Overrides are keyed on the *string* ids `(ruleset_id, rule_id)` rather than
row ids, precisely so they survive a file re-sync.

To change a built-in rule's matching logic, **clone the pack**. That copies
its rules into an editable pack, which you then own.

## Hot reload

There is no filesystem watcher. Reload is driven two ways, both going through
one writer so they cannot disagree:

1. **On a timer** — every `rules.reload_interval_secs` (30 by default).
2. **On a Redis message** — when Redis is configured, a change triggers the
   same path, so it is near-immediate.

Each pass reads the file packs **and the database**, composes them per
tenant, compiles, and swaps the whole store atomically. No in-flight request
sees a mixed state, and there is no detection gap — the previous store keeps
evaluating until the new one is ready.

Two behaviours are deliberate:

- **A pack that fails to compile does not take effect, and the previous store
  keeps serving.** A bad regex costs you that pack, not the firewall. The
  failure is recorded against the ruleset and shown on the
  [Rules page](../dashboard/rules-page.md).
- **If the database is unreachable, the previous snapshot is kept** rather
  than falling back to files alone — which would silently discard every
  customisation until the database returned.

In practice: save a rule, and it is live within a tick. No restart, no
rebuild.

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
