---
title: Guardrails › Policies
description: Edit how detector outputs become verdicts, and control which version is running.
sidebar:
  order: 6
---

Guardrails › Policies (`/guardrails/policies`) is where detector outputs become
verdicts. Every call resolves its policies from the caller's agent class, or from
the `policy_id` it names, so a policy is the answer to
"what happens when this caller trips a detector?"

The screen is a list on the left and an editor panel on the right. The panel always
shows the policy the list has selected, read fresh — so after a save or a mode
change it shows what the server now holds, not what you opened it with.

## Rollout mode

Three settings, and they are the first thing to get right:

| Mode | What the guard does |
|---|---|
| `off` | The policy does not run |
| `monitor` | Detections are recorded; nothing is blocked |
| `enforce` | Detections act — blocked, flagged or modified per the thresholds |

Mode is identity-level: changing it does not mint a new version. Move a policy to
`monitor` first when you are tuning it, watch [Activity › Threats](activity-threats.md)
for what it *would* have done, then promote it.

## Thresholds

A detector returns a score. The thresholds decide what that score means:

- **Block threshold** — a rule scoring this or higher is blocked
- **Flag threshold** — recorded, but allowed through

Both live in the `0`–`1` range. The fields accept a decimal point as you type it,
so `0.85` is reachable a keystroke at a time.

**Fail mode** decides what happens when the engine cannot reach a verdict — a
timeout, a crash, a model that will not load:

- `closed` — refuse the request. Safe, and it means an outage stops traffic.
- `open` — allow it through. Traffic survives an outage; nothing is checked while
  it lasts.

## Versions

A policy has a version history. The panel's `⋯` menu opens **Version history…**,
which separates three things:

- **Drafts** — saved, not published. The engine is not running these.
- **The current version** — what is actually in force.
- **Superseded** — published once, since replaced.

**In force** means the engine is running it. A draft ahead of the published version
is shown as such: you have edited the policy, and the change is not live until you
publish.

| Verb | Effect |
|---|---|
| View | Read a version without switching to it |
| Publish | Make a version the one in force |
| Discard | Delete a draft |

Publishing an earlier version is how you roll back. It does not delete anything —
the version you were on becomes superseded.

## The dirty bar

While the editor differs from the saved policy, a bar names which fields have
changed and states that nothing runs until you save. It clears when the save lands
and the panel re-reads the server's copy — so an empty bar after a save means the
save worked, not that it was lost.

## The rest of the fields

**Every field…** opens the full editor, including the execution plan and per-detector
configuration as JSON. The panel shows the decisions worth making; nothing became
unreachable when the table went.

**Download YAML** exports the policy. Import is not available from the console —
file-backed policies are loaded from disk by the gateway.

## Drift

A file-backed policy can drift from the YAML it came from — someone edited it
through the API, or the file changed underneath. Drifted policies are surfaced on
[Home](home.md) with a Review verb.

## Narrowing the list

Above the list are three filters — **Active**, **Archived** and **All** — each
carrying its own count, plus a search box that matches on name and Policy ID.
**Active** is the default.

Archived policies are fetched even when they are not shown, because each one
still holds its Policy ID and a refused ID whose holder is invisible was the
whole of the problem. So when the Active filter is hiding archived rows, the
empty state says how many, and points at **Archived**. An archived row that is
on screen is marked `· archived`.

Opening a link to an archived policy widens the filter for you, rather than
selecting a row the filter then hides.

## Archiving and deleting

Which of the two you get depends on whether the policy has ever been published,
and the menu says which before you commit to it:

| The policy | Menu item | What happens |
|---|---|---|
| Has a published version | **Archive policy…** | It stops running and is kept for the audit trail. Its Policy ID stays taken; a new policy may reuse the *name*. You can restore it later |
| Was never published | **Delete policy…** | It is removed outright and its Policy ID is freed. This cannot be undone |

Both ask you to type the **Policy ID** — not the name — to arm the button. A
published version records what was in force at the time, and the database
refuses to delete one, which is why archiving exists at all: there is no purge.

A policy bound to keys cannot simply vanish; move those keys to another policy
first. The default policy cannot be archived or deleted — make another the
default first.

## Restoring

An archived policy's `⋯` menu offers **Restore policy**, and the editor panel
shows an **Archived** banner with the same verb. Restoring puts it back in force
at the version it left on.

Until then the server refuses every change to an archived policy, so its editor
fields are disabled rather than accepting edits that would fail on save. An
archived policy also cannot be made the default; restore it first.

## Capabilities

Reading needs `policy:read`; editing, publishing, archiving, deleting and
restoring need `policy:write`.

See also: [Policies](../concepts/policies.md),
[Tune a policy threshold](../guides/tune-a-policy-threshold.md).
