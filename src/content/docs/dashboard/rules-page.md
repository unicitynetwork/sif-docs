---
title: Rules page
description: Browse, enable, and edit detection rules.
---

The Rules page (`/rules`) lists every rule currently loaded by the gateway and lets you toggle, edit metadata, and inspect each one. Rules are the atomic units of detection: YARA-X patterns, regex matchers, and PII / DLP definitions.

## What you see

### Rule table

| Column | Meaning |
|---|---|
| **ID** | The unique `id` field from the rule definition (e.g. `jb_dan_mode`) |
| **Name** | Human-readable name |
| **Category** | What the rule detects (e.g. `jailbreak`, `prompt_injection`, `data_exfiltration`, `pii`) |
| **Severity** | `low` / `medium` / `high` / `critical` |
| **Enabled** | Toggle — disabled rules are still loaded but skipped at evaluation time |
| **Source** | Whether the rule is built-in (shipped with the gateway) or custom (loaded from your rules directory) |

The page is backed by `GET /manage/rules`. The toggle calls `PATCH /manage/rules/{id}` with `{"enabled": true|false}`. Changes apply immediately — no restart.

### Filters

Filter by category and severity. Useful when triaging which rules are firing too often on the [Threats page](threats-page.md).

### Rule detail

Click a row to open the full rule definition. For YARA rules this shows the raw `.yar` source: `meta` block, `strings` section, and `condition`. For built-in rules the source is read-only; for custom rules you can edit the metadata fields.

## Editing rules

Editing from the dashboard is limited to:

- **Enabled / disabled** — single toggle, applies immediately
- **Severity** — affects how the rule contributes to the combined risk score
- **Notes** — free-form metadata for operators (not used by the detection engine)

The rule body (YARA strings + condition, regex pattern) cannot be edited from the dashboard. To author new rules or change rule logic, see [How-to → Write a custom YARA rule](../guides/write-a-custom-yara-rule.md).

## Hot reload

The rules directory is watched at runtime. Dropping a new `.yar` file into the configured rules path triggers a reload — the gateway parses it, validates it, and either accepts it (visible in the table within seconds) or rejects it (surfaced as an error event on the Overview page).

## Related pages

- [Concepts → Rules](../concepts/rules.md) — rule format and matching semantics.
- [How-to → Write a custom YARA rule](../guides/write-a-custom-yara-rule.md) — the authoring path.
- [Detectors page](detectors-page.md) — rules are evaluated *by* detectors; these two pages are siblings.
