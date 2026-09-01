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

## Deleting

**Delete policy…** asks you to type the policy's name first. A policy bound to keys
cannot simply vanish; move those keys to another policy first.

## Capabilities

Reading needs `policy:read`; editing, publishing and deleting need `policy:write`.

See also: [Policies](../concepts/policies.md),
[Tune a policy threshold](../guides/tune-a-policy-threshold.md).
