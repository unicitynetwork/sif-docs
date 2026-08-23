---
title: Fleet › Agents
description: The classes of software calling the guard, and the keys bound to each.
sidebar:
  order: 3
---

Fleet › Agents (`/fleet/agents`) groups your API keys by **agent class** — a label
saying what kind of software holds the key, rather than which individual key it is.

A class is how you answer "what has our summarisation service been doing?" without
first working out which four keys that service happens to hold.

## Why a class and not just a key

Keys are operational: they get rotated, split, replaced. A class outlives them. If
`payments-bot` rotates its key every 30 days, a question asked about the key spans
30 days; the same question asked about the class spans the whole history.

The class is recorded on every audit row at the moment of the call, so it is
durable even after the key that carried it is gone.

## What you see

One row per class: the class name, how many keys carry it, and links into the other
sections filtered to that class.

Keys with no class are grouped as unassigned. Assigning one is the only edit this
screen makes.

## Assigning a class

Pick a class for a key and save. The binding lives on the key record, so it applies
to every call that key makes from then on. It is not retroactive: audit rows already
written keep whatever class they were written with, which is what makes the trail
worth reading.

## Following a class into the trail

The row links through to [Activity › Audit](activity-audit.md) filtered to that
class. The audit log carries a first-class `agent_class` filter — this is not the
same attribute as an app ID, which is free text set per key.

You can construct the same view by hand:

```
/activity/audit?agent_class=payments-bot
```

## Capabilities

Reading needs `apikey:read`; assigning a class needs `apikey:manage`. Without the
read capability the screen says the keys could not be read, rather than claiming
nothing is calling the guard.
