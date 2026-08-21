---
title: Write a custom rule
description: Author a detection pattern — regex, keywords or a composite — from the dashboard or the API.
---

A **rule** is the one part of detection you can author yourself. It is a
pattern, a confidence score and what to do when it matches. You cannot write a
new detector — that is compiled code — but you almost never need to. See
[How the pieces fit](../concepts/how-the-pieces-fit.md) if that distinction is
new.

Rules live in **packs** (rulesets). A pack is either shipped with the gateway
(built-in, file-owned) or created by you (stored in the database). You can
only add rules to a pack you own.

## Before you start — you need a pack of your own

Built-in packs cannot take new rules: the file on disk owns their contents and
a re-sync would discard anything you added. So the first step is always to
have an editable pack.

Two ways to get one:

**Clone a built-in.** Copies its rules into a new pack that you own, so you
start from working patterns and can edit any of them.

```bash
curl -X POST https://sif.unicity.network/manage/rulesets/{id}/clone \
  -H "Authorization: Bearer $TOKEN" \
  -d '{ "new_ruleset_id": "acme-house-rules", "disable_source": false }'
```

**Start empty.** Nothing in it until you add a rule.

```bash
curl -X POST https://sif.unicity.network/manage/rulesets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
        "ruleset_id": "acme-house-rules",
        "version": "1.0.0",
        "description": "Patterns specific to our workload",
        "enabled": true,
        "tags": []
      }'
```

In the dashboard, both routes are offered on **Guardrails › Rules › New rule**
when you have no editable pack yet.

## Write the rule

The interesting field is `match_spec`. It is one of five shapes.

### A regex

The most common. `mode: any` fires if any pattern matches; `all` needs all of
them.

```json
{
  "rule_id": "acme-internal-hostname",
  "name": "Internal hostname leaked",
  "category": "data_exfiltration",
  "severity": "high",
  "enabled": true,
  "score": 0.9,
  "tags": ["internal"],
  "match_spec": {
    "type": "regex",
    "patterns": ["\\b[a-z0-9-]+\\.corp\\.acme\\.internal\\b"],
    "mode": "any",
    "case_insensitive": true
  }
}
```

POST it to the pack:

```bash
curl -X POST https://sif.unicity.network/manage/rulesets/{ruleset_id}/rules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @rule.json
```

### A keyword list

Cheaper than a regex and easier to read when you are matching literal phrases.

```json
{
  "type": "keywords",
  "keywords": ["ignore previous instructions", "disregard the above"],
  "mode": "any",
  "case_insensitive": true
}
```

### A composite

Both conditions must hold — the shape that cuts false positives. A bare run of
digits matches any number; pairing it with nearby words makes it mean
something.

```json
{
  "type": "composite",
  "mode": "all",
  "conditions": [
    { "type": "regex",    "patterns": ["\\b[0-9]{8,17}\\b"], "mode": "any" },
    { "type": "keywords", "keywords": ["iban", "account number", "sort code"],
      "mode": "any", "case_insensitive": true }
  ]
}
```

### Transform, then match

Decodes or normalises first, then applies a nested match — for patterns that
hide behind base64 or unicode tricks.

```json
{
  "type": "transform_then_match",
  "transforms": ["base64_decode"],
  "then": { "type": "keywords", "keywords": ["ignore previous instructions"] }
}
```

### Semantic similarity

An embedding comparison rather than a literal match. Costs more; use it when
paraphrase matters.

## From the dashboard instead

**Guardrails › Rules › New rule**. Pick the pack, then the match type from the
five above — the editor changes to suit it, so a keyword rule gets a word list
and a regex rule gets a pattern box.

Open any existing rule to see the same editor with its patterns filled in.
Built-in rules show it read-only, because the file owns the body.

## Choosing a score

`score` is the confidence when the rule matches — it is **not** the action.
What that score does is decided by the policy's thresholds
([Tune a policy threshold](tune-a-policy-threshold.md)).

A useful way to pick one:

| Score | Meaning |
|---|---|
| `0.95`–`1.0` | Unambiguous. A match is the thing, with no plausible innocent reading |
| `0.7`–`0.9` | Strong, but a legitimate prompt could contain it |
| `0.4`–`0.6` | A signal worth recording, not worth acting on alone |

Rules in the same `category` can be tuned together: a policy can set
thresholds per category, so a coherent category is worth more than a clever
score.

## Check it before you trust it

The **Try it** bench on the rule's own screen sends text through the live
guard and tells you whether *this* rule fired. It needs a guard API key —
paste one on **Guardrails › Tester** and it is held for the browser tab.

Test both directions:

- Text that **should** trip it, to prove it works.
- Text that **should not** — the innocent case nearest your pattern. A rule
  that fires on `4111 1111 1111 1111` in a test fixture will fire on it in
  production too.

## When it goes live

Within one reload tick. There is no restart and no rebuild.

The gateway recomposes the file packs with the database every
`rules.reload_interval_secs` — 30 seconds by default — and immediately on a
Redis message where Redis is configured. It then compiles and swaps the whole
store atomically.

**If your rule does not compile, the pack does not take effect and the
previous one keeps serving.** A bad regex costs you that pack, not the
firewall. The failure is recorded against the ruleset and shown on the
[Rules page](../dashboard/rules-page.md) — worth checking after your first
save.

## Tuning a built-in rule instead

If a shipped rule is close but noisy, you do not have to clone the whole pack.
A **rule override** adjusts `enabled`, `score` and `severity` while leaving
the body to the file:

```bash
curl -X PUT https://sif.unicity.network/manage/rule-overrides/{ruleset_id}/{rule_id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "score": 0.6 }'
```

Note both ids here are the **string** ids (`pii-detection`, `pii-fin-002`),
not row ids — deliberately, so the override survives the file being re-synced.
Any field you leave out keeps whatever the file says.

Clone the pack only when you need to change the matching logic itself.

## Related

- [Rules](../concepts/rules.md) — the format in full
- [How the pieces fit](../concepts/how-the-pieces-fit.md) — rules vs detectors vs policies
- [Tune a policy threshold](tune-a-policy-threshold.md) — turning scores into verdicts
- [Write a custom YARA rule](write-a-custom-yara-rule.md) — the separate YARA detector
