---
title: Guardrails › Rulesets
description: Every ruleset the gateway loaded — what is in it, whether it runs, and whether it compiled.
sidebar:
  order: 9
---

Guardrails › Rulesets (`/guardrails/rulesets`) is the inventory. One row per
ruleset, and every verb that acts on a ruleset lives here.

**A ruleset is the folder; a rule is a file in it.** A rule belongs to exactly
one ruleset, and a ruleset is switched on or off as a whole.

## How this differs from Rules

The two tabs split the work between them:

| | Rulesets | Rules |
|---|---|---|
| Answers | "What is loaded, and is it healthy?" | "Which rule did that, and can I change it?" |
| Row is | one ruleset | one rule, across every ruleset |
| Owns | create, clone, edit, enable, disable, delete | enable, disable, override, edit a rule |
| Never | lists individual rules | acts on a ruleset |

Neither tab is a prerequisite for the other. The rule count on a row opens the
Rules tab filtered to that ruleset, and the Rules tab carries its own **Ruleset**
filter — so you never have to come here just to narrow a list.

## Two states you can only see here

The Rules tab builds its table out of rules, so a ruleset with no rows in it
cannot appear there at all:

- **Empty.** A ruleset you just made, with nothing in it yet. Health says
  "Empty — add a rule".

Before this screen existed, it was invisible, and its verbs were unreachable.

The other state is not a ruleset's at all: **failed composition**. Compilation
belongs to the tenant's rules as a whole, and the API reports the same status on
every row at once — so this tab shows one tenant-level banner, never a
per-ruleset verdict. While it lasts, every enabled and populated row's health
reads "Not in effect": the tenant is serving its previous compiled
configuration — or the shared baseline, if there was none — and nothing saved
since the last good composition is being evaluated. The banner carries the
compiler's message verbatim, which names the rule at fault.

## The columns

| Column | What it says |
|---|---|
| Ruleset | The id, and its description |
| Source | **Built-in** (a file we ship) or **Yours** (stored in the database) |
| Rules | How many. A link to the Rules tab, filtered — unless it is nought |
| Overrides | How many of its rules carry an override |
| State | On or off. Off means nothing in it runs |
| Health | In force, not in effect, empty, or off |

Ordered off first, then by name — what needs a human, first.

## Ruleset detail

Selecting a ruleset opens it at `?id=<ruleset_id>`, which is a real URL you can
link to or bookmark. It carries the source, version, state, health, rule count,
override count and tags.

**A failed composition shows the same banner here as on the list.** One
ruleset's detail is the wrong place to lay a tenant-wide fault, but the warning
is worth seeing wherever you are looking.

## Built-in rulesets

A built-in ruleset is owned by its file on disk and re-synced on every reload, so
it cannot be edited or deleted. The menu says so rather than hiding the verbs.

Two ways to change what a built-in does:

- **Override** a single rule — its severity or score. Stored against the names,
  so a re-sync cannot wipe it. See [Rule detail](guardrails-rule-detail.md).
- **Clone** the whole ruleset. You get an editable copy you own, and it lands
  in this tenant. Cloning a built-in — like switching one on or off — is a
  platform action: the row is shared by every tenant, so the server refuses it
  for tenant roles and the menu says so. Disabling the original is a global
  change, which is why the clone dialog leaves it on by default and names the
  blast radius; a tenant wanting its own posture takes the copy and tunes it,
  leaving everyone else's detection alone.

## New ruleset

**New ruleset** sits beside the tabs. It needs an id and a version; description
and tags are optional.

**A new ruleset is enabled straight away.** That is harmless while it is empty,
but the first rule you add starts firing on the next reload. Disable it first if
you want to build it quietly.

Creating a ruleset also appears on the **New rule** screen, for the case where
you have no editable ruleset and need one before you can go any further. That is
the one thing deliberately in two places — a list is not.

## Deleting

Deleting a ruleset takes its rules with it, and the confirm names how many. Like
every destructive verb on a named object, it arms only once you type the id
exactly.

## Capabilities

Reading needs `rules:read`. Enabling, disabling and deleting need `rules:write`.
Creating, cloning and editing need `rules:author`, which is granted to admins
only. A built-in is the exception on both sides of that split: its toggle and
its clone need the platform role (`tenant:manage`), because the row belongs to
every tenant at once.

See also: [Guardrails › Rules](guardrails-rules.md),
[How the pieces fit](../concepts/how-the-pieces-fit.md),
[Write a custom rule](../guides/write-a-custom-rule.md).
