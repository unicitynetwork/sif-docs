---
title: Rule detail
description: One rule — what it matches, what it would do, and how to test it.
sidebar:
  order: 8
---

Opening a rule from [Guardrails › Rules](guardrails-rules.md) gives it a URL of its
own:

```
/guardrails/rules/{ruleset}/{rule}
```

Bookmarkable and linkable, which is what you want when a rule comes up in an
incident review.

## What it shows

Two panels. **What it matches** renders the rule's match spec through the same
editor used to author one, read-only — the ruleset owns the content, so nothing
here is editable, on a built-in or on your own. Below it, a line naming the
detector the rule configures, linking through to it.

The header carries the rule's name, its ruleset and version, its severity, the
derived action, and whether it is `Off`.

## The derived action

The screen states what this rule *would* do: **Block**, **Flag**, or neither. That
is not a property of the rule. It is the rule's score read against the thresholds
of the policy that would run it, including any category-specific override.

Where no rule-engine configuration applies, the action shows as `—` with a tooltip
explaining why, rather than guessing.

## Changing it

Nothing on this screen changes the rule. There is no per-rule override — a rule
owns its score and severity, and a different value means a different rule. To
make a shipped rule stricter, author one with the same id in a ruleset of your
own; see [Write a custom rule](../guides/write-a-custom-rule.md). Enabling,
disabling, editing and deleting live on the row menu in
[Guardrails › Rules](guardrails-rules.md).

## Testing it

**Try it** puts a prompt through the live guard from this screen and says whether
*this* rule fired, then what else caught it. It needs a guard API key — paste one
on [Guardrails › Tester](guardrails-tester.md) and it is held in `sessionStorage`
for the tab.

## Capabilities

Reading needs `rules:read`. The screen makes no writes.

If the rules cannot be read, the screen says so and names the capability, rather
than reporting that the rule may have been removed.
