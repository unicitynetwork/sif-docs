---
title: Rule detail
description: One rule — what it matches, what it would do, and how to override it.
sidebar:
  order: 8
---

Opening a rule from [Guardrails › Rules](guardrails-rules.md) gives it a URL of its
own:

```
/guardrails/rules/{pack}/{rule}
```

Bookmarkable and linkable, which is what you want when a rule comes up in an
incident review.

## What it shows

The rule's pattern, its category, and its effective severity and score — effective
meaning after any override, because that is what the engine uses.

## The derived action

The screen states what this rule *would* do: **Block**, **Flag**, or neither. That
is not a property of the rule. It is the rule's score read against the thresholds
of the policy that would run it, including any category-specific override.

Where no rule-engine configuration applies, the action shows as `—` with a tooltip
explaining why, rather than guessing.

## Overriding

**Override severity** and **Override score** change what the engine uses without
editing the pack. Save, and the new values are effective immediately.

**Reset override** removes it, returning the rule to what the pack ships.

## Testing it

**Tester** hands the rule to [Guardrails › Tester](guardrails-tester.md) so you can
put a prompt through it and see the verdict. The tester uses a guard API key held
in `sessionStorage` for the tab.

## Capabilities

Reading needs `rules:read`; setting and resetting an override needs `rules:author`.

If the rules cannot be read, the screen says so and names the capability, rather
than reporting that the rule may have been removed.
