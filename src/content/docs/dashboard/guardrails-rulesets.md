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
| Owns | create, clone, edit, enable, disable, delete; and what is inside one ruleset | enable, disable, edit, delete a rule, anywhere |
| Never | lists rules from more than one ruleset at a time | acts on a ruleset |

Neither tab is a prerequisite for the other. The rule count on a row opens the
Rules tab filtered to that ruleset, and the Rules tab carries its own **Ruleset**
filter — so you never have to come here just to narrow a list.

The flat list is the one that searches across everything; this tab is where a
ruleset is **authored**, so the rules of the one you have open are listed and
editable here.

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
| State | On or off. Off means nothing in it runs |
| Health | In force, not in effect, empty, or off |

Ordered off first, then by name — what needs a human, first.

## Ruleset detail

Selecting a ruleset opens it at `?id=<ruleset_id>`, which is a real URL you can
link to or bookmark. It carries the source, version, state, health, rule count
and tags.

**A failed composition shows the same banner here as on the list.** One
ruleset's detail is the wrong place to lay a tenant-wide fault, but the warning
is worth seeing wherever you are looking.

## Rules in this ruleset

Below the detail is the ruleset's own rule table — every rule it holds, off
last and then by score — with the four verbs that change what is in it:

- **Add a rule** opens the New rule form with this ruleset already chosen.
- **Add an existing rule…** puts a rule that already exists somewhere else into
  this one. See [Reusing a rule](#reusing-a-rule) below.
- **Edit rule…** on a row opens the same editor the Rules tab uses: name,
  description, severity, score, tags and the match.
- **Remove the rule…** deletes that rule from this ruleset. It arms only once
  you type the rule id. Another ruleset carrying the same id keeps its own copy
  — see below.

**Add a rule…** and **Add an existing rule…** are also on each row's ⋯ menu on
the list, so you can fill a ruleset without opening it.

A built-in's rules are listed and read-only: the file on disk owns them, and
every verb above says so rather than disappearing.

### Reusing a rule

The same `rule_id` in two rulesets is a supported arrangement, not a mistake:
the unique index is on `(ruleset_id, rule_id)`, so both rows exist, and a policy
attaching both flattens them into a **single** rule with the strictest score and
severity of the two. **Add an existing rule…** is that arrangement made
deliberate — it copies the id and the match across verbatim, and lets you set
this ruleset's severity and score for it.

The match must stay identical. If two rulesets carry the same id with different
patterns, only the defining occurrence's pattern runs and nothing reports the
other, which is why the match is not editable in that dialog. A rule you want to
*change* rather than share is a clone: **Clone this rule…** on the Rules tab
gives it a new id and no merge.

A rule carries no action of its own, so there is nothing to override there — the
policy's thresholds turn a score into flag or block.

## Built-in rulesets

A built-in ruleset is owned by its file on disk and re-synced on every reload, so
it cannot be edited or deleted. The menu says so rather than hiding the verbs.

Two ways to change what a built-in does:

- **Tighten** a rule by authoring one with the same id in a ruleset of your own
  and attaching both to the policy. Flattening keeps the strictest value of each
  field while the pattern still comes from the shipped ruleset, so upstream fixes
  keep arriving. It cannot loosen anything. See
  [Write a custom rule](../guides/write-a-custom-rule.md).
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

## The id is the name, and it is permanent

A ruleset has no display name. `ruleset_id` is its identity: policies attach it
by that id, every rule in it hangs off it, and the API's update accepts only
description, tags and `enabled` — so there is no rename, on this screen or any
other. **Edit the ruleset…** says so where you would go looking for one.

The way to a differently named ruleset is **Clone it under another id…**, in the
edit dialog and on the row menu: it carries the rules across under an id you
choose, and you then delete or disable the old one.

## Deleting

Deleting a ruleset takes its rules with it, and the confirm names how many. Like
every destructive verb on a named object, it arms only once you type the id
exactly.

## Capabilities

Reading needs `rules:read`. Enabling, disabling and deleting — a ruleset or a
rule in one — need `rules:write`. Creating, cloning and editing, including
adding a rule to a ruleset and editing one in place, need `rules:author`, which
is granted to operators and admins. A built-in is the exception on both sides of that split: its toggle and
its clone need the platform role (`tenant:manage`), because the row belongs to
every tenant at once.

See also: [Guardrails › Rules](guardrails-rules.md),
[How the pieces fit](../concepts/how-the-pieces-fit.md),
[Write a custom rule](../guides/write-a-custom-rule.md).
