---
title: Rules
description: Rule format, built-in vs custom, and the hot-reload mechanism.
---

A **rule** is a named thing to look for. The same format is used by built-in
and operator-authored rules; the difference is only where each one is stored.

**A rule's `match.type` decides which detector runs it.** Most types go to
`rule_engine`, but a `yara` rule goes to the YARA detector and an `ml_model`
rule goes to the classifier it names. So a rule is not "rule-engine data" — it
is the authored half of detection, whichever detector ends up doing the work.
See [How the pieces fit](how-the-pieces-fit.md) for the full relationship
between detectors, rules, rulesets and policies.

## File format — YAML

A ruleset is a YAML document: a `ruleset:` header, then a list of `rules:`. This
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

`match.type` is one of seven, and it is also what routes the rule:

| Type | Carries | Run by |
|---|---|---|
| `regex` | `patterns`, `mode`, `case_insensitive` | `rule_engine` |
| `keywords` | `keywords`, `mode`, `case_insensitive` | `rule_engine` |
| `composite` | nested `conditions` plus a `mode` | `rule_engine` |
| `transform_then_match` | `transforms`, then a nested match | `rule_engine` |
| `semantic_similarity` | an embedding comparison | `rule_engine` |
| `ml_model` | `model` plus the `threshold` it must reach | the named classifier |
| `yara` | a YARA source string | the YARA detector |

`match` itself is optional. A second ruleset naming a rule id that is already
defined may leave it out and inherit the pattern — see
[Tightening, and cloning](#tightening-and-cloning). A rule with no `match` and
no defining occurrence to inherit from is refused rather than guessed at.

`action` and `applies_to` deliberately have no default. An unclassified rule
is surfaced at author time and listed as `uncompiled`, rather than having an
action guessed from its severity or score.

:::note[YARA is a match type, not a separate world]
A `yara` rule is authored, stored, versioned and attached exactly like any
other rule — it just runs in the YARA detector rather than the rule engine.
The `rules/yara/*.yar` files shipped with the gateway are the older, separate
route and are still loaded, but new signatures belong in a ruleset.
:::

## Built-in vs. custom rules

| | Built-in | Custom |
|---|---|---|
| Stored in | `rules/*.yaml`, shipped with the gateway | The database |
| Created by | Upgrading the gateway | `POST /manage/rulesets` then `/manage/rulesets/{ruleset_id}/rules`, or the dashboard |
| Marked | `is_builtin: true` | `is_builtin: false` |
| Editable in place | No — the file owns the body | Yes |
| Tunable | Only by attaching a stricter ruleset | Directly |
| Best for | Coverage of well-known attack patterns | Bespoke patterns specific to your workload |

Both are compiled and evaluated identically. What differs is who owns the
body.

### Tightening, and cloning

A built-in rule's body cannot be edited, because the file is the source of
truth and a re-sync would discard the change. Nor is there a per-rule override
to set beside it: a rule owns its own sensitivity, score and severity, and two
different values mean two different rules.

What you do instead is attach a second ruleset naming the same `rule_id` with a
stricter value. Flattening merges the occurrences into one rule, taking the
strictest value of each field, while the pattern still comes from the ruleset
that defined it — so upstream improvements to the regex keep arriving.

This only ever tightens. There is no way to lower a shipped rule's score or
switch it off from another ruleset; if a pack is too coarse, stop attaching it.

To change a built-in rule's matching logic, **clone the ruleset**. That copies
its rules into an editable ruleset, which you then own.

## Hot reload

There is no filesystem watcher. Reload is driven two ways, both going through
one writer so they cannot disagree:

1. **On a timer** — every `rules.reload_interval_secs` (30 by default).
2. **On a Redis message** — when Redis is configured, a change triggers the
   same path, so it is near-immediate.

Each pass reads the file rulesets **and the database**, composes them per
tenant, compiles, and swaps the whole store atomically. No in-flight request
sees a mixed state, and there is no detection gap — the previous store keeps
evaluating until the new one is ready.

Two behaviours are deliberate:

- **A ruleset that fails to compile fails the tenant's whole composition:
  nothing saved since the last good composition takes effect, and the previous
  store keeps serving.** A bad regex costs you your saved changes — the
  firewall itself keeps running. The failure is the tenant's, reported on every
  ruleset row at once, and shown as one banner on
  [Guardrails › Rulesets](../dashboard/guardrails-rulesets.md).
- **If the database is unreachable, the previous snapshot is kept** rather
  than falling back to files alone — which would silently discard every
  customisation until the database returned.

In practice: save a rule, and it is live within a tick. No restart, no
rebuild.

**The rule store is not the only thing a rule write has to move.** A policy
keeps its own flattened copy of the rules its attached rulesets name, and that
copy — not the tenant's whole slice — is what a key screens against once its
agent class has resolved a policy for it. A rule the copy does not name cannot
fire, and a score it holds is used in place of a lower one saved since. So a
rule write refreshes the rule store first and the policies' copies second.

The node taking the write refreshes both before it answers, and the Redis
message carries both to every other node. **The timer refreshes only the rule
store.** With `redis.pubsub_enabled` off (it is on by default) and more than
one node, a second node therefore picks a rule change up in its rule store but
not in its policies' selections until it restarts — the same restriction
policy publishes already have, since nothing but Redis propagates those
between nodes either.

## Disabled rules

A rule can be disabled without deleting the file. Toggling the **Enabled** flag on [Guardrails › Rules](../dashboard/guardrails-rules.md) calls `PATCH /manage/rules/{id}` with `{"enabled": false}`. Disabled rules are still loaded — the file is parsed, the rule is held in memory — but they're skipped during evaluation.

Use disable instead of delete when:

- You're testing whether a rule is the source of a false-positive surge.
- You want to keep the rule definition around for an upcoming policy change.
- The rule is provisional and not yet trusted enough to run on production traffic.

## Versioning

Rules are not individually versioned. The gateway tracks an overall **ruleset version** that bumps on every reload. The current ruleset version is included in every `GET /api/status` response and on every audit row, so old verdicts can be traced back to the exact rules that produced them.

For audit-grade traceability, keep the custom rules directory in version control — the audit row records the ruleset version; your VCS records what was in that version.

## Related

- [Detectors](detectors.md) — rules are consumed by rule-based detectors.
- [How-to → Write a custom rule](../guides/write-a-custom-rule.md) — the recipe for authoring one.
- [How-to → Write a custom YARA rule](../guides/write-a-custom-yara-rule.md) — the separate YARA detector.
- [Guardrails › Rules](../dashboard/guardrails-rules.md) — operational view of the loaded ruleset.
