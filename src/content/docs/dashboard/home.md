---
title: Home
description: What needs your attention, and the last 24 hours at a glance.
sidebar:
  order: 2
---

Home (`/`) is the console's landing screen. It leads with what needs doing rather
than with a wall of charts: an attention queue first, counters second.

It replaces the older Overview screen, which led with KPIs and a live threat feed.
If you are looking for the live feed, that is [Activity › Threats](activity-threats.md).

## Needs attention

The queue is derived from what the console can already see — it is not a separate
alerting system, and nothing here is configurable. An item appears when one of
these is true:

| Label | Raised when | Verb |
|---|---|---|
| **Expiring** | An API key expires within seven days, or has already expired | Rotate → |
| **Blocking** | A ruleset failed to compile, so its rules are not running | Fix the pack → |
| **Risk** | Only one active admin remains — losing it locks the deployment out | Promote another → |
| **Drifted** | A file-backed policy no longer matches the YAML it came from | Review → |

Each item states the consequence, not just the fact. An expired key says its calls
are *already* failing closed; a key expiring tomorrow says they *will*. Every item
links to the screen that fixes it.

An empty queue means nothing matched, which is the ordinary state.

## The counters

A period control sets the window for the strip: the counters and their comparisons
follow it.

| Counter | What it counts |
|---|---|
| Requests | Every request the guard decided on, in the window |
| Blocked | Requests refused |
| Acted on | Blocked, flagged and modified together — everything that was not simply allowed |
| p99 latency (all time) | The 99th-percentile decision latency |

**p99 does not follow the period.** The endpoint behind it takes no window, so the
figure is all-time whatever the period control says. Its label says so.

The trend figure beside a counter compares the two halves of the last 24 hours —
the most recent 12 against the 12 before them. It is labelled "vs previous 12h"
and means exactly that. The underlying aggregate holds 24 hours only, so a true
day-over-day comparison is not available.

## Where to go next

- Something is wrong with a key → [Fleet › Keys](fleet-keys.md)
- Something is wrong with a rule pack → [Guardrails › Rules](guardrails-rules.md)
- A policy has drifted → [Guardrails › Policies](guardrails-policies.md)
- Only one admin left → [Access › Users](access-users.md)
