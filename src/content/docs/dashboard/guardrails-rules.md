---
title: Guardrails › Rules
description: Browse, filter and tune the detection rules the engine runs.
sidebar:
  order: 7
---

Guardrails › Rules (`/guardrails/rules`) lists every rule loaded by the gateway.
Rules are the atomic units of detection: YARA-X patterns, regex matchers, and
PII/DLP definitions. Rules live in **rulesets**, and a ruleset can be built-in or
one you author.

This tab is for finding a rule. Managing the rulesets themselves — creating,
enabling, deleting — is [Guardrails › Rulesets](guardrails-rulesets.md).

## The counters

| Counter | What it counts |
|---|---|
| Rules in force | Rules that can actually fire |
| Turned off | The rest of the loaded rules |
| Customised | Rules in rulesets you authored, rather than built-in ones |

**"In force" means the rule can fire, which needs two things**: the rule itself
enabled, *and* the ruleset it lives in enabled. The engine drops a disabled ruleset
whole, so a rule that is on inside a ruleset that is off cannot fire. The row says
`Off` in that case, and its tooltip names the ruleset as the reason.

This matters when you clone a ruleset to modify it: if you leave the original enabled,
both run, and detections are counted twice.

## The list

Ordered so that what can fire comes first, then by score — the caption says "off
rules last, then by score". Filter chips narrow to all, in force, off or built-in.
The chips and the counters agree about what "on" means.

## Narrowing to one ruleset

The **Ruleset** menu on the left of the filter bar narrows the table to a single
ruleset. It reads scope first, then state.

It is a menu rather than a chip per ruleset because the state chips are a fixed
set of four and rulesets are not — six today, thirty on a busy tenant.

Picking one writes `?ruleset=<id>` to the URL, which is the same address the
Rulesets tab links to when you click a rule count. **One piece of state, two
doors** — you can start on either tab.

While the filter is on, the **Ruleset** column disappears: every row would repeat
the one word the bar above already says. Clear the filter and it comes back.

## Retuning a built-in

A built-in ruleset is owned by its file and cannot be edited in place. There is no
per-rule override to set beside it either: a built-in rule is as shipped, or it is
switched off, or it is not attached. There is no "customised in place" state, which
is why a ruleset reads only ever as **Built-in** or **Custom**.

To use a shipped rule, add it to a ruleset of your own — it stays one rule,
shared, so the pattern goes on receiving the fixes we ship. To make it stricter,
author a **variant**: its own id and its own score and severity, borrowing the
pattern from the rule it tightens. Only changing what the rule *matches* needs a
pattern of your own. See
[Write a custom rule](../guides/write-a-custom-rule.md).

## The row menu

A rule's `⋯` menu carries rule verbs: enable or disable it, and — where the
ruleset is one you own — edit or delete it. A built-in says **Cannot edit in
place** with the reason, rather than hiding the verb, and the reason names where
to go instead.

Also there:

- **Clone this rule…**, which copies one rule into a ruleset you own. It needs
  `rules:author` and nothing more.
- **Open the ruleset**, which takes you to that ruleset's detail — where
  **Use these rules in a ruleset of yours…** and **New variant of a rule…**
  live.

**Clone the ruleset to edit** used to sit here, on a built-in, and is gone. It
was greyed out for everyone but the platform role, and it forks — the copies
stop receiving the updates we ship. The two verbs named above do the job it was
standing in for, without the fork and without the platform role.

Every other ruleset verb — enable, disable, edit, delete — lives on
[Guardrails › Rulesets](guardrails-rulesets.md). One list per concept.

## Compile failures

Compilation is the tenant's, not one ruleset's: a bad rule fails the whole
composition, and nothing saved since the last good one runs. Home surfaces it as
one **Blocking** item, and the compiler's message is on the Rulesets tab's
banner — see [Guardrails › Rulesets](guardrails-rulesets.md). A failed
composition is not a degraded state; it is a hole.

## New rule

**New rule** is a route, not a form on this screen: a rule needs a ruleset to live in,
and explaining that is a screen's worth of work. Without `rules:author` the control
is disabled and says which capability it wants — it is not reachable by keyboard
either, so you cannot land on a form that will refuse you at the end.

## Capabilities

Reading needs `rules:read`. Enabling or disabling a rule in one of your own
rulesets, and deleting one, need `rules:write`; authoring rules and rulesets
needs `rules:author`, which operators and admins both hold. Toggling a built-in
rule needs the platform role (`tenant:manage`), because the row belongs to every
tenant at once.

See also: [Guardrails › Rulesets](guardrails-rulesets.md),
[Rules](../concepts/rules.md),
[Write a custom rule](../guides/write-a-custom-rule.md),
[Write a custom YARA rule](../guides/write-a-custom-yara-rule.md).
