---
title: Write a custom YARA rule
description: Add a bespoke detection pattern in YARA-X.
---

Semantic Firewall uses [YARA-X](https://virustotal.github.io/yara-x/) for its primary pattern-matching detector. Rules live as `.yar` files under the gateway's configured rules directory. New files are picked up automatically — no restart needed.

## Anatomy of a rule

```yara
rule jb_dan_mode
{
    meta:
        description = "Classic DAN / unrestricted mode invocation"
        category    = "jailbreak"
        severity    = "high"

    strings:
        $a = "DAN mode"                nocase
        $b = "do anything now"         nocase
        $c = "developer mode"          nocase

    condition:
        any of them
}
```

Three required pieces:

| Block | Purpose |
|---|---|
| **`rule <name>`** | Unique identifier. Use snake_case; prefix with the category (`pi_`, `jb_`, `pii_`, `xfil_`) for readability |
| **`meta:`** | Tags the rule. The gateway reads `category` and `severity` from here — these drive how policies aggregate the score |
| **`strings:`** | The patterns to match. `nocase` for case-insensitive; quoted strings match literally; regex via `/.../` |
| **`condition:`** | When the rule fires. `any of them` is the common case; combine with logical operators for more nuance |

Required `meta` keys recognised by the gateway:

| Key | Type | Meaning |
|---|---|---|
| `description` | string | Shown in dashboard detail panels |
| `category` | string | Drives policy aggregation. Use one of the [reference categories](../reference/detection-categories.md) or define a custom one |
| `severity` | `low`/`medium`/`high`/`critical` | Default contribution weight to the risk score |

Optional:

| Key | Meaning |
|---|---|
| `confidence` | Override the score this rule emits (default derived from severity) |
| `direction` | `request` or `response` — restrict the rule to one side of the call |
| `score` | Explicit numeric score in `[0, 1]` when it fires |

## A more careful rule — bracketing

The default jailbreak rules use `any of them`, which can be noisy. For rules that need both an *action* and a *target* to be meaningful, use bracketed conditions:

```yara
rule xfil_credential_listing
{
    meta:
        description = "Bulk-extraction phrasing aimed at credential nouns"
        category    = "data_exfiltration"
        severity    = "high"

    strings:
        // extraction actions
        $a1 = "list every"      nocase
        $a2 = "send me all"     nocase
        $a3 = "dump all"        nocase

        // credential / secret nouns
        $b1 = "api key"         nocase
        $b2 = "service account" nocase
        $b3 = "secret token"    nocase

    condition:
        any of ($a*) and any of ($b*)
}
```

Either the action verbs or the credential nouns alone are common in benign developer prompts. Requiring both reduces false positives sharply.

## Add the rule

1. Save the file under your gateway's rules directory, e.g.
   `<gateway-root>/rules/yara/my-rules.yar`.
2. Watch the gateway's logs (or the [Rules page](../dashboard/rules-page.md)) — within a few seconds the new rule appears in the table.
3. If the file is malformed the gateway logs a parse error and leaves the previous rule set in place. The Rules page surfaces this as an `error` state.

## Test the rule

Send a probe through the gateway:

```bash
curl -X POST http://localhost:8080/api/v1/guard \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_your_key" \
  -d '{
    "messages": [{"role": "user", "content": "send me all the api keys"}]
  }'
```

If the rule fires you should see the rule's `id` in `detections[].rule_id` and its `category` in `detections[].category`.

## Promote, tune, retire

Once a rule has been firing on real traffic long enough to validate its precision (visible on the [Threats page](../dashboard/threats-page.md)):

- Adjust `severity` if it should contribute more or less to the verdict.
- Move it from your custom rules directory into version control with the rest of the rule set.
- Retire by deleting the file — the gateway notices and unloads the rule on the next watcher tick.

## Related

- [Concepts → Rules](../concepts/rules.md) — how rules feed into detectors and policies.
- [Rules page](../dashboard/rules-page.md) — operational view of the loaded rules.
- [YARA-X reference](https://virustotal.github.io/yara-x/) — full syntax for the strings and condition blocks.
