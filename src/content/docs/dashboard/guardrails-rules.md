---
title: Guardrails › Rules
description: Browse, filter and tune the detection rules the engine runs.
sidebar:
  order: 7
---

Guardrails › Rules (`/guardrails/rules`) lists every rule loaded by the gateway.
Rules are the atomic units of detection: YARA-X patterns, regex matchers, and
PII/DLP definitions. Rules live in **packs** (rulesets), and a pack can be built-in
or one you author.

## The counters

| Counter | What it counts |
|---|---|
| Rules in force | Rules that can actually fire |
| Turned off | The rest of the loaded rules |
| Customised | Rules carrying an override |

**"In force" means the rule can fire, which needs two things**: the rule itself
enabled, *and* the pack it lives in enabled. The engine drops a disabled pack
whole, so a rule that is on inside a pack that is off cannot fire. The row says
`Off` in that case, and its tooltip names the pack as the reason.

This matters when you clone a pack to modify it: if you leave the original enabled,
both run, and detections are counted twice.

## The list

Ordered so that what can fire comes first, then by score — the caption says "off
rules last, then by score". Filter chips narrow to on, off, overridden or built-in.
The chips and the counters agree about what "on" means.

## Overrides

A built-in pack is owned by its file and cannot be edited in place. What you can do
is **override** a rule: change its severity or score without touching the pack.

The override is what the engine uses. The rule's own values stay as shipped, so an
upgrade to the pack does not silently discard your tuning — and you can always see
what the original said.

Open a rule to set one. See [Rule detail](guardrails-rule-detail.md).

## Packs

A pack's own menu can enable or disable it wholesale, and remove packs you own. A
rule's pattern can be edited where the pack allows it.

Disabling a pack stops everything in it. That is the fastest way to silence a noisy
detection source, and the counters will reflect it immediately.

## Compile failures

If a pack fails to compile, none of its rules run. This is surfaced on
[Home](home.md) as a **Blocking** item, because a pack that will not compile is not
a degraded state — it is a hole.

## New rule

**New rule** is a route, not a form on this screen: a rule needs a pack to live in,
and explaining that is a screen's worth of work. Without `rules:author` the control
is disabled and says which capability it wants — it is not reachable by keyboard
either, so you cannot land on a form that will refuse you at the end.

## Capabilities

Reading needs `rules:read`; overrides and pack toggles need `rules:write`;
authoring rules and packs needs `rules:author`.

See also: [Rules](../concepts/rules.md),
[Write a custom rule](../guides/write-a-custom-rule.md),
[Write a custom YARA rule](../guides/write-a-custom-yara-rule.md).
