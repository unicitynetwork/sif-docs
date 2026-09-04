---
title: Guardrails › Rulesets
description: Every ruleset the gateway loaded — what is in it, whether it runs, and whether it compiled.
sidebar:
  order: 9
---

Guardrails › Rulesets (`/guardrails/rulesets`) is the inventory. One row per
ruleset, and every verb that acts on a ruleset lives here.

**A ruleset is a named list of rules, and a rule is an object it points at.**
One rule may be in several rulesets at once, or in none — being in none is the
library, not an error. A ruleset is switched on or off as a whole.

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
last and then by score — with the verbs that change what is in it:

- **Add a rule** opens the New rule form with this ruleset already chosen.
- **Add an existing rule…** puts a rule that already exists somewhere else into
  this one. See [Reusing a rule](#reusing-a-rule) below.
- **New variant of a rule…** makes a stricter version of a rule without copying
  it. See [Reusing a rule](#reusing-a-rule) below.
- **Edit rule…** on a row opens the same editor the Rules tab uses: name,
  description, severity, score, tags and the match.
- **Remove from this ruleset…** takes the rule out of this ruleset and leaves
  the rule alone. A plain confirmation, no typing: the rule is not destroyed,
  every other ruleset holding it is untouched, and adding it back is one click.
- **Delete the rule…** destroys the rule itself, everywhere. **That** one arms
  only once you type the rule id, and it is refused while any ruleset still
  holds it — the refusal names them — or while any variant still takes its
  pattern from it.

The two are deliberately different verbs with different weights. Unlinking is
reversible and cheap; deleting is neither, and it reaches rulesets you may not
have open.

**Add a rule…** and **Add an existing rule…** are also on each row's ⋯ menu on
the list, so you can fill a ruleset without opening it.

A built-in's rules are listed and read-only: the file on disk owns them, and
every verb above says so rather than disappearing.

### Reusing a rule

**A rule is one object, and a ruleset points at it.** There is one row per
`rule_id` per tenant, and which rulesets hold it is a separate fact —
`PUT /manage/rulesets/{id}/rules` is the verb that sets it. So the same rule in
two rulesets is not two copies to keep in step. It is one rule, held twice, and
an edit to it shows up in both.

**Add an existing rule…** is that made deliberate. It writes a membership and
copies nothing — no id to re-type, no match to keep identical, nothing to drift.
A policy attaching both rulesets still sees the rule once.

**Want one ruleset to be stricter about it? That is a variant, not a copy.**
**New variant of a rule…** makes a rule with its own id, its own severity and
score, and *no pattern of its own* — it points at the rule it tightens and
borrows the pattern from there. Flattening keeps the strictest value of each
field, so a variant can only tighten, never loosen, and the pattern goes on
coming from the original, fixes included. A rule you want to give a *different
pattern* is simply a different rule: **Clone this rule…** on the Rules tab opens
the New rule form pre-filled from it, and you give it an id of its own.

A rule carries no action of its own, so there is nothing to override there — the
policy's thresholds turn a score into flag or block.

## Built-in rulesets

A built-in ruleset is owned by its file on disk and re-synced on every reload, so
it cannot be edited or deleted. The menu says so rather than hiding the verbs.

Its **rules**, though, are usable. A rule is a shared object, and a ruleset of
your own points at the very same row — so nothing about a built-in being
read-only stops you using what is in it.

- **Use these rules in a ruleset of yours…** is the lit item on a built-in's
  row menu, and the ordinary route. It writes a membership and copies nothing:
  the rule stays one object, the built-in goes on holding it too, and the
  pattern goes on receiving the fixes we ship. It needs `rules:author` and no
  more. With no ruleset of your own yet, it asks you to start one first and
  then offers the built-in's rules.
- **Tighten** a rule with **New variant of a rule…**. A variant is a rule of
  its own with its own id, its own score and severity, and no pattern — it
  points at the rule it tightens and borrows that. Flattening keeps the
  strictest value of each field while the pattern still comes from the shipped
  rule, so upstream fixes keep arriving. It cannot loosen anything. See
  [Write a custom rule](../guides/write-a-custom-rule.md).

**Cloning a built-in is not offered in the console.** It used to be, greyed
out, and that was the wrong answer twice over. A clone *forks*: the copies stop
receiving the updates we ship, which is the thing shared rules exist to
prevent. And it is platform-only for reasons that have not gone away — with
`disable_source` it retires a pack for **every** tenant, and the source row
belongs to no tenant, so the whole operation runs with row-level security
bypassed.

Retiring a pack is still a console verb: **Disable the ruleset**, on the same
menu and gated on the same platform role. What the clone added over it was
doing both halves — copy, then disable — in one transaction, with no window
where the pack is off and nothing has replaced it. That flow remains available
through the API.

**Clone the ruleset…** remains on rulesets *you* own, where it is
tenant-scoped, needs no platform role, and shares the rules rather than copying
them.

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

Deleting a ruleset removes the ruleset and its memberships. **The rules
themselves survive** — a rule is an object several rulesets may point at, so
destroying one holder cannot destroy the rule. Any rule this was the last holder
of stays on the Rules tab, held by nothing, and is yours to put in another
ruleset or delete outright.

Like every destructive verb on a named object, it arms only once you type the id
exactly. It is refused while a policy still attaches the ruleset, and the refusal
names the policies — see [Rulesets and
rules](../api/management-endpoints.md#rulesets-and-rules).

## Capabilities

Reading needs `rules:read`. Enabling, disabling and deleting — a ruleset or a
rule in one — need `rules:write`. Creating, cloning and editing, including
adding a rule to a ruleset and editing one in place, need `rules:author`, which
is granted to operators and admins. A built-in is the exception: its toggle
needs the platform role (`tenant:manage`), because the row belongs to every
tenant at once, and its clone is not offered in the console at all. Taking a
built-in's rules into a ruleset of your own is ordinary authoring — it writes a
membership in a ruleset you own and touches the built-in not at all — so it
needs `rules:author` and no more.

See also: [Guardrails › Rules](guardrails-rules.md),
[How the pieces fit](../concepts/how-the-pieces-fit.md),
[Write a custom rule](../guides/write-a-custom-rule.md).
